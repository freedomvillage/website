// Cloud-only SQLite + intercepted provider tests. No actual requests or credentials.
import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {handleIntent as realHandleIntent,intentBatches,INTENT_STATE,RECOVERY} from '../src/content/intent.mjs';
import {rankingRequest} from '../src/content/jev.mjs';import {createWorker as realCreateWorker} from '../src/worker.mjs';
const instant=Date.parse('2026-10-24T14:00:00Z'),secret='SYNTHETIC_TEST_VALUE';
const OWNER_A='a'.repeat(64),OWNER_B='b'.repeat(64);
const fixtureOwner=async request=>request.headers.get('X-Fixture-User')==='second'?OWNER_B:OWNER_A;
const handleIntent=(request,env,options={})=>realHandleIntent(request,env,{resolveOwner:fixtureOwner,...options});
const createWorker=options=>realCreateWorker({...options,resolveIntentOwner:fixtureOwner});
const card=i=>({schemaVersion:2,template:'story',title:'Content '+i,summary:'Useful church information '+i,detail:['Public paragraph.'],facts:[],categories:['faith'],actions:[],related:[],media:null,design:{theme:'paper',layout:'text',motif:'none',motion:'none',size:'regular'},homePriority:50,sourceStatus:'draft',isSynthetic:false});
function setup(count=71){
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE content_cards(id TEXT PRIMARY KEY,status TEXT,content_json TEXT,expires_at TEXT);CREATE TABLE content_checks(id TEXT PRIMARY KEY,result_json TEXT,created_at TEXT)');
 const put=(id,c=card(id),status='draft',expiry=null)=>db.prepare('INSERT INTO content_cards VALUES(?,?,?,?)').run(id,status,JSON.stringify(c),expiry);
 put('freedom-kids');put('connect-card');for(let i=2;i<count;i++)put('sample-'+String(i).padStart(3,'0'));
 const oldFailure=JSON.stringify({status:'unavailable',category:'invalid-response',usage:{inputTokens:8035,outputTokens:538}});
 db.prepare('INSERT INTO content_checks VALUES(?,?,?)').run('ranking-eval-v1:short-stay-kids',oldFailure,new Date(instant).toISOString());
 const adapter={prepare(sql){
  const statement=db.prepare(sql);
  return {bind(...args){return {
   first:async()=>statement.get(...args),
   all:async()=>({results:statement.all(...args)}),
   run:async()=>({meta:{changes:Number(statement.run(...args).changes)}})
  };}};
 }};
 return {db,put,oldFailure,env:{CONTENT_DB:adapter,CONTENT_PILOT_ENABLED:'true',JEV_ENABLED:'true',TYPESAFE_API_KEY:secret}};
}
const request=(input={query:'I would like community.',requestId:'jev-intent-request:11111111-1111-4111-8111-111111111111'},headers={})=>new Request('https://next.freedomvillage.church/api/content/intent',{method:input===null?'GET':'POST',headers:{'Cf-Access-Jwt-Assertion':'SYNTHETIC_ACCESS',...(input===null?{}:{Origin:'https://next.freedomvillage.church','Content-Type':'application/json'}),...headers},...(input===null?{}:{body:JSON.stringify(input)})});
function provider(seen,{failureAt=0,wait,onCall}={}){return async(url,options)=>{
 const body=JSON.parse(options.body);seen.push(body);await onCall?.(seen.length,body);if(wait)await wait;
 assert.equal(url,'https://api.typesafe.ai/v1/systemone');assert.equal(options.redirect,'manual');assert.equal(options.headers.Authorization,'Bearer '+secret);assert.equal(body.model,'jev-1.14.0');
 if(seen.length===failureAt)return Response.json({message:'PRIVATE_PROVIDER_TEXT',model:'jev-1.14.0',usage:{input_tokens:10,output_tokens:4},answers:{}});
 return Response.json({model:'jev-1.14.0',usage:{input_tokens:100,output_tokens:20},answers:Object.fromEntries(Object.keys(body.questions).map(key=>[key,{type:'score',score:2,confidence:1,legend:{0:'No',1:'Part',2:'Direct'},probabilities:{0:0,1:0,2:1}}]))});
};}
test('71 candidates are all ranked, recovery is once, old failure immutable; returned IDs and HTML are actual validated records',async()=>{
 const {db,env,oldFailure}=setup();try{const seen=[],options={now:()=>instant,fetchUpstream:provider(seen)};
 const response=await createWorker(options).fetch(request(),env);assert.equal(response.status,200);const value=await response.json();
 assert.equal(value.receipt.inputProjection,'public-context-v2');assert.equal(value.receipt.candidateCount,71);assert.equal(value.receipt.ranked.length,71);assert.equal(value.selectedIds.length,24);assert(value.html.includes('card-connect-card'));assert(!JSON.stringify(value).includes(secret));
 assert.deepEqual(new Set(seen.slice(1).flatMap(b=>b.state.candidates.map(c=>c.id))),new Set(value.receipt.ranked.map(r=>r.id)));
 assert.equal(seen[0].state.candidates.length,2);assert.deepEqual(seen[0].state.candidates.map(c=>c.id),['freedom-kids','connect-card']);
 assert(seen.length>2);assert.equal(JSON.parse(db.prepare('SELECT result_json FROM content_checks WHERE id=?').get(RECOVERY).result_json).status,'ok');
 assert.equal(db.prepare('SELECT result_json FROM content_checks WHERE id=?').get('ranking-eval-v1:short-stay-kids').result_json,oldFailure);
 const stored=db.prepare('SELECT result_json FROM content_checks WHERE id=?').get(value.receipt.requestId).result_json;assert(!stored.includes('I would like community.'));
 const count=seen.length;assert.equal((await handleIntent(request(),env,options)).status,200);assert.equal(seen.length,count,'same request ID replays receipt without spending');
 }finally{db.close();}
});
test('batch byte/card boundaries preserve every candidate without lexical preselection',()=>{
 const cards=Array.from({length:256},(_,i)=>({id:'sample-'+i,title:'A'.repeat(160),summary:'B'.repeat(600),facts:Array(6).fill('C'.repeat(160))}));
 const batches=intentBatches('Q'.repeat(500),cards);assert.deepEqual(batches.flat(),cards);for(const b of batches){assert(b.length<=64);assert(new TextEncoder().encode(JSON.stringify(rankingRequest('Q'.repeat(500),b,'jev-1.14.0'))).length<=40000);}
 assert.throws(()=>intentBatches('q',Array(257).fill(cards[0])));
});
test('auth/origin/type/shape/query limits and GET do not call Jev',async()=>{
 const {db,env}=setup(2);try{let calls=0;const options={now:()=>instant,fetchUpstream:async()=>{calls++;throw Error();}};
 assert.equal((await handleIntent(request(null),env,options)).status,200);
 assert.equal((await handleIntent(request({}, {Origin:'https://evil.invalid'}),env,options)).status,403);
 assert.equal((await handleIntent(request({}, {'Content-Type':'text/plain'}),env,options)).status,403);
 for(const input of [{query:'a'},{query:'a'.repeat(501),requestId:'bad'},{query:'a',requestId:'https://evil.invalid'},{query:'',requestId:'bad'}])assert.equal((await handleIntent(request(input),env,options)).status,400);
 assert.equal((await handleIntent(request(),{...env,CONTENT_PILOT_ENABLED:'false'},options)).status,404);assert.equal(calls,0);
 }finally{db.close();}
});
test('invalid recovery retains safe diagnosis, stops further calls, never exposes raw response',async()=>{
 const {db,env}=setup(2);try{const seen=[],options={now:()=>instant,fetchUpstream:provider(seen,{failureAt:1})};
 const response=await handleIntent(request(),env,options);assert.equal(response.status,503);const text=await response.text();assert(!text.includes('PRIVATE_PROVIDER_TEXT'));assert(text.includes('answer-count'));
 assert.equal((await handleIntent(request(),env,options)).status,409);assert.equal(seen.length,1);assert(JSON.parse(db.prepare('SELECT result_json FROM content_checks WHERE id=?').get(INTENT_STATE).result_json).stopped);
 }finally{db.close();}
});
test('partial batch failure never renders a partial success or retries recovery',async()=>{
 const {db,env}=setup();try{const seen=[],options={now:()=>instant,fetchUpstream:provider(seen,{failureAt:3})};const response=await handleIntent(request(),env,options);assert.equal(response.status,503);const result=await response.json();assert.equal(result.status,'ranking-failed');assert.deepEqual(result.receipt.ranked,[]);assert.equal(result.html,undefined);await handleIntent(request(),env,options);assert.equal(seen.length,3);}finally{db.close();}
});
test('single flight coalesces simultaneous requests and pending claims cannot be stolen',async()=>{
 const {db,env}=setup(2);let release;const wait=new Promise(r=>release=r);try{const seen=[],options={now:()=>instant,fetchUpstream:provider(seen,{wait})},pending=handleIntent(request(),env,options);
 while(!seen.length)await new Promise(r=>setImmediate(r));assert.equal((await handleIntent(request(),env,options)).status,409);assert.equal(seen.length,1);release();assert.equal((await pending).status,200);
 }finally{release();db.close();}
});
test('published/held/synthetic/expired/invalid rows excluded, including an empty raw page; expiry during provider call is rechecked',async()=>{
 const {db,env,put}=setup(2);try{
 for(let i=0;i<25;i++)put('bad-'+i,{...card(i),title:''});
 put('held',{...card('held'),hold:true});put('synthetic',{...card('synthetic'),isSynthetic:true});put('published',card('published'),'published');put('expired',card('expired'),'draft',new Date(instant-1).toISOString());
 let time=instant;put('expires-during',card('expires-during'),'draft',new Date(instant+1000).toISOString());
 const seen=[],response=await handleIntent(request(),env,{now:()=>time,fetchUpstream:provider(seen,{onCall(n){if(n===2)time+=2000;}})});const result=await response.json();assert.equal(response.status,200);
 assert.deepEqual(new Set(seen.slice(1).flatMap(x=>x.state.candidates.map(c=>c.id))),new Set(['freedom-kids','connect-card','expires-during']));assert(!result.selectedIds.includes('expires-during'));assert(!result.html.includes('expires-during'));
 }finally{db.close();}
});
test('rate/budget stop before provider and receipt reads contain no query or secret',async()=>{
 const {db,env}=setup(2);try{const seen=[],options={now:()=>instant,fetchUpstream:provider(seen)};const first=await(await handleIntent(request(),env,options)).json();
 const second={query:'Another question',requestId:'jev-intent-request:22222222-2222-4222-8222-222222222222'};assert.equal((await handleIntent(request(second),env,options)).status,429);const count=seen.length;
 db.prepare('UPDATE content_checks SET result_json=? WHERE id=?').run(JSON.stringify({busy:false,stopped:false,spent:.10,lastStartedAt:0}),INTENT_STATE);
 assert.equal((await handleIntent(request(second),env,options)).status,409);assert.equal(seen.length,count);
 const receiptRequest=new Request('https://next.freedomvillage.church/api/content/intent?receipt='+encodeURIComponent(first.receipt.requestId),{headers:{'Cf-Access-Jwt-Assertion':'SYNTHETIC_ACCESS'}});const text=await(await handleIntent(receiptRequest,env,options)).text();assert(text.includes('"status":"ok"'));assert(!text.includes('I would like community.'));assert(!text.includes(secret));assert.equal(seen.length,count);
 }finally{db.close();}
});

