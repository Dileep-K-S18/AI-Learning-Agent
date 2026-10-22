const TOP={pc:['Percentages','Quantitative'],tw:['Time & Work','Quantitative'],sp:['Speed & Distance','Quantitative'],sr:['Number Series','Logical'],bl:['Blood Relations','Logical'],cd:['Coding-Decoding','Logical']};
let Q=[],P=null,me=null,view='dash',ps=null,tst=null,tm=null;
const $=id=>document.getElementById(id),TN=t=>TOP[t][0];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const K=Object.keys(TOP),TH=[.4,.7,.9],STEP=['Basics','Intermediate','Advanced'];
const sum=o=>K.reduce((a,t)=>a+o[t],0);
const weakest=d=>[...K].sort((a,b)=>d.m[a]-d.m[b])[0],lvl=m=>m<.4?1:m<.7?2:3;
const shuf=a=>a.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
async function pickQ(){const r=await api('next?recent='+ps.recent.join(','));ps.recent.push(r.qi);if(ps.recent.length>3)ps.recent.shift();return Q[r.qi]}
function say(x){try{const s=new SpeechSynthesisUtterance(x);s.lang='en-IN';speechSynthesis.cancel();speechSynthesis.speak(s)}catch(e){}}
const go=v=>{if(location.hash.slice(1)===v)route();else location.hash=v};
async function logout(){try{await api('logout','POST')}catch(e){}location.href='login.html'}
function hdr(){const st=me.role==='student';
 $('hdr').innerHTML=`<header class="top"><b class="logo">AI Learning Agent</b><nav>${st?'<a href="#dash">Dashboard</a><a href="#practice">Practice</a><a href="#test">Mock test</a><a href="#results">Last result</a>':'<a href="#teacher">Class overview</a>'}<span class="who">${esc(me.name)}</span><button class="b2" onclick="logout()">Log out</button></nav></header>`}
function route(){view=location.hash.slice(1)||(me.role==='teacher'?'teacher':'dash');
 if(me.role==='teacher')view='teacher';else if(view==='teacher')view='dash';
 if(view!=='test'&&tm){clearInterval(tm);tm=null}
 hdr();({dash,practice,test,results,teacher}[view]||dash)()}
function dash(){const d=P,avg=sum(d.m)/K.length,tot=sum(d.n),cor=sum(d.c),w=weakest(d),hs=d.h.slice(-8);
 let h=`<h1>Welcome, ${esc(me.name)}</h1><div class="grid"><div class="card"><div class="big">${Math.round(avg*100)}%</div>Overall mastery<div class="bar"><i style="width:${avg*100}%"></i></div></div><div class="card"><div class="big">${tot?Math.round(cor/tot*100):0}%</div>Accuracy (${cor} of ${tot} correct)</div><div class="card"><div class="big">${d.h.length}</div>Sessions finished</div></div>
<div class="card"><h2>Your next step</h2><p>${tot?`Your weakest topic is <b>${TN(w)}</b>. The agent will practise it with you at level ${lvl(d.m[w])}.`:'Start a short practice session. The agent will find your level.'}</p><button class="b2 go" onclick="go('practice')">Start practice</button><button class="b2" onclick="go('test')">Take a mock test</button></div><h2>Learning path</h2>`;
 K.forEach(t=>{const m=d.m[t];let cu=false;
  h+=`<div class="card"><b>${TN(t)}</b> <span class="mut">${TOP[t][1]} · ${Math.round(m*100)}% mastery</span><div class="steps">`+TH.map((th,i)=>{let c='lk',k='🔒';if(m>=th){c='dn';k='✓'}else if(!cu){c='cu';k='●';cu=true}return `<span class="st ${c}">${k} ${i+1}. ${STEP[i]}</span>`}).join('')+`</div><div class="bar"><i style="width:${m*100}%"></i></div></div>`});
 h+='<h2>Progress over time</h2>'+(hs.length?`<div class="card"><div class="hist">${hs.map(x=>`<div style="height:${Math.max(10,x.s/x.t*100)}%" title="${x.mode}">${Math.round(x.s/x.t*100)}%</div>`).join('')}</div><p class="mut">Last ${hs.length} sessions, oldest to newest.</p></div>`:'<p>No sessions yet. Finish a practice session or mock test to see your progress here.</p>');
 $('v').innerHTML=h}
async function practice(){if(!ps)ps={items:[],recent:[],done:false,sel:-1};if(!ps.cur&&!ps.busy){ps.busy=1;try{ps.cur=await pickQ()}finally{ps.busy=0}}if(ps.cur)drawP()}
function drawP(){const q=ps.cur,n=ps.items.length;
 let h=`<div class="board"><div class="meta">${TOP[q.t][1]} · ${TN(q.t)} · Level ${q.l} · Answered this session: ${n}</div><h3>${esc(q.q)}</h3><button class="b2" onclick="say(ps.cur.q)">🔊 Listen</button>`;
 q.o.forEach((o,i)=>{const c=!ps.done?'':i===q.a?'ok':i===ps.sel?'no':'';h+=`<button class="opt ${c}" onclick="ansP(${i})">${esc(o)}</button>`});
 if(ps.done)h+=`<div class="fb"><b>${ps.sel===q.a?'Correct. Well done.':'Not quite. Here is why:'}</b><br>${esc(q.e)}<br><button class="b2" onclick="say(ps.cur.e)">🔊 Listen</button></div><button class="b2 go" onclick="nextP()">Next question</button>`;
 if(n)h+='<button class="b2" onclick="endP()">End session and see result</button>';
 $('v').innerHTML=h+'</div>'}
