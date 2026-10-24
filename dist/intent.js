// Same-origin protected route. Queries are sent to Jev, never put in URLs/storage.
(()=>{
 const form=document.getElementById('prompt-composer'),input=document.getElementById('prompt-text'),button=document.getElementById('prompt-submit'),status=document.getElementById('composer-status');
 if(!form||!input||!button||!status)return;
 let pending=false,lastQuery=null,requestId=null;
 const messages={'rate-limited':'Please wait a moment before another question.','pending-or-interrupted':'Another request is pending. It will not be retried automatically.','development-budget-exhausted':'The development test limit has been reached. Browse the collections for now.','unconfigured':'Jev is not configured yet. Browse the collections for now.','recovery-failed':'The one-time Jev check failed. Further requests are paused for review.','recovery-needs-review':'The earlier Jev check needs review. No new request was sent.','prior-attempt-needs-review':'Jev is paused after a failed request. Browse the collections for now.'};
 input.maxLength=500;button.setAttribute('aria-label','Find relevant church content');
 status.textContent='Find church content with Jev. Avoid personal or sensitive details.';
 globalThis.submitVisitorIntent=async query=>{
  if(pending)return;
  if(typeof query!=='string'||!query.trim()||query.length>500){status.textContent='Write a question of up to 500 characters.';input.focus();return;}
  pending=true;button.disabled=true;form.setAttribute('aria-busy','true');status.textContent='Finding relevant church content…';
  // An uncertain network outcome reuses the same claim; it cannot double-charge.
  if(query.trim()!==lastQuery){lastQuery=query.trim();requestId='jev-intent-request:'+crypto.randomUUID();}
  form.dataset.requestId=requestId;
  try{
   const response=await fetch('/api/content/intent',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query:query.trim(),requestId}),signal:AbortSignal.timeout(65000)});
   if(!response.headers.get('Content-Type')?.includes('application/json'))throw Error('Session or service unavailable');
   const result=await response.json();
   if(!response.ok||result.status!=='ok'){status.textContent=messages[result.status]||'Jev could not complete this request. No results have been substituted. Please browse the collections.';return;}
   if(!Array.isArray(result.selectedIds)||typeof result.html!=='string'||result.receipt?.status!=='ok')throw Error('Invalid result');
   globalThis.contentView.showIntent(result.html);
   status.textContent=result.selectedIds.length?'Jev found '+result.selectedIds.length+' matches. These are existing church resources, not a generated answer.':'No clear matches. Try a different question or browse the collections.';
   form.dataset.receipt=result.receipt.requestId;
  }catch{status.textContent='The request could not be confirmed. It has not been retried. Check your session or browse the collections.';}
  finally{pending=false;button.disabled=false;form.removeAttribute('aria-busy');}
 };
})();
