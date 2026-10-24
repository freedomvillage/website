// Cloud-only structured rendering/disclosure fixtures, not responsive visual QA.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {publicCard} from '../src/content/catalog.mjs';import {renderLibraryCard,renderLibraryDetail} from '../src/content/render.mjs';
const source=(id,extra={})=>publicCard({id,content_json:JSON.stringify({schemaVersion:2,template:'story',title:'Synthetic title',summary:'A source summary.',detail:['Existing source detail.'],facts:[],categories:['faith'],actions:[],related:[],media:null,design:{theme:'paper',layout:'text',motif:'none',motion:'none',size:'regular'},homePriority:50,sourceStatus:'draft',isSynthetic:false,...extra})});
const media=(id,width,height,disclosure)=>({kind:'image',src:'/media/'+id+'.jpg',alt:'Source image description.',caption:'Original caption, 2025.',width,height,disclosure,fit:'contain',ratio:'4:3',focalPoint:{x:50,y:50}});
const teaching=()=>source('johns-gospel',{title:'John’s Gospel',media:media('johns-gospel',1080,1080,'source-artwork'),actions:[{label:'Watch the series',href:'https://www.youtube.com/playlist?list=PLsynthetic1234'},{label:'Listen to the series',href:'https://soundcloud.com/freedomvillage/sets/johns-gospel'}]});
const visit=()=>source('sunday-gatherings',{facts:['Sunday · 2:10 PM'],actions:[{label:'Ask about visiting',targetId:'visit-help'}]});
const community=()=>source('missional-families',{title:'Missional Families',media:media('missional-families',1024,769,'private-draft'),design:{theme:'paper',layout:'image',motif:'none',motion:'none',size:'feature'},actions:[{label:'Ask about community',targetId:'connect-card'}]});
test('three display treatments preserve canonical headings, facts, source disclosures and exact actions',()=>{
 const t=renderLibraryCard(teaching()),v=renderLibraryCard(visit()),c=renderLibraryCard(community());
 assert(t.includes('presentation-teaching'));const viewport=t.match(/<div class="craft-teaching-window">([\s\S]*?)<\/div>/)[1];assert(!/<(?:a|button|summary)\b/.test(viewport));assert(viewport.includes('<svg'));assert(t.includes('class="series-load"'));assert(!t.includes('<iframe'));assert(t.includes('data-series="PLsynthetic1234"'));assert(t.includes('viewBox="200 130 680 500"'));assert(t.includes('Source artwork · Original caption, 2025.'));assert(t.includes('href="https://www.youtube.com/playlist?list=PLsynthetic1234"'));
 assert(v.includes('presentation-visit'));assert(v.includes('href="/church-horizontal-canva.png"'));assert(v.includes('href="/cards/visit-help"'));assert.equal((v.match(/Sunday · 2:10 PM/g)||[]).length,1);assert(v.indexOf('Sunday · 2:10 PM')<v.indexOf('<details'));
 assert(c.includes('presentation-community'));assert(c.includes('size-feature'));assert(c.includes('viewBox="0 300 850 400"'));assert(c.includes('Private image draft · Original caption, 2025.'));assert(c.includes('href="/connect"'));
 for(const html of [t,v,c]){assert(html.includes('content-presentation'));assert(!html.includes('library-card '));assert(html.includes('<details class="craft-reveal"><summary>'));assert(!html.includes('↗'));assert(!/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/.test(html));assert(!html.includes('Pause'));}
});
test('record-bound crops yield to changed source dimensions/path/disclosure and never alter other cards',()=>{
 for(const c of [teaching(),community()]){c.media.width++;assert(!renderLibraryCard(c).includes('content-presentation'));}
 const changed=teaching();changed.media.disclosure='synthetic';assert(!renderLibraryCard(changed).includes('content-presentation'));
 const unknown=source('other-story');assert(!renderLibraryCard(unknown).includes('content-presentation'));
 const changedVisit=visit();changedVisit.actions=[];assert(!renderLibraryCard(changedVisit).includes('content-presentation'));
});
test('crafted cards retain namespaced IDs, nested heading level and safe source text',()=>{
 const c=community();c.title='<script>UNSAFE()</script>';c.summary='A < B & C';
 const html=renderLibraryCard(c,'embedded-parent-0',3);assert(html.includes('id="embedded-parent-0-card-missional-families"'));assert(html.includes('<h3>'));assert(!html.includes('<h2>'));assert(!html.includes('<script>UNSAFE'));assert(html.includes('A &lt; B &amp; C'));
 assert(renderLibraryDetail(teaching()).includes('craft-teaching-art'));assert(renderLibraryDetail(community()).includes('Private image draft'));
});
test('opening and closing a native disclosure remeasures the masonry once per toggle; enhancement stays idempotent',()=>{
 let remeasures=0;const handlers=[];const disclosure={dataset:{},addEventListener(name,fn){assert.equal(name,'toggle');handlers.push(fn);}};
 const context={Set,URL,URLSearchParams,location:{hash:''},sizeCards(){remeasures++;},requestAnimationFrame(fn){fn();},matchMedia(){return {matches:false,addEventListener(){}};},document:{querySelectorAll(s){return s==='.craft-reveal'?[disclosure]:[];},querySelector(){return null;},addEventListener(){}},addEventListener(){}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../dist/content-view.js',import.meta.url),'utf8'),context);context.contentView.render();const initial=remeasures;
 assert.equal(handlers.length,1);handlers[0]();handlers[0]();assert.equal(remeasures,initial+2);context.contentView.render();assert.equal(handlers.length,1);
});

test('teaching series stays in the content unit and loads only after an explicit media choice',()=>{
 let click,frame;const box={dataset:{series:'PLsynthetic1234'}},button={dataset:{seriesTitle:'Synthetic teaching'},hidden:true,addEventListener(type,fn){assert.equal(type,'click');click=fn;},closest(){return box;},replaceWith(value){frame=value;}};
 const context={Set,URL,URLSearchParams,location:{hash:''},requestAnimationFrame(fn){fn();},matchMedia(){return {matches:false,addEventListener(){}};},document:{querySelectorAll(s){return s==='.series-load'?[button]:[];},querySelector(){return null;},createElement(tag){assert.equal(tag,'iframe');return {focus(){this.focused=true;}};},addEventListener(){}},addEventListener(){}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../dist/content-view.js',import.meta.url),'utf8'),context);context.contentView.render();assert.equal(frame,undefined);assert.equal(button.hidden,false);click();assert.equal(frame.src,'https://www.youtube-nocookie.com/embed/videoseries?list=PLsynthetic1234');assert.equal(frame.title,'Synthetic teaching');assert.equal(frame.focused,true);assert(!frame.src.includes('autoplay'));
 frame=undefined;box.dataset.series='https://outside.invalid';click();assert.equal(frame,undefined);
});

test('only the teaching illustration receives one finite in-view entrance, with static reduced-motion fallback',()=>{
 for(const reducedMotion of [false,true]){
  let observerCallback;const classes=new Set(),el={dataset:{artEntrance:'true'},classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);},add(name){classes.add(name);}}};
  const context={Set,URL,URLSearchParams,location:{hash:''},requestAnimationFrame(fn){fn();},matchMedia(){return {matches:reducedMotion,addEventListener(){}};},IntersectionObserver:class{constructor(fn){observerCallback=fn;}observe(){}},document:{hidden:false,querySelectorAll(s){return s==='.has-motion'?[el]:[];},querySelector(){return null;},addEventListener(){}},addEventListener(){}};
  vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../dist/content-view.js',import.meta.url),'utf8'),context);context.contentView.render();
  observerCallback([{target:el,isIntersecting:true}]);assert.equal(el.dataset.artSeen,'true');assert.equal(classes.has('art-entered'),!reducedMotion);
  classes.delete('art-entered');observerCallback([{target:el,isIntersecting:false}]);observerCallback([{target:el,isIntersecting:true}]);assert.equal(classes.has('art-entered'),false,'re-entry never starts another entrance');
 }
 assert(renderLibraryCard(teaching()).includes('data-art-entrance="true"'));assert(!renderLibraryCard(visit()).includes('data-art-entrance'));assert(!renderLibraryCard(community()).includes('data-art-entrance'));
});