function failCatalogReads(env,failAt){const original=env.CONTENT_DB;let reads=0;env.CONTENT_DB={prepare(sql){const prepared=original.prepare(sql);return {bind(...args){const bound=prepared.bind(...args);return {...bound,all:async()=>{if(sql.includes('FROM content_cards')&&++reads===failAt)throw Error('SYNTHETIC_CATALOG_FAILURE');return bound.all();}};}};}};}
test('saved-receipt catalog rejection returns JSON503 without provider spend or an escaping rejection',async()=>{
 const {db,env}=setup(2);try{const seen=[],options={now:()=>instant,fetchUpstream:provider(seen)};assert.equal((await handleIntent(request(),env,options)).status,200);const calls=seen.length;failCatalogReads(env,1);const response=await handleIntent(request(),env,options);assert.equal(response.status,503);assert.equal((await response.json()).status,'unavailable');assert.equal(seen.length,calls);}finally{db.close();}
});
test('fresh result rendering stays inside the lock/catch and a catalog failure stops new requests',async()=>{
 const {db,env}=setup(2);try{const seen=[],options={now:()=>instant,fetchUpstream:provider(seen)};failCatalogReads(env,3);const response=await handleIntent(request(),env,options);assert.equal(response.status,503);assert.equal((await response.json()).status,'request-interrupted');const state=JSON.parse(db.prepare('SELECT result_json FROM content_checks WHERE id=?').get(INTENT_STATE).result_json);assert.equal(state.stopped,true);assert.equal(state.busy,false);assert.equal(seen.length,2);}finally{db.close();}
});
test('aggregate usage includes known failed-batch tokens and never labels unknown usage zero',async()=>{
 for(const unknown of [false,true]){const {db,env}=setup(2);try{const seen=[],upstream=provider(seen,{failureAt:unknown?0:2});const fetchUpstream=unknown?async(...args)=>{if(seen.length===1){seen.push(null);return new Response('',{status:503});}return upstream(...args);}:upstream;
 const response=await handleIntent(request(),env,{now:()=>instant,fetchUpstream});const value=await response.json();assert.equal(response.status,503);assert.equal(value.receipt.model,null);assert.equal(value.receipt.requestedModel,'jev-1.14.0');assert.equal(value.receipt.usageComplete,!unknown);
 if(unknown){assert.equal(value.receipt.usage,null);assert.equal(value.receipt.estimatedCostUsd,null);assert.equal(value.receipt.knownUsage.inputTokens,0);}else{assert.equal(value.receipt.usage.inputTokens,10);assert.equal(value.receipt.usage.outputTokens,4);assert.equal(value.receipt.estimatedCostUsd,10*.042/1000000);}
 }finally{db.close();}}
});

