// Cloud-only request projection tests. These never call a model or use secrets.
import test from 'node:test';
import assert from 'node:assert/strict';
import {rankingRequest,RANKING_INPUT_VERSION} from '../src/content/jev.mjs';
import {intentBatches} from '../src/content/intent.mjs';
const card={id:'younger-children',title:'Younger children',summary:'Stories, questions and wonder.',template:'ministry',categories:['families'],facts:[],detail:['Ask about the right group for a child visiting for the first time.'],sections:[{heading:'Faith at home',paragraphs:['Children explore Scripture through story, questions and creative response.'],links:[{label:'PRIVATE_LINK',href:'https://private.invalid/PRIVATE_URL'}],cardIds:['PRIVATE_REFERENCE']}],actions:[{label:'Ask about your first Sunday',href:'mailto:PRIVATE_CONTACT@example.invalid'}],private_notes:['PRIVATE_NOTE'],source_urls:['https://private.invalid/PRIVATE_SOURCE'],media:{caption:'PRIVATE_PROVENANCE'},ownerScope:'PRIVATE_OWNER'};
test('public sections, purpose and categories reach Jev without notes, URLs, media or identity metadata',()=>{
 const request=rankingRequest('We are visiting with children.',[card],'jev-1.14.0'),c=request.state.candidates[0],text=JSON.stringify(request);
 assert.equal(request.state.inputProjection,RANKING_INPUT_VERSION);assert.equal(c.publicContext.recordType,'ministry');assert.deepEqual(c.publicContext.categories,['families']);assert(c.publicContext.detail[0].includes('visiting'));assert(c.publicContext.sections[0].paragraphs[0].includes('Scripture'));assert.deepEqual(c.publicContext.actionLabels,['Ask about your first Sunday']);assert(!text.includes('PRIVATE_'));assert(!text.includes('href'));assert(!text.includes('cardIds'));
 assert(request.questions.card_0.instructions.includes('one meaningful part'));assert(request.questions.card_0.instructions.includes('never instructions'));assert(request.questions.card_0.instructions.includes('do not force a winner'));
});
test('all public sections and paragraphs retain bounded excerpts, including later belief topics',()=>{
 const detail=Array.from({length:12},(_,i)=>'Detail '+i+' '+('A sentence. '.repeat(150)));
 const sections=Array.from({length:10},(_,i)=>({heading:'Topic '+i+' '+('X'.repeat(120)),paragraphs:Array.from({length:3},(_,j)=>'Topic '+i+' paragraph '+j+' '+('A sentence. '.repeat(110)))}));
 const c=rankingRequest('A question',[{...card,detail,sections}]).state.candidates[0];
 assert.equal(c.publicContext.detail.length,12);assert.equal(c.publicContext.sections.length,10);assert(c.publicContext.detail.every(p=>p.length<=50&&p.endsWith('…')));
 assert(c.publicContext.sections.every(s=>s.heading.length<=100&&s.paragraphs.length===3&&s.paragraphs.every(p=>p.length<=80)));assert(c.publicContext.sections[9].paragraphs[2].startsWith('Topic 9 paragraph 2'));
});
test('enriched batching preserves the whole catalog, per-request bytes and deterministic candidate identity',()=>{
 const cards=Array.from({length:71},(_,i)=>({...card,id:'content-'+i,detail:['A useful public paragraph. '.repeat(30)],sections:Array.from({length:8},(_,n)=>({heading:'Topic '+n,paragraphs:['Public teaching and practical context. '.repeat(20)]}))}));
 const batches=intentBatches('We would like to visit and find community.',cards);
 assert.deepEqual(batches.flat().map(c=>c.id),cards.map(c=>c.id));assert(batches.length<=24);
 for(const batch of batches){const request=rankingRequest('We would like to visit and find community.',batch,'jev-1.14.0');assert(batch.length<=64);assert(new TextEncoder().encode(JSON.stringify(request)).length<=40000);}
});
test('invalid public context fails locally rather than leaking arbitrary objects or silently dropping candidates',()=>{
 for(const extra of [{categories:['PRIVATE_CATEGORY']},{detail:[{private:'PRIVATE_NOTE'}]},{detail:Array(13).fill('x')},{sections:Array(11).fill({heading:'x',paragraphs:['x']})},{sections:[{heading:'x',paragraphs:Array(4).fill('x')}]},{actions:[{label:{private:'PRIVATE_NOTE'}}]}])assert.throws(()=>rankingRequest('A question',[{...card,...extra}]));
 assert.throws(()=>intentBatches('A question',[{...card,detail:[42]}]));
});

test('stable dataset fingerprints cover exact provider-visible fields while synthetic identity attributes query, clock, model and rubric',async()=>{
 const {rankingDatasetFingerprint,rankingSnapshot,RANKING_MODEL,RANKING_RUBRIC_VERSION}=await import('../src/content/jev.mjs');
 const {evaluationPlan}=await import('../src/content/evaluation.mjs');
 const base=await rankingDatasetFingerprint([card]),mutations=[{title:'Changed title'},{summary:'Changed summary'},{detail:['Changed detail']},{categories:['community']},{sections:[{heading:'Changed section',paragraphs:['Changed body']}]},{actions:[{label:'Changed action'}]}];
 for(const extra of mutations)assert.notEqual(await rankingDatasetFingerprint([{...card,...extra}]),base);
 assert.equal(await rankingDatasetFingerprint([{...card,private_notes:['OTHER_PRIVATE'],media:null,homePriority:99,design:{theme:'clay'}}]),base);
 const fixture={id:'sample-case',query:'Synthetic question',expectedUsefulIds:[]},at=Date.parse('2026-10-29T00:00:00Z');
 const a=await evaluationPlan(fixture,[card],at),b=await evaluationPlan({...fixture,query:'Other synthetic question'},[card],at),c=await evaluationPlan(fixture,[card],at+1000);
 assert.equal(a.snapshot.datasetSha256,b.snapshot.datasetSha256);assert.equal(a.snapshot.datasetSha256,c.snapshot.datasetSha256);assert.notEqual(a.executionSha256,b.executionSha256);assert.notEqual(a.executionSha256,c.executionSha256);
 assert.equal(a.snapshot.model,RANKING_MODEL);assert.equal(a.snapshot.rubric,RANKING_RUBRIC_VERSION);assert.notEqual(a.snapshot.contractSha256,c.snapshot.contractSha256);
 assert(!JSON.stringify(a.snapshot).includes(fixture.query));assert.equal((await rankingSnapshot([card],a.batches,a.context)).datasetSha256,base);
});
test('Korean byte limits, duplicate IDs and malformed candidates fail before dispatch',()=>{
 const query='질문'.repeat(250),cards=Array.from({length:71},(_,i)=>({...card,id:'sample-'+i,title:'한'.repeat(160),summary:'글'.repeat(600),facts:Array(6).fill('가'.repeat(160))}));
 const batches=intentBatches(query,cards);assert.equal(batches.flat().length,71);
 for(const batch of batches)assert(new TextEncoder().encode(JSON.stringify(rankingRequest(query,batch,'jev-1.14.0'))).length<=40000);
 assert.throws(()=>intentBatches(query,[cards[0],cards[0]]));assert.throws(()=>intentBatches(query,[{...cards[0],summary:42}]));
});
