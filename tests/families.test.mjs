// Cloud-only rendering contracts. No provider, credentials or live content.
import test from 'node:test';import assert from 'node:assert/strict';
import {publicCard} from '../src/content/catalog.mjs';
import {renderLibraryCard,renderLibraryDetail} from '../src/content/render.mjs';
import {familyCollectionItems,familyDetailIds} from '../src/content/families.mjs';
import {familyFixtures} from './fixtures/families.mjs';
const cards=()=>familyFixtures().map(([id,content])=>publicCard({id,content_json:JSON.stringify(content)}));
test('family opening combines context and gateway without changing source membership or present-record jumps',()=>{
 const all=cards(),parent=all.find(c=>c.id==='families-growing-together'),home=renderLibraryCard(parent,'',2,all);
 assert(home.includes('family-entry size-feature'));assert(home.includes('href="/topics/families"'));for(const a of parent.actions)assert(home.includes(a.label));assert(home.includes('families-shared-story.webp'));assert(home.includes('family-source-paths'));assert(!home.includes('family-opening-copy'));
 const snapshot=JSON.stringify(all),context=renderLibraryCard(parent,'',2,all.filter(c=>c.id!=='village-youth'),{topic:'families',path:'/topics/families?after=50%3Asample'});
 assert(context.includes('family-opening'));assert.equal(context.split(parent.summary).length-1,1);assert(context.includes('Synthetic contextual introduction'));assert(context.includes('href="/topics/families?after=50%3Asample#card-freedom-kids"'));assert(!context.includes('#card-village-youth'));assert(!context.includes('family-entry-route'));for(const a of parent.actions)assert(context.includes(a.label));assert.equal(JSON.stringify(all),snapshot);
 assert(!renderLibraryCard(parent,'',2,[],{topic:'families',path:'/topics/families'}).includes('class="collection-context family-context"'));
});
test('Kids uses the exact guarded source identity and retains full sections, next steps and eligible supporting questions',()=>{
 const all=cards(),kids=all.find(c=>c.id==='freedom-kids'),related=all.filter(c=>kids.related.includes(c.id));
 kids.facts=['SYNTHETIC_CANONICAL_FACT'];const card=renderLibraryCard(kids),detail=renderLibraryDetail(kids,related,related);assert(card.includes('SYNTHETIC_CANONICAL_FACT'));assert(detail.includes('SYNTHETIC_CANONICAL_FACT'));
 assert(card.includes('kids-card'));assert(card.includes('aria-labelledby="card-freedom-kids-title"'));assert(card.includes('aria-describedby="card-freedom-kids-deck"'));assert.equal(card.split(kids.summary).length-1,1);assert(card.indexOf('kids-card-copy')<card.indexOf('kids-card-scene'));assert(card.includes('freedom-kids-source.png'));assert(card.includes('<details'));assert(card.includes('href="/cards/freedom-kids"'));
 assert(detail.includes('kids-story-discovery.webp'));assert(detail.includes('kids-learning-together.webp'));assert(detail.includes('kids-faith-home.webp'));assert(detail.includes('kids-detail'));assert(detail.includes('href="/cards/freedom-kids#kids-freedom-kids-0"'));assert(detail.includes('aria-label="On this page"'));for(const section of kids.sections){assert(detail.includes(section.heading));for(const p of section.paragraphs)assert(detail.includes(p));}
 assert(detail.includes('Questions and next steps'));assert(detail.includes('What is Godly Play?'));assert(detail.includes(all.find(c=>c.id==='children-in-worship').title));assert(detail.includes('href="/connect"'));assert(detail.includes('href="/topics/families"'));assert(!renderLibraryDetail(kids).includes('kids-question"'));
 const changed={...kids,media:{...kids.media,src:'https://cdn.prod.website-files.com/60e0035471e8115799a8640b/new.png'}};assert(!renderLibraryCard(changed).includes('kids-card'));assert(!renderLibraryDetail(changed).includes('kids-detail'));
});
test('authored output escapes source text, never spreads private fields and keeps occurrence IDs unique',()=>{
 const all=cards(),kids=all.find(c=>c.id==='freedom-kids');kids.title='<script>BAD()</script>';kids.sections[0].paragraphs=['<img src=x onerror=BAD()>'];kids.editorial='PRIVATE_SENTINEL';
 const html=renderLibraryDetail(kids)+renderLibraryCard(kids,'embedded',3);assert(!html.includes('<script>BAD()'));assert(!html.includes('<img src=x'));assert(!html.includes('PRIVATE_SENTINEL'));assert(html.includes('&lt;script&gt;'));assert(html.includes('id="embedded-card-freedom-kids"'));
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
});

