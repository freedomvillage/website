// Cloud-compatible, dependency-free route/security checks. No real provider or remote DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import {handleContentPage,serializeBoot} from '../src/content/pages.mjs';
const origin='https://next.freedomvillage.church';
const sample={schemaVersion:1,template:'event',title:'Sample event',summary:'Source-backed sample.',date:'Saturday',time:'10am',venue:'Sample venue',address:null,detail:['Readable detail.'],theme:'breakfast',actions:[{label:'Details',href:'https://example.org/'}],image:{src:'/media/sample-event.png',alt:'Sample illustration.',width:1920,height:1080}};
const row={id:'sample-event',content_json:JSON.stringify(sample)};
const shell='<!doctype html><html><head><title>Old title</title><meta name="description" content="Old summary"></head><body><main id="main"><p>Old cards</p></main><script src="content-view.js"></script></body></html>';
function env(overrides={}){
 const queries=[];
 return {
  CONTENT_PILOT_ENABLED:'true',queries,
  ASSETS:{async fetch(r){assert.equal(new URL(r.url).pathname,'/');return new Response(shell,{headers:{'Content-Type':'text/html'}});}},
  CONTENT_DB:{
   prepare(sql){
    queries.push(sql);
    return {
     bind(...args){
      return {
       async all(){return {results:[row]};},
       async first(){return args[0]==='sample-event'?row:null;}
      };
     }
    };
   }
  },
  ...overrides
 };
}
function request(path='/',options={}){return new Request(origin+path,{headers:{'Cf-Access-Jwt-Assertion':'LOCAL_FIXTURE_NOT_A_TOKEN'},...options});}
test('initial HTML contains real content and crawlable clean links without a browser fetch',async()=>{const r=await handleContentPage(request(),env());assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.match(r.headers.get('X-Robots-Tag'),/noindex/);const html=await r.text();assert.match(html,/<base href="\/">/);assert.match(html,/href="\/events\/sample-event"/);assert.match(html,/Sample event/);assert.match(html,/content-bootstrap/);assert.match(html,/<noscript>/);assert(!html.includes('Old cards'));assert(!html.includes('#story='));});
test('direct detail has heading, facts, body, real action and per-page metadata',async()=>{const r=await handleContentPage(request('/events/sample-event'),env());const html=await r.text();assert.equal(r.status,200);assert.match(html,/<title>Sample event — The Church at Freedom Village<\/title>/);assert.match(html,/<h1 tabindex="-1">Sample event<\/h1>/);assert.match(html,/Readable detail/);assert.match(html,/href="https:\/\/example.org\/"/);assert.match(html,/href="\/">← Back/);});
test('private guards and method restrictions fail closed before D1',async()=>{for(const r of [new Request(origin),new Request('https://alternate.invalid/',{headers:{'Cf-Access-Jwt-Assertion':'LOCAL_FIXTURE'}})]){const e=env();assert.equal((await handleContentPage(r,e)).status,404);assert.equal(e.queries.length,0);}const e=env();assert.equal((await handleContentPage(request('/',{method:'POST'}),e)).status,405);assert.equal(e.queries.length,0);assert.equal((await handleContentPage(request(),env({CONTENT_PILOT_ENABLED:'false'}))).status,404);});
test('missing/invalid paths are actual 404, storage failures are sanitized 503',async()=>{for(const path of ['/events/not-present','/events/%2F','/not-a-page','/sitemap.xml','/llms.txt'])assert.equal((await handleContentPage(request(path),env())).status,404);const r=await handleContentPage(request(),env({CONTENT_DB:{prepare(){throw new Error('PRIVATE_ERROR_FIXTURE');}}}));assert.equal(r.status,503);const html=await r.text();assert.match(html,/Content unavailable/);assert(!html.includes('PRIVATE_ERROR_FIXTURE'));});
test('HEAD preserves status/metadata with no body; normalization stays on the same origin',async()=>{const r=await handleContentPage(request('/events/sample-event',{method:'HEAD'}),env());assert.equal(r.status,200);assert.equal(await r.text(),'');for(const path of ['/events/sample-event/','/index.html']){const r=await handleContentPage(request(path),env());assert.equal(r.status,308);assert.equal(r.headers.get('Location'),path==='/index.html'?'/':'/events/sample-event');}});
test('stored strings cannot escape metadata, markup or the bootstrap JSON element',async()=>{const hostile={...sample,title:'</script><script>BAD()</script>',summary:'\" onload=\"BAD()',detail:['<img src=x onerror=BAD()>']};const malicious={...row,content_json:JSON.stringify(hostile)};const e=env({CONTENT_DB:{prepare(){return {bind(){return {all:async()=>({results:[malicious]})};}};}}});const r=await handleContentPage(request(),e),html=await r.text();assert(!html.includes('<script>BAD()'));assert(html.includes('&lt;/script&gt;'));assert(html.includes('&quot; onload=&quot;'));assert(html.includes('\\u003c/script\\u003e'));const input={text:'</script>\u2028&'};assert.deepEqual(JSON.parse(serializeBoot(input)),input);});
test('private robots explicitly disallows crawling and never exports draft URLs',async()=>{const r=await handleContentPage(request('/robots.txt'),env());assert.equal(r.status,200);assert.equal(await r.text(),'User-agent: *\nDisallow: /\n');});
