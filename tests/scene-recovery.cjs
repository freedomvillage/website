const fs=require('fs'),vm=require('vm'),assert=require('assert');
const js=fs.readFileSync('dist/app.js','utf8').split('// Scene keyframes:')[1];
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 let mode='ok',held=[],commits=[],loads=0;
 const el=()=>({value:2,textContent:'',hidden:true,setAttribute(k,v){this[k]=v},addEventListener(){},classList:{add(){},remove(){}}});
 const imageNode=()=>({...el(),src:'',decode(){if(mode==='candidate-fail')return Promise.reject(Error('decode'));if(mode==='candidate-hang')return new Promise(()=>{});if(mode==='hold-winter'&&this.src.includes('winter'))return new Promise(r=>held.push(r));return Promise.resolve();}});
 function stack(){const imgs=[imageNode(),imageNode(),imageNode()],tower=el();return {...el(),querySelectorAll:()=>imgs,querySelector:()=>tower,cloneNode:()=>stack(),replaceWith(n){commits.push(n.querySelectorAll().map(x=>x.src));},offsetWidth:1440};}
 const nodes={};for(const id of ['solar-note','scene-time','scene-season','time-readout','season-readout','scene-status','scene-retry','scene-air','scene-air-unknown','air-readout'])nodes[id]=el();nodes['scene-time'].value=720;nodes['scene-front']=stack();nodes['scene-back']=stack();
 class FakeImage{set src(src){loads++;this.naturalWidth=2172;this.complete=false;if(mode==='network-hang')return;queueMicrotask(()=>{if(mode==='network-fail')this.onerror?.();else this.onload?.();});}decode(){if(mode==='preload-decode-fail')return Promise.reject(Error('decode'));return Promise.resolve();}}
 const context={Date:class extends Date{constructor(...args){super(...(args.length?args:['2026-07-15T03:00:00Z']))}},Image:FakeImage,setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,30)),clearTimeout,document:{getElementById:id=>nodes[id],documentElement:{dataset:{},style:{setProperty(){}}}}};vm.createContext(context);vm.runInContext('// Scene keyframes:'+js,context);const run=s=>vm.runInContext(s,context);await tick();await tick();assert.equal(context.document.documentElement.dataset.season,'summer');
 async function select(i){nodes['scene-season'].value=i;await run('updateSceneSeason()');}
 for(const fail of ['network-fail','network-hang','preload-decode-fail','candidate-fail','candidate-hang']){
  mode=fail;run('assetCache.clear()');const before=commits.length,previousTiming=nodes['solar-note'].textContent;await select(0);assert.equal(nodes['solar-note'].textContent,previousTiming,'failed season preserves solar timing');assert.equal(commits.length,before,fail+' should preserve live scene');assert.equal(context.document.documentElement.dataset.season,'summer');assert.equal(nodes['scene-retry'].hidden,false);assert.equal(nodes['scene-season']['aria-busy'],'false');assert(nodes['scene-status'].textContent.includes('Still showing summer'));
  mode='ok';const oldloads=loads;await select(0);assert(loads>oldloads,'retry reloads instead of poisoned cache');assert.equal(context.document.documentElement.dataset.season,'winter');assert(nodes['solar-note'].textContent.includes('2026-01-15'));assert.equal(nodes['scene-retry'].hidden,true);await select(2);
 }
 // Old candidate is held after it has decoded network images. New selection wins.
 mode='hold-winter';nodes['scene-season'].value=0;const old=run('updateSceneSeason()');await tick();assert(held.length>0);mode='ok';await select(3);const count=commits.length;held.forEach(r=>r());await old;assert.equal(commits.length,count,'stale candidate must never commit');assert.equal(context.document.documentElement.dataset.season,'fall');assert(nodes['solar-note'].textContent.includes('2026-10-15'));
 // Rapid season input and time input remain independent; latest season wins.
 nodes['scene-season'].value=1;const a=run('updateSceneSeason()');nodes['scene-time'].value=0;run('updateSceneTime()');nodes['scene-season'].value=4;const b=run('updateSceneSeason()');await Promise.all([a,b]);assert.equal(context.document.documentElement.dataset.season,'christmas');assert(nodes['solar-note'].textContent.includes('2026-12-25'));assert.equal(nodes['time-readout'].value,'12 am');assert.equal(nodes['scene-season']['aria-busy'],'false');
 console.log('PASS: network error/hang, preload decode rejection, candidate decode rejection/hang, all retries, stale decode isolation, rapid latest-selection + time changes; last good scene preserved');
})().catch(e=>{console.error(e);process.exitCode=1});
