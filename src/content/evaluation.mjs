import {privateNextRequest,readRankingCatalog,json} from './catalog.mjs';
import {rankPublishedCards,rankingBatches,rankingRequest,rankingSnapshot,sha256,RANKING_MODEL} from './jev.mjs';
import {lexicalRank} from './lexical.mjs';
import {escape,cardPath} from './render.mjs';
const FIXTURES='ranking-fixtures-v1',PREFIX='ranking-eval-v1:',LOCK=PREFIX+'lock';
const MODEL=RANKING_MODEL,PRICE_PER_MILLION=.042,MAX_CASES=8;
export const EVALUATION_CONTRACT='synthetic-ranking-evaluation-v2';
const ID=/^[a-z][a-z0-9-]{0,79}$/;
export function validFixtures(value){
 return value?.version===1&&value.isSyntheticQuery===true&&Array.isArray(value.cases)&&value.cases.length>0&&value.cases.length<=MAX_CASES&&
 new Set(value.cases.map(c=>c?.id)).size===value.cases.length&&value.cases.every(c=>typeof c?.id==='string'&&ID.test(c.id)&&typeof c.query==='string'&&c.query.trim()&&c.query.length<=500&&Array.isArray(c.expectedUsefulIds)&&c.expectedUsefulIds.length<=16&&c.expectedUsefulIds.every(id=>typeof id==='string'&&ID.test(id)));
}
export function comparisons(query,cards,result,expected){
 const lexical=lexicalRank(query,cards),top=ranked=>ranked.slice(0,5).map(x=>x.id),hits=ids=>expected.filter(id=>ids.includes(id));
 const modelTop=top(result.ranked||[]),lexicalTop=top(lexical),candidateIds=lexical.filter(x=>x.score>0).slice(0,20).map(x=>x.id);
 return {lexical,expectedUsefulIds:expected,jevTopFive:modelTop,lexicalTopFive:lexicalTop,
 expectedHits:{jev:hits(modelTop),lexical:hits(lexicalTop)},
 hybridCandidateRecallSimulation:{candidateIds,missedExpectedIds:expected.filter(id=>!candidateIds.includes(id)),note:'Candidate-recall simulation only; no separate hybrid provider request or latency/cost claim.'}};
}
function list(ranked,cards,semantic=false){const map=new Map(cards.map(c=>[c.id,c]));return `<ol>${(ranked||[]).slice(0,8).map(r=>{const c=map.get(r.id);return `<li>${c?`<a href="${cardPath(c)}">${escape(c.title)}</a>`:escape(r.id)} · score ${Number(r.score).toFixed(3)}${semantic?' · confidence '+Number(r.confidence).toFixed(3):''}</li>`;}).join('')}</ol>`;}
function page(fixtures,rows,cards,notice=''){
 const byId=new Map(rows.map(r=>[r.id,r.result_json?JSON.parse(r.result_json):{status:'pending-or-interrupted'}]));
 const stopped=rows.length>=MAX_CASES||rows.some(r=>!r.result_json||JSON.parse(r.result_json).status!=='ok');
 const contents=fixtures.cases.map(c=>{const result=byId.get(PREFIX+c.id);return `<section><h2>${escape(c.id)}</h2><blockquote>${escape(c.query)}</blockquote>${result?`<p>Status: ${escape(result.status)}</p>${result.status==='ok'?`<div class="comparison"><div><h3>Jev</h3>${list(result.ranked,cards,true)}</div><div><h3>Lexical / phrase / typo baseline</h3>${list(result.comparison.lexical,cards)}</div></div>`:''}<details><summary>Actual receipt and comparison data</summary><pre>${escape(JSON.stringify(result,null,2))}</pre></details>`:`<form method="post"><input type="hidden" name="caseId" value="${escape(c.id)}"><button disabled>Run this fixed case once</button></form>`}</section>`;}).join('');
 return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Private ranking comparison</title><style>body{font:16px/1.6 system-ui;max-width:1100px;margin:40px auto;padding:0 24px;background:#f1eee4;color:#243b34}section{margin:30px 0;padding:24px;border:1px solid #aab5aa;border-radius:14px}blockquote{font:24px/1.3 Georgia;margin:20px 0}button{font:inherit;min-height:44px;padding:8px 16px}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:30px}a{color:inherit}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}@media(max-width:700px){.comparison{grid-template-columns:1fr}}</style><h1>Private ranking comparison</h1><p>Fixed synthetic visitor queries against the real eligible draft catalog. No visitor messages are collected. Historical cases remain readable; reopening this page does not call Jev.</p><p>${escape(notice||(stopped?'A prior attempt needs review. Further execution is stopped.':'New evaluation execution is disabled pending separate bounded paid authorization.'))}</p><p>The versioned evaluation planner shares the visitor 256-candidate, 64-card/40,000-byte batch limits. Saved historical receipts are unchanged. New evaluation execution is disabled.</p>${contents}</html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});
}
async function smallBody(request){if(!request.body)return '';const reader=request.body.getReader();let bytes=0,text='',decoder=new TextDecoder();try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>1024){await reader.cancel();throw Error('Body too large');}text+=decoder.decode(part.value,{stream:true});}return text+decoder.decode();}finally{reader.releaseLock();}}
// Pure preparation and an explicitly injected transport allow cloud fixtures to
// exercise the shared pipeline. No HTTP handler calls this execution capability.
export async function evaluationPlan(fixture,cards,instant){
 if(!validFixtures({version:1,isSyntheticQuery:true,cases:[fixture]}))throw new TypeError('Invalid synthetic fixture');
 const context={referenceTime:new Date(instant).toISOString()},batches=rankingBatches(fixture.query,cards,MODEL,context);
 const snapshot=await rankingSnapshot(cards,batches,context);
 const requests=batches.map(batch=>rankingRequest(fixture.query,batch,MODEL,context));
 return {version:EVALUATION_CONTRACT,batches,context,snapshot,
  executionSha256:await sha256({version:EVALUATION_CONTRACT,fixtureId:fixture.id,requests})};
}
export async function evaluateSyntheticFixture(fixture,cards,env,{fetchUpstream,now=Date.now}={}){
 if(typeof fetchUpstream!=='function')throw new TypeError('Explicit synthetic transport required');
 const started=now(),plan=await evaluationPlan(fixture,cards,started),batches=[],ranked=[],usage={inputTokens:0,outputTokens:0};
 let failure=null;
 for(const batch of plan.batches){
  const result=await rankPublishedCards(fixture.query,batch,env,{fetchUpstream,model:MODEL,context:plan.context});
  batches.push({status:result.status,model:result.model||null,candidateIds:batch.map(c=>c.id),usage:result.usage||null,failure:result.failure||null});
  if(result.usage){usage.inputTokens+=result.usage.inputTokens;usage.outputTokens+=result.usage.outputTokens;}
  if(result.status!=='ok'){failure=result;break;}
  ranked.push(...result.ranked);
 }
 ranked.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 const complete=!failure&&batches.length===plan.batches.length,usageComplete=batches.every(b=>b.usage)&&complete;
 const result={status:complete?'ok':'unavailable',model:complete?MODEL:null,ranked:complete?ranked:[],usage:usageComplete?usage:null};
 return {...result,contract:EVALUATION_CONTRACT,snapshot:plan.snapshot,datasetSha256:plan.snapshot.datasetSha256,executionSha256:plan.executionSha256,
  isSyntheticQuery:true,query:fixture.query,candidateIds:cards.map(c=>c.id),batches,usageComplete,knownUsage:usage,
  completedAt:new Date(now()).toISOString(),elapsedMs:Math.max(0,now()-started),estimatedCostUsd:usageComplete?usage.inputTokens*PRICE_PER_MILLION/1000000:null,
  comparison:comparisons(fixture.query,cards,result,fixture.expectedUsefulIds),...(failure?{failure:failure.failure||null}:{})};
}
export async function handleRankingEvaluation(request,env,{now=Date.now}={}){
 if(!privateNextRequest(request,env))return json({error:'Not found'},404);
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405,{Allow:'GET, POST'});
 if(request.method==='POST'&&(request.headers.get('Origin')!=='https://next.freedomvillage.church'||!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded')))return json({error:'Invalid request'},403);
 try{
  const row=await env.CONTENT_DB.prepare('SELECT result_json FROM content_checks WHERE id=?').bind(FIXTURES).first();
  let fixtures;try{fixtures=JSON.parse(row?.result_json);}catch{}
  if(!validFixtures(fixtures))return json({status:'not-configured'},409);
  const saved=await env.CONTENT_DB.prepare('SELECT id,result_json FROM content_checks WHERE id LIKE ? AND id<>?').bind(PREFIX+'%',LOCK).all(),rows=saved.results||[];
  if(request.method==='GET')return page(fixtures,rows,await readRankingCatalog(env.CONTENT_DB,now()));
  const params=new URLSearchParams(await smallBody(request)),caseId=params.get('caseId');
  if(!ID.test(caseId||'')||[...params.keys()].some(k=>k!=='caseId')||params.getAll('caseId').length!==1||!fixtures.cases.some(c=>c.id===caseId))return json({error:'Unknown fixture'},400);
  if(rows.some(r=>!r.result_json||JSON.parse(r.result_json).status!=='ok'))return json({status:'prior-attempt-needs-review'},409);
  // Historical approvals do not authorize this new multi-batch contract. No
  // locks/claims, budget resets, credit changes or provider calls occur here.
  return json({status:'evaluation-execution-disabled',contract:EVALUATION_CONTRACT},409);
 }catch{return json({status:'unavailable'},503);}
}