test('Godly Play keeps the complete source sequence and eligible contextual parent separate from its related content',()=>{
 const all=cards(),godly=all.find(c=>c.id==='godly-play'),kids=all.find(c=>c.id==='freedom-kids'),related=all.filter(c=>godly.related.includes(c.id));
 godly.facts=['SYNTHETIC_GODLY_FACT'];godly.detail.push('A third complete source paragraph is also retained.');godly.actions=[{label:'Canonical next step',targetId:'connect-card'}];
 const snapshot=JSON.stringify(godly),html=renderLibraryDetail(godly,related,[...related,kids]);
 assert(html.includes('godly-detail'));assert(renderLibraryCard(godly).includes('godly-card'));assert(html.includes('SYNTHETIC_GODLY_FACT'));assert(html.includes('Canonical next step'));assert(html.includes('href="/connect"'));
 for(const p of [godly.summary,...godly.detail])assert.equal(html.split(p).length-1,1);assert(html.indexOf(godly.detail[0])<html.indexOf(godly.detail[1]));
 assert(html.includes('godly-parent'));assert(html.includes('href="/cards/freedom-kids"'));for(const c of related)assert(html.includes('href="/cards/'+c.id+'"'));
 assert.deepEqual(familyDetailIds(godly),['freedom-kids']);assert.deepEqual(familyDetailIds(kids),[]);assert.equal(JSON.stringify(godly),snapshot);
 assert(!renderLibraryDetail(godly,related,related).includes('godly-parent'));assert(renderLibraryDetail(godly,related,related).includes(godly.detail[1]));
 const changedParent={...kids,media:null};assert(!renderLibraryDetail(godly,related,[changedParent]).includes('godly-parent'));
});

test('Godly source changes retain the complete generic contract, including new sections and embedded records',()=>{
 const all=cards(),godly=all.find(c=>c.id==='godly-play'),kids=all.find(c=>c.id==='freedom-kids');
 for(const changed of [{...godly,media:null},{...godly,detail:[godly.summary]},{...godly,sections:[{heading:'New source section',paragraphs:['New canonical paragraph.'],links:[{label:'New source action',href:'https://example.org/source'}],cardIds:['freedom-kids']}]}]){
  const html=renderLibraryDetail(changed,[],[kids]);assert(!html.includes('godly-detail'));for(const p of changed.detail)assert(html.includes(p));assert.deepEqual(familyDetailIds(changed),[]);
  if(changed.sections){assert(html.includes('New source section'));assert(html.includes('New canonical paragraph.'));assert(html.includes('href="https://example.org/source"'));assert(html.includes('embedded-godly-play-0-card-freedom-kids'));}
 }
 godly.title='<script>BAD()</script>';godly.detail[0]='<img src=x onerror=BAD()>';godly.editorial='PRIVATE_SENTINEL';const html=renderLibraryDetail(godly);assert(!html.includes('<script>BAD()'));assert(!html.includes('<img src=x'));assert(!html.includes('PRIVATE_SENTINEL'));assert(html.includes('&lt;img'));
});

