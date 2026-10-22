# AI Learning Agent – Personalized Learning for Rural Students

Adaptive aptitude practice (Quantitative + Logical Reasoning) for BE students.
Python Flask backend with SQLite, real login, server-side learning agent, results, step-by-step progress and a teacher view.

## Quick start (3 steps)
Needs Python 3.9+ (https://www.python.org/downloads/ . On Windows, tick "Add Python to PATH" while installing).

1. Unzip, then in VS Code choose File > Open Folder and select the `ai-learning-agent` folder.
   VS Code will suggest the Python extension. Click Install.
2. Start the project. Pick ONE way:
   - Windows: double-click `start.bat`. It sets everything up and opens the browser.
   - Mac/Linux: run `./start.sh` in the VS Code terminal.
   - VS Code only: Terminal > Run Task > "1. Install requirements" (first time only), then press F5.
3. Open http://127.0.0.1:5000 and log in with a demo account below.

Stop the server with Ctrl+C in the terminal (or the red square when using F5).
Manual commands: `cd backend`, `pip install -r requirements.txt`, `python app.py`.

## Demo logins
- Student: `demo` / `demo123` (has sample history)
- Teacher: `teacher` / `teach123`
- Sign up creates new accounts. Teacher sign-up needs the code `TEACH123` (change it with the TEACHER_CODE environment variable).

## Architecture
```
Browser (frontend/*.html, app.js)  <--JSON over HTTP-->  Flask API (backend/app.py)  <-->  SQLite (data.db)
```
- Passwords are hashed (werkzeug). Login uses a signed, HttpOnly session cookie. Teacher routes are role-protected.
- The student model and question picking run on the server. The browser only sends answers.

| Endpoint | Who | Purpose |
|---|---|---|
| POST /api/signup, /api/login, /api/logout, GET /api/me | all | accounts |
| GET /api/questions | logged in | question bank (backend/questions.json) |
| GET /api/next | student | agent picks the next question (weakest topic, level from mastery) |
| POST /api/answer | student | updates mastery for one answer |
| POST /api/session | student | saves a finished practice session or mock test |
| GET /api/progress | logged in | mastery, accuracy, history, last result |
| GET /api/class | teacher | class overview |

## How the agent works
1. Each topic starts at 10% mastery. Correct: mastery rises. Wrong: it falls.
2. The agent practises the weakest topic. Level 1/2/3 comes from mastery (below 40%, below 70%, above).
3. Learning path steps unlock at 40% (Basics), 70% (Intermediate), 90% (Advanced).

## Add questions
Edit `backend/questions.json`. Each item: `t` topic code (pc, tw, sp, sr, bl, cd), `l` level 1-3, `q` question, `o` options,
`a` index of the correct option, `e` explanation. Restart the server.

## Limits (say these in your viva)
- The question bank (with correct answers) is sent to the browser, so a determined student could read it. Fix: keep answers on the server and check them there.
- Needs the server running. The earlier offline mode was removed.
- Flask's built-in server is for development. For deployment use gunicorn behind HTTPS and set SECRET_KEY.
- No login rate limiting or password reset yet. Only 18 questions, and the tutor is rule-based.

## Roadmap
LLM tutor grounded in the question bank, more topics (verbal, data interpretation), regional-language explanations,
Bayesian Knowledge Tracing, Docker + cloud deployment, pilot study with pre/post test.
