// Cloud-only rendering contracts. No provider, credentials or live content.
import test from 'node:test';import assert from 'node:assert/strict';
import {publicCard} from '../src/content/catalog.mjs';
import {renderLibraryCard,renderLibraryDetail} from '../src/content/render.mjs';
import {renderFamilyContext} from '../src/content/families.mjs';
import {familyFixtures} from './fixtures/families.mjs';
const cards=()=>familyFixtures().map(([id,content])=>publicCard({id,content_json:JSON.stringify(content)}));
test('family gateway links to the category and preserves canonical actions; category context jumps only to present eligible records',()=>{
 const all=cards(),parent=all.find(c=>c.id==='families-growing-together'),html=renderLibraryCard(parent);
 assert(html.includes('family-entry size-feature'));assert(html.includes('href="/topics/families"'));for(const id of ['freedom-kids','junior-village','village-youth'])assert(html.includes('href="/cards/'+id+'"'));
 const context=renderFamilyContext({topic:'families',items:all.filter(c=>c.id!=='village-youth')},s=>s);
 assert(context.includes('Synthetic contextual introduction'));assert(context.includes('href="#card-freedom-kids"'));assert(!context.includes('#card-village-youth'));assert.equal(renderFamilyContext({topic:'faith',items:all},s=>s),'');assert.equal(renderFamilyContext({topic:'families',items:[]},s=>s),'');
});
test('Kids uses the exact guarded source identity and retains full sections, next steps and eligible supporting questions',()=>{
 const all=cards(),kids=all.find(c=>c.id==='freedom-kids'),related=all.filter(c=>kids.related.includes(c.id));
 kids.facts=['SYNTHETIC_CANONICAL_FACT'];const card=renderLibraryCard(kids),detail=renderLibraryDetail(kids,related,related);assert(card.includes('SYNTHETIC_CANONICAL_FACT'));assert(detail.includes('SYNTHETIC_CANONICAL_FACT'));
 assert(card.includes('kids-card'));assert(card.includes('freedom-kids-source.png'));assert(card.includes('<details'));assert(card.includes('href="/cards/freedom-kids"'));
 assert(detail.includes('kids-detail'));assert(detail.includes('aria-label="On this page"'));for(const section of kids.sections){assert(detail.includes(section.heading));for(const p of section.paragraphs)assert(detail.includes(p));}
 assert(detail.includes('Questions and next steps'));assert(detail.includes('What is Godly Play?'));assert(detail.includes('Children in worship'));assert(detail.includes('href="/connect"'));assert(detail.includes('href="/topics/families"'));assert(!renderLibraryDetail(kids).includes('kids-question"'));
 const changed={...kids,media:{...kids.media,src:'https://cdn.prod.website-files.com/60e0035471e8115799a8640b/new.png'}};assert(!renderLibraryCard(changed).includes('kids-card'));assert(!renderLibraryDetail(changed).includes('kids-detail'));
});
test('authored output escapes source text, never spreads private fields and keeps occurrence IDs unique',()=>{
 const all=cards(),kids=all.find(c=>c.id==='freedom-kids');kids.title='<script>BAD()</script>';kids.sections[0].paragraphs=['<img src=x onerror=BAD()>'];kids.editorial='PRIVATE_SENTINEL';
 const html=renderLibraryDetail(kids)+renderLibraryCard(kids,'embedded',3);assert(!html.includes('<script>BAD()'));assert(!html.includes('<img src=x'));assert(!html.includes('PRIVATE_SENTINEL'));assert(html.includes('&lt;script&gt;'));assert(html.includes('id="embedded-card-freedom-kids"'));
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
});
