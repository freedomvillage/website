// Public copy and intercepted SQLite fixtures; cloud CI only, no real D1 or API.
import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {PROTOTYPE_COPY} from '../src/content/prototype-copy-data.mjs';
import {publicCard,handleCatalogRequest} from '../src/content/catalog.mjs';
import {handleContentPage} from '../src/content/pages.mjs';
const base=(extra={})=>({schemaVersion:2,template:'story',title:'Synthetic fixture',summary:'Synthetic summary',detail:['Synthetic readable detail.'],facts:[],categories:['faith'],actions:[],related:[],media:null,design:{theme:'paper',layout:'text',motif:'none',motion:'none',size:'regular'},homePriority:50,sourceStatus:'draft',isSynthetic:false,...extra});
const sunday=()=>base({template:'actions',summary:PROTOTYPE_COPY.sunday.summary,actions:[{label:'Ask about visiting',targetId:'visit-help'}]});
const beliefs=()=>base({sections:PROTOTYPE_COPY.beliefs.before.map(s=>({...s,paragraphs:[...s.paragraphs],links:[{label:'Public reference',href:'https://example.org/reference'}],cardIds:[]}))});
const row=(id,content)=>({id,content_json:JSON.stringify(content)});
test('copy applies only after normal eligibility validation and never creates a missing record',()=>{
 const input=sunday(),stored=JSON.stringify(input),projected=publicCard(row('sunday-gatherings',input));
 assert.deepEqual(projected.facts,['Sunday · 2:10 PM']);assert.equal(projected.summary,input.summary);assert.equal(JSON.stringify(input),stored);
 for(const invalid of [{hold:true},{isSynthetic:true},{sourceStatus:'pending'},{actions:[{label:'Unsafe',href:'javascript:alert(1)'}]}])assert.equal(publicCard(row('sunday-gatherings',{...input,...invalid})),null);
 assert.equal(publicCard(row('sunday-gatherings',{})),null);
 const different=publicCard(row('other-card',input));assert.deepEqual(different.facts,[]);
});
test('future authoritative copy, service facts and edited belief sections are not overwritten',()=>{
 for(const extra of [{summary:'A new authoritative summary.'},{facts:['A new service time.']}]){
  const input={...sunday(),...extra},projected=publicCard(row('sunday-gatherings',input));assert.equal(projected.summary,input.summary);assert.deepEqual(projected.facts,input.facts);
 }
 for(const mode of ['paragraph','heading','count']){
  const input=beliefs();if(mode==='paragraph')input.sections[0].paragraphs=['An owner edit.'];if(mode==='heading')input.sections[0].heading='Edited heading';if(mode==='count')input.sections.pop();
  assert.deepEqual(publicCard(row('what-we-believe',input)).sections,input.sections);
 }
});
test('six belief sections regain source detail while references, embedded IDs and all other fields stay intact',()=>{
 const input=beliefs();input.sections[7].cardIds=['baptism','lords-supper'];input.editorial='PRIVATE_SOURCE_SENTINEL';
 const projected=publicCard(row('what-we-believe',input));assert.equal(projected.sections.length,8);
 assert.equal(projected.sections.filter((s,i)=>JSON.stringify(s.paragraphs)!==JSON.stringify(input.sections[i].paragraphs)).length,6);
 for(let i=0;i<8;i++){assert.equal(projected.sections[i].heading,input.sections[i].heading);assert.deepEqual(projected.sections[i].links,input.sections[i].links);assert.deepEqual(projected.sections[i].cardIds,input.sections[i].cardIds);}
 assert(!JSON.stringify(projected).includes('PRIVATE_SOURCE_SENTINEL'));
 const imported={...input,sections:projected.sections};assert.deepEqual(publicCard(row('what-we-believe',imported)),projected);
});
test('the shared projection reaches API, homepage and detail once, with no database mutation',async()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec('CREATE TABLE content_cards(id TEXT PRIMARY KEY,status TEXT,content_json TEXT,expires_at TEXT)');
  const stored=JSON.stringify(sunday());db.prepare('INSERT INTO content_cards VALUES(?,?,?,?)').run('sunday-gatherings','draft',stored,null);
  let writes=0;const adapter={prepare(sql){assert(/^SELECT/.test(sql));const statement=db.prepare(sql);return {bind(...args){return {all:async()=>({results:statement.all(...args)}),first:async()=>statement.get(...args),run:async()=>{writes++;throw Error('No writes allowed');}};}};}};
  const shell='<!doctype html><html><head><title>Fixture</title><meta name="description" content="Fixture"></head><body><main id="main"></main><script src="content-view.js"></script></body></html>';
  const env={CONTENT_PILOT_ENABLED:'true',CONTENT_DB:adapter,ASSETS:{fetch:async()=>new Response(shell)}};
  const request=path=>new Request('https://next.freedomvillage.church'+path,{headers:{'Cf-Access-Jwt-Assertion':'LOCAL_FIXTURE'}});
  const api=await(await handleCatalogRequest(request('/api/content'),env)).json();assert.deepEqual(api.items[0].facts,['Sunday · 2:10 PM']);
  for(const path of ['/','/cards/sunday-gatherings']){const response=await handleContentPage(request(path),env),html=await response.text(),main=html.match(/<main[\s\S]*?<\/main>/)[0],detailStart=main.indexOf('<section id="detail"'),visible=path==='/'?main.slice(0,detailStart):main.slice(detailStart);assert.equal(response.status,200);assert(!visible.startsWith('<section id="detail" hidden'));assert.equal((visible.match(/Sunday · 2:10 PM/g)||[]).length,1);assert(html.includes('noindex'));}
  assert.equal(db.prepare('SELECT content_json FROM content_cards').get().content_json,stored);assert.equal(db.prepare('SELECT count(*) AS count FROM content_cards').get().count,1);assert.equal(writes,0);
 }finally{db.close();}
});

