import {privateNextRequest,readCatalog,json} from './catalog.mjs';
import {rankPublishedCards} from './jev.mjs';
import {lexicalRank} from './lexical.mjs';
import {escape,cardPath} from './render.mjs';
const FIXTURES='ranking-fixtures-v1',PREFIX='ranking-eval-v1:',LOCK=PREFIX+'lock';
const MODEL='jev-1.14.0',PRICE_PER_MILLION=.042,MAX_CASES=8;
const ID=/^[a-z][a-z0-9-]{0,79}$/;
export function validFixtures(value){
 return value?.version===1&&value.isSyntheticQuery===true&&Array.isArray(value.cases)&&value.cases.length>0&&value.cases.length<=MAX_CASES&&
 new Set(value.cases.map(c=>c?.id)).size===value.cases.length&&value.cases.every(c=>typeof c?.id==='string'&&ID.test(c.id)&&typeof c.query==='string'&&c.query.trim()&&c.query.length<=500&&Array.isArray(c.expectedUsefulIds)&&c.expectedUsefulIds.length<=16&&c.expectedUsefulIds.every(id=>typeof id==='string'&&ID.test(id)));
}
async function catalog(env){let items=[],after='';for(let page=0;page<4;page++){const result=await readCatalog(env.CONTENT_DB,{after});items.push(...result.items);if(items.length>64)throw Error('Catalog too large');if(!result.nextCursor)return items;after=result.nextCursor;}throw Error('Catalog too large');}
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
 const contents=fixtures.cases.map(c=>{const result=byId.get(PREFIX+c.id);return `<section><h2>${escape(c.id)}</h2><blockquote>${escape(c.query)}</blockquote>${result?`<p>Status: ${escape(result.status)}</p>${result.status==='ok'?`<div class="comparison"><div><h3>Jev</h3>${list(result.ranked,cards,true)}</div><div><h3>Lexical / phrase / typo baseline</h3>${list(result.comparison.lexical,cards)}</div></div>`:''}<details><summary>Actual receipt and comparison data</summary><pre>${escape(JSON.stringify(result,null,2))}</pre></details>`:`<form method="post"><input type="hidden" name="caseId" value="${escape(c.id)}"><button${fixtures.executionApproved===true?'':' disabled'}>Run this fixed case once</button></form>`}</section>`;}).join('');
 return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Private ranking comparison</title><style>body{font:16px/1.6 system-ui;max-width:1100px;margin:40px auto;padding:0 24px;background:#f1eee4;color:#243b34}section{margin:30px 0;padding:24px;border:1px solid #aab5aa;border-radius:14px}blockquote{font:24px/1.3 Georgia;margin:20px 0}button{font:inherit;min-height:44px;padding:8px 16px}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:30px}a{color:inherit}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}@media(max-width:700px){.comparison{grid-template-columns:1fr}}</style><h1>Private ranking comparison</h1><p>Fixed synthetic visitor queries against the real eligible draft catalog. No visitor messages are collected. Each case can run once; reopening this page does not call Jev.</p><p>${escape(notice||'Existing credits only. Execution stays disabled until the actual remaining balance is verified.')}</p>${contents}</html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});
}
async function smallBody(request){if(!request.body)return '';const reader=request.body.getReader();let bytes=0,text='',decoder=new TextDecoder();try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>1024){await reader.cancel();throw Error('Body too large');}text+=decoder.decode(part.value,{stream:true});}return text+decoder.decode();}finally{reader.releaseLock();}}
export async function handleRankingEvaluation(request,env,{fetchUpstream=fetch,now=Date.now}={}){
 if(!privateNextRequest(request,env))return json({error:'Not found'},404);
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405,{Allow:'GET, POST'});
 if(request.method==='POST'&&(request.headers.get('Origin')!=='https://next.freedomvillage.church'||!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded')))return json({error:'Invalid request'},403);
 try{
  const fixtureRow=await env.CONTENT_DB.prepare('SELECT result_json FROM content_checks WHERE id=?').bind(FIXTURES).first();let fixtures;try{fixtures=JSON.parse(fixtureRow?.result_json);}catch{}
  if(!validFixtures(fixtures))return json({status:'not-configured'},409);
  const cards=await catalog(env),readRows=async()=>{const r=await env.CONTENT_DB.prepare('SELECT id,result_json FROM content_checks WHERE id LIKE ? AND id<>?').bind(PREFIX+'%',LOCK).all();return r.results||[];};
  let rows=await readRows();if(request.method==='GET')return page(fixtures,rows,cards);
  const params=new URLSearchParams(await smallBody(request)),caseId=params.get('caseId'),fixture=fixtures.cases.find(c=>c.id===caseId);
  if(!fixture||[...params.keys()].some(k=>k!=='caseId')||params.getAll('caseId').length!==1)return json({error:'Unknown fixture'},400);
  if(rows.some(r=>r.id===PREFIX+caseId))return page(fixtures,rows,cards,'This fixed case was already claimed; no new provider request was sent.');
  const approvedAt=Date.parse(fixtures.creditVerifiedAt),age=now()-approvedAt;
  if(fixtures.executionApproved!==true||!Number.isFinite(fixtures.remainingCreditsUsd)||fixtures.remainingCreditsUsd<.10||!Number.isFinite(age)||age<0||age>6*3600000)return json({status:'credit-verification-required'},409);
  if(env.JEV_ENABLED!=='true'||!env.TYPESAFE_API_KEY||cards.length===0)return json({status:'unconfigured'},409);
  if(rows.length>=MAX_CASES||rows.some(r=>!r.result_json||JSON.parse(r.result_json).status!=='ok'))return json({status:'prior-attempt-needs-review'},409);
  const spent=rows.reduce((n,r)=>n+(JSON.parse(r.result_json).estimatedCostUsd||0),0);if(spent>=.10)return json({status:'experiment-budget-exhausted'},409);
  await env.CONTENT_DB.prepare('INSERT OR IGNORE INTO content_checks(id,result_json,created_at) VALUES(?,?,?)').bind(LOCK,JSON.stringify({caseId:null}),new Date(now()).toISOString()).run();
  const mutex=await env.CONTENT_DB.prepare("UPDATE content_checks SET result_json=? WHERE id=? AND json_extract(result_json,'$.caseId') IS NULL").bind(JSON.stringify({caseId}),LOCK).run();
  if(mutex.meta?.changes!==1)return json({status:'another-case-pending'},409);
  const claim=await env.CONTENT_DB.prepare('INSERT OR IGNORE INTO content_checks(id,created_at) VALUES(?,?)').bind(PREFIX+caseId,new Date(now()).toISOString()).run();
  if(claim.meta?.changes!==1){await env.CONTENT_DB.prepare('UPDATE content_checks SET result_json=? WHERE id=?').bind(JSON.stringify({caseId:null}),LOCK).run();return page(fixtures,await readRows(),cards,'Already claimed.');}
  // No retry or lock stealing. Interrupted attempts remain reviewable and block more spend.
  const started=now(),result=await rankPublishedCards(fixture.query,cards,env,{fetchUpstream,model:MODEL});
  const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(cards.map(c=>({id:c.id,title:c.title,summary:c.summary,facts:c.facts||[c.date,c.time,c.venue].filter(Boolean)}))))))).map(n=>n.toString(16).padStart(2,'0')).join('');
  const receipt={...result,query:fixture.query,isSyntheticQuery:true,elapsedMs:Math.max(0,now()-started),datasetSha256:fingerprint,candidateIds:cards.map(c=>c.id),estimatedCostUsd:result.usage?Number((result.usage.inputTokens*PRICE_PER_MILLION/1000000).toFixed(12)):null,unitPriceSource:'https://docs.typesafe.ai/models (2026-10-23)',comparison:comparisons(fixture.query,cards,result,fixture.expectedUsefulIds)};
  await env.CONTENT_DB.prepare('UPDATE content_checks SET result_json=? WHERE id=?').bind(JSON.stringify(receipt),PREFIX+caseId).run();
  await env.CONTENT_DB.prepare('UPDATE content_checks SET result_json=? WHERE id=?').bind(JSON.stringify({caseId:null}),LOCK).run();
  return page(fixtures,await readRows(),cards,'One bounded case completed. No automatic retries or further calls.');
 }catch{return json({status:'unavailable'},503);}
}
