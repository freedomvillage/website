// Synthetic client/history contract checks, cloud CI only; no automated Mac browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync(new URL('../dist/content-view.js',import.meta.url),'utf8');
const origin='https://next.freedomvillage.church';
function harness({referrer=origin+'/topics/families',historyLength=2,canGoBack,backThrows=false}={}){
 const listeners={},pageHandlers={},historyCalls=[],sourceState={scrollY:1800,focusId:'study-ministry-first-0-card-village-youth',appendedCardIds:['card-page-one','card-page-two','card-page-three']};
 const back={href:'/',dataset:{},addEventListener(k,fn){listeners[k]=fn;}};
 const context={URL,URLSearchParams,Set,location:{origin,hash:''},history:{length:historyLength,back(){if(backThrows)throw Error('Synthetic unsupported history');historyCalls.push('back');},state:sourceState},
  ...(canGoBack===undefined?{}:{navigation:{canGoBack}}),
  matchMedia(){return {matches:false,addEventListener(){}};},requestAnimationFrame(fn){fn();},addEventListener(k,fn){pageHandlers[k]=fn;},
  document:{referrer,hidden:false,querySelector(selector){return selector==='#detail .detail-shell > a.back'?back:null;},querySelectorAll(){return [];},addEventListener(){}}};
 vm.createContext(context);vm.runInContext(script,context);context.contentView.render();
 function click(extra={}){let prevented=false;listeners.click?.({button:0,preventDefault(){prevented=true;},...extra});return prevented;}
 return {context,back,listeners,pageHandlers,historyCalls,sourceState,click};
}
test('Back from home, category, study and paged feeds traverses history without rebuilding or replacing their state',()=>{
 for(const source of ['/', '/topics/families','/studies/families#study-ministry-first','/?after=75%3Agodly-play','/topics/faith?after=50%3Abaptism']){
  const h=harness({referrer:origin+source});const snapshot=JSON.stringify(h.sourceState);
  assert.equal(h.back.href,source);assert(h.click());assert.deepEqual(h.historyCalls,['back']);assert.equal(JSON.stringify(h.context.history.state),snapshot);
  // Repeated render does not install another handler; repeated clicks cannot skip two entries.
  h.context.contentView.render();assert(h.click());assert.equal(h.historyCalls.length,1);
  h.pageHandlers.pageshow();assert(h.click());assert.equal(h.historyCalls.length,2);
 }
});
test('a normal referrer omits the study fragment but native traversal still targets the original entry',()=>{
 const h=harness({referrer:origin+'/studies/families'});h.context.history.state.studyHash='#study-ministry-first';
 assert(h.click());assert.deepEqual(h.historyCalls,['back']);assert.equal(h.context.history.state.studyHash,'#study-ministry-first');
});
test('direct, new-tab, external and unsupported arrivals retain the ordinary homepage fallback',()=>{
 const sources=['','not a URL','https://outside.invalid/topics/families',origin+'/api/content/evaluation',origin+'/not-a-route',origin+'/topics/families?query=PRIVATE',origin+'/?after=101%3Ax',origin+'/?after=50%3Ax&after=40%3Ay',origin+'/studies/families?after=50%3Ax'];
 for(const referrer of sources){const h=harness({referrer});assert.equal(h.back.href,'/');assert.equal(h.click(),false);assert.equal(h.historyCalls.length,0);}
 for(const options of [{historyLength:1},{canGoBack:false}]){const h=harness(options);assert.equal(h.back.href,'/');assert.equal(h.click(),false);assert.equal(h.historyCalls.length,0);}
});
test('modified/auxiliary/prevented clicks keep native link behavior and a throwing history leaves the same-site anchor usable',()=>{
 const h=harness();for(const extra of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1},{defaultPrevented:true}])assert.equal(h.click(extra),false);
 assert.equal(h.historyCalls.length,0);assert.equal(h.back.href,'/topics/families');
 const unsupported=harness({backThrows:true});assert.equal(unsupported.click(),false);assert.equal(unsupported.back.href,'/topics/families');
});

// Skip to content adds #main to the same detail document. Traversing that entry
// must unlock the next Back even when no document pageshow event occurs.
test('same-document fragment/state completion releases the pending Back guard without pageshow',()=>{
 for(const completion of ['hashchange','popstate']){
  const h=harness();h.context.location.hash='#main';
  assert(h.click());assert.deepEqual(h.historyCalls,['back']);
  assert(h.click());assert.equal(h.historyCalls.length,1,'pending traversal still coalesces repeated clicks');
  h.context.location.hash='';h.pageHandlers[completion]({state:null});
  assert(h.click());assert.equal(h.historyCalls.length,2,'completed same-document traversal permits the next Back');
  assert(h.click());assert.equal(h.historyCalls.length,2,'new traversal is guarded until its own completion');
 }
});
