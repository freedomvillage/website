// Synthetic geometry and reconstructed-document fixtures; run in cloud CI.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const script=fs.readFileSync('dist/feed-history.js','utf8'),origin='https://next.freedomvillage.church',instant=Date.parse('2026-10-24T15:00:00Z');
function harness({path='/topics/families',state=null,navigation='navigate'}={}){
 const events={},documentEvents={},cards=new Map(),scrolls=[],focused=[];
 const context={URL,location:new URL(origin+path),innerHeight:400,scrollY:9169,performance:{getEntriesByType:()=>[{type:navigation}]},Date:class extends Date{static now(){return instant;}},requestAnimationFrame(fn){fn();},
  history:{state,scrollRestoration:'auto',replaceState(value){this.state=JSON.parse(JSON.stringify(value));}},
  addEventListener(type,fn){(events[type]??=[]).push(fn);},scrollTo(value){scrolls.push(value);this.scrollY=value.top;},scrollBy(value){scrolls.push(value);},
  document:{activeElement:null,addEventListener(type,fn){(documentEvents[type]??=[]).push(fn);},getElementById(id){return cards.get(id)||null;}}};
 vm.createContext(context);vm.runInContext(script,context);
 function link(id='card-village-youth',href='/cards/village-youth'){
  const card={id,querySelectorAll:()=>[anchor]},anchor={href:origin+href,hasAttribute:()=>false,closest(selector){return selector==='main a[href]'?this:selector==='article[id]'?card:null;},focus(options){assert.equal(options.preventScroll,true);context.document.activeElement=this;focused.push(id);}};
  cards.set(id,card);return anchor;
 }
 const emit=(type,event={})=>(events[type]||[]).forEach(fn=>fn(event));
 const click=anchor=>(documentEvents.click||[]).forEach(fn=>fn({target:anchor,button:0}));
 return {context,events,documentEvents,cards,scrolls,focused,link,emit,click};
}
function saved(path='/topics/families',pages=3){return {fvcFeedRestore:{version:1,path,pages,y:9169,focus:{cardId:'card-village-youth',href:'/cards/village-youth'},at:instant}};}
test('departure stores only bounded navigation hints, retaining unrelated history state',()=>{
 const h=harness({state:{unrelated:'preserved'}}),controller=h.context.createFeedHistory({pageCount:()=>3,isIntent:()=>false,loadMore:async()=>false,measure(){}});
 assert(!controller.willRestore());h.click(h.link());h.emit('pagehide');
 const value=h.context.history.state;assert.equal(value.unrelated,'preserved');assert.deepEqual(value.fvcFeedRestore,saved().fvcFeedRestore);
 assert.deepEqual(Object.keys(value.fvcFeedRestore).sort(),['at','focus','pages','path','version','y']);assert(!JSON.stringify(value).includes('<article'));
});
test('no-store Back reconstructs appended pages before restoring exact scroll and card focus',async()=>{
 for(const path of ['/', '/topics/families','/topics/families#card-freedom-kids','/studies/families#study-ministry-first','/topics/faith?after=50%3Abaptism']){
  const h=harness({path,state:saved(path),navigation:'back_forward'});let loads=0,measure=0;
  const controller=h.context.createFeedHistory({pageCount:()=>1,isIntent:()=>false,async loadMore(){loads++;if(loads===2)h.link();return true;},measure(){measure++;}});
  assert(controller.willRestore());await controller.restore();assert.equal(loads,2);assert.equal(measure,1);assert.deepEqual(h.focused,['card-village-youth']);assert.equal(h.scrolls.at(-1).top,9169);assert.equal(h.context.history.scrollRestoration,'auto');
  const count=h.scrolls.length;h.emit('pageshow',{persisted:true});assert.equal(h.scrolls.length,count,'native bfcache is not overridden');h.emit('pageshow',{persisted:false});assert.equal(h.scrolls.at(-1).top,9169);
 }
});
test('study hash changes are saved for the actual departing history entry',()=>{
 const h=harness({path:'/studies/families'});h.context.createFeedHistory({pageCount:()=>1,isIntent:()=>false,loadMore:async()=>false,measure(){}});h.context.location.hash='#study-ministry-first';h.click(h.link());assert.equal(h.context.history.state.fvcFeedRestore.path,'/studies/families#study-ministry-first');
});
test('the authored readers restore bounded single-page hints without enabling other detail or query state',async()=>{
 for(const [path,id,href] of [['/cards/godly-play','godly-play-reader','/cards/freedom-kids'],['/cards/village-youth','youth-reader','/connect'],['/cards/freedom-kids','kids-reader','/cards/godly-play'],['/cards/freedom-kids#kids-freedom-kids-2','kids-reader','/cards/godly-play']]){
  const h=harness({path,state:null});h.context.createFeedHistory({pageCount:()=>1,isIntent:()=>false,loadMore(){throw Error('Reader has no pagination');},measure(){}});h.click(h.link(id,href));h.emit('pagehide');
  const state=JSON.parse(JSON.stringify(h.context.history.state));assert.equal(state.fvcFeedRestore.path,path);assert.equal(state.fvcFeedRestore.pages,1);assert.deepEqual(state.fvcFeedRestore.focus,{cardId:id,href});
  const returned=harness({path,state,navigation:'back_forward'});returned.link(id,href);const controller=returned.context.createFeedHistory({pageCount:()=>1,isIntent:()=>false,loadMore(){throw Error('Reader must not re-fetch pages');},measure(){}});assert(controller.willRestore());await controller.restore();assert.deepEqual(returned.focused,[id]);assert.equal(returned.scrolls.at(-1).top,9169);
  state.fvcFeedRestore.pages=2;assert(!harness({path,state,navigation:'back_forward'}).context.createFeedHistory({}).willRestore());
 }
 for(const unsupported of ['/cards/freedom-kids#PRIVATE','/cards/freedom-kids?query=PRIVATE','/cards/other-reader','/cards/godly-play?query=PRIVATE','/cards/godly-play?after=50%3Ax','/cards/village-youth?question=PRIVATE','/cards/village-youth?after=50%3Ax'])assert.equal(harness({path:unsupported}).context.createFeedHistory({}),null);
});
test('reconstructed Kids return reopens only the departed native question before measurement without storing prose',async()=>{
 const path='/cards/freedom-kids#kids-freedom-kids-2',state=saved(path,1);state.fvcFeedRestore.focus={cardId:'kids-reader',href:'/cards/godly-play'};
 const h=harness({path,state,navigation:'back_forward'}),link=h.link('kids-reader','/cards/godly-play'),disclosure={open:false};link.closest=selector=>selector==='details.kids-question'?disclosure:null;
 let measured=false;await h.context.createFeedHistory({pageCount:()=>1,isIntent:()=>false,loadMore(){throw Error('No reader paging');},measure(){assert(disclosure.open);measured=true;}}).restore();
 assert(measured);assert.deepEqual(h.focused,['kids-reader']);assert.equal(h.scrolls.at(-1).top,9169);assert.equal(state.fvcFeedRestore.pages,1);assert.deepEqual(Object.keys(state.fvcFeedRestore).sort(),['at','focus','pages','path','version','y']);
});
test('a marked inquiry restores the exact link occurrence when an earlier link has the same destination',async()=>{
 const path='/cards/village-youth',h=harness({path});h.link('youth-reader','/connect');const ending=h.link('youth-inquiry','/connect');
 ending.closest=selector=>selector==='main a[href]'?ending:selector==='section[data-history-anchor][id]'?h.cards.get('youth-inquiry'):selector==='article[id]'?h.cards.get('youth-reader'):null;
 h.context.createFeedHistory({pageCount:()=>1,isIntent:()=>false,loadMore(){throw Error('No reader pagination');},measure(){}});h.click(ending);h.emit('pagehide');const state=JSON.parse(JSON.stringify(h.context.history.state));assert.deepEqual(state.fvcFeedRestore.focus,{cardId:'youth-inquiry',href:'/connect'});
 const returned=harness({path,state,navigation:'back_forward'});returned.link('youth-reader','/connect');returned.link('youth-inquiry','/connect');await returned.context.createFeedHistory({pageCount:()=>1,isIntent:()=>false,loadMore(){throw Error('No reader pagination');},measure(){}}).restore();assert.deepEqual(returned.focused,['youth-inquiry']);
});
test('user input cancels restoration without stealing scroll/focus; failed paging remains usable',async()=>{
 for(const cancellation of [true,false]){
  const h=harness({state:saved(),navigation:'back_forward'});let loads=0;
  const controller=h.context.createFeedHistory({pageCount:()=>1,isIntent:()=>false,async loadMore(){loads++;if(cancellation)h.emit('wheel');return false;},measure(){}});
  await controller.restore();assert.equal(loads,1);assert.equal(h.focused.length,0);if(cancellation)assert.equal(h.scrolls.length,0);assert.equal(h.context.history.scrollRestoration,'auto');
 }
});
test('stale/malformed/cross-route state and private query URLs cannot trigger re-fetches',async()=>{
 const variants=[{...saved().fvcFeedRestore,path:'/'},{...saved().fvcFeedRestore,pages:33},{...saved().fvcFeedRestore,pages:1.5},{...saved().fvcFeedRestore,y:-1},{...saved().fvcFeedRestore,at:instant-1800001},{...saved().fvcFeedRestore,focus:{cardId:'a',href:'https://evil.invalid/cards/x'}}];
 for(const value of variants){const h=harness({state:{fvcFeedRestore:value},navigation:'back_forward'});let calls=0;const controller=h.context.createFeedHistory({pageCount:()=>1,isIntent:()=>false,async loadMore(){calls++;},measure(){}});assert(!controller.willRestore());await controller.restore();assert.equal(calls,0);}
 for(const path of ['/topics/families?query=PRIVATE','/?after=101%3Ax','/studies/families#PRIVATE','/api/content/intent']){const h=harness({path});assert.equal(h.context.createFeedHistory({}),null);}
 const h=harness();h.context.createFeedHistory({pageCount:()=>1,isIntent:()=>true,loadMore(){},measure(){}});h.click(h.link());h.emit('pagehide');assert.equal(h.context.history.state,null,'transient Jev results/questions are not saved');
});
test('short viewport focuses the visible content landmark, not an oversized card bottom',()=>{
 const h=harness(),overlay={height:250.39,top:127.61};h.cards.set('prompt-composer',{getBoundingClientRect:()=>overlay});
 const target={closest:s=>s==='main'?{}:null,matches:s=>s==='a',querySelector:()=>({getBoundingClientRect:()=>({top:-146,bottom:-112,height:34})})};
 h.context.keepContentFocusVisible(target);assert.equal(h.scrolls.at(-1).top,-158,'heading moves from -146 to 12, inside the unobscured strip');
 const visible={...target,querySelector:()=>({getBoundingClientRect:()=>({top:20,bottom:54,height:34})})};const count=h.scrolls.length;h.context.keepContentFocusVisible(visible);assert.equal(h.scrolls.length,count);
 const bottom={...target,querySelector:()=>({getBoundingClientRect:()=>({top:110,bottom:144,height:34})})};h.context.keepContentFocusVisible(bottom);assert(Math.abs(h.scrolls.at(-1).top-28.39)<.001);
 h.context.keepContentFocusVisible({closest:()=>null});assert.equal(h.scrolls.length,count+1,'composer/modal/drawer focus does not move the feed');
});
test('single scroll reservation, fresh protected fetches and privacy headers remain source-enforced',()=>{
 const css=fs.readFileSync('dist/style.css','utf8'),view=fs.readFileSync('dist/content-view.js','utf8'),pages=fs.readFileSync('src/content/pages.mjs','utf8');
 assert(css.includes('scroll-padding-bottom:var(--composer-clearance,290px)'));assert(css.includes('scroll-margin-bottom:12px'));assert(!css.includes('scroll-margin-bottom:calc(var(--composer-height'));
 assert(view.includes('restoring&&!forRestore'));assert(view.includes("credentials:'same-origin',cache:'no-store',redirect:'error'"));assert(pages.includes("'Cache-Control':'private, no-store'"));assert(!/localStorage|sessionStorage|innerHTML/.test(script));
});

test('artwork-delayed reveal retries Back focus, unless the user has intervened',async()=>{
 for(const cancel of [false,true]){
  const h=harness({state:saved('/topics/families',1),navigation:'back_forward'});h.link();let callback,disconnected=false,visible=false;
  h.context.document.documentElement={dataset:{siteRevealed:'false'}};h.context.getComputedStyle=()=>({visibility:visible?'visible':'hidden'});
  h.context.MutationObserver=class{constructor(fn){callback=fn;}observe(){}disconnect(){disconnected=true;}};
  const controller=h.context.createFeedHistory({pageCount:()=>1,isIntent:()=>false,loadMore:async()=>false,measure(){}});await controller.restore();assert.equal(h.focused.length,0);assert.equal(h.scrolls.at(-1).top,9169);assert(callback);
  if(cancel)h.emit('keydown');visible=true;h.context.document.documentElement.dataset.siteRevealed='true';callback();assert.equal(h.focused.length,cancel?0:1);assert(disconnected);assert.equal(h.scrolls.at(-1).top,9169);
 }
});
