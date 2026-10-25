import {privateNextRequest,readCatalog,json} from './catalog.mjs';
import {rankingRequest,rankPublishedCards,RANKING_INPUT_VERSION} from './jev.mjs';
import {renderCard,cardPath} from './pages.mjs';
import {resolveIntentOwner} from './intent-owner.mjs';

// Explicit recovery approved on 2026-10-24 after review of the failed evaluation.
// Historical evaluation rows are never updated, deleted or treated as successful.
export const INTENT_STATE='jev-intent-runtime-v1',RECOVERY='jev-intent-recovery-v1';
const MODEL='jev-1.14.0';
const RESERVE_USD=.003,BUDGET_USD=.10,MIN_INTERVAL=10000,MAX_BATCHES=24;
const FIXED_QUERY='We are visiting with children and would like to get connected.';
const error=(status,http=409,extra={})=>json({status,...extra},http);
const parse=row=>row?.result_json?JSON.parse(row.result_json):null;
async function get(db,id){return db.prepare('SELECT result_json FROM content_checks WHERE id=?').bind(id).first();}
async function save(db,id,value){await db.prepare('UPDATE content_checks SET result_json=? WHERE id=?').bind(JSON.stringify(value),id).run();}
async function claim(db,id,at,initial){return (await db.prepare('INSERT OR IGNORE INTO content_checks(id,result_json,created_at) VALUES(?,?,?)').bind(id,JSON.stringify(initial),new Date(at).toISOString()).run()).meta?.changes===1;}

export async function intentCatalog(db,now){
 const cards=[],ids=new Set(),cursors=new Set();let after='';
 for(let page=0;page<32;page++){
  const result=await readCatalog(db,{after,now});
  for(const c of result.items){if(ids.has(c.id))throw Error('Duplicate catalog ID');ids.add(c.id);cards.push(c);}
  if(cards.length>256)throw Error('Catalog limit');
  if(!result.nextCursor)return cards;
  if(cursors.has(result.nextCursor))throw Error('Repeated cursor');
  cursors.add(result.nextCursor);after=result.nextCursor;
 }
 throw Error('Catalog limit');
}
export function intentBatches(query,cards){
 if(!cards.length||cards.length>256)throw Error('Catalog limit');
 if(new Set(cards.map(c=>c.id)).size!==cards.length)throw Error('Duplicate candidate');
 const batches=[];let current=[];
 for(const card of cards){
  try{rankingRequest(query,[...current,card],MODEL);current.push(card);}
  catch{if(!current.length)throw Error('Invalid candidate');batches.push(current);current=[card];rankingRequest(query,current,MODEL);}
 }
 if(current.length)batches.push(current);
 if(batches.length>MAX_BATCHES)throw Error('Batch limit');
 return batches;
}
async function body(request){
 const reader=request.body?.getReader();if(!reader)throw Error('Missing body');
 const decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,text='',timer;
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{void reader.cancel().catch(()=>{});reject(Error('Body timeout'));},5000);});
 try{while(true){const part=await Promise.race([reader.read(),deadline]);if(part.done)break;bytes+=part.value.byteLength;if(bytes>4096){await reader.cancel();throw Error('Body limit');}text+=decoder.decode(part.value,{stream:true});}return JSON.parse(text+decoder.decode());}
 finally{clearTimeout(timer);reader.releaseLock();}
}
function publicReceipt(r){return {requestId:r.requestId,status:r.status,model:r.model||null,requestedModel:r.requestedModel||null,candidateCount:r.candidateIds.length,candidateIds:r.candidateIds,batches:r.batches,
 inputProjection:r.inputProjection||'summary-facts-v1',candidateInputs:r.candidateInputs||null,candidateInputScope:r.batchPlan?'attempted-or-transport-uncertain':'legacy-delivery-not-established',batchPlan:r.batchPlan||null,rankedBeforeEligibility:r.rankedBeforeEligibility||null,selection:r.selection||null,
 usage:r.usage,knownUsage:r.knownUsage||r.usage,usageComplete:r.usageComplete??Boolean(r.usage),estimatedCostUsd:r.estimatedCostUsd,ranked:r.ranked||[],failure:r.failure||null,completedAt:r.completedAt};}
