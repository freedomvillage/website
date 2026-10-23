// Synthetic fixtures only. These checks run in cloud CI, not on the Mac.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {publicCard,readCatalog,handleCatalogRequest,handleMediaRequest,MAX_MEDIA_BYTES,validCursor} from '../src/content/catalog.mjs';
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
 const list=await(await handleContentPage(req('/'),env)).text();assert(list.includes('Pause background animation'));assert(list.includes('loading="lazy"'));assert(!list.includes('<iframe'));const motionDetail=await(await handleContentPage(req('/cards/sample-motion'),env)).text();assert(motionDetail.includes('Pause background animation'));assert(motionDetail.includes('#sidebar{position:static!important'));assert(motionDetail.includes('#menu-toggle,.drawer-close'));
 const detail=await(await handleContentPage(req('/cards/sample-video'),env)).text();assert(detail.includes('Load video'));assert(detail.includes('Watch on YouTube'));assert(!detail.includes('<iframe'));
 }finally{db.close();}
});

test('practical action card exposes real individual links without nested anchors or a simulated form',async()=>{
 const {db,add,adapter}=database();try{add('sample-actions',sample({template:'actions',actions:[{label:'Contact',href:'https://example.org/contact'},{label:'Media',href:'https://example.org/media'}]}));
 const env={CONTENT_PILOT_ENABLED:'true',CONTENT_DB:adapter,ASSETS:{fetch:async()=>new Response(asset)}};
 const html=await(await handleContentPage(req('/'),env)).text(),main=html.match(/<main[\s\S]*?<\/main>/)[0];assert(main.includes('class="practical-actions"'));assert(main.includes('href="https://example.org/contact"'));assert(main.includes('href="https://example.org/media"'));assert(!main.includes('<form'));assert(!/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/.test(main));
 }finally{db.close();}
});

test('local actions and single-recipient mail handoffs are allowed; header injection is rejected',()=>{
 const row=c=>({id:'sample-links',content_json:JSON.stringify(c)});
 const valid=publicCard(row(sample({actions:[{label:'Related',targetId:'sample-other'},{label:'Email',href:'mailto:hello@example.org?subject=My%20question'}]})));assert(valid);assert.equal(valid.actions[0].targetId,'sample-other');
 for(const href of ['mailto:hello@example.org?bcc=other@example.org','mailto:hello@example.org?subject=Hi%0ABcc:other@example.org','mailto:one@example.org,two@example.org','file:///tmp/private','javascript:alert(1)'])assert.equal(publicCard(row(sample({actions:[{label:'Bad',href}]}))),null);
 assert.equal(publicCard(row(sample({actions:[{label:'Bad',targetId:'../private'}]}))),null);assert.equal(publicCard(row(sample({actions:[{label:'Bad',targetId:'sample',href:'https://example.org'}]}))),null);
});

test('private raster images are record-bound, explicitly disclosed and source fields remain private',async()=>{
 const media={kind:'image',src:'/media/sample-image.jpg',alt:'Source image description.',caption:'Source image, 2025.',width:1024,height:769,disclosure:'historical',fit:'contain',ratio:'4:3',focalPoint:{x:48,y:62}};
 const row=extra=>({id:'sample-image',content_json:JSON.stringify(sample({media:{...media,...extra},design:{theme:'paper',layout:'image',motif:'none',motion:'none',size:'feature'}}))});
 assert(publicCard(row({sourceUrl:'PRIVATE_SOURCE',rightsNote:'PRIVATE_NOTE'})));assert(!JSON.stringify(publicCard(row({sourceUrl:'PRIVATE_SOURCE'}))).includes('PRIVATE_SOURCE'));
 const artwork=publicCard(row({disclosure:'source-artwork',ratio:'1:1'}));assert(artwork);assert.equal(artwork.media.ratio,'1:1');
 for(const extra of [{src:'/media/other-image.jpg'},{src:'https://example.org/image.jpg'},{src:'/media/sample-image.svg'},{caption:''},{disclosure:'cleared'},{focalPoint:{x:101,y:50}},{width:13000},{ratio:'1; color:red'}])assert.equal(publicCard(row(extra)),null);
 const {db,add,adapter}=database();try{
  add('sample-image',JSON.parse(row({disclosure:'synthetic'}).content_json));let reads=0;
  const env={CONTENT_PILOT_ENABLED:'true',CONTENT_DB:adapter,ASSETS:{fetch:async()=>new Response(asset)},CONTENT_MEDIA:{get:async key=>{reads++;assert.equal(key,'sample-image.jpg');return {size:4,body:'DATA'};},head:async()=>({size:4})}};
  const html=await(await handleContentPage(req('/cards/sample-image'),env)).text();assert(html.includes('Concept artwork · synthetic portraits'));assert(html.includes('Source image, 2025.'));assert(html.includes('object-fit:contain'));assert(html.includes('width="1024"'));assert(!html.includes('PRIVATE_SOURCE'));
  const image=await handleMediaRequest(req('/media/sample-image.jpg'),env);assert.equal(image.status,200);assert.equal(image.headers.get('Cache-Control'),'private, no-store');assert.equal(image.headers.get('Cross-Origin-Resource-Policy'),'same-origin');assert.equal(await image.text(),'DATA');
  assert.equal((await handleMediaRequest(req('/media/other-image.jpg'),env)).status,404);assert.equal((await handleMediaRequest(new Request('https://next.freedomvillage.church/media/sample-image.jpg'),env)).status,404);assert.equal(reads,1);
  const head=await handleMediaRequest(new Request('https://next.freedomvillage.church/media/sample-image.jpg',{method:'HEAD',headers:{'Cf-Access-Jwt-Assertion':'TEST_FIXTURE'}}),env);assert.equal(head.headers.get('Content-Length'),'4');assert.equal(await head.text(),'');
  let canceled=false;env.CONTENT_MEDIA.get=async()=>({size:MAX_MEDIA_BYTES+1,body:new ReadableStream({cancel(){canceled=true;}})});assert.equal((await handleMediaRequest(req('/media/sample-image.jpg'),env)).status,413);assert(canceled);
 }finally{db.close();}
});