async function ansP(i){if(ps.done)return;const q=ps.cur,qi=Q.indexOf(q);ps.done=true;ps.sel=i;ps.items.push({qi,sel:i});drawP();try{P=(await api('answer','POST',{qi,sel:i})).progress}catch(e){}}
async function nextP(){ps.cur=await pickQ();ps.done=false;ps.sel=-1;drawP()}
function endP(){const it=ps.items;ps=null;finish(it,'Practice',false)}
function test(){if(!tst)tst={qs:shuf(shuf(K).flatMap(t=>shuf(Q.filter(q=>q.t===t)).slice(0,2))),ans:{},end:Date.now()+9e5};
 clearInterval(tm);tm=setInterval(tick,1000);drawT()}
function tick(){if(!tst){clearInterval(tm);return}const s=Math.max(0,Math.round((tst.end-Date.now())/1000)),e=$('tm');if(e)e.textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0');if(s<=0)submitT()}
function drawT(){const y=scrollY,a=Object.keys(tst.ans).length;
 let h=`<div class="board"><div class="meta">Mock test · ${tst.qs.length} questions · Time left: <b id="tm"></b> · Answered ${a} of ${tst.qs.length}. Explanations appear after you submit.</div>`;
 tst.qs.forEach((q,k)=>{h+=`<h3>${k+1}. ${esc(q.q)}</h3>`+q.o.map((o,i)=>`<button class="opt ${tst.ans[k]===i?'sel':''}" onclick="selT(${k},${i})">${esc(o)}</button>`).join('')});
 $('v').innerHTML=h+'<p><button class="b2 go" onclick="submitT()">Submit test</button></p></div>';tick();scrollTo(0,y)}
function selT(k,i){tst.ans[k]=i;drawT()}
function submitT(){if(!tst||tst.sending)return;tst.sending=1;clearInterval(tm);const it=tst.qs.map((q,k)=>({qi:Q.indexOf(q),sel:tst.ans[k]===undefined?-1:tst.ans[k]}));finish(it,'Mock test',true).then(ok=>{if(ok)tst=null;else tst.sending=0})}
async function finish(it,mode,apply){try{P=(await api('session','POST',{mode,items:it,apply})).progress}catch(e){alert('Could not save your result. Make sure the server is running, then try again.');return false}go('results');return true}
function results(){const r=P.last;
 if(!r){$('v').innerHTML='<h1>No result yet</h1><p>Finish a practice session or mock test to see your result here.</p><button class="b2 go" onclick="go(\'practice\')">Start practice</button>';return}
 const it=r.items,s=it.filter(x=>x.sel===Q[x.qi].a).length,p=Math.round(s/it.length*100),by={};
 it.forEach(x=>{const q=Q[x.qi],b=by[q.t]||(by[q.t]=[0,0]);b[1]++;if(x.sel===q.a)b[0]++});
 const wk=Object.keys(by).sort((a,b)=>by[a][0]/by[a][1]-by[b][0]/by[b][1])[0];
 const msg=p>=80?'Excellent work. You are placement-ready in these topics.':p>=50?'Good progress. A little more practice on your weak topics will lift your score.':'Keep going. Every session builds your base, and the explanations below show where to start.';
 let h=`<h1>${r.mode} result</h1><p class="mut">${new Date(r.d).toLocaleString()}</p><div class="grid"><div class="card"><div class="big">${s} / ${it.length}</div>Score</div><div class="card"><div class="big">${p}%</div>Percentage</div><div class="card"><div class="big">${p>=80?'A':p>=50?'B':'C'}</div>Grade</div></div><div class="card"><p>${msg}</p><p>Focus next on <b>${TN(wk)}</b>.</p></div><h2>Topic-wise result</h2><div class="card">`;
 Object.keys(by).forEach(t=>{const b=by[t];h+=`<div class="row"><span>${TN(t)}</span><span>${b[0]} of ${b[1]}</span></div><div class="bar"><i style="width:${b[0]/b[1]*100}%"></i></div>`});
 h+='</div><h2>Review your answers</h2>';
 it.forEach((x,k)=>{const q=Q[x.qi],ok=x.sel===q.a;h+=`<div class="rv ${ok?'g':'b'}"><b>${k+1}. ${esc(q.q)}</b><br>Your answer: ${x.sel<0?'not answered':esc(q.o[x.sel])} ${ok?'✓':'✗'}`+(ok?'':`<br>Correct answer: <b>${esc(q.o[q.a])}</b>`)+`<br><span class="mut">${esc(q.e)}</span></div>`});
 $('v').innerHTML=h+`<p class="noprint"><button class="b2 go" onclick="go('practice')">Practise weak topics</button><button class="b2" onclick="go('dash')">Back to dashboard</button><button class="b2" onclick="print()">Print result</button></p>`}
async function teacher(){let st=[];try{st=await api('class')}catch(e){}
 let h='<h1>Class overview</h1><p class="mut">All student accounts.</p>';
 if(!st.length){$('v').innerHTML=h+'<p>No students yet. Ask students to sign up on the login page.</p>';return}
 h+='<div style="overflow-x:auto"><table><tr><th>Student</th><th>Sessions</th><th>Accuracy</th><th>Mastery</th><th>Needs help in</th><th>Last session</th></tr>';
 st.forEach(s=>{h+=s.answers?`<tr><td>${esc(s.name)}</td><td>${s.sessions}</td><td>${s.accuracy}%</td><td>${s.mastery}%</td><td>${TN(s.weakest)}</td><td>${s.last?s.last.pct+'% ('+s.last.mode+')':'-'}</td></tr>`:`<tr><td>${esc(s.name)}</td><td colspan="5" class="mut">No activity yet</td></tr>`});
 $('v').innerHTML=h+'</table></div>'}
(async()=>{try{me=await api('me');Q=await api('questions');P=await api('progress')}catch(e){location.replace('login.html');return}window.onhashchange=route;route()})();
