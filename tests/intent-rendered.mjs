// Explicit cloud-only rendered acceptance. No credentials, provider calls or live DB.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createWorker} from '../src/worker.mjs';
if(process.env.CI!=='true'||process.platform!=='linux')throw Error('Cloud Linux only');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const origin='https://next.freedomvillage.church',at=Date.parse('2026-10-25T03:00:00Z');
const output=resolve('rendered-review');await mkdir(output,{recursive:true});
const browser=await chromium.launch();
try{
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE content_cards(id TEXT PRIMARY KEY,status TEXT,content_json TEXT,expires_at TEXT);CREATE TABLE content_checks(id TEXT PRIMARY KEY,result_json TEXT,created_at TEXT)');
  const themes=['paper','ink','forest','clay','youth','outline'];
  for(let i=0;i<71;i++){
   const id=i===0?'freedom-kids':i===1?'connect-card':'sample-'+String(i).padStart(3,'0');
   const card={schemaVersion:2,template:'story',title:'Review resource '+(i+1),summary:'Synthetic review content for ranked resource continuation.',detail:['Synthetic public prose for browser acceptance.'],facts:[],categories:['community'],actions:[],related:[],media:null,design:{theme:themes[i%themes.length],layout:'text',motif:'none',motion:'none',size:'regular'},homePriority:50,sourceStatus:'draft',isSynthetic:false};
   db.prepare('INSERT INTO content_cards VALUES(?,?,?,?)').run(id,'draft',JSON.stringify(card),null);
  }
  const adapter={prepare(sql){
   const s=db.prepare(sql);
   return {bind(...args){return {
    first:async()=>s.get(...args),
    all:async()=>({results:s.all(...args)}),
    run:async()=>({meta:{changes:Number(s.run(...args).changes)}})
   };}};
  }};
  let providerCalls=0,zero=false,failPage=false;
  const worker=createWorker({now:()=>at,resolveIntentOwner:async()=> 'a'.repeat(64),fetchUpstream:async(_,options)=>{
   providerCalls++;const body=JSON.parse(options.body);
   return Response.json({model:'jev-1.14.0',usage:{input_tokens:100,output_tokens:20},answers:Object.fromEntries(body.state.candidates.map((c,i)=>{
    const score=zero?0:c.id==='connect-card'?2:c.id==='freedom-kids'?.9:.2;
    return ['card_'+i,{type:'score',score,confidence:.7,probabilities:{0:1-score/2,1:0,2:score/2}}];
   }))});
  }});
  const env={CONTENT_DB:adapter,CONTENT_PILOT_ENABLED:'true',JEV_ENABLED:'true',TYPESAFE_API_KEY:'SYNTHETIC_ONLY',ASSETS:{fetch:async request=>{
   const path=new URL(request.url).pathname,file=resolve('dist','.'+(path==='/'?'/index.html':path));
   if(!file.startsWith(resolve('dist')+'/'))return new Response('',{status:404});
   const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
   try{return new Response(await readFile(file),{headers:{'Content-Type':types[extname(file)]||'application/octet-stream'}});}catch{return new Response('',{status:404});}
  }}};
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  await context.route('**/*',async route=>{
   const r=route.request(),url=new URL(r.url());if(url.origin!==origin)return route.abort();
   if(failPage&&url.pathname==='/api/content/intent'&&url.searchParams.has('after')){failPage=false;return route.fulfill({status:503,contentType:'application/json',body:'{"status":"unavailable"}'});}
   const headers=new Headers(r.headers());headers.set('Cf-Access-Jwt-Assertion','SYNTHETIC_FIXTURE');if(r.method()==='POST')headers.set('Origin',origin);
   const response=await worker.fetch(new Request(r.url(),{method:r.method(),headers,...(r.postData()?{body:r.postData()}: {})}),env);
   if(url.pathname==='/api/content/intent'){const value=await response.clone().json();console.log(JSON.stringify({viewport:name,method:r.method(),httpStatus:response.status,status:value.status,selected:value.selectedIds?.length,nextCursor:value.renderSelection?.nextCursor}));}
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  });
  const page=await context.newPage();await page.clock.install({time:new Date(at)});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.locator('html[data-site-revealed="true"]').waitFor({timeout:30000});
  await page.screenshot({path:resolve(output,name+'-browse.png')});
  await page.locator('#prompt-text').fill('Synthetic review question');await page.locator('#prompt-submit').click();
  await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='24 ranked resources loaded');
  await page.screenshot({path:resolve(output,name+'-ranked-head.png')});
  const calls=providerCalls;
  await page.locator('#intent-more').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(output,name+'-more.png')});
  failPage=true;await page.locator('#intent-more').click();await page.getByRole('button',{name:'Could not load. Try again ↓'}).waitFor();
  await page.screenshot({path:resolve(output,name+'-retry.png')});
  await page.locator('#intent-more').click();await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='48 ranked resources loaded');
  await page.locator('#intent-more').click();await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='71 ranked resources loaded');
  assert.equal(await page.locator('#intent-more').count(),0);assert.equal(providerCalls,calls);const continuationProviderCalls=providerCalls-calls;
  const ids=await page.locator('#grid > article.card').evaluateAll(cards=>cards.map(c=>c.id));assert.equal(new Set(ids).size,71);assert.equal(ids[0],'card-connect-card');assert.equal(ids[1],'card-freedom-kids');
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  await page.screenshot({path:resolve(output,name+'-ranked-tail.png')});
  const composer=await page.locator('#prompt-composer').boundingBox();assert(composer&&composer.y>=0&&composer.y+composer.height<=height+1);
  const last=await page.locator('#grid > article.card').last().boundingBox();assert(last&&last.y+last.height<=composer.y,'final resource clears the bottom composer');
  // A fresh synthetic database state enables one new all-zero fixture query.
  // This is not a runtime recovery or spend reset mechanism.
  db.prepare("UPDATE content_checks SET result_json=json_set(result_json,'$.lastStartedAt',0) WHERE id='jev-intent-runtime-v1'").run();zero=true;
  await page.locator('#prompt-text').fill('Synthetic no-close question');await page.locator('#prompt-submit').click();
  await page.waitForFunction(()=>document.querySelector('#composer-status')?.textContent.startsWith('No close matches.'));
  assert.equal(await page.locator('#grid > article.card').count(),24);await page.screenshot({path:resolve(output,name+'-no-close.png')});assert.deepEqual(errors,[]);
  console.log(JSON.stringify({viewport:name,candidateCount:71,rendered:ids.length,weakSecond:true,noCloseRetained:24,continuationProviderCalls,composerWithinViewport:true,pageErrors:errors}));
  await context.close();db.close();
 }
}finally{await browser.close();}
