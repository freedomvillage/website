// Entirely intercepted provider/SQLite fixtures: no real API, keys or remote storage.
import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {handleRankingEvaluation,validFixtures} from '../src/content/evaluation.mjs';import {lexicalRank} from '../src/content/lexical.mjs';import {rankingRequest,rankingResult,rankPublishedCards} from '../src/content/jev.mjs';
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
test('one fixed case stores actual model/usage/latency/inputs and replay cannot call twice',async()=>{const {db,env}=setup();try{const count={calls:0},options={fetchUpstream:provider(count),now:()=>instant};const response=await handleRankingEvaluation(request('sample-one'),env,options);assert.equal(response.status,200);const html=await response.text();assert(!html.includes(secret));const saved=JSON.parse(db.prepare('SELECT result_json FROM content_checks WHERE id=?').get('ranking-eval-v1:sample-one').result_json);assert.equal(saved.status,'ok');assert.equal(saved.query,'baptisim');assert.equal(saved.model,'jev-1.14.0');assert.equal(saved.usage.inputTokens,100);assert.equal(saved.estimatedCostUsd,.0000042);assert.equal(saved.datasetSha256.length,64);assert.equal(saved.isSyntheticQuery,true);assert(saved.comparison.expectedHits.jev.includes('sample-baptism'));await handleRankingEvaluation(request('sample-one'),env,options);await handleRankingEvaluation(request(),env,options);assert.equal(count.calls,1);}finally{db.close();}});
test('pending attempt coalesces other cases; no lock stealing or automatic retry',async()=>{const {db,env}=setup();try{let resolve,count=0;const wait=new Promise(r=>resolve=r),options={now:()=>instant,fetchUpstream:async(...args)=>{count++;await wait;return provider({calls:0})(...args);}};const first=handleRankingEvaluation(request('sample-one'),env,options);while(count===0)await new Promise(r=>setImmediate(r));const second=await handleRankingEvaluation(request('sample-two'),env,options);assert.equal(second.status,409);assert.equal(count,1);resolve();assert.equal((await first).status,200);}finally{db.close();}});
test('provider failure consumes its claim and blocks further spending for review',async()=>{const {db,env}=setup();try{let calls=0;const options={now:()=>instant,fetchUpstream:async()=>{calls++;return new Response('PRIVATE_PROVIDER_FIXTURE',{status:429});}};const html=await(await handleRankingEvaluation(request('sample-one'),env,options)).text();assert(!html.includes('PRIVATE_PROVIDER_FIXTURE'));assert(html.includes('<button disabled>Run this fixed case once'));assert.equal((await handleRankingEvaluation(request('sample-two'),env,options)).status,409);assert.equal(calls,1);}finally{db.close();}});

function delayedRequest(id){
 let release,bodyRequested;
 const reading=new Promise(resolve=>bodyRequested=resolve);
 const body=new ReadableStream({pull(controller){bodyRequested();return new Promise(resolve=>{release=()=>{controller.enqueue(new TextEncoder().encode('caseId='+id));controller.close();resolve();};});}},{highWaterMark:0});
 return {request:new Request('https://next.freedomvillage.church/api/content/evaluation',{method:'POST',duplex:'half',headers:{'Cf-Access-Jwt-Assertion':'LOCAL_ACCESS_FIXTURE',Origin:'https://next.freedomvillage.church','Content-Type':'application/x-www-form-urlencoded'},body}),reading,release:()=>release()};
}
test('a delayed body cannot bypass a failure completed before its lock acquisition',async()=>{
 const {db,env}=setup();try{
  let calls=0;const options={now:()=>instant,fetchUpstream:async()=>{calls++;return new Response('PRIVATE_PROVIDER_FIXTURE',{status:429});}};
  const delayed=delayedRequest('sample-two'),second=handleRankingEvaluation(delayed.request,env,options);await delayed.reading;
  assert.equal((await handleRankingEvaluation(request('sample-one'),env,options)).status,200);
  delayed.release();const response=await second;assert.equal(response.status,409);assert.equal((await response.json()).status,'prior-attempt-needs-review');assert.equal(calls,1);
  assert.equal(db.prepare('SELECT count(*) AS count FROM content_checks WHERE id=?').get('ranking-eval-v1:sample-two').count,0);
 }finally{db.close();}
});
test('a delayed body uses current budget and current fixture approval under the lock',async()=>{
 for(const mode of ['budget','approval']){const {db,env}=setup();try{
  let calls=0;const delayed=delayedRequest('sample-two'),pending=handleRankingEvaluation(delayed.request,env,{now:()=>instant,fetchUpstream:async()=>{calls++;}});await delayed.reading;
  if(mode==='budget')db.prepare('INSERT INTO content_checks VALUES(?,?,?)').run('ranking-eval-v1:sample-one',JSON.stringify({status:'ok',estimatedCostUsd:.10}),new Date(instant).toISOString());
  else db.prepare('UPDATE content_checks SET result_json=? WHERE id=?').run(JSON.stringify({...fixtures,executionApproved:false}),'ranking-fixtures-v1');
  delayed.release();const response=await pending;assert.equal(response.status,409);assert.equal((await response.json()).status,mode==='budget'?'experiment-budget-exhausted':'credit-verification-required');assert.equal(calls,0);
  assert.equal(JSON.parse(db.prepare('SELECT result_json FROM content_checks WHERE id=?').get('ranking-eval-v1:lock').result_json).caseId,null);
 }finally{db.close();}}
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
