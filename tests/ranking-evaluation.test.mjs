// Entirely intercepted provider/SQLite fixtures: no real API, keys or remote storage.
import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {handleRankingEvaluation,validFixtures,evaluationPlan,evaluateSyntheticFixture} from '../src/content/evaluation.mjs';import {lexicalRank} from '../src/content/lexical.mjs';import {rankingRequest,rankingResult,rankPublishedCards} from '../src/content/jev.mjs';
const instant=Date.parse('2026-10-24T00:00:00Z'),secret='LOCAL_TEST_VALUE_NOT_A_CREDENTIAL';
const fixtures={version:1,isSyntheticQuery:true,executionApproved:true,remainingCreditsUsd:1,creditVerifiedAt:new Date(instant).toISOString(),cases:[{id:'sample-one',query:'baptisim',expectedUsefulIds:['sample-baptism']},{id:'sample-two',query:'a different question',expectedUsefulIds:[]}]};
const content=(title,summary)=>({schemaVersion:2,template:'story',title,summary,detail:['Fixture paragraph.'],facts:[],categories:['faith'],actions:[],related:[],media:null,design:{theme:'paper',layout:'text',motif:'none',motion:'none',size:'regular'},homePriority:50,sourceStatus:'draft',isSynthetic:false});
function setup(overrides={}){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE content_cards(id TEXT PRIMARY KEY,status TEXT,content_json TEXT,expires_at TEXT); CREATE TABLE content_checks(id TEXT PRIMARY KEY,result_json TEXT,created_at TEXT)');db.prepare('INSERT INTO content_checks VALUES(?,?,?)').run('ranking-fixtures-v1',JSON.stringify({...fixtures,...overrides}),new Date(instant).toISOString());for(const [id,c]of [['sample-baptism',content('Baptism','Considering baptism?')],['sample-community',content('Community','A group for shared life.')]])db.prepare('INSERT INTO content_cards VALUES(?,?,?,?)').run(id,'draft',JSON.stringify(c),null);
 const adapter={
  prepare(sql){
   const st=db.prepare(sql);
   return {
    bind(...a){
     return {
      first:async()=>st.get(...a),
      all:async()=>({results:st.all(...a)}),
      run:async()=>{const result=st.run(...a);return {meta:{changes:Number(result.changes)}};}
     };
    }
   };
  }
 };
 return {db,env:{CONTENT_PILOT_ENABLED:'true',JEV_ENABLED:'true',TYPESAFE_API_KEY:secret,CONTENT_DB:adapter}};
}
const request=(id=null,origin='https://next.freedomvillage.church')=>new Request('https://next.freedomvillage.church/api/content/evaluation',{method:id===null?'GET':'POST',headers:{'Cf-Access-Jwt-Assertion':'LOCAL_ACCESS_FIXTURE',...(id===null?{}:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'})},...(id===null?{}:{body:'caseId='+id})});
function provider(counter){return async(url,options)=>{counter.calls++;assert.equal(url,'https://api.typesafe.ai/v1/systemone');assert.equal(options.redirect,'manual');const body=JSON.parse(options.body);assert.equal(body.model,'jev-1.14.0');const answers=Object.fromEntries(Object.keys(body.questions).map((key,i)=>[key,{type:'score',score:i?0:2,confidence:1,probabilities:{0:i?1:0,1:0,2:i?0:1}}]));return Response.json({model:'jev-1.14.0',usage:{input_tokens:100,output_tokens:20},answers});};}
test('fixture shape and request bounds reject unapproved arbitrary inputs',()=>{assert(validFixtures(fixtures));assert(!validFixtures({...fixtures,isSyntheticQuery:false}));assert(!validFixtures({...fixtures,cases:[...fixtures.cases,fixtures.cases[0]]}));assert(!validFixtures({...fixtures,cases:[{id:'bad',query:'x'.repeat(501),expectedUsefulIds:[]}]}));assert.throws(()=>rankingRequest('x',[]));assert.throws(()=>rankingRequest('x',Array(65).fill({})));assert.throws(()=>rankingRequest('x',[{id:'a',title:'a',summary:'a'}],'unapproved-model'));});
test('lexical baseline recovers one-edit typo without manufacturing off-topic matches',()=>{const cards=[{id:'baptism',title:'Baptism',summary:'New life',facts:[]},{id:'other',title:'Community',summary:'Groups',facts:[]}];assert.equal(lexicalRank('baptisim',cards)[0].id,'baptism');assert(lexicalRank('baptisim',cards)[0].score>0);assert(lexicalRank('passport renewal',cards).every(c=>c.score===0));});
test('GET and wrong-origin POST cannot invoke the provider',async()=>{const {db,env}=setup();try{const counter={calls:0},options={fetchUpstream:provider(counter),now:()=>instant};assert.equal((await handleRankingEvaluation(request(),env,options)).status,200);assert.equal((await handleRankingEvaluation(request('sample-one','https://other.invalid'),env,options)).status,403);assert.equal(counter.calls,0);}finally{db.close();}});
test('credit verification, fixed case membership and existing secret fail closed',async()=>{for(const change of [{executionApproved:false},{remainingCreditsUsd:.01},{creditVerifiedAt:'2020-01-01T00:00:00Z'}]){const {db,env}=setup(change);try{let calls=0;assert.equal((await handleRankingEvaluation(request('sample-one'),env,{now:()=>instant,fetchUpstream:async()=>{calls++;}})).status,409);assert.equal(calls,0);}finally{db.close();}}
 const {db,env}=setup();try{assert.equal((await handleRankingEvaluation(request('not-a-case'),env,{now:()=>instant})).status,400);delete env.TYPESAFE_API_KEY;assert.equal((await handleRankingEvaluation(request('sample-one'),env,{now:()=>instant})).status,409);}finally{db.close();}});
test('new evaluation execution is inert even with historical approval, with no lock/claim or provider call',async()=>{
 const {db,env}=setup();try{let calls=0;const before=db.prepare('SELECT * FROM content_checks ORDER BY id').all();
 for(const id of ['sample-one','sample-two']){const r=await handleRankingEvaluation(request(id),env,{now:()=>instant,fetchUpstream:async()=>{calls++;}});assert.equal(r.status,409);assert.equal((await r.json()).status,'evaluation-execution-disabled');}
 assert.equal(calls,0);assert.deepEqual(db.prepare('SELECT * FROM content_checks ORDER BY id').all(),before);
 }finally{db.close();}
});
test('failed/null historical claims remain byte-for-byte intact and stop spending before any new execution',async()=>{
 for(const saved of [null,JSON.stringify({status:'unavailable',receiptMarker:'IMMUTABLE_FAILURE'})]){const {db,env}=setup();try{
 db.prepare('INSERT INTO content_checks VALUES(?,?,?)').run('ranking-eval-v1:sample-one',saved,new Date(instant).toISOString());const before=db.prepare('SELECT * FROM content_checks ORDER BY id').all();let calls=0;
 const r=await handleRankingEvaluation(request('sample-two'),env,{now:()=>instant,fetchUpstream:async()=>{calls++;}});assert.equal((await r.json()).status,'prior-attempt-needs-review');
 await handleRankingEvaluation(request(),env,{now:()=>instant});assert.equal(calls,0);assert.deepEqual(db.prepare('SELECT * FROM content_checks ORDER BY id').all(),before);
 }finally{db.close();}}
});
test('synthetic evaluation shares the visitor 71/256 complete batch pipeline and rejects257 before dispatch',async()=>{
 const {db,env}=setup();try{
 for(const size of [71,256]){
 const cards=Array.from({length:size},(_,i)=>({id:'sample-'+i,title:'공동체 '+i,summary:'함께 배우는 이야기',facts:[],detail:['Approved public context.'],categories:['faith']})),counter={calls:0};
 const result=await evaluateSyntheticFixture(fixtures.cases[0],cards,env,{now:()=>instant,fetchUpstream:provider(counter)});
 assert.equal(result.status,'ok');assert.equal(result.ranked.length,size);assert.equal(new Set(result.ranked.map(c=>c.id)).size,size);assert.equal(result.snapshot.context.referenceTime,new Date(instant).toISOString());assert.equal(result.snapshot.context.timeZone,'Asia/Seoul');
 assert.equal(counter.calls,result.batches.length);assert.equal(result.datasetSha256.length,64);assert.equal(result.executionSha256.length,64);
 let calls=0;await assert.rejects(()=>evaluateSyntheticFixture(fixtures.cases[0],[...cards,...Array.from({length:257-size},(_,i)=>({...cards[0],id:'extra-'+i}))],env,{now:()=>instant,fetchUpstream:async()=>{calls++;}}));assert.equal(calls,0);
 }
 }finally{db.close();}
});
test('synthetic partial failure never presents incomplete rankings as complete',async()=>{
 const {db,env}=setup();try{const cards=Array.from({length:71},(_,i)=>({id:'sample-'+i,title:'A',summary:'B'}));let calls=0;
 const result=await evaluateSyntheticFixture(fixtures.cases[0],cards,env,{now:()=>instant,fetchUpstream:async(...args)=>++calls===1?provider({calls:0})(...args):Response.json({answers:{}})});
 assert.equal(result.status,'unavailable');assert.deepEqual(result.ranked,[]);assert.equal(result.usageComplete,false);assert.equal(calls,2);
 }finally{db.close();}
});

test('probability rounding boundary is stable without clamping or renormalizing provider values',()=>{
 const cards=[{id:'sample-one',title:'Sample',summary:'Fixture'}],r=rankingRequest('query',cards);
 for(const probabilities of [{0:.33,1:.33,2:.33},{0:.34,1:.33,2:.34}]){
  const score=probabilities[1]+2*probabilities[2],payload={model:'jev-1.14.0',usage:{input_tokens:1,output_tokens:1},answers:{card_0:{type:'score',score,confidence:0,probabilities}}};
  const result=rankingResult(payload,r);assert.deepEqual(result.ranked[0].probabilities,probabilities);assert.equal(result.ranked[0].score,score);
 }
 const bad={model:'jev-1.14.0',usage:{input_tokens:1,output_tokens:1},answers:{card_0:{type:'score',score:.99,confidence:0,probabilities:{0:.32,1:.33,2:.33}}}};
 assert.throws(()=>rankingResult(bad,r),e=>e.validationCode==='probability-sum');
});
test('invalid provider data retains only fixed validation categories and bounded numeric context',async()=>{
 const cards=[{id:'sample-one',title:'Sample',summary:'Fixture'}];
 const result=await rankPublishedCards('query',cards,{JEV_ENABLED:'true',TYPESAFE_API_KEY:secret},{fetchUpstream:async()=>Response.json({model:'jev-1.14.0',usage:{input_tokens:18,output_tokens:4},answers:{card_0:{type:'score',confidence:.5,score:'PRIVATE_VALUE',probabilities:{0:0,1:1,2:0}}},message:'PRIVATE_PROVIDER_TEXT'})});
 assert.equal(result.status,'unavailable');assert.deepEqual(result.validation,{code:'score',questionIndex:0,answerCount:1,model:'jev-1.14.0'});assert(!JSON.stringify(result).includes('PRIVATE'));assert.equal(result.usage.inputTokens,18);assert.deepEqual(result.ranked,[]);
});

function growCatalog(db){for(let i=0;i<69;i++)db.prepare('INSERT INTO content_cards VALUES(?,?,?,?)').run('sample-extra-'+String(i).padStart(2,'0'),'draft',JSON.stringify(content('Additional fixture '+i,'Synthetic source metadata for a cloud regression.')),null);}
test('a 71-card catalog keeps saved failure receipts readable without enabling provider execution',async()=>{
 const {db,env}=setup();try{
  growCatalog(db);const failure=JSON.stringify({status:'unavailable',category:'invalid-response',receiptMarker:'IMMUTABLE_FAILED_FIXTURE'});
  db.prepare('INSERT INTO content_checks VALUES(?,?,?)').run('ranking-eval-v1:sample-one',failure,new Date(instant).toISOString());
  let calls=0;const options={now:()=>instant,fetchUpstream:async()=>{calls++;throw Error('Must not call');}};
  const get=await handleRankingEvaluation(request(),env,options);assert.equal(get.status,200);const html=await get.text();assert(html.includes('IMMUTABLE_FAILED_FIXTURE'));assert(html.includes('256-candidate'));assert(html.includes('<button disabled>Run this fixed case once'));
  const post=await handleRankingEvaluation(request('sample-two'),env,options);assert.equal(post.status,409);assert.equal((await post.json()).status,'prior-attempt-needs-review');
  assert.equal(calls,0);assert.equal(db.prepare('SELECT result_json FROM content_checks WHERE id=?').get('ranking-eval-v1:sample-one').result_json,failure);
  assert.equal(db.prepare('SELECT count(*) AS count FROM content_checks WHERE id=?').get('ranking-eval-v1:sample-two').count,0);
 }finally{db.close();}
});
test('71-card evaluation remains disabled before a claim or provider call',async()=>{
 const {db,env}=setup();try{
  growCatalog(db);let calls=0;const response=await handleRankingEvaluation(request('sample-one'),env,{now:()=>instant,fetchUpstream:async()=>{calls++;throw Error('Must not call');}});
  assert.equal(response.status,409);assert.equal((await response.json()).status,'evaluation-execution-disabled');assert.equal(calls,0);
  assert.equal(db.prepare('SELECT count(*) AS count FROM content_checks WHERE id=?').get('ranking-eval-v1:sample-one').count,0);
 }finally{db.close();}
});

// Fractional position/probability/legend contract: https://docs.typesafe.ai/primitives/score
// This is a synthetic compatibility fixture, not the discarded live failure response.
test('documented fractional Score shape with a rubric legend is accepted without retaining the legend',()=>{
 const request=rankingRequest('Synthetic visitor query',[{id:'sample-one',title:'Synthetic title',summary:'Synthetic description'}],'jev-1.14.0');
 const payload={model:'jev-1.14.0',usage:{input_tokens:332,output_tokens:18},answers:{card_0:{type:'score',score:1.43,confidence:.35,legend:{0:'Synthetic low',1:'Synthetic middle',2:'Synthetic high'},probabilities:{0:0,1:.57,2:.43}}}};
 const result=rankingResult(payload,request);assert.equal(result.status,'ok');assert.equal(result.ranked[0].score,1.43);assert.equal(result.ranked[0].confidence,.35);
 assert.deepEqual(result.ranked[0].probabilities,{0:0,1:.57,2:.43});assert(!JSON.stringify(result).includes('legend'));assert(!JSON.stringify(result).includes('Synthetic middle'));
});

const diagnosticCards=[{id:'sample-one',title:'Synthetic title',summary:'Synthetic description'}];
const diagnosticEnv={JEV_ENABLED:'true',TYPESAFE_API_KEY:secret};
const scorePayload=()=>({model:'jev-1.14.0',usage:{input_tokens:18,output_tokens:4},answers:{card_0:{type:'score',score:1,confidence:.5,probabilities:{0:0,1:1,2:0}}}});
test('future schema failures retain the precise fixed branch but never provider values or answer names',async()=>{
 const cases=[
  ['model',p=>p.model='PRIVATE_MODEL'],
  ['answer-count',p=>p.answers={}],
  ['answer-keys',p=>p.answers={PRIVATE_ANSWER_NAME:p.answers.card_0}],
  ['usage',p=>p.usage.input_tokens='PRIVATE_USAGE'],
  ['answer-type',p=>p.answers.card_0.type='PRIVATE_TYPE'],
  ['confidence',p=>p.answers.card_0.confidence='PRIVATE_CONFIDENCE'],
  ['score',p=>p.answers.card_0.score='PRIVATE_SCORE'],
  ['probability-shape',p=>p.answers.card_0.probabilities={PRIVATE_LEVEL:1}],
  ['probability-range',p=>p.answers.card_0.probabilities[0]='PRIVATE_PROBABILITY'],
  ['probability-sum',p=>p.answers.card_0.probabilities={0:.1,1:1,2:0}],
  ['score-consistency',p=>p.answers.card_0.score=2]
 ];
 for(const [code,mutate] of cases){
  const payload=scorePayload();mutate(payload);payload.message='PRIVATE_PROVIDER_TEXT';
  const result=await rankPublishedCards('Synthetic query',diagnosticCards,diagnosticEnv,{fetchUpstream:async()=>Response.json(payload)});
  assert.deepEqual(result.failure,{version:1,stage:'schema',code});assert.equal(result.validation.code,code);assert.equal(result.httpStatus,200);assert.deepEqual(result.ranked,[]);
  assert(!JSON.stringify(result).includes('PRIVATE'));assert(!Object.hasOwn(result,'answers'));assert(!Object.hasOwn(result,'message'));
 }
});
test('transport, HTTP and bounded-body failures retain fixed stages without messages, headers or body bytes',async()=>{
 let canceled=false;
 const cases=[
  ['transport','request-failed',async()=>{throw Error('PRIVATE_TRANSPORT');}],
  ['transport','request-timeout-or-abort',async()=>{throw new DOMException('PRIVATE_TIMEOUT','TimeoutError');}],
  ['http','upstream-status',async()=>new Response('PRIVATE_HTTP',{status:429,headers:{'X-Private-Fixture':'PRIVATE_HEADER'}})],
  ['body','body-missing',async()=>new Response(null)],
  ['body','body-empty',async()=>new Response('')],
  ['body','body-json',async()=>new Response('{PRIVATE_JSON')],
  ['body','body-encoding',async()=>new Response(new Uint8Array([0xff]))],
  ['body','body-read',async()=>new Response(new ReadableStream({start(c){c.error(Error('PRIVATE_STREAM'));}}))],
  ['body','body-too-large',async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(65537));},cancel(){canceled=true;}}))]
 ];
 for(const [stage,code,fetchUpstream]of cases){
  const result=await rankPublishedCards('Synthetic query',diagnosticCards,diagnosticEnv,{fetchUpstream});
  assert.equal(result.status,'unavailable');assert.deepEqual(result.failure,{version:1,stage,code});assert.deepEqual(result.ranked,[]);assert(!JSON.stringify(result).includes('PRIVATE'));assert(!Object.hasOwn(result,'usage'));
 }
 assert(canceled);
});
test('a future malformed-body receipt retains safe classification and stays immutable while blocking more spend',async()=>{
 const {db,env}=setup();try{
  let calls=0;const options={now:()=>instant,fetchUpstream:async()=>{calls++;return new Response('{PRIVATE_RESPONSE');}};
  const html=await(await handleRankingEvaluation(request('sample-one'),env,options)).text();
  const original=db.prepare('SELECT result_json FROM content_checks WHERE id=?').get('ranking-eval-v1:sample-one').result_json,saved=JSON.parse(original);
  assert.deepEqual(saved.failure,{version:1,stage:'body',code:'body-json'});assert.equal(saved.estimatedCostUsd,null);assert(!original.includes('PRIVATE_RESPONSE'));assert(!html.includes('PRIVATE_RESPONSE'));
  assert.equal((await handleRankingEvaluation(request('sample-two'),env,options)).status,409);await handleRankingEvaluation(request(),env,options);
  assert.equal(calls,1);assert.equal(db.prepare('SELECT result_json FROM content_checks WHERE id=?').get('ranking-eval-v1:sample-one').result_json,original);
 }finally{db.close();}
});

