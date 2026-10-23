"""AI Learning Agent - Flask + SQLite backend. Serves the frontend and a JSON API."""
import hmac, json, os, random, sqlite3, time
from functools import wraps
from flask import Flask, g, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

BASE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(BASE, 'data.db')
TOPICS = ['pc', 'tw', 'sp', 'sr', 'bl', 'cd']
TEACHER_CODE = os.environ.get('TEACHER_CODE', 'TEACH123')
with open(os.path.join(BASE, 'questions.json'), encoding='utf-8') as f:
    QS = json.load(f)

app = Flask(__name__, static_folder=os.path.join(BASE, '..', 'frontend'), static_url_path='')


def _secret():
    if os.environ.get('SECRET_KEY'):
        return os.environ['SECRET_KEY']
    p = os.path.join(BASE, 'secret.key')
    if not os.path.exists(p):
        with open(p, 'w') as fh:
            fh.write(os.urandom(24).hex())
    with open(p) as fh:
        return fh.read()


app.secret_key = _secret()
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='Lax')


# ---------- database ----------
def db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_):
    d = g.pop('db', None)
    if d:
        d.close()


def blank():
    return {'m': {t: 0.1 for t in TOPICS}, 'n': {t: 0 for t in TOPICS},
            'c': {t: 0 for t in TOPICS}, 'h': [], 'last': None}


def init_db():
    c = sqlite3.connect(DB)
    c.executescript('''
      CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, pw_hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS progress(user_id INTEGER PRIMARY KEY REFERENCES users(id), data TEXT NOT NULL);''')
    if not c.execute('SELECT 1 FROM users').fetchone():  # demo accounts on first run
        cur = c.execute('INSERT INTO users(username,name,role,pw_hash) VALUES(?,?,?,?)',
                        ('demo', 'Demo Student', 'student', generate_password_hash('demo123')))
        c.execute('INSERT INTO users(username,name,role,pw_hash) VALUES(?,?,?,?)',
                  ('teacher', 'Demo Teacher', 'teacher', generate_password_hash('teach123')))
        now, day = int(time.time() * 1000), 86400000
        p = blank()
        p['m'] = {'pc': .55, 'tw': .3, 'sp': .45, 'sr': .75, 'bl': .2, 'cd': .6}
        p['n'] = {'pc': 6, 'tw': 5, 'sp': 5, 'sr': 6, 'bl': 4, 'cd': 6}
        p['c'] = {'pc': 4, 'tw': 2, 'sp': 3, 'sr': 5, 'bl': 1, 'cd': 4}
        p['h'] = [{'d': now - 6 * day, 'mode': 'Mock test', 's': 5, 't': 12},
                  {'d': now - 4 * day, 'mode': 'Practice', 's': 6, 't': 10},
                  {'d': now - 2 * day, 'mode': 'Practice', 's': 7, 't': 10},
                  {'d': now - day, 'mode': 'Mock test', 's': 8, 't': 12}]
        c.execute('INSERT INTO progress VALUES(?,?)', (cur.lastrowid, json.dumps(p)))
    c.commit()
    c.close()


init_db()


def load(uid):
    r = db().execute('SELECT data FROM progress WHERE user_id=?', (uid,)).fetchone()
    return json.loads(r['data']) if r else blank()


def store(uid, p):
    db().execute('INSERT OR REPLACE INTO progress(user_id,data) VALUES(?,?)', (uid, json.dumps(p)))
    db().commit()


# ---------- the learning agent ----------
def level(m):
    return 1 if m < .4 else 2 if m < .7 else 3


def apply_answer(p, qi, sel):
    """Student model update: correct raises mastery, wrong lowers it."""
    q = QS[qi]
    t, ok = q['t'], sel == q['a']
    p['n'][t] += 1
    if ok:
        p['c'][t] += 1
        p['m'][t] += .25 * (1 - p['m'][t])
    else:
        p['m'][t] *= .8
    return ok


def valid_item(x):
    try:
        qi, sel = int(x['qi']), int(x['sel'])
    except (KeyError, TypeError, ValueError):
        return None
    if 0 <= qi < len(QS) and -1 <= sel < len(QS[qi]['o']):
        return {'qi': qi, 'sel': sel}
    return None


# ---------- auth ----------
def need(role=None):
    def deco(fn):
        @wraps(fn)
        def wrap(*a, **k):
            uid = session.get('uid')
            u = db().execute('SELECT id,username,name,role FROM users WHERE id=?', (uid,)).fetchone() if uid else None
            if not u:
                return jsonify(error='Please log in.'), 401
            if role and u['role'] != role:
                return jsonify(error='Not allowed.'), 403
            g.user = u
            return fn(*a, **k)
        return wrap
    return deco


def user_json(u):
    return {'username': u['username'], 'name': u['name'], 'role': u['role']}


