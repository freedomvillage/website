// Synthetic fixtures only. These checks run in cloud CI, not on the Mac.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {publicCard,readCatalog,handleCatalogRequest,validCursor} from '../src/content/catalog.mjs';
import {handleContentPage} from '../src/content/pages.mjs';
const sample=(extra={})=>({schemaVersion:2,template:'story',title:'Sample story',summary:'A concise source summary.',detail:['A complete readable paragraph.'],facts:[],categories:['community'],actions:[],related:[],media:null,design:{theme:'paper',layout:'text',motif:'none',motion:'none',size:'regular'},homePriority:50,sourceStatus:'draft',isSynthetic:false,...extra});
function database(){
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE content_cards(id TEXT PRIMARY KEY,status TEXT,content_json TEXT,expires_at TEXT)');
 const add=(id,c,status='draft',expiry=null)=>db.prepare('INSERT INTO content_cards VALUES(?,?,?,?)').run(id,status,JSON.stringify(c),expiry);
 const adapter={prepare(sql){const statement=db.prepare(sql);return {bind(...args){return {all:async()=>({results:statement.all(...args)}),first:async()=>statement.get(...args)}}}}};return {db,add,adapter};
}
const req=path=>new Request('https://next.freedomvillage.church'+path,{headers:{'Cf-Access-Jwt-Assertion':'TEST_FIXTURE'}});
const asset='<!doctype html><html><head><title>Old</title><meta name="description" content="Old"></head><body><nav aria-label="Explore the community" id="filters"></nav><main id="main"></main><script src="content-view.js"></script></body></html>';
test('structured projection rejects held/synthetic/untrusted content and never exposes editorial fields',()=>{
 const row=c=>({id:'sample-story',content_json:JSON.stringify(c)}),c=publicCard(row({...sample(),editorial:'PRIVATE_FIXTURE',sourceUrl:'PRIVATE_SOURCE'}));assert(c);assert(!JSON.stringify(c).includes('PRIVATE'));
 for(const extra of [{isSynthetic:true},{isSynthetic:undefined},{hold:true},{sourceStatus:'pending'},{actions:[{label:'Unsafe',href:'javascript:alert(1)'}]},{categories:['unknown']},{media:{kind:'brand',src:'https://evil.invalid/logo.svg',alt:'Bad'}},{related:['../bad']},{homePriority:1000}])assert.equal(publicCard(row(sample(extra))),null);
});
test('real SQL keyset pagination has stable priority order without duplicate/missing cards',async()=>{
 const {db,add,adapter}=database();try{for(let i=0;i<29;i++)add('sample-'+String(i).padStart(2,'0'),sample({homePriority:i<3?90:50}));
 add('hidden-synthetic',sample({isSynthetic:true}));add('held',sample({hold:true}));add('archived',sample(),'archived');add('expired',sample(),'draft','2020-01-01T00:00:00Z');
 const a=await readCatalog(adapter),b=await readCatalog(adapter,{after:a.nextCursor});assert.equal(a.items.length,24);assert.equal(b.items.length,5);assert.equal(b.nextCursor,null);const ids=[...a.items,...b.items].map(x=>x.id);assert.equal(new Set(ids).size,29);assert.deepEqual(ids.slice(0,3),['sample-00','sample-01','sample-02']);assert(!ids.some(x=>/hidden|held|archived|expired/.test(x)));
 }finally{db.close();}
});
test('topic SQL selects multi-category union members and query validation is bounded',async()=>{
 const {db,add,adapter}=database();try{add('sample-one',sample({categories:['families','community']}));add('sample-two',sample({categories:['faith']}));
 const list=await readCatalog(adapter,{topic:'families'});assert.deepEqual(list.items.map(x=>x.id),['sample-one']);
 const env={CONTENT_PILOT_ENABLED:'true',CONTENT_DB:adapter};for(const path of ['/api/content?topic=bad','/api/content?after=bad','/api/content?after=10%3Aone&after=10%3Atwo','/api/content?x=1'])assert.equal((await handleCatalogRequest(req(path),env)).status,400);
 assert(validCursor('50:sample-one'));assert(!validCursor('999:sample-one'));assert(!validCursor("50:sample' OR 1=1"));
 }finally{db.close();}
});
test('clean generic detail and topic pages use canonical facts and finite related content',async()=>{
 const {db,add,adapter}=database();try{add('sample-story',sample({related:['sample-related']}));add('sample-related',sample({title:'Related sample',categories:['families']}));
 const env={CONTENT_PILOT_ENABLED:'true',CONTENT_DB:adapter,ASSETS:{fetch:async()=>new Response(asset)}};
 const r=await handleContentPage(req('/cards/sample-story'),env),html=await r.text();assert.equal(r.status,200);assert(html.includes('A complete readable paragraph.'));assert(html.includes('Related sample'));assert(html.includes('href="/cards/sample-related"'));assert(!html.includes('iframe'));
 const t=await handleContentPage(req('/topics/families'),env),topic=await t.text();assert.equal(t.status,200);assert(topic.includes('aria-current="page">Families'));assert(topic.includes('Related sample'));assert(!topic.includes('href="/cards/sample-story"'));
 assert.equal((await handleContentPage(req('/events/sample-story'),env)).status,308);
 }finally{db.close();}
});
test('media and motion are explicit, source-limited and have static accessible fallback',async()=>{
 const {db,add,adapter}=database();try{add('sample-motion',sample({design:{theme:'youth',layout:'brand',motif:'none',motion:'gradient',size:'feature'},media:{kind:'brand',src:'https://cdn.prod.website-files.com/60e0035471e8115799a8640b/sample.svg',alt:'Sample brand'}}));add('sample-video',sample({template:'sermon',media:{kind:'youtube',videoId:'abcdefghijk',title:'Sample video'}}));
 const env={CONTENT_PILOT_ENABLED:'true',CONTENT_DB:adapter,ASSETS:{fetch:async()=>new Response(asset)}};
 const list=await(await handleContentPage(req('/'),env)).text();assert(list.includes('Pause background animation'));assert(list.includes('loading="lazy"'));assert(!list.includes('<iframe'));
 const detail=await(await handleContentPage(req('/cards/sample-video'),env)).text();assert(detail.includes('Load video'));assert(detail.includes('Watch on YouTube'));assert(!detail.includes('<iframe'));
 }finally{db.close();}
});