test('an unexpected response model cannot satisfy the explicitly pinned request',()=>{
 const request=rankingRequest('A question',[{id:'sample',title:'Sample',summary:'Public content'}],'jev-1.14.0');
 const payload={model:'jev-other-model',usage:{input_tokens:100,output_tokens:20},answers:{card_0:{type:'score',score:2,confidence:1,probabilities:{0:0,1:0,2:1}}}};
 assert.throws(()=>rankingResult(payload,request),error=>error.validationCode==='model');
 assert.equal(rankingResult({...payload,model:'jev-1.14.0'},request).model,'jev-1.14.0');
});

test('worker injects the same eligibility clock into evaluation diagnostics as visitor catalog',async()=>{
 const {createWorker}=await import('../src/worker.mjs');const {db,env}=setup();try{
 db.prepare('UPDATE content_cards SET expires_at=? WHERE id=?').run(new Date(instant+1000).toISOString(),'sample-baptism');
 db.prepare('INSERT INTO content_checks VALUES(?,?,?)').run('ranking-eval-v1:sample-one',JSON.stringify({status:'ok',ranked:[{id:'sample-baptism',score:2,confidence:1}],comparison:{lexical:[]}}),new Date(instant).toISOString());
 const before=await(await createWorker({now:()=>instant}).fetch(request(),env)).text(),after=await(await createWorker({now:()=>instant+1001}).fetch(request(),env)).text();assert(before.includes('href="/cards/sample-baptism"'));assert(!after.includes('href="/cards/sample-baptism"'));
 }finally{db.close();}
});