function selectionFor(receipt,cards,now,after=''){
 const byId=new Map(cards.map(c=>[c.id,c])),ranked=receipt.rankedBeforeEligibility||receipt.ranked||[];
 const index=after?ranked.findIndex(r=>r.id===after):-1;
 if(after&&index<0)return null;
 // Advance in the immutable ranking, not a freshly filtered list: expiry or
 // removal before the cursor must never skip an unseen resource.
 const eligible=ranked.filter(r=>byId.has(r.id)),remaining=ranked.slice(index+1).filter(r=>byId.has(r.id)),selected=remaining.slice(0,24);
 return {version:2,noticeMinimumScore:1,scoreRange:[0,2],limit:24,after,totalCount:eligible.length,closeMatchCount:eligible.filter(r=>r.score>=1).length,
  nextCursor:remaining.length>24?selected.at(-1).id:null,evaluatedAt:new Date(now).toISOString(),selectedIds:selected.map(r=>r.id),selectedPaths:selected.map(r=>cardPath(byId.get(r.id))),
  belowThresholdIds:eligible.filter(r=>r.score<1).map(r=>r.id),unavailableIds:ranked.filter(r=>!byId.has(r.id)).map(r=>r.id),remainingIds:remaining.slice(24).map(r=>r.id)};
}
async function inspectReceipt(receipt,db,now){
 const value=publicReceipt(receipt);if(receipt.status!=='ok')return value;
 try{
  const cards=await intentCatalog(db,now),scores=new Map((receipt.rankedBeforeEligibility||receipt.ranked||[]).map(r=>[r.id,r]));
  return {...value,currentInspection:{scope:'current-eligible-catalog-not-original-render',...selectionFor(receipt,cards,now),
   familyAndVisitInputs:cards.filter(c=>c.categories?.includes('families')||c.id==='visit-help').map(c=>({
    projection:rankingRequest('Read-only input inspection',[c],MODEL).state.candidates[0],categories:c.categories||[],currentInputProjection:RANKING_INPUT_VERSION,inSavedSnapshot:receipt.candidateIds.includes(c.id),savedScore:scores.get(c.id)||null
   }))}};
 }catch{return {...value,currentInspection:{status:'unavailable',scope:'current-eligible-catalog-not-original-render'}};}
}
async function results(receipt,db,now,{persistSelection=false,after=''}={}){
 if(receipt.status!=='ok')return error('ranking-failed',503,{receipt:publicReceipt(receipt)});
 if(receipt.model!==MODEL||!Array.isArray(receipt.batches)||receipt.batches.some(b=>b.status!=='ok'||b.model!==MODEL))return error('model-receipt-needs-review');
 const cards=await intentCatalog(db,now),byId=new Map(cards.map(c=>[c.id,c]));
 const selection=selectionFor(receipt,cards,now,after);
 if(!selection)return error('invalid-cursor',400);
 const html=selection.selectedIds.map(id=>renderCard(byId.get(id),cards)).join('');
 const saved=persistSelection?{...receipt,selection}:receipt;
 if(persistSelection)await save(db,receipt.requestId,saved);
 return json({status:'ok',receipt:publicReceipt(saved),renderSelection:selection,selectedIds:selection.selectedIds,html});
}