test('historical successful receipts with an unexpected model cannot bypass the new pin guard',async()=>{
 const {db,env}=setup(2);try{const seen=[],options={now:()=>instant,fetchUpstream:provider(seen)};const first=await(await handleIntent(request(),env,options)).json();const count=seen.length;
 const row=JSON.parse(db.prepare('SELECT result_json FROM content_checks WHERE id=?').get(first.receipt.requestId).result_json);row.batches[0].model='jev-other-model';db.prepare('UPDATE content_checks SET result_json=? WHERE id=?').run(JSON.stringify(row),first.receipt.requestId);
 const replay=await handleIntent(request(),env,options);assert.equal(replay.status,409);assert.equal((await replay.json()).status,'model-receipt-needs-review');assert.equal(seen.length,count);
 const recovery=JSON.parse(db.prepare('SELECT result_json FROM content_checks WHERE id=?').get(RECOVERY).result_json);recovery.model='jev-other-model';db.prepare('UPDATE content_checks SET result_json=? WHERE id=?').run(JSON.stringify(recovery),RECOVERY);
 const fresh=await handleIntent(request({query:'Another question',requestId:'jev-intent-request:22222222-2222-4222-8222-222222222222'}),env,{...options,now:()=>instant+11000});assert.equal(fresh.status,409);assert.equal((await fresh.json()).status,'recovery-needs-review');assert.equal(seen.length,count);
 }finally{db.close();}
});

