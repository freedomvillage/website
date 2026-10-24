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
 for(const path of ['/', '/topics/families','/studies/families#study-ministry-first','/topics/faith?after=50%3Abaptism']){
  const h=harness({path,state:saved(path),navigation:'back_forward'});let loads=0,measure=0;
  const controller=h.context.createFeedHistory({pageCount:()=>1,isIntent:()=>false,async loadMore(){loads++;if(loads===2)h.link();return true;},measure(){measure++;}});
  assert(controller.willRestore());await controller.restore();assert.equal(loads,2);assert.equal(measure,1);assert.deepEqual(h.focused,['card-village-youth']);assert.equal(h.scrolls.at(-1).top,9169);assert.equal(h.context.history.scrollRestoration,'auto');
  const count=h.scrolls.length;h.emit('pageshow',{persisted:true});assert.equal(h.scrolls.length,count,'native bfcache is not overridden');h.emit('pageshow',{persisted:false});assert.equal(h.scrolls.at(-1).top,9169);
 }
});
test('study hash changes are saved for the actual departing history entry',()=>{
 const h=harness({path:'/studies/families'});h.context.createFeedHistory({pageCount:()=>1,isIntent:()=>false,loadMore:async()=>false,measure(){}});h.context.location.hash='#study-ministry-first';h.click(h.link());assert.equal(h.context.history.state.fvcFeedRestore.path,'/studies/families#study-ministry-first');
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
