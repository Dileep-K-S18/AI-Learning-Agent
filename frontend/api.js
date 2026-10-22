async function api(path,method='GET',body){
 const r=await fetch('/api/'+path,{method,headers:{'Content-Type':'application/json'},credentials:'same-origin',body:body?JSON.stringify(body):undefined});
 const j=await r.json().catch(()=>({}));
 if(r.status===401&&!/^(login|signup)/.test(path)&&!location.pathname.endsWith('login.html'))location.href='login.html';
 if(!r.ok)throw Object.assign(new Error(j.error||'Request failed'),{status:r.status});
 return j}