test('weak matches follow stronger resources; threshold is notice metadata and inspection never rewrites history',async()=>{
 const {db,env,put}=setup(2);try{
 put('visit-help',{...card('visit-help'),title:'Your first Sunday',summary:'Ask about visiting in Yangjae.'});
 const family=JSON.parse(db.prepare('SELECT content_json FROM content_cards WHERE id=?').get('freedom-kids').content_json);family.categories=['families'];family.summary='Bible stories, big questions and room to wonder.';db.prepare('UPDATE content_cards SET content_json=? WHERE id=?').run(JSON.stringify(family),'freedom-kids');
 const seen=[],fetchUpstream=async(url,options)=>{const b=JSON.parse(options.body);seen.push(b);return Response.json({model:'jev-1.14.0',usage:{input_tokens:100,output_tokens:20},answers:Object.fromEntries(b.state.candidates.map((c,i)=>{const direct=c.id==='visit-help',partial=c.id==='freedom-kids';return ['card_'+i,{type:'score',score:direct?2:(partial ? .9 : .6),confidence:.7,probabilities:direct?{0:0,1:0,2:1}:partial?{0:.1,1:.9,2:0}:{0:.4,1:.6,2:0}}];}))});};
 const query='Visiting Seoul in Noviember with children.',input={query,requestId:'jev-intent-request:11111111-1111-4111-8111-111111111111'},options={now:()=>instant,fetchUpstream};
 const response=await handleIntent(request(input),env,options),value=await response.json();assert.equal(response.status,200);assert.deepEqual(value.selectedIds,['visit-help','freedom-kids','connect-card']);assert.deepEqual(value.receipt.selection.selectedIds,value.selectedIds);assert.equal(value.renderSelection.closeMatchCount,1);assert.equal(value.renderSelection.totalCount,3);assert.equal(value.renderSelection.nextCursor,null);assert(value.receipt.selection.belowThresholdIds.includes('freedom-kids'));assert.equal(value.receipt.rankedBeforeEligibility.find(r=>r.id==='freedom-kids').score,.9);
 assert(value.receipt.candidateInputs.some(c=>c.id==='freedom-kids'&&c.description===family.summary));assert(!JSON.stringify(value.receipt).includes(query));
 const calls=seen.length,saved=db.prepare('SELECT result_json FROM content_checks WHERE id=?').get(input.requestId).result_json;
 const latest=()=>new Request('https://next.freedomvillage.church/api/content/intent?receipt=latest',{headers:{'Cf-Access-Jwt-Assertion':'SYNTHETIC_ACCESS'}});
 const inspection=await(await handleIntent(latest(),env,options)).json();assert.equal(inspection.requestId,input.requestId);assert.equal(inspection.currentInspection.scope,'current-eligible-catalog-not-original-render');assert.equal(inspection.currentInspection.familyAndVisitInputs.find(c=>c.projection.id==='freedom-kids').savedScore.score,.9);assert.equal(seen.length,calls);assert.equal(db.prepare('SELECT result_json FROM content_checks WHERE id=?').get(input.requestId).result_json,saved);
 // Older live receipts have no original selection/input snapshot. A current
 // reinspection must never present a new inference as their actual past render.
 const old=JSON.parse(saved);delete old.selection;delete old.candidateInputs;delete old.rankedBeforeEligibility;db.prepare('UPDATE content_checks SET result_json=? WHERE id=?').run(JSON.stringify(old),input.requestId);
 const legacy=await(await handleIntent(latest(),env,options)).json();assert.equal(legacy.selection,null);assert.equal(legacy.candidateInputs,null);assert(legacy.currentInspection);assert.equal(seen.length,calls);
 }finally{db.close();}
});
test('latest pending receipt and unavailable current inspection are read-only, truthful outcomes',async()=>{
 const {db,env}=setup(2);try{const seen=[],options={now:()=>instant,fetchUpstream:provider(seen)};const first=await(await handleIntent(request(),env,options)).json(),calls=seen.length;
 const latest=()=>new Request('https://next.freedomvillage.church/api/content/intent?receipt=latest',{headers:{'Cf-Access-Jwt-Assertion':'SYNTHETIC_ACCESS'}});
 failCatalogReads(env,1);const inspected=await(await handleIntent(latest(),env,options)).json();assert.equal(inspected.status,'ok');assert.equal(inspected.currentInspection.status,'unavailable');assert.equal(seen.length,calls);
 const id='jev-intent-request:22222222-2222-4222-8222-222222222222';db.prepare('INSERT INTO content_checks VALUES(?,?,?)').run(id,JSON.stringify({status:'pending',ownerScope:OWNER_A,requestId:id}),new Date(instant+1000).toISOString());const pending=await handleIntent(latest(),env,options);assert.equal(pending.status,409);assert.deepEqual(await pending.json(),{status:'pending-or-interrupted',requestId:id});assert.equal(seen.length,calls);assert(first.receipt.selection);
 }finally{db.close();}
});