test('prepared SQL import matches the projection, preserves private fields and skips newer or held records',()=>{
 const sql=fs.readFileSync(new URL('../docs/imports/prototype-copy-2026-10-24.sql',import.meta.url),'utf8');
 for(const mode of ['baseline','newer','held']){
  const db=new DatabaseSync(':memory:');try{
   db.exec('CREATE TABLE content_cards(id TEXT PRIMARY KEY,status TEXT,content_json TEXT)');
   const s=sunday(),b=beliefs();s.editorial=b.editorial='PRIVATE_RETAINED_IN_DB';
   if(mode==='newer'){s.facts=['New owner schedule'];b.sections[0].paragraphs=['New owner wording'];}
   if(mode==='held'){s.hold=true;b.hold=true;}
   for(const [id,c]of [['sunday-gatherings',s],['what-we-believe',b]])db.prepare('INSERT INTO content_cards VALUES(?,?,?)').run(id,'draft',JSON.stringify(c));
   const expected=mode==='baseline'?['sunday-gatherings','what-we-believe'].map(id=>publicCard(db.prepare('SELECT id,content_json FROM content_cards WHERE id=?').get(id))):[s,b];
   db.exec(sql);
   for(const [i,id]of ['sunday-gatherings','what-we-believe'].entries()){const stored=db.prepare('SELECT id,content_json FROM content_cards WHERE id=?').get(id);const raw=JSON.parse(stored.content_json);assert.equal(raw.editorial,'PRIVATE_RETAINED_IN_DB');if(mode==='baseline'){if(i===0)assert.deepEqual(raw.facts,PROTOTYPE_COPY.sunday.facts);else assert.deepEqual(raw.sections.map(s=>({heading:s.heading,paragraphs:s.paragraphs})),PROTOTYPE_COPY.beliefs.after);}assert.deepEqual(mode==='baseline'?publicCard(stored):raw,expected[i]);}
  }finally{db.close();}
 }
});
