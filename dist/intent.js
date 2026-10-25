// Same-origin protected route. Queries are sent to Jev, never put in URLs/storage.
(()=>{
 const form=document.getElementById('prompt-composer'),input=document.getElementById('prompt-text'),button=document.getElementById('prompt-submit'),status=document.getElementById('composer-status');
 if(!form||!input||!button||!status)return;
 let pending=false,lastQuery=null,requestId=null,paging=null;
 const resourceStatus=selection=>selection.totalCount?(selection.closeMatchCount?'Church resources ranked for your question.':'No close matches. All eligible church resources remain available below.'):'No eligible church resources are available right now.';
 function validate(result){
  const s=result.renderSelection;
  if(!Array.isArray(result.selectedIds)||typeof result.html!=='string'||result.receipt?.status!=='ok'||
   !/^jev-intent-request:[0-9a-f-]{36}$/.test(result.receipt.requestId||'')||s?.version!==2||!Array.isArray(s.selectedIds)||
   s.selectedIds.length!==result.selectedIds.length||s.selectedIds.some((id,i)=>id!==result.selectedIds[i])||
   !Number.isInteger(s.totalCount)||s.totalCount<result.selectedIds.length||!Number.isInteger(s.closeMatchCount)||s.closeMatchCount<0||s.closeMatchCount>s.totalCount||
   !(s.nextCursor===null||(/^[a-z][a-z0-9-]{0,79}$/.test(s.nextCursor)&&s.nextCursor===result.selectedIds.at(-1))))throw Error('Invalid result');
  return s;
 }
 function installPaging(result){
  paging?.button.remove();paging=null;
  if(!result.renderSelection.nextCursor)return;
  const more=document.createElement('button');more.id='intent-more';more.type='button';more.className='load-more';more.textContent='More ranked resources ↓';
  const state={button:more,receipt:result.receipt.requestId,cursor:result.renderSelection.nextCursor,busy:false};paging=state;
  document.getElementById('grid').after(more);
  more.addEventListener('click',async()=>{
   if(pending||state.busy||paging!==state)return;
   state.busy=true;more.disabled=true;more.setAttribute('aria-busy','true');more.textContent='Loading…';
   const cursor=state.cursor;
   try{
    const url='/api/content/intent?'+new URLSearchParams({receipt:state.receipt,after:cursor});
    const response=await fetch(url,{credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
    if(!response.ok||!response.headers.get('Content-Type')?.includes('application/json'))throw Error('Page unavailable');
    const next=await response.json();if(next.status!=='ok')throw Error('Page unavailable');
    const selection=validate(next);if(next.receipt.requestId!==state.receipt||selection.after!==cursor||selection.nextCursor===cursor)throw Error('Invalid page');
    if(paging!==state||pending)return;
    globalThis.contentView.showIntent(next.html,{append:true,selection});status.textContent=resourceStatus(selection);
    state.cursor=selection.nextCursor;
    if(state.cursor)more.textContent='More ranked resources ↓';else{more.remove();paging=null;}
   }catch{if(paging===state&&!pending){more.textContent='Could not load. Try again ↓';status.textContent='The next page could not be loaded. Try again to read the saved ranking.';}}
   finally{state.busy=false;more.disabled=pending;more.removeAttribute('aria-busy');if(paging===state&&more.textContent==='Loading…')more.textContent='More ranked resources ↓';}
  });
 }
 const messages={'identity-unavailable':'Your private session could not be verified. No question was sent to Jev. Please reload.','rate-limited':'Please wait a moment before another question.','pending-or-interrupted':'Another request is pending. It will not be retried automatically.','development-budget-exhausted':'The development test limit has been reached. Browse the collections for now.','unconfigured':'Jev is not configured yet. Browse the collections for now.','recovery-failed':'The one-time Jev check failed. Further requests are paused for review.','recovery-needs-review':'The earlier Jev check needs review. No new request was sent.','prior-attempt-needs-review':'Jev is paused after a failed request. Browse the collections for now.'};
 input.maxLength=500;button.setAttribute('aria-label','Find relevant church content');
 status.textContent='';
 globalThis.submitVisitorIntent=async query=>{
  if(pending)return;
  if(typeof query!=='string'||!query.trim()||query.length>500){status.textContent='Write a question of up to 500 characters.';input.focus();return;}
  pending=true;button.disabled=true;form.setAttribute('aria-busy','true');status.textContent='Finding relevant church content…';
  if(paging)paging.button.disabled=true;
  // An uncertain network outcome reuses the same claim; it cannot double-charge.
  if(query.trim()!==lastQuery){lastQuery=query.trim();requestId='jev-intent-request:'+crypto.randomUUID();}
  form.dataset.requestId=requestId;
  try{
   const response=await fetch('/api/content/intent',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query:query.trim(),requestId}),signal:AbortSignal.timeout(65000)});
   if(!response.headers.get('Content-Type')?.includes('application/json'))throw Error('Session or service unavailable');
   const result=await response.json();
   if(!response.ok||result.status!=='ok'){status.textContent=messages[result.status]||'Jev could not complete this request. No results have been substituted. Please browse the collections.';return;}
   const selection=validate(result);if(selection.after!=='')throw Error('Invalid first page');
   globalThis.contentView.showIntent(result.html,{selection});installPaging(result);
   status.textContent=resourceStatus(selection)+' These are existing resources, not a generated answer.';
   form.dataset.receipt=result.receipt.requestId;
  }catch{status.textContent='The request could not be confirmed. It has not been retried. Check your session or browse the collections.';}
  finally{pending=false;button.disabled=false;form.removeAttribute('aria-busy');if(paging)paging.button.disabled=paging.busy;}
 };
})();