test('saved receipts, replay and latest are isolated to the originating user, including pending and legacy rows',async()=>{
 const {db,env}=setup(2);try{const seen=[],options={now:()=>instant,fetchUpstream:provider(seen)};const first=await(await handleIntent(request(),env,options)).json(),id=first.receipt.requestId,calls=seen.length;
 const get=(receipt,second=false)=>new Request('https://next.freedomvillage.church/api/content/intent?receipt='+encodeURIComponent(receipt),{headers:{'Cf-Access-Jwt-Assertion':'SYNTHETIC_ACCESS',...(second?{'X-Fixture-User':'second'}:{})}});
 assert.equal((await handleIntent(get(id),env,options)).status,200);assert.equal((await handleIntent(get(id,true),env,options)).status,404);assert.equal((await handleIntent(get('latest',true),env,options)).status,404);
 assert.equal((await handleIntent(request(undefined,{'X-Fixture-User':'second'}),env,options)).status,404);assert.equal(seen.length,calls);
 const stored=JSON.parse(db.prepare('SELECT result_json FROM content_checks WHERE id=?').get(id).result_json);assert.equal(stored.ownerScope,OWNER_A);assert(!JSON.stringify(first).includes(OWNER_A));
 const secondInput={query:'Another question',requestId:'jev-intent-request:22222222-2222-4222-8222-222222222222'};
 const second=await(await handleIntent(request(secondInput,{'X-Fixture-User':'second'}),env,{...options,now:()=>instant+11000})).json();assert.equal(second.status,'ok');
 assert.equal((await(await handleIntent(get('latest'),env,options)).json()).requestId,id);assert.equal((await(await handleIntent(get('latest',true),env,options)).json()).requestId,secondInput.requestId);
 const secondStatus=await(await handleIntent(new Request('https://next.freedomvillage.church/api/content/intent',{headers:{'Cf-Access-Jwt-Assertion':'SYNTHETIC_ACCESS','X-Fixture-User':'second'}}),env,options)).json();assert.deepEqual(Object.keys(secondStatus.recovery).sort(),['model','status']);
 delete stored.ownerScope;db.prepare('UPDATE content_checks SET result_json=? WHERE id=?').run(JSON.stringify(stored),id);const legacy=db.prepare('SELECT result_json FROM content_checks WHERE id=?').get(id).result_json;
 assert.equal((await handleIntent(get(id),env,options)).status,404);assert.equal((await handleIntent(request(),env,options)).status,404);assert.equal(db.prepare('SELECT result_json FROM content_checks WHERE id=?').get(id).result_json,legacy,'legacy data is retained, never retroactively claimed');
 }finally{db.close();}
});
test('unverified identity cannot read D1 or spend; raw identity/owner fields cannot be supplied in the question body',async()=>{
 const {db,env}=setup(2);try{let calls=0;const options={now:()=>instant,fetchUpstream:async()=>{calls++;},resolveOwner:async()=>null};assert.equal((await handleIntent(request(null),env,options)).status,403);assert.equal((await handleIntent(request(),env,options)).status,403);assert.equal(calls,0);
 const body={query:'A question',requestId:'jev-intent-request:11111111-1111-4111-8111-111111111111',ownerScope:OWNER_A};assert.equal((await handleIntent(request(body),env,{...options,resolveOwner:fixtureOwner})).status,400);assert.equal(calls,0);
 }finally{db.close();}
});