export async function handleIntent(request,env,{fetchUpstream=fetch,now=Date.now,resolveOwner=resolveIntentOwner}={}){
 if(!privateNextRequest(request,env))return error('not-found',404);
 if(!['GET','POST'].includes(request.method))return error('method-not-allowed',405,{allowed:'GET, POST'});
 if(request.method==='POST'&&(request.headers.get('Origin')!=='https://next.freedomvillage.church'||!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||'')))return error('invalid-origin-or-type',403);
 let ownerScope;try{ownerScope=await resolveOwner(request);}catch{}
 if(typeof ownerScope!=='string'||!/^[a-f0-9]{64}$/.test(ownerScope))return error('identity-unavailable',403);
 const db=env.CONTENT_DB;
 try{
  if(request.method==='GET'){
   const params=new URL(request.url).searchParams,id=params.get('receipt'),after=params.get('after');
   if([...params.keys()].some(k=>!['receipt','after'].includes(k))||params.getAll('receipt').length>1||params.getAll('after').length>1||(id&&id!=='latest'&&!/^jev-intent-request:[0-9a-f-]{36}$/.test(id))||
    (after!==null&&(!id||id==='latest'||!/^[a-z][a-z0-9-]{0,79}$/.test(after))))return error('invalid-receipt',400);
   if(id){
    const row=id==='latest'?await db.prepare("SELECT id,result_json FROM content_checks WHERE id LIKE ? AND json_extract(result_json,'$.ownerScope')=? ORDER BY created_at DESC,id DESC LIMIT 1").bind('jev-intent-request:%',ownerScope).first():await get(db,id),value=parse(row);
    // Legacy/unowned rows stay intact, but cannot be retroactively claimed by
    // someone who merely knows a UUID. Other users get the same404 as missing.
    if(!value||value.ownerScope!==ownerScope)return error('not-found',404);
    if(value.status==='pending')return error('pending-or-interrupted',409,{requestId:value.requestId,...(value.batchPlan?{batchPlan:value.batchPlan}:{})});
    // Continuation only reads this user's saved scores; it cannot enter the
    // provider, reservation, recovery, or receipt-write path below.
    if(after!==null)return await results(value,db,now(),{after});
    return json(await inspectReceipt(value,db,now()));
   }
   const recovery=await get(db,RECOVERY),state=parse(await get(db,INTENT_STATE));
   const configured=env.JEV_ENABLED==='true'&&typeof env.TYPESAFE_API_KEY==='string'&&Boolean(env.TYPESAFE_API_KEY.trim());
   const savedRecovery=parse(recovery),recoveryStatus=savedRecovery?.status||'pending-or-interrupted';
   const recoveryView=savedRecovery?.ownerScope===ownerScope?Object.fromEntries(Object.entries(savedRecovery).filter(([key])=>key!=='ownerScope')):recovery?{status:recoveryStatus,model:savedRecovery?.model||null}:{status:'not-run'};
   return json({status:state?.stopped?'stopped':state?.busy?'pending-or-interrupted':configured?'ready':'unconfigured',recovery:recoveryView,budgetUsd:BUDGET_USD,spentOrReservedUsd:state?.spent||0});
  }
  let input;try{input=await body(request);}catch{return error('invalid-input',400);}
  if(!input||Object.keys(input).length!==2||typeof input.query!=='string'||!input.query.trim()||input.query.length>500||!/^jev-intent-request:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input.requestId||''))return error('invalid-input',400);
  const existing=await get(db,input.requestId);
  if(existing){const receipt=parse(existing);if(receipt?.ownerScope!==ownerScope)return error('not-found',404);return receipt.status==='pending'?error('pending-or-interrupted',409,{requestId:receipt.requestId}):await results(receipt,db,now());}
  if(env.JEV_ENABLED!=='true'||!env.TYPESAFE_API_KEY)return error('unconfigured',503);
  // No query is written to D1, URLs, analytics or application logs.
  const query=input.query.trim(),instant=now();
  await db.prepare('INSERT OR IGNORE INTO content_checks(id,result_json,created_at) VALUES(?,?,?)').bind(INTENT_STATE,JSON.stringify({busy:false,stopped:false,spent:0,lastStartedAt:0}),new Date(instant).toISOString()).run();
  const owner=crypto.randomUUID();
  const lock=await db.prepare("UPDATE content_checks SET result_json=json_set(result_json,'$.busy',json('true'),'$.owner',?) WHERE id=? AND json_extract(result_json,'$.busy')=0").bind(owner,INTENT_STATE).run();
  if(lock.meta?.changes!==1)return error('pending-or-interrupted');
  let state=parse(await get(db,INTENT_STATE));
  // Only this request can release its lock. A killed request stays visibly pending.
  const release=async()=>{state.busy=false;delete state.owner;await db.prepare("UPDATE content_checks SET result_json=? WHERE id=? AND json_extract(result_json,'$.owner')=?").bind(JSON.stringify(state),INTENT_STATE,owner).run();};
  try{
   if(state.stopped)return error('prior-attempt-needs-review');
   if(instant-state.lastStartedAt<MIN_INTERVAL)return error('rate-limited',429);
   const recoveryRow=await get(db,RECOVERY),recovery=parse(recoveryRow);
   if(recoveryRow&&(recovery?.status!=='ok'||recovery.model!==MODEL))return error('recovery-needs-review');
   let cards,batches;try{cards=await intentCatalog(db,instant);batches=intentBatches(query,cards);}catch{return error('catalog-unavailable',503);}
   const diagnosticCards=['freedom-kids','connect-card'].map(id=>cards.find(c=>c.id===id));
   if(!recovery&&diagnosticCards.some(c=>!c))return error('recovery-candidates-unavailable',503);
   const reservation=(batches.length+(recovery?0:1))*RESERVE_USD;
   if(!Number.isFinite(state.spent)||state.spent+reservation>BUDGET_USD)return error('development-budget-exhausted');
   state.spent+=reservation;state.lastStartedAt=instant;await save(db,INTENT_STATE,state);
   const started=now(),deadline=started+55000,receipts=[];
   const run=async(q,batch)=>{
    if(now()>=deadline)return {status:'unavailable',dispatch:'not-sent',ranked:[],failure:{version:1,stage:'transport',code:'request-deadline'}};
    return rankPublishedCards(q,batch,env,{fetchUpstream,model:MODEL,signal:AbortSignal.timeout(Math.max(1,deadline-now()))});
   };
   let actualCost=0,unknownUsage=false;
   const account=result=>{if(result.usage)actualCost+=result.usage.inputTokens*.042/1000000;else unknownUsage=true;};
   if(!recovery){
    if(!await claim(db,RECOVERY,instant,{status:'pending',ownerScope}))return error('recovery-already-claimed');
    const result=await run(FIXED_QUERY,diagnosticCards);account(result);
    const receipt={...result,ownerScope,isSyntheticQuery:true,query:FIXED_QUERY,candidateIds:diagnosticCards.map(c=>c.id),estimatedCostUsd:result.usage?result.usage.inputTokens*.042/1000000:null,completedAt:new Date(now()).toISOString(),recoveryOf:'ranking-eval-v1:short-stay-kids'};
    await save(db,RECOVERY,receipt);
    if(result.status!=='ok'){state.stopped=true;return error('recovery-failed',503,{diagnostic:{status:result.status,failure:result.failure||null,validation:result.validation||null,usage:result.usage||null}});}
   }
   const requestId=input.requestId;if(!await claim(db,requestId,now(),{status:'pending',ownerScope,requestId}))return error('pending-or-interrupted');
   let ranked=[],usage={inputTokens:0,outputTokens:0},failed=null;
   const candidateInputs=[],candidateIds=cards.map(c=>c.id),batchPlan=batches.map((batch,index)=>({index,candidateIds:batch.map(c=>c.id),dispatch:'not-attempted'}));
   for(const [index,batch] of batches.entries()){
    batchPlan[index].dispatch='pending-or-uncertain';
    await save(db,requestId,{status:'pending',ownerScope,requestId,inputProjection:RANKING_INPUT_VERSION,candidateIds,batches:receipts,batchPlan,candidateInputs});
    const result=await run(query,batch);account(result);
    const dispatch=result.dispatch||'transport-uncertain';batchPlan[index].dispatch=dispatch;
    if(dispatch!=='not-sent')candidateInputs.push(...rankingRequest(query,batch,MODEL).state.candidates);
    receipts.push({status:result.status,dispatch,candidateIds:batch.map(c=>c.id),model:result.model||null,usage:result.usage||null,failure:result.failure||null,validation:result.validation||null});
    if(result.usage){usage.inputTokens+=result.usage.inputTokens;usage.outputTokens+=result.usage.outputTokens;}
    if(result.status!=='ok'){failed=result;break;}
    ranked.push(...result.ranked);
   }
   ranked.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
   if(failed){state.stopped=true;ranked=[];}
   const rankedBeforeEligibility=[...ranked];
   // Recheck current eligibility after the request: expired/held/removed records
   // cannot become visible merely because they were eligible at request start.
   const current=failed?[]:await intentCatalog(db,now()),eligible=new Set(current.map(c=>c.id));
   ranked=ranked.filter(r=>eligible.has(r.id));
   const usageComplete=receipts.every(r=>r.usage);
   const receipt={requestId,ownerScope,status:failed?'unavailable':'ok',model:failed?null:MODEL,requestedModel:MODEL,inputProjection:RANKING_INPUT_VERSION,candidateIds,candidateInputs,batchPlan,batches:receipts,ranked,rankedBeforeEligibility,usage:usageComplete?usage:null,knownUsage:usage,usageComplete,
    estimatedCostUsd:receipts.every(r=>r.usage)?receipts.reduce((sum,r)=>sum+r.usage.inputTokens*.042/1000000,0):null,elapsedMs:Math.max(0,now()-started),completedAt:new Date(now()).toISOString(),...(failed?{failure:failed.failure||null}:{})};
   await save(db,requestId,receipt);
   if(!unknownUsage)state.spent=Math.max(0,state.spent-reservation+actualCost);
   if(failed)return error('ranking-failed',503,{receipt:publicReceipt(receipt)});
   // Relevance orders every eligible resource. The descriptive middle level
   // controls only the no-close-matches notice, never inclusion or pagination.
   return await results(receipt,db,now(),{persistSelection:true});
  }catch{state.stopped=true;return error('request-interrupted',503);}
  finally{await release();}
 }catch{return error('unavailable',503);}
}
