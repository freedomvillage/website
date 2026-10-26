// Synthetic, cloud-Linux-only interaction evidence. Never runs on the Mac.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {createWorker} from '../src/worker.mjs';
import {familyFixtures} from './fixtures/families.mjs';
if(process.env.CI!=='true'||process.platform!=='linux')throw Error('Cloud Linux only');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE),output=resolve(process.env.PRELOADER_REVIEW_DIR||'preloader-review'),origin='https://next.freedomvillage.church';
await mkdir(output,{recursive:true});
const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE content_cards(id TEXT PRIMARY KEY,status TEXT,content_json TEXT,expires_at TEXT);CREATE TABLE content_checks(id TEXT PRIMARY KEY,result_json TEXT,created_at TEXT)');
for(const [id,card] of familyFixtures())db.prepare('INSERT INTO content_cards VALUES(?,?,?,?)').run(id,'draft',JSON.stringify(card),null);
const adapter={prepare(sql){const statement=db.prepare(sql);return {bind(...args){return {first:async()=>statement.get(...args),all:async()=>({results:statement.all(...args)}),run:async()=>({meta:{changes:Number(statement.run(...args).changes)}})};}};}};
let providerCalls=0;
const worker=createWorker({now:()=>Date.parse('2026-10-25T03:00:00Z'),resolveIntentOwner:async()=>'a'.repeat(64),fetchUpstream:async()=>{providerCalls++;throw Error('No questions are submitted in menu review');}});
const fixtureOptions={};
const env={CONTENT_DB:adapter,CONTENT_PILOT_ENABLED:'true',JEV_ENABLED:'true',TYPESAFE_API_KEY:'SYNTHETIC_ONLY',ASSETS:{fetch:async request=>{
 const path=new URL(request.url).pathname,file=resolve('dist','.'+(path==='/'?'/index.html':path));if(!file.startsWith(resolve('dist')+'/'))return new Response('',{status:404});
 if(/village-.*\.png$/.test(path)){if(fixtureOptions.delay)await new Promise(r=>setTimeout(r,fixtureOptions.delay));if(fixtureOptions.failImages)return new Response('Synthetic image failure',{status:503});}
 const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
 try{return new Response(await readFile(file),{headers:{'Content-Type':types[extname(file)]||'application/octet-stream'}});}catch{return new Response('',{status:404});}
}}};
const youthUrl='https://cdn.prod.website-files.com/60e0035471e8115799a8640b/64e0f1446e4ab5692426f843_Village-Youth-Logo.svg';
const serve=(targetWorker,targetEnv)=>async route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.href===youthUrl)return route.fulfill({status:200,contentType:'image/svg+xml',body:await readFile(resolve('dist/village-youth-source.svg'))});
 assert.equal(url.origin,origin,'No external runtime font, media or provider request');
 const headers=new Headers(request.headers());headers.set('Cf-Access-Jwt-Assertion','SYNTHETIC_FIXTURE');
 const response=await targetWorker.fetch(new Request(request.url(),{method:request.method(),headers,...(request.postData()?{body:request.postData()}: {})}),targetEnv);
 await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
};
const records=[],checks=[],browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
const check=(name,value)=>{assert(value,name);checks.push({name,pass:true});};
const ready=page=>page.waitForFunction(()=>document.documentElement.dataset.siteRevealed==='true');
async function setup(context,options={}){
 Object.assign(fixtureOptions,{delay:0,failImages:false},options);
 await context.addInitScript(({canvasFailure,hiddenFrames})=>{
  window.preloaderEvents=[];addEventListener('fvc:preloader',e=>window.preloaderEvents.push({...e.detail,ms:performance.now(),path:location.pathname}));
  if(canvasFailure){const draw=CanvasRenderingContext2D.prototype.drawImage;let n=0;CanvasRenderingContext2D.prototype.drawImage=function(...a){if(++n>7)throw Error('Injected frame failure');return draw.apply(this,a);};}
  if(hiddenFrames){const raf=window.requestAnimationFrame;window.requestAnimationFrame=fn=>fn.name==='tick'?1:raf.call(window,fn);}
 },options);
 await context.route('**/*',serve(worker,env));
}
async function record(page,name){const events=await page.evaluate(()=>window.preloaderEvents);records.push({name,events,url:page.url(),state:await page.evaluate(()=>({sceneReady:document.documentElement.dataset.sceneReady,siteRevealed:document.documentElement.dataset.siteRevealed,transform:document.querySelector('.scene-stage').style.transform,overflow:document.documentElement.scrollWidth>innerWidth}))});return events;}
try{
 for(const [name,width,height] of [['desktop',1440,1024],['intermediate',900,900],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'no-preference',recordVideo:{dir:resolve(output,'recordings'),size:{width,height}}});await setup(context,{delay:300});
  await context.addCookies([{name:'fv_scene_mode',value:'dark',domain:'next.freedomvillage.church',path:'/'}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/');await page.waitForFunction(()=>document.documentElement.dataset.preloaderState==='opening');
  check(name+' scene container is not CSS-hidden during aperture',await page.locator('.village-scene').evaluate(e=>getComputedStyle(e).visibility==='visible'));
  await page.screenshot({path:resolve(output,name+'-opening.png')});await page.waitForTimeout(260);await page.screenshot({path:resolve(output,name+'-aperture.png')});
  await ready(page);await page.screenshot({path:resolve(output,name+'-settled.png')});
  const first=await record(page,name+'-initial');check(name+' complete1260ms arch',first.filter(x=>x.phase==='start').length===1&&first.at(-1).reason==='complete'&&first.at(-1).elapsed===1260);
  check(name+' original controls preserved',await page.locator('.composer-socials a').count()===5&&await page.locator('#scene-settings').textContent()==='');
  check(name+' no settled overflow/transform',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.scene-stage').style.transform===''));
  await page.locator('#prompt-text').fill('Synthetic unsent preloader draft');await page.locator('#scene-settings').click();await page.locator('#settings-close').click();
  await page.locator('#card-freedom-kids a[href="/cards/freedom-kids"]').first().click();await ready(page);
  check(name+' destination retained',new URL(page.url()).pathname==='/cards/freedom-kids');
  const internal=await record(page,name+'-internal');check(name+' internal navigation skips intro',!internal.some(x=>x.phase==='start')&&internal.at(-1).reason==='internal-navigation');
  await page.goBack();await ready(page);const back=await record(page,name+'-back');check(name+' Back skips replay',!back.some(x=>x.phase==='start')||back.at(-1).reason==='page-departure');
  check(name+' no page errors',errors.length===0);await page.screenshot({path:resolve(output,name+'-back.png')});
  const video=page.video();await context.close();await video.saveAs(resolve(output,name+'-normal.webm'));
 }
 for(const [name,options] of [['direct-detail',{}],['reduced',{reducedMotion:'reduce'}],['scene-failure',{failImages:true}],['frame-failure',{canvasFailure:true}],['watchdog',{hiddenFrames:true}],['slow-readiness',{delay:1800}]]){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:options.reducedMotion||'no-preference'});await setup(context,options);const page=await context.newPage();
  await page.goto(origin+'/cards/freedom-kids');await ready(page);const events=await record(page,name),reason=events.at(-1).reason;
  const expected={'direct-detail':'complete',reduced:'reduced-motion','scene-failure':'scene-fallback','frame-failure':'canvas-fallback',watchdog:'animation-watchdog','slow-readiness':'complete'}[name];
  check(name+' releases destination',reason===expected&&new URL(page.url()).pathname==='/cards/freedom-kids');check(name+' visible main',await page.locator('#main').isVisible());
  await page.screenshot({path:resolve(output,name+'.png')});await context.close();
 }
 const context=await browser.newContext({viewport:{width:900,height:900}});await setup(context);const page=await context.newPage();await page.goto(origin+'/');await page.waitForFunction(()=>document.documentElement.dataset.preloaderState==='opening');await page.emulateMedia({reducedMotion:'reduce'});await ready(page);check('preference change completes once',(await record(page,'preference-change')).at(-1).reason==='preference-reduced');await context.close();
 check('zero provider calls',providerCalls===0);
}finally{
 await browser.close();const files={};for(const name of ['dist/preloader.js','dist/preloader.css','dist/app.js','dist/index.html'])files[name]=createHash('sha256').update(await readFile(name)).digest('hex');
 await writeFile(resolve(output,'receipt.json'),JSON.stringify({completedUTC:new Date().toISOString(),files,checks,records,providerCalls,limits:['Cloud synthetic Chromium only, no authenticated live request.','No physical-device frame pacing or screen-reader certification.','Existing pages/menu/composer retained.']},null,2));
}
console.log('PASS: arch reveal, readiness, failure recovery, direct detail, internal navigation, Back and reduced motion');