test('all-zero scores still paginate the full owned ranking without provider spend or receipt writes',async()=>{
 const {db,env}=setup();try{
 const seen=[],upstream=provider(seen),options={now:()=>instant,fetchUpstream:async(...args)=>{
  const response=await upstream(...args),value=await response.json();
  for(const answer of Object.values(value.answers)){answer.score=0;answer.probabilities={0:1,1:0,2:0};}return Response.json(value);
 }};
 let page=await(await handleIntent(request(),env,options)).json();const id=page.receipt.requestId,calls=seen.length,ids=[...page.selectedIds];
 const saved=db.prepare('SELECT result_json FROM content_checks WHERE id=?').get(id).result_json,state=db.prepare('SELECT result_json FROM content_checks WHERE id=?').get(INTENT_STATE).result_json;
 assert.equal(page.renderSelection.closeMatchCount,0);assert.equal(page.renderSelection.totalCount,71);assert.equal(ids.length,24);
 // Continuation is a pure receipt read even when new inference is disabled.
 const continuationEnv={...env,JEV_ENABLED:'false',TYPESAFE_API_KEY:undefined};
 while(page.renderSelection.nextCursor){
  const after=page.renderSelection.nextCursor,url='https://next.freedomvillage.church/api/content/intent?'+new URLSearchParams({receipt:id,after});
  const get=headers=>new Request(url,{headers:{'Cf-Access-Jwt-Assertion':'SYNTHETIC_ACCESS',...headers}});
  assert.equal((await handleIntent(get({'X-Fixture-User':'second'}),continuationEnv,options)).status,404);
  const response=await handleIntent(get(),continuationEnv,options);assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);
  page=await response.json();assert.equal(page.renderSelection.after,after);assert.equal(page.renderSelection.closeMatchCount,0);ids.push(...page.selectedIds);
 }
 assert.equal(ids.length,71);assert.equal(new Set(ids).size,71);assert.deepEqual(ids,page.receipt.ranked.map(r=>r.id));assert.equal(page.selectedIds.length,23);
 assert.equal(seen.length,calls);assert.equal(db.prepare('SELECT result_json FROM content_checks WHERE id=?').get(id).result_json,saved);assert.equal(db.prepare('SELECT result_json FROM content_checks WHERE id=?').get(INTENT_STATE).result_json,state);
 }finally{db.close();}
});

