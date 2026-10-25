// Synthetic, cloud-Linux-only interaction evidence. Never runs on the Mac.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createWorker} from '../src/worker.mjs';
import {familyFixtures} from './fixtures/families.mjs';
if(process.env.CI!=='true'||process.platform!=='linux')throw Error('Cloud Linux only');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE),output=resolve('menu-review'),origin='https://next.freedomvillage.church';
await mkdir(output,{recursive:true});
const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE content_cards(id TEXT PRIMARY KEY,status TEXT,content_json TEXT,expires_at TEXT);CREATE TABLE content_checks(id TEXT PRIMARY KEY,result_json TEXT,created_at TEXT)');
for(const [id,card] of familyFixtures())db.prepare('INSERT INTO content_cards VALUES(?,?,?,?)').run(id,'draft',JSON.stringify(card),null);
const adapter={prepare(sql){const statement=db.prepare(sql);return {bind(...args){return {first:async()=>statement.get(...args),all:async()=>({results:statement.all(...args)}),run:async()=>({meta:{changes:Number(statement.run(...args).changes)}})};}};}};
let providerCalls=0;
const worker=createWorker({now:()=>Date.parse('2026-10-25T03:00:00Z'),resolveIntentOwner:async()=>'a'.repeat(64),fetchUpstream:async()=>{providerCalls++;throw Error('No questions are submitted in menu review');}});
const env={CONTENT_DB:adapter,CONTENT_PILOT_ENABLED:'true',JEV_ENABLED:'true',TYPESAFE_API_KEY:'SYNTHETIC_ONLY',ASSETS:{fetch:async request=>{
 const path=new URL(request.url).pathname,file=resolve('dist','.'+(path==='/'?'/index.html':path));if(!file.startsWith(resolve('dist')+'/'))return new Response('',{status:404});
 const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
 try{return new Response(await readFile(file),{headers:{'Content-Type':types[extname(file)]||'application/octet-stream'}});}catch{return new Response('',{status:404});}
}}};
const baseline=process.env.CONTENT_BASELINE_DIR;
assert(baseline,'Exact public base worktree is required');
const {createWorker:createBaseWorker}=await import(pathToFileURL(resolve(baseline,'src/worker.mjs')));
const baselineWorker=createBaseWorker({now:()=>Date.parse('2026-10-25T03:00:00Z'),resolveIntentOwner:async()=>'a'.repeat(64),fetchUpstream:async()=>{throw Error('No baseline questions');}});
const baselineEnv={...env,ASSETS:{fetch:async request=>{
 const path=new URL(request.url).pathname,file=resolve(baseline,'dist','.'+(path==='/'?'/index.html':path));assert(file.startsWith(resolve(baseline,'dist')+'/'));
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
const records=[],browser=await chromium.launch();let activePage=null,activeName='';
const ready=async page=>{await page.locator('html[data-site-revealed="true"]').waitFor({state:'attached'});await page.evaluate(()=>document.fonts.ready);if(await page.evaluate(()=>Boolean(document.getElementById('site-menu-dialog')?.open)))await page.locator('#drawer-close').waitFor({state:'visible'});else await page.locator('#main').waitFor({state:'visible'});};
const closed=async page=>page.waitForFunction(()=>document.getElementById('site-menu-dialog').dataset.phase==='closed'&&!document.getElementById('site-menu-dialog').open&&!document.getElementById('main').inert&&!document.getElementById('prompt-composer').inert&&document.body.style.position!=='fixed'&&document.getElementById('menu-toggle').getAttribute('aria-expanded')==='false');
const opened=async page=>page.waitForFunction(()=>document.getElementById('site-menu-dialog').dataset.phase==='open'&&document.getElementById('site-menu-dialog').open&&document.getElementById('main').inert&&document.getElementById('prompt-composer').inert&&document.body.style.position==='fixed'&&Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.getElementById('site-menu-dialog')).transform).m41)<.5);
const startSampling=page=>page.evaluate(()=>{
 window.menuFrames=[];window.menuSampling=true;const start=performance.now();
 const sample=()=>{const d=document.getElementById('site-menu-dialog'),s=getComputedStyle(d);window.menuFrames.push({ms:performance.now()-start,phase:d.dataset.phase,open:d.open,x:d.open?new DOMMatrixReadOnly(s.transform).m41:null});if(window.menuSampling)requestAnimationFrame(sample);};requestAnimationFrame(sample);
});
const stopSampling=page=>page.evaluate(()=>{window.menuSampling=false;return window.menuFrames;});
try{
 for(const [name,width,height] of [['desktop',1440,1024],['intermediate',900,900],['rail-boundary',701,900],['drawer-boundary',700,900],['mobile',390,844],['narrow',320,800],['short',390,500]]){
  if(['desktop','intermediate','mobile'].includes(name)){
   const before=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});await before.route('**/*',serve(baselineWorker,baselineEnv));
   const page=await before.newPage();activePage=page;activeName=name+'-before';await page.clock.install({time:new Date('2026-10-25T03:00:00Z')});await page.goto(origin+'/topics/families');await ready(page);await page.screenshot({path:resolve(output,name+'-before-opening.png')});
   if(width<=700)await page.locator('#menu-toggle').click();await page.locator('#filters a[href="/topics/families"]').focus();await page.screenshot({path:resolve(output,name+'-before-menu-focus.png')});await before.close();
  }
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<=700,reducedMotion:'no-preference',recordVideo:{dir:resolve(output,'recordings'),size:{width,height}}});
  await context.route('**/*',serve(worker,env));
  const page=await context.newPage(),errors=[];activePage=page;activeName=name;await page.clock.install({time:new Date('2026-10-25T03:00:00Z')});page.on('pageerror',error=>errors.push(error.message));const started=performance.now();
  await page.goto(origin+'/topics/families');await ready(page);
  assert.equal(await page.locator('#scene-settings').textContent(),'');assert.equal(await page.locator('.composer-socials a').count(),5);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const typography=await page.locator('#filters a').first().evaluate(el=>({font:getComputedStyle(el).fontFamily,weight:getComputedStyle(el).fontWeight,size:getComputedStyle(el).fontSize,radius:getComputedStyle(el).borderRadius}));assert(typography.font.includes('Manrope'));assert.equal(typography.weight,'600');assert.equal(typography.radius,'4px');
  await page.screenshot({path:resolve(output,name+'-opening.png')});
  const menu=page.getByRole('button',{name:'Menu',exact:true});let samples=[];
  if(width<=700){
   await page.locator('#prompt-text').fill('Synthetic unsent menu draft');await page.mouse.wheel(0,650);await page.waitForTimeout(100);let y=await page.evaluate(()=>scrollY);const beforeTriggerScroll=y,historyLength=await page.evaluate(()=>history.length),restoration=await page.evaluate(()=>history.scrollRestoration);
   await page.locator('#menu-toggle').evaluate(el=>el.addEventListener('pointerdown',()=>{window.menuActivationY=scrollY;window.menuActivationBounds=el.getBoundingClientRect().toJSON();},{once:true}));
   await startSampling(page);await menu.tap();await page.waitForTimeout(45);await page.keyboard.press('Escape');await page.keyboard.press('Escape');await closed(page);samples=await stopSampling(page);
   const activation=await page.evaluate(()=>({y:window.menuActivationY,bounds:window.menuActivationBounds,after:scrollY}));assert(Number.isFinite(activation.y));y=activation.y;console.log(JSON.stringify({viewport:name,menuActivation:{beforeTriggerScroll,...activation}}));
   assert(Math.abs(activation.after-y)<3,'Interrupted opening preserves the actual visible-trigger departure scroll');assert.equal(await page.evaluate(()=>document.activeElement.id),'menu-toggle');
   assert(samples.some(frame=>frame.phase==='opening'&&frame.open&&frame.x<0),'Actual intermediate opening frame was sampled');
   await menu.tap();await opened(page);await page.screenshot({path:resolve(output,name+'-menu-open.png')});
   const box=await page.locator('#site-menu-dialog').boundingBox();assert(box&&Math.abs(box.x)<1&&Math.abs(box.width-Math.min(336,width*.9))<1&&box.height===height);
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('brand')),true,'Native loop skips the hidden/mobile duplicate links');await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'drawer-close');
   await page.locator('#filters a[href="/topics/families"]').focus();await page.screenshot({path:resolve(output,name+'-menu-focus.png')});
   if(name==='mobile'){
    const popupPromise=context.waitForEvent('page');await page.locator('#filters a[href="/topics/faith"]').click({modifiers:['Control']});const popup=await popupPromise;await popup.close();await opened(page);assert.equal(new URL(page.url()).pathname,'/topics/families','Modified new-tab click leaves menu and source route intact');
   }
   await page.goBack();await closed(page);assert(Math.abs(await page.evaluate(()=>scrollY)-y)<3,'Browser Back dismisses only the overlay');
   await page.goForward();await opened(page);await page.getByRole('button',{name:'Close menu',exact:true}).click();await closed(page);await page.waitForFunction(value=>history.scrollRestoration===value,restoration);console.log(JSON.stringify({viewport:name,forwardCloseRestoration:await page.evaluate(()=>history.scrollRestoration)}));
   assert.equal(new URL(page.url()).pathname,'/topics/families');assert.equal(await page.evaluate(()=>history.length),historyLength+1,'Reopening reuses the replaced forward overlay entry');
   await menu.tap();await opened(page);await page.mouse.click(width-3,Math.min(height-20,250));await closed(page);assert(Math.abs(await page.evaluate(()=>scrollY)-y)<3);
   await menu.tap();await opened(page);await page.locator('#filters a[href="/topics/faith"]').click();await page.waitForURL(origin+'/topics/faith');await ready(page);assert.equal(await page.locator('#site-menu-dialog').getAttribute('open'),null);
   await page.goBack();await ready(page);await closed(page);await page.waitForFunction(y=>Math.abs(scrollY-y)<3,y);assert.equal(new URL(page.url()).pathname,'/topics/families');
   await page.locator('#prompt-text').fill('Synthetic unsent menu draft');
   if(name==='mobile'){
    for(const delay of [0,145]){await menu.tap();if(delay)await page.waitForTimeout(delay);await page.getByRole('button',{name:'Close menu',exact:true}).click();await page.keyboard.press('Escape');await closed(page);assert.equal(new URL(page.url()).pathname,'/topics/families');assert(Math.abs(await page.evaluate(()=>scrollY)-y)<3);}
    await menu.tap();await opened(page);await page.locator('#sidebar .brand').click();await page.waitForURL(origin+'/');await ready(page);await page.goBack();await ready(page);await closed(page);assert.equal(new URL(page.url()).pathname,'/topics/families');
   }
   await menu.tap();await opened(page);await page.setViewportSize({width:900,height});await page.waitForFunction(()=>document.documentElement.dataset.menuMode==='rail');await closed(page);assert.equal(await page.locator('#sidebar').getAttribute('inert'),null);assert.equal(await page.evaluate(()=>document.activeElement.closest('#sidebar')!==null),true,'Drawer-to-rail retains visible navigation focus');
   await page.setViewportSize({width,height});await page.waitForFunction(()=>document.documentElement.dataset.menuMode==='drawer');await page.waitForFunction(value=>history.scrollRestoration===value,restoration);assert.equal(await page.evaluate(()=>document.activeElement.id),'menu-toggle','Rail-to-drawer moves focus before sidebar becomes inert');
   if(name==='mobile'){
    await menu.tap();await opened(page);await page.reload();await ready(page);await opened(page);assert.equal(await page.evaluate(()=>document.activeElement.id),'drawer-close','Reload focuses the visible modal control after scene reveal');await page.screenshot({path:resolve(output,name+'-reloaded-menu-focus.png')});await page.keyboard.press('Escape');await closed(page);await page.waitForFunction(value=>history.scrollRestoration===value,restoration);
    await menu.tap();await opened(page);await page.goto(origin+'/connect');await ready(page);await page.goBack();await ready(page);await opened(page);await page.keyboard.press('Escape');await closed(page);
    await menu.tap();await opened(page);await page.evaluate(()=>{closeMenu();openMenu();});await opened(page);await page.keyboard.press('Escape');await closed(page);await page.waitForFunction(value=>history.scrollRestoration===value,restoration);
   }
   if(name==='mobile'){
    await page.evaluate(()=>{history.scrollRestoration='manual';openMenu();});await opened(page);await page.goBack();await closed(page);await page.goForward();await opened(page);await page.keyboard.press('Escape');await closed(page);await page.waitForFunction(()=>history.scrollRestoration==='manual');await page.evaluate(value=>{history.scrollRestoration=value;},restoration);
    await page.mouse.wheel(0,650);await page.waitForTimeout(100);const sourceY=await page.evaluate(()=>scrollY);assert(sourceY>100);
    await page.evaluate(()=>openMenu());await opened(page);await page.keyboard.press('Escape');await closed(page);assert(Math.abs(await page.evaluate(()=>scrollY)-sourceY)<3,'Separately labeled controller-level nonzero-scroll case');console.log(JSON.stringify({viewport:name,controllerNonzeroScroll:{before:sourceY,after:await page.evaluate(()=>scrollY)}}));
   }
   await page.emulateMedia({reducedMotion:'reduce'});await menu.tap();await opened(page);assert.equal(await page.locator('#site-menu-dialog').evaluate(el=>el.getAnimations().length),0);await page.screenshot({path:resolve(output,name+'-reduced-motion.png')});await page.keyboard.press('Escape');await closed(page);
   await page.emulateMedia({reducedMotion:'no-preference'});await menu.tap();await page.waitForTimeout(40);await page.emulateMedia({reducedMotion:'reduce'});await opened(page);assert.equal(await page.locator('#site-menu-dialog').evaluate(el=>el.getAnimations().length),0);await page.keyboard.press('Escape');await closed(page);
  }else{
   await page.locator('#filters a[href="/topics/families"]').focus();await page.screenshot({path:resolve(output,name+'-menu-focus.png')});await page.locator('#filters a').first().hover();await page.screenshot({path:resolve(output,name+'-menu-hover.png')});
   await page.locator('#filters a[href="/topics/families"]').focus();await page.setViewportSize({width:390,height});await page.waitForFunction(()=>document.documentElement.dataset.menuMode==='drawer');assert.equal(await page.evaluate(()=>document.activeElement.id),'menu-toggle');await page.setViewportSize({width,height});await page.waitForFunction(()=>document.documentElement.dataset.menuMode==='rail');
  }
  await page.locator('#scene-settings').click();await page.waitForFunction(()=>document.getElementById('scene-settings-dialog').open);await page.screenshot({path:resolve(output,name+'-settings.png')});await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('scene-settings-dialog').open);await page.locator('#scene-settings').click();await page.getByRole('button',{name:/Advanced scene settings/}).click();await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('advanced-settings-dialog').open&&!document.body.classList.contains('settings-open'));assert.equal(await page.evaluate(()=>document.activeElement.id),'scene-settings');
  await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="dark"]').click();await page.locator('#settings-close').click();
  if(width<=700){await menu.tap();await opened(page);}
  await page.locator('#filters a[href="/topics/families"]').focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
  const darkFocus=await page.locator('#filters a[href="/topics/families"]').evaluate(el=>({active:el===document.activeElement,visible:el.matches(':focus-visible'),width:parseFloat(getComputedStyle(el).outlineWidth),color:getComputedStyle(el).outlineColor}));assert(darkFocus.active&&darkFocus.visible&&darkFocus.width>=3,'Actual dark keyboard focus is visible');console.log(JSON.stringify({viewport:name,darkKeyboardFocus:darkFocus}));
  await page.screenshot({path:resolve(output,name+'-menu-dark-focus.png')});
  if(name==='short'){
   await page.locator('#filters a').last().focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');const last=await page.locator('#filters a').last().boundingBox();assert(last&&last.y>=0&&last.y+last.height<=height,'Last menu destination is reachable in the short drawer');await page.screenshot({path:resolve(output,name+'-menu-last-link.png')});await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'drawer-close');const closeBox=await page.locator('#drawer-close').boundingBox();assert(closeBox&&closeBox.y>=0&&closeBox.y+closeBox.height<=height);await page.screenshot({path:resolve(output,name+'-menu-close-return.png')});
  }
  if(width<=700){await page.keyboard.press('Escape');await closed(page);}
  await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="light"]').click();await page.locator('#settings-close').click();
  assert.equal(await page.evaluate(()=>document.querySelectorAll('dialog[open]').length),0);assert.equal(providerCalls,0);assert.deepEqual(errors,[]);
  const record={viewport:name,width,height,typography,providerCalls,errors,motionSamples:samples,recording:(await page.video().path()).split('/').at(-1),startSeconds:0,endSeconds:Number(((performance.now()-started)/1000).toFixed(2))};records.push(record);console.log(JSON.stringify({...record,motionSamples:samples.length,menuJourney:'passed'}));await context.close();
 }
}catch(error){
 if(activePage){await activePage.screenshot({path:resolve(output,activeName+'-failure.png')}).catch(()=>{});const diagnostic=await activePage.evaluate(()=>({url:location.pathname,y:scrollY,phase:document.getElementById('site-menu-dialog')?.dataset.phase,bodyStyle:document.body.getAttribute('style'),historyState:history.state,restoration:history.scrollRestoration,active:document.activeElement?.id,activationY:window.menuActivationY,frames:window.menuFrames})).catch(()=>null);await writeFile(resolve(output,'failure.json'),JSON.stringify(diagnostic,null,2));console.error(JSON.stringify({menuFailure:activeName,diagnostic}));}
 throw error;
}finally{for(const context of browser.contexts())await context.close();await writeFile(resolve(output,'menu-behavior.json'),JSON.stringify(records,null,2)+'\n');await browser.close();db.close();}
