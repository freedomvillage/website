// Same-origin protected route. Questions never enter URLs or durable storage.
(()=>{
 const form=document.getElementById('prompt-composer'),input=document.getElementById('prompt-text'),button=document.getElementById('prompt-submit'),status=document.getElementById('composer-status');
 if(!form||!input||!button||!status)return;
 let pending=false,lastQuery=null,requestId=null,completed=false,paging=null,owned=null,generation=0;
 const resourceStatus=selection=>{
  const base=selection.totalCount?(selection.closeMatchCount?'Church resources ranked for your question.':'No close matches in this saved result. Its eligible church resources remain available below.'):'No eligible resources remain in this saved result.';
  const snapshot=selection.snapshot;
  if(!snapshot)return base;
  const at=snapshot.completedAt?' Ranked '+new Date(snapshot.completedAt).toLocaleString('en-GB',{timeZone:'Asia/Seoul'})+' (Seoul).':'';
  const notice={changed:' Content has changed since this ranking; displayed resources may have changed and new resources are not included. Submit a new search for current rankings.',older:' This is an older saved ranking. Submit a new search for current rankings.',unverified:' The content version of this saved ranking is unavailable.'}[snapshot.state]||'';
  return base+at+notice;
 };
 globalThis.rankedResourceStatus=resourceStatus;
 function validate(result){
  const s=result.renderSelection;
  if(!Array.isArray(result.selectedIds)||typeof result.html!=='string'||result.receipt?.status!=='ok'||
   !/^jev-intent-request:[0-9a-f-]{36}$/.test(result.receipt.requestId||'')||s?.version!==2||!Array.isArray(s.selectedIds)||
   s.selectedIds.length!==result.selectedIds.length||new Set(result.selectedIds).size!==result.selectedIds.length||s.selectedIds.some((id,i)=>id!==result.selectedIds[i]||!/^[a-z][a-z0-9-]{0,79}$/.test(id))||
   !Number.isInteger(s.totalCount)||s.totalCount<result.selectedIds.length||!Number.isInteger(s.closeMatchCount)||s.closeMatchCount<0||s.closeMatchCount>s.totalCount||
   !(s.nextCursor===null||(/^[a-z][a-z0-9-]{0,79}$/.test(s.nextCursor)&&s.nextCursor===result.selectedIds.at(-1))))throw Error('Invalid result');
  return s;
 }
 const read=async(url,signal)=>{
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal});
  if(!response.ok||!response.headers.get('Content-Type')?.includes('application/json'))throw Error('Saved result unavailable');
  const result=await response.json();validate(result);return result;
 };
 function installPaging(result){
  paging?.button.remove();paging=null;
  if(!result.renderSelection.nextCursor)return;
  const more=document.createElement('button');more.id='intent-more';more.type='button';more.className='load-more';more.textContent='More ranked resources ↓';
  const state={button:more,receipt:result.receipt.requestId,cursor:result.renderSelection.nextCursor,busy:false};paging=state;
  document.getElementById('grid').after(more);
  more.addEventListener('click',async()=>{
   if(pending||state.busy||paging!==state)return;
   const epoch=generation,cursor=state.cursor;state.busy=true;more.disabled=true;more.setAttribute('aria-busy','true');more.textContent='Loading…';
   try{
    const url='/api/content/intent?'+new URLSearchParams({receipt:state.receipt,after:cursor});
    const next=await read(url,AbortSignal.timeout(15000)),selection=next.renderSelection;
    if(next.receipt.requestId!==state.receipt||selection.after!==cursor||selection.nextCursor===cursor)throw Error('Invalid page');
    if(epoch!==generation||paging!==state||pending)return;
    globalThis.contentView.showIntent(next.html,{append:true,selection});status.textContent=resourceStatus(selection);
    if(owned)owned.pages=Math.min(11,owned.pages+1);globalThis.contentView.saveNavigation?.();
    state.cursor=selection.nextCursor;
    if(state.cursor)more.textContent='More ranked resources ↓';else{more.remove();paging=null;}
   }catch{if(epoch===generation&&paging===state&&!pending){more.textContent='Could not load. Try again ↓';status.textContent='The next page could not be loaded. Try again to read the saved ranking.';}}
   finally{state.busy=false;more.disabled=pending;more.removeAttribute('aria-busy');if(paging===state&&more.textContent==='Loading…')more.textContent='More ranked resources ↓';}
  });
 }
 // Only opaque navigation hints; neither question text nor result HTML is saved.
 globalThis.visitorIntentState=()=>owned?{receipt:owned.receipt,pages:owned.pages}:null;
 globalThis.restoreVisitorIntent=async(hint,signal)=>{
  const epoch=++generation;
  try{
   const result=await read('/api/content/intent?'+new URLSearchParams({receipt:hint.receipt,replay:'first',pages:String(hint.pages)}),signal||AbortSignal.timeout(15000));
   if(epoch!==generation||pending||result.receipt.requestId!==hint.receipt||result.renderSelection.after!=='')return false;
   owned={receipt:hint.receipt,pages:hint.pages};
   globalThis.contentView.showIntent(result.html,{selection:result.renderSelection,quiet:true});installPaging(result);
   status.textContent=resourceStatus(result.renderSelection);form.dataset.receipt=hint.receipt;return true;
  }catch{return false;}
 };
 const messages={'identity-unavailable':'Your private session could not be verified. No question was sent. Please reload.','rate-limited':'Please wait a moment before another question.','pending-or-interrupted':'Another request is pending. It will not be retried automatically.','development-budget-exhausted':'The development test limit has been reached. Browse the collections for now.','unconfigured':'Questions are not configured yet. Browse the collections for now.','recovery-failed':'The one-time check failed. Further requests are paused for review.','recovery-needs-review':'The earlier check needs review. No new request was sent.','prior-attempt-needs-review':'Requests are paused after a failed request. Browse the collections for now.'};
 input.maxLength=500;button.setAttribute('aria-label','Find relevant church content');status.textContent='';
 globalThis.submitVisitorIntent=async query=>{
  if(pending)return;
  if(typeof query!=='string'||!query.trim()||query.length>500){status.textContent='Write a question of up to 500 characters.';input.focus();return;}
  const epoch=++generation;
  pending=true;button.disabled=true;form.setAttribute('aria-busy','true');
  if(paging)paging.button.disabled=true;
  // Confirmed completion permits an intentional new same-text search. An
  // uncertain outcome retains its exact idempotent claim in this document.
  if(query.trim()!==lastQuery||completed){lastQuery=query.trim();requestId='jev-intent-request:'+crypto.randomUUID();}
  completed=false;form.dataset.requestId=requestId;status.textContent='Finding relevant church content…';
  try{
   const response=await fetch('/api/content/intent',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query:query.trim(),requestId}),signal:AbortSignal.timeout(65000)});
   if(!response.headers.get('Content-Type')?.includes('application/json'))throw Error('Session or service unavailable');
   const result=await response.json();if(epoch!==generation)return;
   if(!response.ok||result.status!=='ok'){status.textContent=messages[result.status]||'This request could not be completed. No results have been substituted. Please browse the collections.';return;}
   const selection=validate(result);if(selection.after!==''||result.receipt.requestId!==requestId)throw Error('Invalid first page');
   completed=true;owned={receipt:result.receipt.requestId,pages:1};
   globalThis.contentView.showIntent(result.html,{selection});installPaging(result);globalThis.contentView.saveNavigation?.({supersede:true});
   status.textContent=resourceStatus(selection)+' These are existing resources, not a generated answer. Submit again to start a new search.';
   form.dataset.receipt=result.receipt.requestId;
  }catch{if(epoch===generation)status.textContent='The request could not be confirmed. It has not been retried. Submit again to check this same request, or browse the collections.';}
  finally{if(epoch===generation){pending=false;button.disabled=false;form.removeAttribute('aria-busy');button.setAttribute('aria-label',completed?'Start a new search':'Check previous request');if(paging)paging.button.disabled=paging.busy;}}
 };
 const invalidate=()=>{generation++;pending=false;button.disabled=false;form.removeAttribute('aria-busy');};
 globalThis.addEventListener?.('pagehide',()=>{
  invalidate();
  // A cached document must not expose held/expired result HTML before a fresh
  // eligibility check. Preserve layout for history's scroll measurement.
  if(owned)document.getElementById('collection')?.style.setProperty('visibility','hidden');
 });
 globalThis.addEventListener?.('pageshow',event=>{
  // Reconstruct via the bounded history hint even when a browser retained the
  // old document. Reload is a read-only GET and never resubmits the question.
  if(event.persisted&&owned)globalThis.location.reload();
 });
 document.addEventListener?.('click',event=>{
  const link=event.target?.closest?.('a[href]');
  if(!link||event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target==='_blank')return;
  try{const url=new URL(link.href,location.href);if(url.origin===location.origin&&(url.pathname!==location.pathname||url.search!==location.search||link.id==='intent-return'))invalidate();}catch{}
 });
})();