test('continuation rechecks eligibility without skipping ranked neighbors when earlier cards or the cursor disappear',async()=>{
 const {db,env}=setup();try{
 const seen=[],options={now:()=>instant,fetchUpstream:provider(seen)},first=await(await handleIntent(request(),env,options)).json(),cursor=first.renderSelection.nextCursor;
 const remainder=first.receipt.ranked.slice(24).map(r=>r.id),changed=remainder.slice(0,5);
 db.prepare('DELETE FROM content_cards WHERE id=?').run(first.selectedIds[0]);db.prepare('DELETE FROM content_cards WHERE id=?').run(cursor);
 const held=JSON.parse(db.prepare('SELECT content_json FROM content_cards WHERE id=?').get(changed[0]).content_json);held.hold=true;db.prepare('UPDATE content_cards SET content_json=? WHERE id=?').run(JSON.stringify(held),changed[0]);
 db.prepare("UPDATE content_cards SET status='archived' WHERE id=?").run(changed[1]);db.prepare("UPDATE content_cards SET status='published' WHERE id=?").run(changed[2]);db.prepare('UPDATE content_cards SET expires_at=? WHERE id=?').run(new Date(instant-1).toISOString(),changed[3]);
 const invalid=JSON.parse(db.prepare('SELECT content_json FROM content_cards WHERE id=?').get(changed[4]).content_json);invalid.isSynthetic=true;db.prepare('UPDATE content_cards SET content_json=? WHERE id=?').run(JSON.stringify(invalid),changed[4]);
 const ids=[],calls=seen.length;let after=cursor;
 while(after){const response=await handleIntent(new Request('https://next.freedomvillage.church/api/content/intent?'+new URLSearchParams({receipt:first.receipt.requestId,after}),{headers:{'Cf-Access-Jwt-Assertion':'SYNTHETIC_ACCESS'}}),env,options);assert.equal(response.status,200);const page=await response.json();ids.push(...page.selectedIds);after=page.renderSelection.nextCursor;for(const id of changed)assert(!page.html.includes('id="card-'+id+'"'));}
 assert.deepEqual(ids,remainder.slice(5));assert.equal(seen.length,calls);
 }finally{db.close();}
});

test('continuation rejects malformed, unknown and duplicate cursors and retains model and pending guards',async()=>{
 const {db,env}=setup();try{
 const seen=[],options={now:()=>instant,fetchUpstream:provider(seen)},first=await(await handleIntent(request(),env,options)).json(),id=first.receipt.requestId,calls=seen.length;
 const get=params=>handleIntent(new Request('https://next.freedomvillage.church/api/content/intent?'+params,{headers:{'Cf-Access-Jwt-Assertion':'SYNTHETIC_ACCESS'}}),env,options);
 for(const params of ['after=connect-card','receipt=latest&after=connect-card','receipt='+id+'&after=','receipt='+id+'&after=../bad','receipt='+id+'&after=connect-card&after=freedom-kids','receipt='+id+'&after=unknown-card'])assert.equal((await get(params)).status,400);
 const row=JSON.parse(db.prepare('SELECT result_json FROM content_checks WHERE id=?').get(id).result_json);row.batches[0].model='unexpected';db.prepare('UPDATE content_checks SET result_json=? WHERE id=?').run(JSON.stringify(row),id);
 assert.equal((await get(new URLSearchParams({receipt:id,after:'connect-card'}))).status,409);
 row.status='pending';db.prepare('UPDATE content_checks SET result_json=? WHERE id=?').run(JSON.stringify(row),id);assert.equal((await get(new URLSearchParams({receipt:id,after:'connect-card'}))).status,409);assert.equal(seen.length,calls);
 }finally{db.close();}
});
test('failed and uncertain batches never claim future planned inputs were sent',async()=>{
 for(const uncertain of [false,true]){const {db,env}=setup(140);try{const seen=[],upstream=provider(seen,{failureAt:3});const fetchUpstream=async(...args)=>{if(uncertain&&seen.length===2){seen.push(JSON.parse(args[1].body));throw Error('SYNTHETIC_TRANSPORT_ERROR');}return upstream(...args);};
 const response=await handleIntent(request(),env,{now:()=>instant,fetchUpstream}),value=await response.json();assert.equal(response.status,503);assert.equal(value.receipt.batches.length,2);assert.equal(value.receipt.batchPlan[0].dispatch,'http-response');assert.equal(value.receipt.batchPlan[1].dispatch,uncertain?'transport-uncertain':'http-response');assert(value.receipt.batchPlan.slice(2).every(b=>b.dispatch==='not-attempted'));
 const attemptedIds=value.receipt.batches.flatMap(b=>b.candidateIds),inputIds=value.receipt.candidateInputs.map(c=>c.id);assert.deepEqual(inputIds,attemptedIds);assert(inputIds.length<value.receipt.candidateCount);assert(value.receipt.batchPlan.slice(2).flatMap(b=>b.candidateIds).every(id=>!inputIds.includes(id)));
 }finally{db.close();}}
});

