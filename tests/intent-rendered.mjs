// Explicit cloud-only rendered acceptance. No credentials, provider calls or live DB.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createWorker} from '../src/worker.mjs';
import {familyFixtures} from './fixtures/families.mjs';
import {sundayFixtures} from './fixtures/sunday.mjs';
if(process.env.CI!=='true'||process.platform!=='linux')throw Error('Cloud Linux only');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const baselineSha=process.env.BASE_SHA;if(!/^[0-9a-f]{40}$/.test(baselineSha||''))throw Error('Exact public baseline SHA required');
const baselineSceneFiles=new Map(['/content-view.js','/content-view.css'].map(path=>[path,execFileSync('git',['show',baselineSha+':dist'+path])]));
const origin='https://next.freedomvillage.church',at=Date.parse('2026-10-25T03:00:00Z');
const expectedFamilyIds=['freedom-kids','families-growing-together','junior-village','village-youth','godly-play','children-in-worship','sunday-gatherings','visit-help',...Array.from({length:32},(_,i)=>'sample-'+String(i+20).padStart(3,'0'))].map(id=>'card-'+id).sort();
const output=resolve('rendered-review');await mkdir(output,{recursive:true});
const contrast=locator=>locator.evaluate(el=>{
 const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number),luma=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
 const color=rgb(getComputedStyle(el).color);let background=[255,255,255];for(let p=el;p;p=p.parentElement){const value=rgb(getComputedStyle(p).backgroundColor);if(value.length===3||value[3]>=.99){background=value;break;}}
 const a=luma(color),b=luma(background);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
});
const familySupportBounds=async page=>{
 const copy=await page.locator('#collection .sunday-scene-copy').boundingBox(),art=await page.locator('#collection .sunday-scene-art').boundingBox(),tail=await page.locator('#collection .sunday-entry-tail').boundingBox();
 assert(copy&&art&&tail&&copy.y+copy.height<=art.y+.5&&art.y+art.height<=tail.y+.5,'Families support text and neutral art flow intrinsically before actions');
};
const completeFamilies=async page=>{
 if(new URL(page.url()).pathname!=='/topics/families'||new URL(page.url()).search)await page.goto(origin+'/topics/families');
 await page.locator('html[data-site-revealed="true"]').waitFor();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
 await page.waitForFunction(()=>document.querySelectorAll('#grid > article.card').length===40);assert.deepEqual((await page.locator('#grid > article.card').evaluateAll(cards=>cards.map(c=>c.id))).sort(),expectedFamilyIds);
};
const youthEntryClearance=async(page,phase)=>{
 const bounds=await page.evaluate(()=>{
  const card=document.getElementById('card-village-youth'),content=card.querySelector('a[href="/cards/village-youth"]').getBoundingClientRect();
  const next=[...document.querySelectorAll('#grid > article.card')].filter(e=>e!==card).map(e=>({id:e.id,r:e.getBoundingClientRect()})).filter(({r})=>r.top>content.top+1&&r.left<content.right-1&&r.right>content.left+1).sort((a,b)=>a.r.top-b.r.top)[0];
  return {contentBottom:content.bottom,nextTop:next?.r.top,nextId:next?.id};
 });
 console.log(JSON.stringify({viewport:page.viewportSize().width,youthEntryClearance:phase,...bounds}));assert(bounds.nextTop>=bounds.contentBottom-.5,'the next same-column card clears the complete Youth entry and its padding');
};
// Walk lazy editorial media naturally before stitched whole-page evidence.
const loadScene=async(page,selector)=>{await page.locator(selector).scrollIntoViewIfNeeded();await page.waitForFunction(selector=>{const e=document.querySelector(selector);return e?.complete&&e.naturalWidth>0;},selector);};
// Keep fixed controls in the same top-of-document state as baseline whole-page captures.
const captureTop=async page=>{await page.evaluate(()=>scrollTo(0,0));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
const captureOpening=async page=>{await page.locator('.family-opening').evaluate(e=>e.scrollIntoView({block:'start'}));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
// Compose the same source card at its actual Home and Families masonry widths.
const kidsEntryReview=async(page,name,place,activate,recordingStarted)=>{
 const startSeconds=Number(((performance.now()-recordingStarted)/1000).toFixed(2)),path=new URL(page.url()).pathname;
 const card=page.locator('#card-freedom-kids'),primary=card.locator('.kids-brand-link'),disclosure=card.locator('.kids-wonder'),summary=disclosure.locator('summary');
 await loadScene(page,'#card-freedom-kids .kids-paper');await card.evaluate(e=>e.scrollIntoView({block:'start'}));
 const composition=await card.evaluate(card=>{
  const logo=card.querySelector('.kids-brand-link>.kids-source-mark'),art=card.querySelector('.kids-paper'),copy=card.querySelector('.kids-card-copy'),a=logo.getBoundingClientRect(),b=art.getBoundingClientRect(),c=copy.getBoundingClientRect();
  return {cardWidth:card.getBoundingClientRect().width,logoComplete:logo.complete&&logo.naturalWidth===398,artComplete:art.complete&&art.naturalWidth===1254,artFit:getComputedStyle(art).objectFit,overlap:a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top,deckFont:parseFloat(getComputedStyle(card.querySelector('.kids-card-deck')).fontSize),copyBottom:c.bottom,artTop:b.top};
 });
 assert(composition.logoComplete&&composition.artComplete);assert.equal(composition.artFit,'contain');assert.equal(composition.overlap,false,'the authentic logo never covers the learning gesture');assert(composition.deckFont>=21,'source summary is a reading invitation, not a caption');assert(composition.copyBottom<=composition.artTop,'source invitation and route lead into the intact learning scene');
 assert(await contrast(card.locator('.kids-card-deck'))>=4.5);assert(await contrast(card.locator('.kids-card-copy>span'))>=4.5);
 await card.screenshot({path:resolve(output,`${name}-${place}-kids-entry-card.png`)});await page.screenshot({path:resolve(output,`${name}-${place}-kids-entry-context.png`)});
 await summary.focus();await page.keyboard.press('Shift+Tab');assert.equal(await primary.evaluate(e=>e===document.activeElement),true);assert(await primary.evaluate(e=>parseFloat(getComputedStyle(e).outlineWidth)>=2));await page.screenshot({path:resolve(output,`${name}-${place}-kids-entry-focus.png`)});
 await page.keyboard.press('Tab');assert.equal(await summary.evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Enter');assert.equal(await disclosure.getAttribute('open'),'');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const flow=await card.evaluate(card=>{const body=card.querySelector('.kids-wonder').getBoundingClientRect(),box=card.getBoundingClientRect();const next=[...document.querySelectorAll('#grid>article.card')].filter(e=>e!==card).map(e=>e.getBoundingClientRect()).filter(r=>r.top>box.top+1&&r.left<box.right-1&&r.right>box.left+1).sort((a,b)=>a.top-b.top)[0];return {bodyBottom:body.bottom,cardBottom:box.bottom,nextTop:next?.top};});
 assert(flow.bodyBottom<=flow.cardBottom+1,'expanded native reading is not clipped');assert(!flow.nextTop||flow.nextTop>=flow.bodyBottom-1,'the next masonry card clears expanded reading');assert.equal(await disclosure.locator('p').first().textContent(),familyFixtures().find(([id])=>id==='freedom-kids')[1].sections[0].paragraphs[0]);assert.equal(await disclosure.locator('a').getAttribute('href'),'/cards/freedom-kids');
 await card.screenshot({path:resolve(output,`${name}-${place}-kids-entry-disclosure.png`)});await summary.focus();await page.keyboard.press('Enter');assert.equal(await disclosure.getAttribute('open'),null);
 if(name==='mobile'){await summary.tap();assert.equal(await disclosure.getAttribute('open'),'');await page.screenshot({path:resolve(output,`${name}-${place}-kids-entry-touch.png`)});await summary.tap();}
 await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="dark"]').click();await page.locator('#settings-close').click();assert(await contrast(card.locator('.kids-card-deck'))>=4.5);await card.screenshot({path:resolve(output,`${name}-${place}-kids-entry-dark.png`)});await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="light"]').click();await page.locator('#settings-close').click();
 await summary.focus();await page.keyboard.press('Shift+Tab');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const departureY=await page.evaluate(()=>scrollY);
 if(name==='desktop')await page.keyboard.press('Enter');else await activate(primary);await page.locator('html[data-site-revealed="true"]').waitFor();assert.equal(new URL(page.url()).pathname,'/cards/freedom-kids');await activate(page.locator('.kids-detail>.back'));
 await page.waitForFunction(({path,y})=>location.pathname===path&&Math.abs(scrollY-y)<3&&document.activeElement?.closest('#card-freedom-kids'),{path,y:departureY});await page.screenshot({path:resolve(output,`${name}-${place}-kids-entry-return.png`)});
 console.log(JSON.stringify({viewport:name,kidsEntryJourney:'passed',place,...composition,...flow,keyboardDisclosure:true,touchDisclosure:name==='mobile',backFocusAndScrollRestored:true,recording:(await page.video().path()).split('/').at(-1),startSeconds,endSeconds:Number(((performance.now()-recordingStarted)/1000).toFixed(2))}));
};
const browser=await chromium.launch();
try{
 for(const [name,width,height] of [['desktop',1440,1000],['intermediate',900,900],['breakpoint',720,900],['mobile',390,844],['narrow',320,800]]){
  const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE content_cards(id TEXT PRIMARY KEY,status TEXT,content_json TEXT,expires_at TEXT);CREATE TABLE content_checks(id TEXT PRIMARY KEY,result_json TEXT,created_at TEXT)');
  const themes=['paper','ink','forest','clay','youth','outline'];
  for(let i=0;i<71;i++){
   const id=['freedom-kids','connect-card','families-growing-together','village-youth','junior-village','godly-play','children-in-worship','sunday-gatherings','visit-help','serve'][i]||'sample-'+String(i).padStart(3,'0');
   const card={schemaVersion:2,template:'story',title:'Review resource '+(i+1),summary:'Synthetic review content for ranked resource continuation.',detail:['Synthetic public prose for browser acceptance.'],facts:[],categories:i>=20&&i<52?['families']:['community'],actions:[],related:[],media:null,design:{theme:themes[i%themes.length],layout:'text',motif:'none',motion:'none',size:'regular'},homePriority:50,sourceStatus:'draft',isSynthetic:false};
   db.prepare('INSERT INTO content_cards VALUES(?,?,?,?)').run(id,'draft',JSON.stringify(card),null);
  }
  for(const [id,card] of [...familyFixtures(),...sundayFixtures()])db.prepare('INSERT OR REPLACE INTO content_cards VALUES(?,?,?,?)').run(id,'draft',JSON.stringify(card),null);
  const adapter={prepare(sql){
   const s=db.prepare(sql);
   return {bind(...args){return {
    first:async()=>s.get(...args),
    all:async()=>({results:s.all(...args)}),
    run:async()=>({meta:{changes:Number(s.run(...args).changes)}})
   };}};
  }};
  let providerCalls=0,zero=false,failPage=false,baselineSceneAssets=false;
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
   try{return new Response(baselineSceneAssets&&baselineSceneFiles.has(path)?baselineSceneFiles.get(path):await readFile(file),{headers:{'Content-Type':types[extname(file)]||'application/octet-stream'}});}catch{return new Response('',{status:404});}
  }}};
  const context=await browser.newContext({viewport:{width,height},hasTouch:['mobile','narrow'].includes(name),reducedMotion:'reduce',recordVideo:{dir:resolve(output,'journey-recordings'),size:{width,height}}});
  const activate=locator=>name==='mobile'?locator.tap():locator.click();
  const serve=async route=>{
   const r=route.request(),url=new URL(r.url());
   if(url.href==='https://cdn.prod.website-files.com/60e0035471e8115799a8640b/64e0f1446e4ab5692426f843_Village-Youth-Logo.svg'){await new Promise(resolve=>setTimeout(resolve,250));return route.fulfill({status:200,contentType:'image/svg+xml',body:await readFile(resolve('dist/village-youth-source.svg'))});}
   if(url.origin!==origin)return route.abort();
   if(failPage&&url.pathname==='/api/content/intent'&&url.searchParams.has('after')){failPage=false;return route.fulfill({status:503,contentType:'application/json',body:'{"status":"unavailable"}'});}
   const headers=new Headers(r.headers());headers.set('Cf-Access-Jwt-Assertion','SYNTHETIC_FIXTURE');if(r.method()==='POST')headers.set('Origin',origin);
   const response=await worker.fetch(new Request(r.url(),{method:r.method(),headers,...(r.postData()?{body:r.postData()}: {})}),env);
   if(url.pathname==='/api/content/intent'){const value=await response.clone().json();console.log(JSON.stringify({viewport:name,method:r.method(),httpStatus:response.status,status:value.status,selected:value.selectedIds?.length,nextCursor:value.renderSelection?.nextCursor}));}
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  };
  await context.route('**/*',serve);
  const page=await context.newPage(),recordingStarted=performance.now();await page.clock.install({time:new Date(at)});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.locator('html[data-site-revealed="true"]').waitFor({timeout:30000});
  assert.equal(await page.locator('#prompt-composer a').count(),0);
  const controlButtons=page.locator('.composer-actions button');
  assert.deepEqual(await controlButtons.evaluateAll(buttons=>buttons.map(b=>[b.id,b.getAttribute('aria-label')])),[['scene-settings','Appearance'],['prompt-submit','Find relevant church content']]);
  for(const button of await controlButtons.all()){const rect=await button.boundingBox();assert(rect&&rect.width>=44&&rect.height>=44&&rect.x>=0&&rect.x+rect.width<=width,'composer control targets remain in the viewport');}
  assert.equal(await page.locator('#composer-status').textContent(),'');assert.equal(providerCalls,0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:resolve(output,name+'-browse.png')});
  await page.locator('#prompt-text').focus();await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'scene-settings');
  await page.keyboard.press('Enter');await page.waitForFunction(()=>document.getElementById('scene-settings-dialog')?.open);await page.screenshot({path:resolve(output,name+'-composer-gear-open.png')});await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('scene-settings-dialog')?.open&&document.activeElement?.id==='scene-settings');
  await page.screenshot({path:resolve(output,name+'-composer-gear-focus.png')});
  await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="dark"]').click();await page.locator('#settings-close').click();
  await page.screenshot({path:resolve(output,name+'-composer-dark.png')});
  await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="light"]').click();await page.locator('#settings-close').click();
  await page.locator('#prompt-text').fill('Synthetic private draft');
  const privacy=await page.locator('#composer-privacy').boundingBox();assert(privacy&&privacy.width>1&&privacy.height>1);
  assert((await page.locator('#prompt-text').getAttribute('aria-describedby')).includes('composer-privacy'));
  await page.screenshot({path:resolve(output,name+'-composer-draft.png')});assert.equal(providerCalls,0);
  {
   await page.locator('#prompt-text').fill('');await page.locator('#prompt-text').blur();const familyStartSeconds=Number(((performance.now()-recordingStarted)/1000).toFixed(2));
   await kidsEntryReview(page,name,'home',activate,recordingStarted);await loadScene(page,'.family-entry .kids-paper');await loadScene(page,'.kids-card .kids-paper');await loadScene(page,'.sunday-scene-art');await captureTop(page);await page.screenshot({path:resolve(output,name+'-families-home-full.png'),fullPage:true});await page.locator('.family-entry').scrollIntoViewIfNeeded();await page.waitForFunction(()=>{const e=document.querySelector('.family-entry .kids-paper');return e?.complete&&e.naturalWidth===1254;});await page.locator('.family-entry').screenshot({path:resolve(output,name+'-families-home-scene.png')});const homeStyle=await page.locator('.family-entry').evaluate(e=>{const s=getComputedStyle(e);return {background:s.backgroundColor,padding:parseFloat(s.paddingTop),color:s.color};});assert.equal(homeStyle.background,'rgb(243, 200, 69)');assert(homeStyle.padding>=24);assert.equal(homeStyle.color,'rgb(36, 59, 52)');
   const familyDisclosure=page.locator('.family-source-paths');await activate(familyDisclosure.locator('summary'));assert.equal(await familyDisclosure.getAttribute('open'),'');assert.equal(await familyDisclosure.locator('a').count(),familyFixtures().find(([id])=>id==='families-growing-together')[1].actions.length);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.locator('.family-entry').screenshot({path:resolve(output,name+'-families-home-actions-open.png')});await activate(familyDisclosure.locator('summary'));

   await activate(page.locator('.family-entry-route'));await page.locator('html[data-site-revealed="true"]').waitFor();
   assert.equal(new URL(page.url()).pathname,'/topics/families');assert.deepEqual(await page.locator('.family-context a').evaluateAll(links=>links.map(a=>({hash:new URL(a.href).hash,present:!!document.getElementById(new URL(a.href).hash.slice(1))}))),[{hash:'#card-freedom-kids',present:true},{hash:'#card-junior-village',present:true}]);const familyOrder=await page.locator('#grid > article.card').evaluateAll(cards=>cards.map(c=>c.id));assert.deepEqual(familyOrder.slice(0,3),['card-families-growing-together','card-freedom-kids','card-junior-village']);assert(!familyOrder.includes('card-village-youth'),'the initial page must not inject a record selected on the continuation');assert.deepEqual(familyOrder.slice(-2),['card-sunday-gatherings','card-visit-help']);if(width>700){const support=await page.locator('.sunday-scene-entry').boundingBox(),grid=await page.locator('#grid').boundingBox();assert(support.width<grid.width/2,'Families Sunday scene is a supporting column, not the Home feature');}
   assert.equal(await page.locator('.family-entry-route').isVisible(),false);const initialFamilyIds=await page.locator('#grid > article.card').evaluateAll(cards=>cards.map(c=>c.id));await page.locator('.load-more').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelectorAll('#grid > article.card').length===40);const completeFamilyIds=await page.locator('#grid > article.card').evaluateAll(cards=>cards.map(c=>c.id));assert.equal(new Set(completeFamilyIds).size,40);assert.deepEqual([...completeFamilyIds].sort(),expectedFamilyIds);assert.deepEqual(completeFamilyIds.slice(0,4),['card-families-growing-together','card-freedom-kids','card-junior-village','card-village-youth']);assert.deepEqual(completeFamilyIds.slice(-2),['card-sunday-gatherings','card-visit-help']);assert(completeFamilyIds.includes('card-sample-051'));console.log(JSON.stringify({viewport:name,familiesCollection:'complete',initial:initialFamilyIds.length,appended:completeFamilyIds.length-initialFamilyIds.length,total:40,cursorSelectionUnchanged:true}));
   await loadScene(page,'.family-opening .kids-paper');await loadScene(page,'.kids-card .kids-paper');await loadScene(page,'#card-village-youth .youth-source-mark');await captureTop(page);await page.screenshot({path:resolve(output,name+'-families-category-full.png'),fullPage:true});await captureOpening(page);await page.locator('.family-opening').screenshot({path:resolve(output,name+'-families-opening.png')});const openingStyle=await page.locator('.family-opening').evaluate(e=>{const s=getComputedStyle(e);return {background:s.backgroundColor,padding:parseFloat(s.paddingTop),start:s.gridColumnStart,end:s.gridColumnEnd};});assert.equal(openingStyle.background,'rgb(244, 236, 218)');assert(openingStyle.padding>=24);if(width>700){assert.equal(openingStyle.start,'1');assert.equal(openingStyle.end,'-1');}if(width<=800){const art=await page.locator('.family-opening .family-entry-scene').boundingBox(),copy=await page.locator('.family-opening .family-entry-heading').boundingBox();assert(copy.y>=art.y+art.height,'narrow sidebar and mobile openings stack the complete scene before reading');}
   await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="dark"]').click();await page.locator('#settings-close').click();await page.locator('.family-context a').first().hover();assert(await contrast(page.locator('.family-context a').first())>=4.5);await page.locator('.family-opening').screenshot({path:resolve(output,name+'-families-opening-dark.png')});await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="light"]').click();await page.locator('#settings-close').click();
   await kidsEntryReview(page,name,'families',activate,recordingStarted);await page.locator('.kids-card').screenshot({path:resolve(output,name+'-kids-entry.png')});await familySupportBounds(page);
   const youthLink=page.locator('#card-village-youth a[href="/cards/village-youth"]');await youthLink.focus();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const youthDepartureY=await page.evaluate(()=>scrollY);
   await page.screenshot({path:resolve(output,name+'-families-youth-loaded.png')});await activate(youthLink);await page.locator('html[data-site-revealed="true"]').waitFor();assert.equal(new URL(page.url()).pathname,'/cards/village-youth');assert.equal(await page.locator('#detail h1').innerText(),'Village Youth');await page.screenshot({path:resolve(output,name+'-youth-detail.png')});
   if(['desktop','intermediate','mobile'].includes(name)){
    const bridgeStart=Number(((performance.now()-recordingStarted)/1000).toFixed(2)),inquiry=page.locator('.youth-inquiry a');await inquiry.focus();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const inquiryY=await page.evaluate(()=>scrollY);await page.screenshot({path:resolve(output,name+'-youth-family-inquiry-focus.png')});
    if(name==='desktop')await page.keyboard.press('Enter');else await activate(inquiry);await page.locator('html[data-site-revealed="true"]').waitFor();assert.equal(new URL(page.url()).pathname,'/connect');await page.screenshot({path:resolve(output,name+'-youth-family-inquiry-destination.png')});await activate(page.locator('#detail .back'));await page.waitForFunction(y=>location.pathname==='/cards/village-youth'&&Math.abs(scrollY-y)<3&&document.activeElement?.closest('.youth-inquiry'),inquiryY);await page.screenshot({path:resolve(output,name+'-youth-family-inquiry-return.png')});
    console.log(JSON.stringify({viewport:name,youthFamilyBridge:'passed',journey:'Home → Families → Youth → inquiry → Youth',backFocusAndScrollRestored:true,input:name==='mobile'?'emulated-touch':name==='desktop'?'keyboard':'pointer',recording:(await page.video().path()).split('/').at(-1),familyJourneyStartSeconds:familyStartSeconds,startSeconds:bridgeStart,endSeconds:Number(((performance.now()-recordingStarted)/1000).toFixed(2))}));
   }
   await activate(page.locator('#detail .back'));await page.waitForFunction(y=>location.pathname==='/topics/families'&&document.querySelectorAll('#grid > article.card').length===40&&Math.abs(scrollY-y)<3&&document.activeElement?.closest('#card-village-youth'),youthDepartureY);await page.screenshot({path:resolve(output,name+'-families-youth-return.png')});
   await activate(page.locator('.family-context a[href$="#card-freedom-kids"]'));assert.equal(new URL(page.url()).pathname,'/topics/families');await page.locator('.kids-brand-link').focus();
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const departureY=await page.evaluate(()=>scrollY);
   if(name==='desktop')await page.keyboard.press('Enter');else await activate(page.locator('.kids-brand-link'));await page.locator('html[data-site-revealed="true"]').waitFor();
   assert.equal(new URL(page.url()).pathname,'/cards/freedom-kids');assert.equal(await page.locator('.kids-chapter').count(),3);assert.equal(await page.locator('.kids-question').count(),2);assert.equal(await page.locator('.kids-chapter').evaluateAll(es=>es.every(e=>getComputedStyle(e).animationName==='none')),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);

   const sourceKids=familyFixtures().find(([id])=>id==='freedom-kids')[1];assert.deepEqual(await page.locator('.kids-chapter p').allTextContents(),sourceKids.sections.flatMap(s=>s.paragraphs));
   for(let i=0;i<3;i++){const chapter=page.locator('.kids-chapter').nth(i);await chapter.scrollIntoViewIfNeeded();await page.waitForFunction(i=>{const e=document.querySelectorAll('.kids-chapter img')[i];return e?.complete&&e.naturalWidth===1254;},i);await activate(page.locator('.kids-contents a').nth(i));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const target=await chapter.locator('h2').boundingBox(),contents=await page.locator('.kids-contents').boundingBox(),sticky=await page.locator('.kids-contents').evaluate(e=>getComputedStyle(e).position==='sticky');assert(target.y>=0&&(!sticky||target.y>=contents.y+contents.height),'native contents jump leaves its heading below the sticky rail');await page.screenshot({path:resolve(output,name+'-kids-spread-'+i+'-viewport.png')});await chapter.screenshot({path:resolve(output,name+'-kids-spread-'+i+'.png')});assert(await contrast(chapter.locator('p').first())>=4.5);}
   await captureTop(page);await page.screenshot({path:resolve(output,name+'-kids-detail-full.png'),fullPage:true});await captureTop(page);await page.screenshot({path:resolve(output,name+'-kids-opening-viewport.png')});assert.equal(await page.locator('.family-context').count(),0);
   await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="dark"]').click();await page.locator('#settings-close').click();
   await page.locator('.kids-contents a').first().hover();assert(await contrast(page.locator('.kids-questions h2'))>=4.5);await captureTop(page);await page.screenshot({path:resolve(output,name+'-kids-dark-hover-full.png'),fullPage:true});
   await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="light"]').click();await page.locator('#settings-close').click();
   await activate(page.locator('.kids-question').first().locator('summary'));assert.equal(await page.locator('.kids-question').first().getAttribute('open'),'');
   await page.screenshot({path:resolve(output,name+'-kids-question-open-viewport.png')});assert(await contrast(page.locator('.kids-questions h2'))>=4.5);await captureTop(page);await page.screenshot({path:resolve(output,name+'-kids-question-open-full.png'),fullPage:true});
   if(['desktop','intermediate','mobile'].includes(name)){
    const bridgeStart=Number(((performance.now()-recordingStarted)/1000).toFixed(2)),question=page.locator('.godly-question-entry'),readMore=question.locator('a[href="/cards/godly-play"]');
    await readMore.focus();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const questionY=await page.evaluate(()=>scrollY);await page.screenshot({path:resolve(output,name+'-godly-kids-bridge-focus.png')});
    if(name==='desktop')await page.keyboard.press('Enter');else await activate(readMore);await page.locator('html[data-site-revealed="true"]').waitFor();assert.equal(new URL(page.url()).pathname,'/cards/godly-play');await captureTop(page);await page.screenshot({path:resolve(output,name+'-godly-bridge-opening.png')});
    await activate(page.locator('.godly-detail>.back'));await page.waitForFunction(y=>location.pathname==='/cards/freedom-kids'&&Math.abs(scrollY-y)<3&&document.activeElement?.closest('.godly-question-entry')&&document.querySelector('.godly-question-entry').open,questionY);await page.screenshot({path:resolve(output,name+'-godly-kids-bridge-return.png')});
    console.log(JSON.stringify({viewport:name,godlyFamilyBridge:'passed',journey:'Home → Families → Kids → Godly Play → Kids',nativeQuestionOpenRestored:true,backFocusAndScrollRestored:true,input:name==='mobile'?'emulated-touch':name==='desktop'?'keyboard':'pointer',recording:(await page.video().path()).split('/').at(-1),familyJourneyStartSeconds:familyStartSeconds,startSeconds:bridgeStart,endSeconds:Number(((performance.now()-recordingStarted)/1000).toFixed(2))}));
   }
   await page.locator('.kids-next a').first().focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'/topics/families');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const ending=await page.locator('.kids-next a').last().boundingBox(),overlay=await page.locator('#prompt-composer').boundingBox();assert(ending&&overlay&&ending.y+ending.height<=overlay.y,'Kids closing action clears the composer');
   await page.screenshot({path:resolve(output,name+'-kids-ending-focus.png')});
   await activate(page.locator('.kids-contents a').nth(1));assert.equal(new URL(page.url()).hash,'#kids-freedom-kids-1');assert.equal(new URL(page.url()).pathname,'/cards/freedom-kids');
   await activate(page.locator('.kids-detail > .back'));await page.waitForFunction(y=>location.pathname==='/topics/families'&&Math.abs(scrollY-y)<3&&document.activeElement?.closest('.kids-card'),departureY);
   assert.equal(await page.locator('#filters a[href="/topics/families"]').getAttribute('aria-current'),'page');assert.equal(await page.locator('.family-context').count(),1);await page.screenshot({path:resolve(output,name+'-families-return.png')});assert.equal(providerCalls,0);
   console.log(JSON.stringify({viewport:name,familiesJourney:'passed',input:name==='mobile'?'emulated-touch':'pointer',backScrollRestored:true,backFocusRestored:true,youthOnContinuation:true,restoredLoadedRecords:40,providerCallsBeforeSubmit:providerCalls,recording:(await page.video().path()).split('/').at(-1),startSeconds:familyStartSeconds,endSeconds:Number(((performance.now()-recordingStarted)/1000).toFixed(2))}));
   if(name==='mobile'){
    const noJs=await browser.newContext({viewport:{width,height},javaScriptEnabled:false});await noJs.route('**/*',serve);const plain=await noJs.newPage();await plain.goto(origin+'/cards/freedom-kids');
    assert.equal(await plain.locator('.kids-chapter').count(),3);await plain.locator('.kids-question').first().locator('summary').click();assert.equal(await plain.locator('.kids-question').first().getAttribute('open'),'');
    await plain.locator('.kids-contents a').nth(1).click();assert.equal(new URL(plain.url()).pathname,'/cards/freedom-kids');assert.equal(new URL(plain.url()).hash,'#kids-freedom-kids-1');
    for(let i=0;i<3;i++)await loadScene(plain,'.kids-spread-'+i+' .kids-paper');await plain.evaluate(()=>scrollTo(0,0));await plain.screenshot({path:resolve(output,'mobile-kids-no-js-full.png'),fullPage:true});
    await plain.goto(origin+'/topics/families');await plain.locator('.family-context a[href$="#card-freedom-kids"]').click();assert.equal(new URL(plain.url()).pathname,'/topics/families');const firstIds=await plain.locator('#grid > article.card').evaluateAll(cards=>cards.map(c=>c.id));await plain.locator('.load-more').click();assert(new URL(plain.url()).searchParams.has('after'));const secondIds=await plain.locator('#grid > article.card').evaluateAll(cards=>cards.map(c=>c.id));assert.equal(firstIds.length,24);assert.equal(secondIds.length,16);assert.equal(secondIds[0],'card-village-youth');assert.equal(await plain.locator('#card-village-youth a').getAttribute('href'),'/cards/village-youth');assert.equal(new Set([...firstIds,...secondIds]).size,40);assert.deepEqual([...firstIds,...secondIds].sort(),expectedFamilyIds);await plain.screenshot({path:resolve(output,'mobile-families-native-page2-full.png'),fullPage:true});
    await noJs.close();assert.equal(providerCalls,0);
   }
  }
  {
   const startSeconds=Number(((performance.now()-recordingStarted)/1000).toFixed(2));
   await completeFamilies(page);
   const entry=page.locator('#card-godly-play .godly-card-link');await entry.focus();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await entry.evaluate(el=>parseFloat(getComputedStyle(el).outlineOffset)>=2&&parseFloat(getComputedStyle(el).outlineWidth)>=2),true,'question card focus ring stays outside its text');const departureY=await page.evaluate(()=>scrollY);
   await page.screenshot({path:resolve(output,name+'-godly-entry-focus.png')});if(name==='desktop')await page.keyboard.press('Enter');else await activate(entry);
   await page.locator('html[data-site-revealed="true"]').waitFor();assert.equal(new URL(page.url()).pathname,'/cards/godly-play');assert.equal(await page.locator('.godly-reading p').count(),2);
   assert.deepEqual(await page.locator('.godly-reading p').allTextContents(),familyFixtures().find(([id])=>id==='godly-play')[1].detail);assert.equal(await page.locator('.godly-heading .kids-source-mark').evaluate(e=>e.complete&&e.naturalWidth===398),true);
   assert.equal(await page.locator('.godly-parent a').getAttribute('href'),'/cards/freedom-kids');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await captureTop(page);await page.screenshot({path:resolve(output,name+'-godly-opening-viewport.png')});await page.screenshot({path:resolve(output,name+'-godly-detail-full.png'),fullPage:true});
   await page.locator('.godly-story').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(output,name+'-godly-reading-viewport.png')});await page.locator('.godly-exploration').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(output,name+'-godly-exploration-viewport.png')});
   for(const text of ['.godly-heading h1','.godly-intro','.godly-reading p','.godly-parent p'])assert(await contrast(page.locator(text).first())>=4.5);
   await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="dark"]').click();await page.locator('#settings-close').click();await page.locator('.godly-parent a').hover();assert(await contrast(page.locator('.godly-parent a'))>=4.5);await captureTop(page);await page.screenshot({path:resolve(output,name+'-godly-dark-full.png'),fullPage:true});
   await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="light"]').click();await page.locator('#settings-close').click();
   await page.locator('.godly-parent a').focus();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const readerDepartureY=await page.evaluate(()=>scrollY),ending=await page.locator('.godly-parent a').boundingBox(),composer=await page.locator('#prompt-composer').boundingBox();assert(ending&&composer&&ending.y+ending.height<=composer.y,'Godly closing parent route clears the composer');await page.screenshot({path:resolve(output,name+'-godly-parent-focus.png')});
   if(name==='desktop')await page.keyboard.press('Enter');else await activate(page.locator('.godly-parent a'));await page.locator('html[data-site-revealed="true"]').waitFor();assert.equal(new URL(page.url()).pathname,'/cards/freedom-kids');assert.equal(await page.locator('.kids-detail > .back').innerText(),'← Back');await page.screenshot({path:resolve(output,name+'-godly-kids-parent.png')});
   await activate(page.locator('.kids-detail > .back'));try{await page.waitForFunction(y=>location.pathname==='/cards/godly-play'&&Math.abs(scrollY-y)<3&&document.activeElement?.closest('.godly-parent'),readerDepartureY);}catch(error){console.log(JSON.stringify({viewport:name,readerReturnFailure:await page.evaluate(()=>({path:location.pathname,y:scrollY,active:document.activeElement?.outerHTML?.slice(0,400)})),expectedY:readerDepartureY}));await page.screenshot({path:resolve(output,name+'-godly-return-failure.png')});throw error;}await page.screenshot({path:resolve(output,name+'-godly-parent-return.png')});
   await activate(page.locator('.godly-detail > .back'));await page.waitForFunction(y=>location.pathname==='/topics/families'&&document.querySelectorAll('#grid > article.card').length===40&&Math.abs(scrollY-y)<3&&document.activeElement?.closest('#card-godly-play'),departureY);await page.screenshot({path:resolve(output,name+'-godly-families-return.png')});assert.equal(providerCalls,0);
   console.log(JSON.stringify({viewport:name,godlyJourney:'passed',sourceParagraphsRetained:2,parentRoute:'/cards/freedom-kids',input:name==='mobile'?'emulated-touch':name==='desktop'?'keyboard':'pointer',backFocusAndScrollRestored:true,restoredLoadedRecords:40,reducedMotion:'reduce',providerCallsBeforeSubmit:providerCalls,recording:(await page.video().path()).split('/').at(-1),startSeconds,endSeconds:Number(((performance.now()-recordingStarted)/1000).toFixed(2))}));
   if(name==='mobile'){
    const godlySource=familyFixtures().find(([id])=>id==='godly-play')[1];db.prepare('UPDATE content_cards SET content_json=? WHERE id=?').run(JSON.stringify({...godlySource,actions:[{label:'Synthetic optional next step',targetId:'connect-card'}]}),'godly-play');
    await page.goto(origin+'/cards/godly-play');await page.locator('html[data-site-revealed="true"]').waitFor();await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="dark"]').click();await page.locator('#settings-close').click();const optionalAction=page.locator('.godly-actions a');assert.equal(await optionalAction.getAttribute('href'),'/connect');await optionalAction.hover();assert(await contrast(optionalAction)>=4.5,'optional canonical action stays readable on fixed paper in dark hover');await page.screenshot({path:resolve(output,'mobile-godly-action-dark-hover.png')});
    await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="light"]').click();await page.locator('#settings-close').click();db.prepare('UPDATE content_cards SET content_json=? WHERE id=?').run(JSON.stringify(godlySource),'godly-play');
    for(const unavailable of ['held','private-hold','expired']){
     if(unavailable==='held')db.prepare("UPDATE content_cards SET status='held' WHERE id='freedom-kids'").run();else if(unavailable==='private-hold')db.prepare("UPDATE content_cards SET status='draft',content_json=json_set(content_json,'$.hold',json('true')) WHERE id='freedom-kids'").run();else db.prepare("UPDATE content_cards SET content_json=json_remove(content_json,'$.hold'),expires_at='2026-10-24T00:00:00Z' WHERE id='freedom-kids'").run();
     await page.goto(origin+'/cards/godly-play');await page.locator('html[data-site-revealed="true"]').waitFor();assert.equal(await page.locator('.godly-parent').count(),0);assert.equal(await page.locator('.godly-reading p').count(),2);
    }
    await page.screenshot({path:resolve(output,'mobile-godly-ineligible-parent.png'),fullPage:true});db.prepare("UPDATE content_cards SET status='draft',expires_at=NULL WHERE id='freedom-kids'").run();
    const noJs=await browser.newContext({viewport:{width,height},javaScriptEnabled:false});await noJs.route('**/*',serve);const plain=await noJs.newPage();await plain.goto(origin+'/cards/godly-play');assert.equal(await plain.locator('.godly-reading p').count(),2);assert.equal(await plain.locator('.godly-parent a').getAttribute('href'),'/cards/freedom-kids');await plain.screenshot({path:resolve(output,'mobile-godly-no-js-full.png'),fullPage:true});await plain.locator('.godly-parent a').click();assert.equal(new URL(plain.url()).pathname,'/cards/freedom-kids');await noJs.close();
   }
  }
  {
   const startSeconds=Number(((performance.now()-recordingStarted)/1000).toFixed(2));await completeFamilies(page);
   const entry=page.locator('#card-village-youth a[href="/cards/village-youth"]');await entry.focus();await page.waitForFunction(()=>{const e=document.querySelector('#card-village-youth .library-brand-art img');return e?.complete&&e.naturalWidth>0&&e.naturalWidth===e.naturalHeight;});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const departureY=await page.evaluate(()=>scrollY);await youthEntryClearance(page,'initial-after-delayed-image');await page.screenshot({path:resolve(output,name+'-youth-entry-preserved.png')});
   if(name==='desktop')await page.keyboard.press('Enter');else await activate(entry);await page.locator('html[data-site-revealed="true"]').waitFor();assert.equal(new URL(page.url()).pathname,'/cards/village-youth');assert.equal(await page.locator('.youth-detail').count(),1);
   const source=familyFixtures().find(([id])=>id==='village-youth')[1];assert.deepEqual(await page.locator('.youth-reading p,.youth-inquiry p').allTextContents(),source.detail);assert.deepEqual(await page.locator('.youth-hero .library-facts p').allTextContents(),source.facts);assert.equal(await page.locator('.youth-identity img').evaluate(e=>e.complete&&e.naturalWidth>0&&e.naturalWidth===e.naturalHeight&&getComputedStyle(e).objectFit==='contain'),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.deepEqual(await page.locator('.youth-detail nav a').evaluateAll(a=>a.map(e=>e.getAttribute('href'))),['/connect','/connect']);assert.deepEqual(await page.locator('#detail .related-grid > article').evaluateAll(a=>a.map(e=>e.id)),['card-children-in-worship','card-serve']);
   if(width<=800){const early=await page.locator('.youth-hero-actions').boundingBox(),mark=await page.locator('.youth-identity img').boundingBox();assert(early&&mark&&early.y+early.height<=mark.y+.5,'mobile Youth keeps complete introduction and inquiry clear of its generous mark');}
   await captureTop(page);await page.screenshot({path:resolve(output,name+'-youth-opening-viewport.png')});await page.screenshot({path:resolve(output,name+'-youth-detail-full.png'),fullPage:true});await page.locator('.youth-reading').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(output,name+'-youth-reading-viewport.png')});
   await page.locator('.youth-detail > .back').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('.youth-hero-actions')),true);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const early=await page.locator('.youth-hero-actions a').boundingBox(),earlyComposer=await page.locator('#prompt-composer').boundingBox();assert(early&&earlyComposer&&early.y+early.height<=earlyComposer.y);assert(await contrast(page.locator('.youth-hero-actions a'))>=4.5);await page.screenshot({path:resolve(output,name+'-youth-intro-inquiry-focus.png')});const earlyDepartureY=await page.evaluate(()=>scrollY);
   if(name==='desktop')await page.keyboard.press('Enter');else await activate(page.locator('.youth-hero-actions a'));await page.locator('html[data-site-revealed="true"]').waitFor();assert.equal(new URL(page.url()).pathname,'/connect');await activate(page.locator('#detail .back'));await page.waitForFunction(y=>location.pathname==='/cards/village-youth'&&Math.abs(scrollY-y)<3&&document.activeElement?.closest('.youth-hero-actions'),earlyDepartureY);await page.screenshot({path:resolve(output,name+'-youth-intro-return.png')});
   await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="dark"]').click();await page.locator('#settings-close').click();await page.locator('.youth-inquiry a').hover();assert(await contrast(page.locator('.youth-inquiry a'))>=4.5);assert(await contrast(page.locator('.youth-hero-actions a'))>=4.5);await captureTop(page);await page.screenshot({path:resolve(output,name+'-youth-dark-full.png'),fullPage:true});
   await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="light"]').click();await page.locator('#settings-close').click();
   const inquiry=page.locator('.youth-inquiry a');await page.locator('.youth-hero-actions a').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('.youth-inquiry')),true);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const readerDepartureY=await page.evaluate(()=>scrollY),last=await inquiry.boundingBox(),composer=await page.locator('#prompt-composer').boundingBox();assert(last&&composer&&last.y+last.height<=composer.y,'Youth ending inquiry clears composer');assert.equal(await inquiry.evaluate(e=>parseFloat(getComputedStyle(e).outlineOffset)>=2),true);await page.screenshot({path:resolve(output,name+'-youth-ending-focus.png')});
   if(name==='desktop')await page.keyboard.press('Enter');else await activate(inquiry);await page.locator('html[data-site-revealed="true"]').waitFor();assert.equal(new URL(page.url()).pathname,'/connect');await page.screenshot({path:resolve(output,name+'-youth-connect-destination.png')});
   await activate(page.locator('#detail .back'));await page.waitForFunction(y=>location.pathname==='/cards/village-youth'&&Math.abs(scrollY-y)<3&&document.activeElement?.closest('.youth-inquiry'),readerDepartureY);await page.screenshot({path:resolve(output,name+'-youth-connect-return.png')});
   if(name==='mobile'){
    await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.youth-hero').scrollIntoViewIfNeeded();const motionStart=Number(((performance.now()-recordingStarted)/1000).toFixed(2));await page.waitForFunction(()=>getComputedStyle(document.querySelector('.youth-identity')).animationName==='brand-drift');await page.screenshot({path:resolve(output,'mobile-youth-motion-start.png')});await page.waitForTimeout(4300);await page.screenshot({path:resolve(output,'mobile-youth-motion-end.png')});assert.equal(await page.locator('.youth-identity').evaluate(e=>getComputedStyle(e).animationIterationCount),'1');console.log(JSON.stringify({viewport:name,youthMotion:'existing-finite-brand-gradient',recording:(await page.video().path()).split('/').at(-1),startSeconds:motionStart,endSeconds:Number(((performance.now()-recordingStarted)/1000).toFixed(2))}));await page.emulateMedia({reducedMotion:'reduce'});
   }
   await activate(page.locator('.youth-detail > .back'));await page.waitForFunction(y=>location.pathname==='/topics/families'&&document.querySelectorAll('#grid > article.card').length===40&&Math.abs(scrollY-y)<3&&document.activeElement?.closest('#card-village-youth'),departureY);await page.waitForFunction(()=>{const e=document.querySelector('#card-village-youth .library-brand-art img');return e?.complete&&e.naturalWidth>0;});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await youthEntryClearance(page,'back-after-delayed-image');await page.screenshot({path:resolve(output,name+'-youth-families-return.png')});assert.equal(providerCalls,0);
   console.log(JSON.stringify({viewport:name,youthJourney:'passed',sourceParagraphsRetained:2,sourceInquiry:'/connect',backFocusAndScrollRestored:true,restoredLoadedRecords:40,input:name==='mobile'?'emulated-touch':name==='desktop'?'keyboard':'pointer',providerCallsBeforeSubmit:providerCalls,reducedMotion:'reduce',recording:(await page.video().path()).split('/').at(-1),startSeconds,endSeconds:Number(((performance.now()-recordingStarted)/1000).toFixed(2))}));
   if(name==='mobile'){
    const noJs=await browser.newContext({viewport:{width,height},javaScriptEnabled:false});await noJs.route('**/*',serve);const plain=await noJs.newPage();await plain.goto(origin+'/cards/village-youth');assert.deepEqual(await plain.locator('.youth-reading p,.youth-inquiry p').allTextContents(),source.detail);assert.equal(await plain.locator('.youth-inquiry a').getAttribute('href'),'/connect');await plain.screenshot({path:resolve(output,'mobile-youth-no-js-full.png'),fullPage:true});await plain.locator('.youth-inquiry a').click();assert.equal(new URL(plain.url()).pathname,'/connect');await noJs.close();
   }
  }
  if(['desktop','intermediate','mobile'].includes(name)){
   const startSeconds=Number(((performance.now()-recordingStarted)/1000).toFixed(2));
   await page.goto(origin);await page.locator('html[data-site-revealed="true"]').waitFor();
   await page.screenshot({path:resolve(output,name+'-sunday-home-full.png'),fullPage:true});
   assert.equal(await page.locator('.sunday-entry details').count(),0);assert.equal(await page.locator('.sunday-scene-art').count(),1);assert.equal(await page.locator('img[src*="youngil-source"]').count(),0);assert.equal(await page.locator('.sunday-scene-art').evaluate(e=>e.complete&&e.naturalWidth===800),true);
   const visitLink=page.locator('.sunday-entry-actions a[href="/cards/visit-help"]');
   await page.locator('.sunday-entry h2 a').focus();await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'/cards/visit-help');
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const departureY=await page.evaluate(()=>scrollY);
   assert(await contrast(visitLink)>=4.5);await page.screenshot({path:resolve(output,name+'-sunday-entry-focus.png')});
   if(name==='desktop')await page.keyboard.press('Enter');else await activate(visitLink);
   await page.locator('html[data-site-revealed="true"]').waitFor();assert.equal(new URL(page.url()).pathname,'/cards/visit-help');
   assert.equal(await page.locator('.arrival-section').count(),3);assert.deepEqual(await page.locator('.arrival-destination .library-facts p').allTextContents(),['Sunday · 2:10 PM','Youngil Church · Yangjae']);
   assert.equal(await page.locator('.arrival-section').nth(1).innerText().then(t=>t.includes('venue has an elevator')),true);
   assert.equal(await page.locator('.arrival-section').nth(2).innerText().then(t=>t.includes('separate from the Sunday venue')),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.deepEqual(await page.locator('[aria-label="Venue maps"] a').evaluateAll(a=>a.map(e=>e.href)),['https://kko.kakao.com/htkOT9NBZ8','https://naver.me/5v3PGy4s']);
   await page.screenshot({path:resolve(output,name+'-visit-detail-full.png'),fullPage:true});
   await page.locator('[aria-label="Venue maps"] a').first().focus();await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'https://naver.me/5v3PGy4s');
   await page.screenshot({path:resolve(output,name+'-visit-map-focus.png')});
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'https://naver.me/SYNTHETIC-PARKING');
   await page.screenshot({path:resolve(output,name+'-visit-parking-focus.png')});
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'mailto:contact@freedomvillage.church');
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'https://pf.kakao.com/_nEAVn');
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const ending=await page.locator('.arrival-contact a').last().boundingBox(),overlay=await page.locator('#prompt-composer').boundingBox();assert(ending&&overlay&&ending.y+ending.height<=overlay.y,'Visit closing contact clears the composer');
   for(const a of await page.locator('.arrival-contact a').all())assert(await contrast(a)>=4.5);assert.equal(await page.locator('.arrival-contact a').last().evaluate(e=>getComputedStyle(e).outlineColor===getComputedStyle(e).color&&parseFloat(getComputedStyle(e).outlineWidth)>=2),true);await page.screenshot({path:resolve(output,name+'-visit-ending-focus.png')});
   await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="dark"]').click();await page.locator('#settings-close').click();
   await page.locator('.arrival-contact a').last().hover();assert(await contrast(page.locator('.arrival-contact a').last())>=4.5);await page.locator('[aria-label="Venue maps"] a').first().hover();assert(await contrast(page.locator('[aria-label="Venue maps"] a').first())>=4.5);await page.screenshot({path:resolve(output,name+'-visit-dark-full.png'),fullPage:true});
   await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="light"]').click();await page.locator('#settings-close').click();
   await activate(page.locator('.visit-detail > .back'));await page.waitForFunction(y=>location.pathname==='/'&&Math.abs(scrollY-y)<3&&document.activeElement?.getAttribute('href')==='/cards/visit-help',departureY);
   await page.screenshot({path:resolve(output,name+'-sunday-return.png')});await page.locator('.sunday-entry-actions a').last().focus();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.locator('.sunday-entry-actions a').last().hover();assert(await contrast(page.locator('.sunday-entry-actions a').last())>=4.5);await page.screenshot({path:resolve(output,name+'-sunday-secondary-hover.png')});assert.equal(providerCalls,0);
   console.log(JSON.stringify({viewport:name,sundayJourney:'passed',entryInput:name==='mobile'?'emulated-touch':name==='desktop'?'keyboard':'pointer',keyboardMapParkingContactOrder:true,backScrollRestored:true,backFocusRestored:true,providerCallsBeforeSubmit:providerCalls,reducedMotion:'reduce',recording:(await page.video().path()).split('/').at(-1),startSeconds,endSeconds:Number(((performance.now()-recordingStarted)/1000).toFixed(2))}));
   if(name==='mobile'){
    const noJs=await browser.newContext({viewport:{width,height},javaScriptEnabled:false});await noJs.route('**/*',serve);const plain=await noJs.newPage();await plain.goto(origin);await plain.locator('.sunday-entry-actions a[href="/cards/visit-help"]').click();assert.equal(new URL(plain.url()).pathname,'/cards/visit-help');assert.equal(await plain.locator('.arrival-section').count(),3);assert.equal(await plain.locator('.arrival-contact a').count(),2);await plain.screenshot({path:resolve(output,'mobile-visit-no-js-full.png'),fullPage:true});await noJs.close();
   }
  }
  if(['breakpoint','narrow'].includes(name)){
   // The Godly Back journey already restored the complete collection here.
   assert.equal(new URL(page.url()).pathname,'/topics/families');assert.deepEqual((await page.locator('#grid > article.card').evaluateAll(cards=>cards.map(c=>c.id))).sort(),expectedFamilyIds);
   await loadScene(page,'.family-opening .kids-paper');await loadScene(page,'.kids-card .kids-paper');await loadScene(page,'#card-village-youth .youth-source-mark');await captureTop(page);await page.screenshot({path:resolve(output,name+'-families-category-full.png'),fullPage:true});await captureOpening(page);await page.locator('.family-opening').screenshot({path:resolve(output,name+'-families-opening.png')});await page.locator('.kids-card').screenshot({path:resolve(output,name+'-kids-entry.png')});await familySupportBounds(page);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   console.log(JSON.stringify({viewport:name,familiesSupport:'intrinsic-flow-passed',completeFamilyRecords:40}));
  }
  await page.locator('#prompt-text').fill('Synthetic review question');await page.locator('#prompt-submit').click();
  await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='24 ranked resources loaded');
  assert.equal(await page.locator('#prompt-composer a').count(),0);assert((await page.locator('#composer-status').textContent()).includes('ranked for your question'));
  assert.equal(await page.locator('.collection-context').count(),0,'category introduction does not leak into global intent results');assert.equal(await page.locator('#collection').getAttribute('data-topic'),null,'Families presentation does not change global ranking layout');
  await page.screenshot({path:resolve(output,name+'-ranked-head.png')});
  const calls=providerCalls;
  await page.locator('#intent-more').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(output,name+'-more.png')});
  failPage=true;await page.locator('#intent-more').click();await page.getByRole('button',{name:'Could not load. Try again ↓'}).waitFor();
  await page.screenshot({path:resolve(output,name+'-retry.png')});
  await page.locator('#intent-more').click();await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='48 ranked resources loaded');
  await page.locator('#intent-more').click();await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='71 ranked resources loaded');
  assert.equal(await page.locator('#intent-more').count(),0);assert.equal(providerCalls,calls);const continuationProviderCalls=providerCalls-calls;
  const ids=await page.locator('#grid > article.card').evaluateAll(cards=>cards.map(c=>c.id));assert.equal(new Set(ids).size,71);assert.equal(ids[0],'card-connect-card');assert.equal(ids[1],'card-freedom-kids');
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  await page.screenshot({path:resolve(output,name+'-ranked-tail.png')});
  const composer=await page.locator('#prompt-composer').boundingBox();assert(composer&&composer.y>=0&&composer.y+composer.height<=height+1);
  const last=await page.locator('#grid > article.card').last().boundingBox();console.log(JSON.stringify({viewport:name,rankedTail:{lastBottom:last?.y+last?.height,composerTop:composer?.y,...await page.evaluate(()=>({scrollY,height:innerHeight,scrollHeight:document.documentElement.scrollHeight}))}}));assert(last&&last.y+last.height<=composer.y,'final resource clears the bottom composer');
  // A fresh synthetic database state enables one new all-zero fixture query.
  // This is not a runtime recovery or spend reset mechanism.
  db.prepare("UPDATE content_checks SET result_json=json_set(result_json,'$.lastStartedAt',0) WHERE id='jev-intent-runtime-v1'").run();zero=true;
  await page.locator('#prompt-text').fill('Synthetic no-close question');await page.locator('#prompt-submit').click();
  await page.waitForFunction(()=>document.querySelector('#composer-status')?.textContent.startsWith('No close matches.'));
  assert.equal(await page.locator('#grid > article.card').count(),24);await page.screenshot({path:resolve(output,name+'-no-close.png')});assert.deepEqual(errors,[]);
  console.log(JSON.stringify({viewport:name,candidateCount:71,rendered:ids.length,weakSecond:true,noCloseRetained:24,continuationProviderCalls,composerWithinViewport:true,pageErrors:errors}));
  await context.close();
  // Actual before/after native scrolling: identical current source markup and
  // synthetic records; only the two exact baseline browser assets are swapped.
  const nativeCalls=providerCalls;
  for(const phase of ['before','after']){
   if(!['desktop','intermediate','mobile'].includes(name)&&phase==='before')continue;
   baselineSceneAssets=phase==='before';
   const natural=await browser.newContext({viewport:{width,height},hasTouch:name==='mobile',reducedMotion:'no-preference',recordVideo:{dir:resolve(output,'journey-recordings'),size:{width,height}}});await natural.route('**/*',serve);
   const reading=await natural.newPage(),nativeStarted=performance.now();await reading.clock.install({time:new Date(at)});const nativeErrors=[];reading.on('pageerror',e=>nativeErrors.push(e.message));
   await completeFamilies(reading);const invitation=reading.locator('.kids-brand-link');await invitation.focus();await reading.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const departureY=await reading.evaluate(()=>scrollY);await invitation.click();await reading.locator('html[data-site-revealed="true"]').waitFor();
   const enhanced=phase==='after'&&['desktop','intermediate'].includes(name);if(enhanced)await reading.locator('.kids-reading[data-scene-stage]').waitFor();else assert.equal(await reading.locator('.kids-reading[data-scene-stage]').count(),0);
   const prefix=name+'-kids-scroll-'+phase,recording=(await reading.video().path()).split('/').at(-1),samples=[];
   if(['desktop','intermediate','mobile'].includes(name)){
    await reading.locator('.kids-detail>.back').focus();await reading.evaluate(()=>{window.__nativeRead={wheel:0,scroll:0,touch:0};addEventListener('wheel',()=>__nativeRead.wheel++,{passive:true});addEventListener('scroll',()=>__nativeRead.scroll++,{passive:true});addEventListener('touchmove',()=>__nativeRead.touch++,{passive:true});});
    const identity=await reading.evaluate(()=>({href:location.href,history:history.length,state:JSON.stringify(history.state),focus:document.activeElement.outerHTML})),startSeconds=Number(((performance.now()-nativeStarted)/1000).toFixed(2));
    const touch=name==='mobile'?await natural.newCDPSession(reading):null;
    const advance=async direction=>{
     if(touch)await touch.send('Input.synthesizeScrollGesture',{x:Math.round(width*.65),y:Math.round(height*.5),yDistance:-direction*180,gestureSourceType:'touch',speed:900});
     else{await reading.mouse.move(Math.round(width*.78),Math.round(height*.45));await reading.mouse.wheel(0,direction*120);}
     await reading.waitForTimeout(70);
    };
    const reach=async(index,direction)=>{
     for(let step=0;step<65;step++){
      const reached=await reading.evaluate(({index,enhanced})=>{const heads=[...document.querySelectorAll('.kids-chapter h2')],nav=document.querySelector('.kids-contents'),edge=Math.max(nav.getBoundingClientRect().bottom+40,160),stage=document.querySelector('.kids-scene-stage'),top=parseFloat(document.querySelector('.kids-reading').style.getPropertyValue('--kids-stage-top'));return heads[index].getBoundingClientRect().top<=edge&&(!heads[index+1]||heads[index+1].getBoundingClientRect().top>edge)&&(!enhanced||Math.abs(stage.getBoundingClientRect().top-top)<2);},{index,enhanced});
      if(reached)return;await advance(direction);
     }console.log(JSON.stringify({viewport:name,phase,nativeReachFailure:index,geometry:await reading.evaluate(()=>({y:scrollY,headings:[...document.querySelectorAll('.kids-chapter h2')].map(e=>e.getBoundingClientRect().top),chapters:[...document.querySelectorAll('.kids-chapter')].map(e=>e.getBoundingClientRect().height),stage:document.querySelector('.kids-scene-stage')?.getBoundingClientRect().toJSON(),sequence:document.querySelector('.kids-scene-sequence')?.getBoundingClientRect().toJSON(),configuredTop:document.querySelector('.kids-reading').style.getPropertyValue('--kids-stage-top'),configuredHeight:document.querySelector('.kids-reading').style.getPropertyValue('--kids-stage-height')}))}));await reading.screenshot({path:resolve(output,prefix+'-reach-failure.png')});throw Error(prefix+' native scroll did not reach chapter '+index);
    };
    const capture=async(index,direction)=>{
     await reach(index,direction);
     if(enhanced){await reading.waitForFunction(index=>document.querySelector('.kids-scene-stage').dataset.chapter===String(index),index);await reading.waitForFunction(()=>{const i=document.querySelector('.kids-scene-frame:not([hidden]) img');return i?.complete&&i.naturalWidth>0;});const art=await reading.locator('.kids-scene-stage').boundingBox(),nav=await reading.locator('.kids-contents').boundingBox(),composer=await reading.locator('#prompt-composer').boundingBox();assert(art.y>=nav.y+nav.height&&art.y+art.height<=composer.y,'native reading stage fits between existing contents and composer');assert.equal(await reading.locator('.kids-contents a').nth(index).getAttribute('aria-current'),'location');}
     else await reading.waitForFunction(index=>{const i=document.querySelectorAll('.kids-chapter img')[index];return i?.complete&&i.naturalWidth>0;},index);
     await reading.screenshot({path:resolve(output,prefix+'-'+(direction>0?'forward':'backward')+'-'+index+'.png')});samples.push({direction:direction>0?'forward':'backward',chapter:index,...await reading.evaluate(()=>({y:scrollY,stage:document.querySelector('.kids-scene-stage')?.dataset.chapter||null}))});
    };
    for(const index of [0,1,2])await capture(index,1);
    for(let step=0;step<35;step++){if(await reading.locator('.kids-questions').evaluate(e=>e.getBoundingClientRect().top<=180))break;await advance(1);}
    if(enhanced){const art=await reading.locator('.kids-scene-stage').boundingBox(),questions=await reading.locator('.kids-questions').boundingBox();assert(art.y+art.height<=questions.y+.5,'scene releases before questions and closing actions');}await reading.screenshot({path:resolve(output,prefix+'-release.png')});
    for(const index of [2,1,0])await capture(index,-1);
    assert.deepEqual(await reading.evaluate(()=>({href:location.href,history:history.length,state:JSON.stringify(history.state),focus:document.activeElement.outerHTML})),identity,'passive native progression does not change URL/history/focus');const inputCounts=await reading.evaluate(()=>__nativeRead);assert(inputCounts.scroll>0);if(!touch)assert(inputCounts.wheel>0);
    console.log(JSON.stringify({viewport:name,kidsNativeScroll:'passed',phase,baselineSha,enhanced,input:touch?'CDP-emulated-touch-scroll':'native-mouse-wheel',...inputCounts,samples,passiveFocusUrlHistoryUnchanged:true,recording,startSeconds,endSeconds:Number(((performance.now()-nativeStarted)/1000).toFixed(2))}));
    await reading.locator('.kids-contents a').nth(1).focus();await reading.keyboard.press('Enter');assert.equal(new URL(reading.url()).hash,'#kids-freedom-kids-1');assert.equal(await reading.locator('#kids-freedom-kids-1').evaluate(e=>document.activeElement===e),true);if(enhanced)await reading.waitForFunction(()=>document.querySelector('.kids-scene-stage').dataset.chapter==='1');await reading.screenshot({path:resolve(output,prefix+'-keyboard-jump.png')});
   }
   for(let i=0;i<3;i++)if(!enhanced)await loadScene(reading,'.kids-spread-'+i+' .kids-paper');await captureTop(reading);await reading.screenshot({path:resolve(output,prefix+'-full.png'),fullPage:true});
   if(enhanced){await reading.emulateMedia({reducedMotion:'reduce'});await reading.waitForFunction(()=>!document.querySelector('.kids-reading').hasAttribute('data-scene-stage'));assert.equal(await reading.locator('.kids-chapter .kids-spread-art').evaluateAll(art=>art.every(e=>getComputedStyle(e).display!=='none')),true);for(let i=0;i<3;i++)await loadScene(reading,'.kids-spread-'+i+' .kids-paper');await captureTop(reading);await reading.screenshot({path:resolve(output,prefix+'-reduced-full.png'),fullPage:true});await reading.emulateMedia({reducedMotion:'no-preference'});await reading.locator('.kids-reading[data-scene-stage]').waitFor();await reading.setViewportSize({width,height:650});await reading.waitForFunction(()=>!document.querySelector('.kids-reading').hasAttribute('data-scene-stage'));await captureTop(reading);await reading.screenshot({path:resolve(output,prefix+'-short-static.png'),fullPage:true});await reading.setViewportSize({width,height});await reading.locator('.kids-reading[data-scene-stage]').waitFor();}
   await reading.locator('.kids-detail>.back').click();await reading.waitForFunction(y=>location.pathname==='/topics/families'&&document.querySelectorAll('#grid>article.card').length===40&&Math.abs(scrollY-y)<3&&document.activeElement?.closest('#card-freedom-kids'),departureY);await reading.screenshot({path:resolve(output,prefix+'-families-back.png')});assert.deepEqual(nativeErrors,[]);await natural.close();
  }
  baselineSceneAssets=false;assert.equal(providerCalls,nativeCalls,'native reading makes no extra provider call');db.close();
 }
}finally{await browser.close();}
