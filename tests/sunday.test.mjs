import test from 'node:test';import assert from 'node:assert/strict';
import {publicCard} from '../src/content/catalog.mjs';import {renderLibraryCard,renderLibraryDetail} from '../src/content/render.mjs';import {sundayFixtures} from './fixtures/sunday.mjs';
const cards=()=>sundayFixtures().map(([id,c])=>publicCard({id,content_json:JSON.stringify(c)}));
test('Sunday invitation exposes all source actions directly while retaining substantive heading route and facts',()=>{
 const [c]=cards();c.facts.push('FUTURE_SOURCE_FACT');const html=renderLibraryCard(c,'related',3);
 assert(html.includes('sunday-entry'));assert(html.includes('<h3>'));assert(html.includes('id="related-card-sunday-gatherings"'));assert(html.includes('href="/cards/sunday-gatherings"'));assert(html.includes('href="/cards/visit-help"'));assert(html.includes('href="/cards/watch-and-listen"'));assert(!html.includes('<details'));assert(!html.includes('church-horizontal-canva'));for(const f of c.facts)assert(html.includes(f));
 assert(renderLibraryDetail(c).includes(c.detail[0]));
 const changed={...c,actions:[]};assert(!renderLibraryCard(changed).includes('sunday-entry'));
});
test('arrival composition retains every canonical fact, paragraph, section, source link, embedded record and action',()=>{
 const [s,c]=cards();c.facts.push('FUTURE_VISIT_FACT');c.sections[1].cardIds=['sunday-gatherings'];const html=renderLibraryDetail(c,[s],[s]);
 assert(html.includes('visit-detail'));for(const f of c.facts)assert(html.includes(f));for(const p of [c.summary,...c.detail,...c.sections.flatMap(s=>s.paragraphs)])assert(html.includes(p));for(const section of c.sections)assert(html.includes(section.heading));
 for(const a of [...c.actions,...c.sections.flatMap(s=>s.links)])assert(html.includes(`href="${a.href}"`));assert(html.includes('arrival-visit-help-1-card-sunday-gatherings'));assert(html.includes('Venue maps'));assert(html.includes('Visit questions'));assert(html.includes('More about Sunday'));
 const related=html.slice(html.indexOf('class="related-content'));assert(related.includes('href="/cards/sunday-gatherings"'));assert(!related.includes('href="/cards/visit-help"'),'the related invitation must not loop back to the current visit page');
 const bare=renderLibraryDetail(c);assert(!bare.includes('arrival-related'));assert(!bare.includes('children-in-worship'));
 const changed={...c,sections:undefined};assert(!renderLibraryDetail(changed).includes('visit-detail'));
});
test('arrival escapes source fields, does not expose private editorial data and keeps section/occurrence IDs unique',()=>{
 const [s,c]=cards();c.title='<script>BAD()</script>';c.summary='Source < wording & care';c.sections[0].paragraphs=['<img src=x onerror=BAD()>'];c.editorial='PRIVATE_SENTINEL';const html=renderLibraryDetail(c,[s])+renderLibraryCard(s,'other');
 assert(html.includes('&lt;script&gt;'));assert(html.includes('Source &lt; wording &amp; care'));assert(!html.includes('<script>BAD'));assert(!html.includes('<img src=x'));assert(!html.includes('PRIVATE_SENTINEL'));
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
});

test('Youngil source scene requires the currently supplied eligible venue identity and both canonical map destinations',()=>{
 const [s,c]=cards();const card=renderLibraryCard(s,'',2,[c]);assert(card.includes('sunday-scene-entry size-feature'));assert(card.includes('youngil-source-800.png'));assert(card.includes(c.facts[1]));assert(renderLibraryDetail(c).includes('has-venue'));
 assert(!renderLibraryCard(s).includes('youngil-source-800.png'),'absent eligible venue supplies no stale image');
 for(const changed of [{...c,facts:['A changed venue']},{...c,actions:c.actions.slice(1)},{...c,media:{kind:'brand',src:'https://example.test/new.png',alt:'New source'}}]){
  assert(!renderLibraryCard(s,'',2,[changed]).includes('youngil-source-800.png'));assert(!renderLibraryDetail(changed).includes('youngil-source-800.png'));
 }
});
