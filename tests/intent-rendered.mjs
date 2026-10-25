// Explicit cloud-only rendered acceptance. No credentials, provider calls or live DB.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createWorker} from '../src/worker.mjs';
import {familyFixtures} from './fixtures/families.mjs';
if(process.env.CI!=='true'||process.platform!=='linux')throw Error('Cloud Linux only');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const origin='https://next.freedomvillage.church',at=Date.parse('2026-10-25T03:00:00Z');
const output=resolve('rendered-review');await mkdir(output,{recursive:true});
const browser=await chromium.launch();
try{
 for(const [name,width,height] of [['desktop',1440,1000],['intermediate',900,900],['breakpoint',720,900],['mobile',390,844],['narrow',320,800]]){
  const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE content_cards(id TEXT PRIMARY KEY,status TEXT,content_json TEXT,expires_at TEXT);CREATE TABLE content_checks(id TEXT PRIMARY KEY,result_json TEXT,created_at TEXT)');
  const themes=['paper','ink','forest','clay','youth','outline'];
  for(let i=0;i<71;i++){
   const id=['freedom-kids','connect-card','families-growing-together','village-youth','junior-village','godly-play','children-in-worship'][i]||'sample-'+String(i).padStart(3,'0');
   const card={schemaVersion:2,template:'story',title:'Review resource '+(i+1),summary:'Synthetic review content for ranked resource continuation.',detail:['Synthetic public prose for browser acceptance.'],facts:[],categories:['community'],actions:[],related:[],media:null,design:{theme:themes[i%themes.length],layout:'text',motif:'none',motion:'none',size:'regular'},homePriority:50,sourceStatus:'draft',isSynthetic:false};
   db.prepare('INSERT INTO content_cards VALUES(?,?,?,?)').run(id,'draft',JSON.stringify(card),null);
  }
  for(const [id,card] of familyFixtures())db.prepare('INSERT OR REPLACE INTO content_cards VALUES(?,?,?,?)').run(id,'draft',JSON.stringify(card),null);
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
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',recordVideo:{dir:resolve(output,'journey-recordings'),size:{width,height}}});
  const serve=async route=>{
   const r=route.request(),url=new URL(r.url());if(url.origin!==origin)return route.abort();
   if(failPage&&url.pathname==='/api/content/intent'&&url.searchParams.has('after')){failPage=false;return route.fulfill({status:503,contentType:'application/json',body:'{"status":"unavailable"}'});}
   const headers=new Headers(r.headers());headers.set('Cf-Access-Jwt-Assertion','SYNTHETIC_FIXTURE');if(r.method()==='POST')headers.set('Origin',origin);
   const response=await worker.fetch(new Request(r.url(),{method:r.method(),headers,...(r.postData()?{body:r.postData()}: {})}),env);
   if(url.pathname==='/api/content/intent'){const value=await response.clone().json();console.log(JSON.stringify({viewport:name,method:r.method(),httpStatus:response.status,status:value.status,selected:value.selectedIds?.length,nextCursor:value.renderSelection?.nextCursor}));}
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  };
  await context.route('**/*',serve);
  const page=await context.newPage();await page.clock.install({time:new Date(at)});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.locator('html[data-site-revealed="true"]').waitFor({timeout:30000});
  const socialLinks=page.getByRole('navigation',{name:'Freedom Village links'}).getByRole('link');
  assert.deepEqual(await socialLinks.evaluateAll(links=>links.map(a=>[a.getAttribute('aria-label'),a.href])),[
   ['YouTube','https://www.youtube.com/FreedomVillageChurch'],['Instagram','https://www.instagram.com/freedom_village_church/'],['Kakao','https://pf.kakao.com/_nEAVn'],['SoundCloud','https://soundcloud.com/freedomvillage'],['Email Freedom Village','mailto:contact@freedomvillage.church']
  ]);
  const actions=await page.locator('.composer-actions').boundingBox();assert(actions);
  for(const link of await socialLinks.all()){const rect=await link.boundingBox();assert(rect&&rect.width>=44&&rect.height>=44&&rect.x>=0&&rect.x+rect.width<=width);assert(!(rect.x<actions.x+actions.width&&rect.x+rect.width>actions.x&&rect.y<actions.y+actions.height&&rect.y+rect.height>actions.y),'social links and composer actions must not overlap');}
  assert.equal(await page.locator('#composer-status').textContent(),'');assert.equal(providerCalls,0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:resolve(output,name+'-browse.png')});
  await page.locator('#prompt-text').focus();await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'YouTube');
  await page.screenshot({path:resolve(output,name+'-social-focus.png')});
  await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="dark"]').click();await page.locator('#settings-close').click();
  await page.screenshot({path:resolve(output,name+'-social-dark.png')});
  await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="light"]').click();await page.locator('#settings-close').click();
  await page.locator('#prompt-text').fill('Synthetic private draft');
  const privacy=await page.locator('#composer-privacy').boundingBox();assert(privacy&&privacy.width>1&&privacy.height>1);
  assert((await page.locator('#prompt-text').getAttribute('aria-describedby')).includes('composer-privacy'));
  await page.screenshot({path:resolve(output,name+'-composer-draft.png')});assert.equal(providerCalls,0);
  if(['desktop','intermediate','mobile'].includes(name)){
   await page.locator('#prompt-text').fill('');await page.locator('#prompt-text').blur();
   await page.screenshot({path:resolve(output,name+'-families-home-full.png'),fullPage:true});
   await page.locator('.family-entry-route').click();await page.locator('html[data-site-revealed="true"]').waitFor();
   assert.equal(new URL(page.url()).pathname,'/topics/families');assert.equal(await page.locator('.family-context nav a').count(),3);
   assert.equal(await page.locator('.family-entry-route').isVisible(),false);
   await page.screenshot({path:resolve(output,name+'-families-category-full.png'),fullPage:true});
   await page.locator('.family-context a[href$="#card-freedom-kids"]').click();assert.equal(new URL(page.url()).pathname,'/topics/families');await page.locator('.kids-brand-link').focus();
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const departureY=await page.evaluate(()=>scrollY);
   await page.locator('.kids-brand-link').click();await page.locator('html[data-site-revealed="true"]').waitFor();
   assert.equal(new URL(page.url()).pathname,'/cards/freedom-kids');assert.equal(await page.locator('.kids-chapter').count(),3);assert.equal(await page.locator('.kids-question').count(),2);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:resolve(output,name+'-kids-detail-full.png'),fullPage:true});
   await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="dark"]').click();await page.locator('#settings-close').click();
   await page.locator('.kids-contents a').first().hover();await page.screenshot({path:resolve(output,name+'-kids-dark-hover-full.png'),fullPage:true});
   await page.locator('#scene-settings').click();await page.locator('[data-scene-mode="light"]').click();await page.locator('#settings-close').click();
   await page.locator('.kids-question').first().locator('summary').click();assert.equal(await page.locator('.kids-question').first().getAttribute('open'),'');
   await page.screenshot({path:resolve(output,name+'-kids-question-open-full.png'),fullPage:true});
   await page.locator('.kids-next a').last().focus();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const ending=await page.locator('.kids-next a').last().boundingBox(),overlay=await page.locator('#prompt-composer').boundingBox();assert(ending&&overlay&&ending.y+ending.height<=overlay.y,'Kids closing action clears the composer');
   await page.screenshot({path:resolve(output,name+'-kids-ending-focus.png')});
   await page.locator('.kids-contents a').nth(1).click();assert.equal(new URL(page.url()).hash,'#kids-freedom-kids-1');assert.equal(new URL(page.url()).pathname,'/cards/freedom-kids');
   await page.locator('.kids-detail > .back').click();await page.waitForFunction(y=>location.pathname==='/topics/families'&&Math.abs(scrollY-y)<3&&document.activeElement?.closest('.kids-card'),departureY);
   assert.equal(await page.locator('#filters a[href="/topics/families"]').getAttribute('aria-current'),'page');assert.equal(await page.locator('.family-context').count(),1);await page.screenshot({path:resolve(output,name+'-families-return.png')});assert.equal(providerCalls,0);
   console.log(JSON.stringify({viewport:name,familiesJourney:'passed',backScrollRestored:true,backFocusRestored:true,providerCallsBeforeSubmit:providerCalls}));
   if(name==='mobile'){
    const noJs=await browser.newContext({viewport:{width,height},javaScriptEnabled:false});await noJs.route('**/*',serve);const plain=await noJs.newPage();await plain.goto(origin+'/cards/freedom-kids');
    assert.equal(await plain.locator('.kids-chapter').count(),3);await plain.locator('.kids-question').first().locator('summary').click();assert.equal(await plain.locator('.kids-question').first().getAttribute('open'),'');
    await plain.locator('.kids-contents a').nth(1).click();assert.equal(new URL(plain.url()).pathname,'/cards/freedom-kids');assert.equal(new URL(plain.url()).hash,'#kids-freedom-kids-1');
    await plain.screenshot({path:resolve(output,'mobile-kids-no-js-full.png'),fullPage:true});
    await plain.goto(origin+'/topics/families');await plain.locator('.family-context a[href$="#card-freedom-kids"]').click();assert.equal(new URL(plain.url()).pathname,'/topics/families');
    await noJs.close();assert.equal(providerCalls,0);
   }
  }
  await page.locator('#prompt-text').fill('Synthetic review question');await page.locator('#prompt-submit').click();
  await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='24 ranked resources loaded');
  assert.equal(await page.getByRole('navigation',{name:'Freedom Village links'}).isVisible(),false);assert((await page.locator('#composer-status').textContent()).includes('ranked for your question'));
  assert.equal(await page.locator('.collection-context').count(),0,'category introduction does not leak into global intent results');
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
