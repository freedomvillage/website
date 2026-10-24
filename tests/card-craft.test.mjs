// Cloud-only structured rendering/disclosure fixtures, not responsive visual QA.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {publicCard} from '../src/content/catalog.mjs';import {renderLibraryCard,renderLibraryDetail} from '../src/content/render.mjs';
const source=(id,extra={})=>publicCard({id,content_json:JSON.stringify({schemaVersion:2,template:'story',title:'Synthetic title',summary:'A source summary.',detail:['Existing source detail.'],facts:[],categories:['faith'],actions:[],related:[],media:null,design:{theme:'paper',layout:'text',motif:'none',motion:'none',size:'regular'},homePriority:50,sourceStatus:'draft',isSynthetic:false,...extra})});
const media=(id,width,height,disclosure)=>({kind:'image',src:'/media/'+id+'.jpg',alt:'Source image description.',caption:'Original caption, 2025.',width,height,disclosure,fit:'contain',ratio:'4:3',focalPoint:{x:50,y:50}});
const teaching=()=>source('johns-gospel',{title:'John’s Gospel',media:media('johns-gospel',1080,1080,'source-artwork'),actions:[{label:'Watch the series',href:'https://www.youtube.com/playlist?list=ORIGINAL'},{label:'Listen to the series',href:'https://soundcloud.com/freedomvillage/sets/johns-gospel'}]});
const visit=()=>source('sunday-gatherings',{facts:['Sunday · 2:10 PM'],actions:[{label:'Ask about visiting',targetId:'visit-help'}]});
const community=()=>source('missional-families',{title:'Missional Families',media:media('missional-families',1024,769,'private-draft'),design:{theme:'paper',layout:'image',motif:'none',motion:'none',size:'feature'},actions:[{label:'Ask about community',targetId:'connect-card'}]});
test('three display treatments preserve canonical headings, facts, source disclosures and exact actions',()=>{
 const t=renderLibraryCard(teaching()),v=renderLibraryCard(visit()),c=renderLibraryCard(community());
 assert(t.includes('craft-teaching'));assert(t.includes('viewBox="200 130 680 500"'));assert(t.includes('Source artwork · Original caption, 2025.'));assert(t.includes('href="https://www.youtube.com/playlist?list=ORIGINAL"'));
 assert(v.includes('craft-visit'));assert(v.includes('href="/church-horizontal-canva.png"'));assert(v.includes('href="/cards/visit-help"'));assert.equal((v.match(/Sunday · 2:10 PM/g)||[]).length,1);assert(v.indexOf('Sunday · 2:10 PM')<v.indexOf('<details'));
 assert(c.includes('craft-community'));assert(c.includes('size-feature'));assert(c.includes('viewBox="0 300 850 400"'));assert(c.includes('Private image draft · Original caption, 2025.'));assert(c.includes('href="/connect"'));
 for(const html of [t,v,c]){assert(html.includes('<details class="craft-reveal"><summary>'));assert(!html.includes('↗'));assert(!/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/.test(html));assert(!html.includes('Pause'));}
});
test('record-bound crops yield to changed source dimensions/path/disclosure and never alter other cards',()=>{
 for(const c of [teaching(),community()]){c.media.width++;assert(!renderLibraryCard(c).includes('craft-card'));}
 const changed=teaching();changed.media.disclosure='synthetic';assert(!renderLibraryCard(changed).includes('craft-card'));
 const unknown=source('other-story');assert(!renderLibraryCard(unknown).includes('craft-card'));
 const changedVisit=visit();changedVisit.actions=[];assert(!renderLibraryCard(changedVisit).includes('craft-card'));
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