test('Youth preserves its branded entry with reserved geometry and complete source detail with inquiry near both ends',()=>{
 const all=cards(),youth=all.find(c=>c.id==='village-youth'),related=all.filter(c=>youth.related.includes(c.id));youth.facts.push('FUTURE_CANONICAL_FACT');youth.detail.push('Another complete canonical paragraph remains available.');youth.actions.push({label:'Another source destination',href:'https://example.org/source'});
 const snapshot=JSON.stringify(youth),html=renderLibraryDetail(youth,related),entry=renderLibraryCard(youth);
 assert(entry.includes('library-card theme-youth layout-brand'));assert(entry.includes(youth.media.src));assert(entry.includes('class="youth-source-mark" width="2200" height="2200"'));assert(!renderLibraryCard({...youth,media:{...youth.media,src:'https://example.org/changed.svg'}}).includes('youth-source-mark'));assert(!entry.includes('youth-detail'));assert(html.includes('youth-detail'));assert(html.includes('id="youth-reader"'));assert(html.includes('/village-youth-source.svg'));assert(html.includes('width="2200" height="2200"'));
 for(const value of [youth.summary,...youth.detail,...youth.facts])assert.equal(html.split(value).length-1,1);assert(html.indexOf(youth.detail[0])<html.indexOf(youth.detail[1]));for(const a of youth.actions)assert.equal(html.split(a.label).length-1,2);assert(html.includes('href="/connect"'));for(const c of related)assert(html.includes('href="/cards/'+c.id+'"'));assert.equal(JSON.stringify(youth),snapshot);
});

test('Youth source drift retains the full generic contract, and source strings stay escaped',()=>{
 const all=cards(),youth=all.find(c=>c.id==='village-youth'),kids=all.find(c=>c.id==='freedom-kids');
 for(const changed of [{...youth,media:null},{...youth,actions:[]},{...youth,sections:[{heading:'New source section',paragraphs:['New source paragraph.'],links:[{label:'New source link',href:'https://example.org/new'}],cardIds:['freedom-kids']}]}]){
  const html=renderLibraryDetail(changed,[],[kids]);assert(!html.includes('youth-detail'));for(const p of changed.detail)assert(html.includes(p));for(const f of changed.facts)assert(html.includes(f));if(changed.sections){assert(html.includes('New source paragraph.'));assert(html.includes('href="https://example.org/new"'));assert(html.includes('embedded-village-youth-0-card-freedom-kids'));}
 }
 youth.title='<script>BAD()</script>';youth.detail[0]='<img src=x onerror=BAD()>';youth.editorial='PRIVATE_SENTINEL';const html=renderLibraryDetail(youth);assert(!html.includes('<script>BAD()'));assert(!html.includes('<img src=x'));assert(!html.includes('PRIVATE_SENTINEL'));assert(html.includes('&lt;img'));
});

test('Families presentation leads with current ministries and keeps arrival supporting without changing membership, source order or other contexts',()=>{
 const items=[{id:'sunday-gatherings'},{id:'visit-help'},{id:'village-youth'},{id:'other-family-a'},{id:'freedom-kids'},{id:'families-growing-together'},{id:'junior-village'},{id:'other-family-b'}],original=items.map(c=>c.id);
 assert.deepEqual(familyCollectionItems({topic:'families',items}).map(c=>c.id),['families-growing-together','freedom-kids','junior-village','village-youth','other-family-a','other-family-b','sunday-gatherings','visit-help']);assert.deepEqual(items.map(c=>c.id),original);assert.equal(familyCollectionItems({topic:'',items}),items);assert.equal(familyCollectionItems({topic:'community',items}),items);
 const nextPage=items.filter(c=>['other-family-a','visit-help'].includes(c.id));assert.deepEqual(familyCollectionItems({topic:'families',items:nextPage}).map(c=>c.id),['other-family-a','visit-help']);assert.equal(familyCollectionItems({topic:'families',items:[]}).length,0);
});
