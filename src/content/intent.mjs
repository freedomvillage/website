import {privateNextRequest,readCatalog,json} from './catalog.mjs';
import {rankingRequest,rankPublishedCards} from './jev.mjs';
import {renderCard} from './pages.mjs';

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
async function claim(db,id,at){return (await db.prepare('INSERT OR IGNORE INTO content_checks(id,created_at) VALUES(?,?)').bind(id,new Date(at).toISOString()).run()).meta?.changes===1;}

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
function publicReceipt(r){return {requestId:r.requestId,status:r.status,model:r.model||null,candidateCount:r.candidateIds.length,candidateIds:r.candidateIds,batches:r.batches,
 usage:r.usage,estimatedCostUsd:r.estimatedCostUsd,ranked:r.ranked||[],failure:r.failure||null,completedAt:r.completedAt};}
async function results(receipt,db,now){
 if(receipt.status!=='ok')return error('ranking-failed',503,{receipt:publicReceipt(receipt)});
 const cards=await intentCatalog(db,now),byId=new Map(cards.map(c=>[c.id,c]));
 const selected=receipt.ranked.filter(r=>r.score>=1&&byId.has(r.id)).slice(0,24);
 return json({status:'ok',receipt:publicReceipt(receipt),selectedIds:selected.map(r=>r.id),html:selected.map(r=>renderCard(byId.get(r.id))).join('')});
}

export async function handleIntent(request,env,{fetchUpstream=fetch,now=Date.now}={}){
 if(!privateNextRequest(request,env))return error('not-found',404);
 if(!['GET','POST'].includes(request.method))return error('method-not-allowed',405,{allowed:'GET, POST'});
 const db=env.CONTENT_DB;
 try{
  if(request.method==='GET'){
   const id=new URL(request.url).searchParams.get('receipt');
   if(id&&!/^jev-intent-request:[0-9a-f-]{36}$/.test(id))return error('invalid-receipt',400);
   if(id){const row=await get(db,id),value=parse(row);return value?json(publicReceipt(value)):error(row?'pending-or-interrupted':'not-found',row?409:404);}
   const recovery=await get(db,RECOVERY),state=parse(await get(db,INTENT_STATE));
   return json({status:state?.stopped?'stopped':state?.busy?'pending-or-interrupted':'ready',recovery:recovery?(parse(recovery)||{status:'pending-or-interrupted'}):{status:'not-run'},budgetUsd:BUDGET_USD,spentOrReservedUsd:state?.spent||0});
  }
  if(request.headers.get('Origin')!=='https://next.freedomvillage.church'||!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))return error('invalid-origin-or-type',403);
  let input;try{input=await body(request);}catch{return error('invalid-input',400);}
  if(!input||Object.keys(input).length!==2||typeof input.query!=='string'||!input.query.trim()||input.query.length>500||!/^jev-intent-request:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input.requestId||''))return error('invalid-input',400);
  const existing=await get(db,input.requestId);
  if(existing){const receipt=parse(existing);return receipt?results(receipt,db,now()):error('pending-or-interrupted');}
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
   if(recoveryRow&&recovery?.status!=='ok')return error('recovery-needs-review');
   let cards,batches;try{cards=await intentCatalog(db,instant);batches=intentBatches(query,cards);}catch{return error('catalog-unavailable',503);}
   const diagnosticCards=['freedom-kids','connect-card'].map(id=>cards.find(c=>c.id===id));
   if(!recovery&&diagnosticCards.some(c=>!c))return error('recovery-candidates-unavailable',503);
   const reservation=(batches.length+(recovery?0:1))*RESERVE_USD;
   if(!Number.isFinite(state.spent)||state.spent+reservation>BUDGET_USD)return error('development-budget-exhausted');
   state.spent+=reservation;state.lastStartedAt=instant;await save(db,INTENT_STATE,state);
   const started=now(),deadline=started+55000,receipts=[];
   const run=async(q,batch)=>{
    if(now()>=deadline)return {status:'unavailable',ranked:[],failure:{version:1,stage:'transport',code:'request-deadline'}};
    return rankPublishedCards(q,batch,env,{fetchUpstream,model:MODEL,signal:AbortSignal.timeout(Math.max(1,deadline-now()))});
   };
   let actualCost=0,unknownUsage=false;
   const account=result=>{if(result.usage)actualCost+=result.usage.inputTokens*.042/1000000;else unknownUsage=true;};
   if(!recovery){
    if(!await claim(db,RECOVERY,instant))return error('recovery-already-claimed');
    const result=await run(FIXED_QUERY,diagnosticCards);account(result);
    const receipt={...result,isSyntheticQuery:true,query:FIXED_QUERY,candidateIds:diagnosticCards.map(c=>c.id),estimatedCostUsd:result.usage?result.usage.inputTokens*.042/1000000:null,completedAt:new Date(now()).toISOString(),recoveryOf:'ranking-eval-v1:short-stay-kids'};
    await save(db,RECOVERY,receipt);
    if(result.status!=='ok'){state.stopped=true;return error('recovery-failed',503,{diagnostic:{status:result.status,failure:result.failure||null,validation:result.validation||null,usage:result.usage||null}});}
   }
   const requestId=input.requestId;if(!await claim(db,requestId,now()))return error('pending-or-interrupted');
   let ranked=[],usage={inputTokens:0,outputTokens:0},failed=null;
   for(const batch of batches){
    const result=await run(query,batch);account(result);
    receipts.push({status:result.status,candidateIds:batch.map(c=>c.id),model:result.model||null,usage:result.usage||null,failure:result.failure||null,validation:result.validation||null});
    if(result.status!=='ok'){failed=result;break;}
    ranked.push(...result.ranked);usage.inputTokens+=result.usage.inputTokens;usage.outputTokens+=result.usage.outputTokens;
   }
   ranked.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
   if(failed){state.stopped=true;ranked=[];}
   // Recheck current eligibility after the request: expired/held/removed records
   // cannot become visible merely because they were eligible at request start.
   const current=failed?[]:await intentCatalog(db,now()),eligible=new Set(current.map(c=>c.id));
   ranked=ranked.filter(r=>eligible.has(r.id));
   const receipt={requestId,status:failed?'unavailable':'ok',model:MODEL,candidateIds:cards.map(c=>c.id),batches:receipts,ranked,usage,
    estimatedCostUsd:receipts.every(r=>r.usage)?receipts.reduce((sum,r)=>sum+r.usage.inputTokens*.042/1000000,0):null,elapsedMs:Math.max(0,now()-started),completedAt:new Date(now()).toISOString(),...(failed?{failure:failed.failure||null}:{})};
   await save(db,requestId,receipt);
   if(!unknownUsage)state.spent=Math.max(0,state.spent-reservation+actualCost);
   if(failed)return error('ranking-failed',503,{receipt:publicReceipt(receipt)});
   // The score is a relevance position, not a calibrated probability. Return
   // useful/partial answers (>= the descriptive middle level), never a fake answer.
   return results(receipt,db,now());
  }catch{state.stopped=true;return error('request-interrupted',503);}
  finally{await release();}
 }catch{return error('unavailable',503);}
}