@app.post('/api/signup')
def signup():
    j = request.get_json(silent=True) or {}
    name = str(j.get('name', '')).strip()[:60]
    un = str(j.get('username', '')).strip().lower()[:30]
    pw, role = str(j.get('password', '')), j.get('role', 'student')
    if not name or len(un) < 3 or len(pw) < 6:
        return jsonify(error='Enter your name, a username of 3+ characters and a password of 6+ characters.'), 400
    if role not in ('student', 'teacher'):
        return jsonify(error='Choose student or teacher.'), 400
    if role == 'teacher' and not hmac.compare_digest(str(j.get('code', '')).strip().upper(), TEACHER_CODE.upper()):
        return jsonify(error='Teacher code is incorrect.'), 403
    try:
        cur = db().execute('INSERT INTO users(username,name,role,pw_hash) VALUES(?,?,?,?)',
                           (un, name, role, generate_password_hash(pw)))
        db().commit()
    except sqlite3.IntegrityError:
        return jsonify(error='That username is taken. Choose another.'), 409
    session.clear()
    session['uid'] = cur.lastrowid
    return jsonify(username=un, name=name, role=role)


@app.post('/api/login')
def login():
    j = request.get_json(silent=True) or {}
    u = db().execute('SELECT * FROM users WHERE username=?', (str(j.get('username', '')).strip().lower(),)).fetchone()
    if not u or not check_password_hash(u['pw_hash'], str(j.get('password', ''))):
        return jsonify(error='Wrong username or password. Check both and try again.'), 401
    session.clear()
    session['uid'] = u['id']
    return jsonify(user_json(u))


@app.post('/api/logout')
def logout():
    session.clear()
    return jsonify(ok=True)


@app.get('/api/me')
@need()
def me():
    return jsonify(user_json(g.user))


# ---------- learning API ----------
@app.get('/api/questions')
@need()
def questions():
    return jsonify(QS)


@app.get('/api/progress')
@need()
def progress():
    return jsonify(load(g.user['id']))


@app.get('/api/next')
@need('student')
def next_question():
    p = load(g.user['id'])
    t = min(TOPICS, key=lambda x: p['m'][x])  # weakest topic
    lv = level(p['m'][t])
    recent = {int(x) for x in request.args.get('recent', '').split(',') if x.strip().isdigit()}
    pool = [i for i, q in enumerate(QS) if q['t'] == t and abs(q['l'] - lv) <= 1 and i not in recent]
    pool = pool or [i for i, q in enumerate(QS) if q['t'] == t]
    return jsonify(qi=random.choice(pool))


@app.post('/api/answer')
@need('student')
def answer():
    it = valid_item(request.get_json(silent=True) or {})
    if not it:
        return jsonify(error='Invalid answer.'), 400
    p = load(g.user['id'])
    ok = apply_answer(p, it['qi'], it['sel'])
    store(g.user['id'], p)
    return jsonify(correct=ok, progress=p)


@app.post('/api/session')
@need('student')
def finish_session():
    j = request.get_json(silent=True) or {}
    items = [valid_item(x) for x in (j.get('items') or [])[:50] if isinstance(x, dict)]
    if not items or None in items or j.get('mode') not in ('Practice', 'Mock test'):
        return jsonify(error='Invalid session.'), 400
    p = load(g.user['id'])
    if j.get('apply'):  # mock test: mastery is updated now. Practice already updated per answer.
        for x in items:
            apply_answer(p, x['qi'], x['sel'])
    now = int(time.time() * 1000)
    s = sum(1 for x in items if x['sel'] == QS[x['qi']]['a'])
    p['h'] = (p['h'] + [{'d': now, 'mode': j['mode'], 's': s, 't': len(items)}])[-50:]
    p['last'] = {'mode': j['mode'], 'd': now, 'items': items}
    store(g.user['id'], p)
    return jsonify(progress=p)


@app.get('/api/class')
@need('teacher')
def class_overview():
    out = []
    for u in db().execute("SELECT id,name FROM users WHERE role='student' ORDER BY name").fetchall():
        p = load(u['id'])
        tot, cor = sum(p['n'].values()), sum(p['c'].values())
        last = p['h'][-1] if p['h'] else None
        out.append({'name': u['name'], 'sessions': len(p['h']), 'answers': tot,
                    'accuracy': round(100 * cor / tot) if tot else 0,
                    'mastery': round(100 * sum(p['m'].values()) / len(TOPICS)),
                    'weakest': min(TOPICS, key=lambda t: p['m'][t]) if tot else None,
                    'last': {'pct': round(100 * last['s'] / last['t']), 'mode': last['mode']} if last else None})
    return jsonify(out)


@app.get('/')
def home():
    return app.send_static_file('index.html')


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=int(os.environ.get('PORT', 5000)), debug=os.environ.get('FLASK_DEBUG') == '1')