test('explicit same-text new claim gets current dataset; old immutable snapshot visibly marks changed content and age',async()=>{
 const {db,env,put}=setup(2);try{let time=instant;const seen=[],options={now:()=>time,fetchUpstream:provider(seen)},first=await(await handleIntent(request(),env,options)).json();
 assert.equal(first.renderSelection.snapshot.state,'current');assert.equal(first.receipt.snapshot.version,1);assert.equal(first.receipt.snapshot.context.referenceTime,new Date(instant).toISOString());
 const saved=db.prepare('SELECT result_json FROM content_checks WHERE id=?').get(first.receipt.requestId).result_json,calls=seen.length;
 put('added-resource');const value=JSON.parse(db.prepare('SELECT content_json FROM content_cards WHERE id=?').get('freedom-kids').content_json);value.detail=['Changed public body.'];value.summary='Changed public summary.';db.prepare('UPDATE content_cards SET content_json=? WHERE id=?').run(JSON.stringify(value),'freedom-kids');
 const get=(receipt,pages=1,headers={})=>new Request('https://next.freedomvillage.church/api/content/intent?'+new URLSearchParams({receipt,replay:'first',pages:String(pages)}),{headers:{'Cf-Access-Jwt-Assertion':'SYNTHETIC_ACCESS',...headers}});
 const replay=await(await handleIntent(get(first.receipt.requestId),env,options)).json();assert.equal(replay.renderSelection.snapshot.state,'changed');assert.equal(replay.renderSelection.snapshot.addedCount,1);assert(!replay.selectedIds.includes('added-resource'));assert(replay.html.includes('Changed public summary.'));assert.equal(seen.length,calls);
 assert.equal(db.prepare('SELECT result_json FROM content_checks WHERE id=?').get(first.receipt.requestId).result_json,saved);
 time+=11000;const freshInput={query:'I would like community.',requestId:'jev-intent-request:22222222-2222-4222-8222-222222222222'},fresh=await(await handleIntent(request(freshInput),env,options)).json();assert(fresh.selectedIds.includes('added-resource'));assert.notEqual(fresh.receipt.snapshot.datasetSha256,first.receipt.snapshot.datasetSha256);assert(seen.length>calls);
 time+=1800001;const older=await(await handleIntent(get(fresh.receipt.requestId),env,options)).json();assert.equal(older.renderSelection.snapshot.state,'older');
 const row=JSON.parse(saved);delete row.snapshot;db.prepare('UPDATE content_checks SET result_json=? WHERE id=?').run(JSON.stringify(row),first.receipt.requestId);assert.equal((await(await handleIntent(get(first.receipt.requestId),env,options)).json()).renderSelection.snapshot.state,'unverified');
 }finally{db.close();}
});
test('first-page GET replay restores all traversed pages, rechecks eligibility and ownership, and never mutates state/spends',async()=>{
 const {db,env}=setup();try{const seen=[],options={now:()=>instant,fetchUpstream:provider(seen)},first=await(await handleIntent(request(),env,options)).json(),id=first.receipt.requestId,calls=seen.length;
 const saved=db.prepare('SELECT * FROM content_checks ORDER BY id').all();
 const get=(params,headers={})=>new Request('https://next.freedomvillage.church/api/content/intent?'+params,{headers:{'Cf-Access-Jwt-Assertion':'SYNTHETIC_ACCESS',...headers}});
 const params=new URLSearchParams({receipt:id,replay:'first',pages:'3'}),replayed=await(await handleIntent(get(params),{...env,JEV_ENABLED:'false'},options)).json();assert.equal(replayed.selectedIds.length,71);assert.deepEqual(replayed.selectedIds,first.receipt.ranked.map(r=>r.id));assert.deepEqual(db.prepare('SELECT * FROM content_checks ORDER BY id').all(),saved);
 assert.equal((await handleIntent(get(params,{'X-Fixture-User':'second'}),env,options)).status,404);assert.equal((await realHandleIntent(get(params),env,{...options,resolveOwner:async()=>null})).status,403);
 for(const changed of first.receipt.ranked.slice(65).map(r=>r.id))db.prepare('DELETE FROM content_cards WHERE id=?').run(changed);
 const current=await(await handleIntent(get(params),env,options)).json();assert.equal(current.selectedIds.length,65);assert.equal(current.renderSelection.nextCursor,null);assert.equal(seen.length,calls);
 for(const invalid of ['receipt=latest&replay=first','receipt='+id+'&replay=first&pages=12','receipt='+id+'&pages=3','receipt='+id+'&replay=first&after=connect-card','receipt='+id+'&replay=first&pages=3&pages=3'])assert.equal((await handleIntent(get(invalid),env,options)).status,400);
 }finally{db.close();}
});
