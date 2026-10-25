// Synthetic source-contract fixtures; executed only in cloud CI.
import test from 'node:test';import assert from 'node:assert/strict';
import {publicCard} from '../src/content/catalog.mjs';import {renderLibraryCard,renderLibraryDetail} from '../src/content/render.mjs';import {familyFixtures} from './fixtures/families.mjs';
const all=()=>familyFixtures().map(([id,c])=>publicCard({id,content_json:JSON.stringify(c)}));
const text=html=>html.replace(/<[^>]*>/g,'').replace(/\s+/g,' ');
test('worship typography retains the complete source invitation, body, facts, actions and eligible related records',()=>{
 const cards=all(),c=cards.find(c=>c.id==='children-in-worship'),related=cards.filter(x=>c.related.includes(x.id));c.facts=['CANONICAL_FACT'];c.actions=[{label:'Canonical inquiry',targetId:'connect-card'}];c.detail.push('Another complete future source paragraph.');const before=JSON.stringify(c),card=renderLibraryCard(c),detail=renderLibraryDetail(c,related);
 assert(card.includes('worship-card'));assert(detail.includes('worship-detail'));assert(!card.includes('kids-source'));assert(!detail.includes('kids-source-mark'));for(const value of [c.title,c.summary,...c.facts,...c.detail])assert(text(detail).includes(value));assert(text(card).includes(c.summary));assert.equal(detail.split(c.detail[2]).length-1,1);assert(detail.indexOf(c.detail[0])<detail.indexOf(c.detail[1]));assert(card.includes('Canonical inquiry'));assert(detail.includes('href="/connect"'));for(const r of related)assert(detail.includes('/cards/'+r.id));assert.equal(JSON.stringify(c),before);
});
test('changed identity, new source sections or a changed invitation retain the full generic contract',()=>{
 const cards=all(),c=cards.find(c=>c.id==='children-in-worship'),kids=cards.find(c=>c.id==='freedom-kids');
 for(const changed of [{...c,id:'other-question'},{...c,media:kids.media},{...c,summary:'A changed complete source invitation.'},{...c,sections:[{heading:'New canonical section',paragraphs:['New complete paragraph.'],links:[{label:'Canonical source link',href:'https://example.org/source'}],cardIds:['freedom-kids']}]}]){const html=renderLibraryDetail(changed,[],[kids]);assert(!html.includes('worship-detail'));for(const p of changed.detail)assert(html.includes(p));if(changed.sections){assert(html.includes('New complete paragraph.'));assert(html.includes('href="https://example.org/source"'));assert(html.includes('embedded-children-in-worship-0-card-freedom-kids'));}}
 c.title='<script>BAD()</script>';c.detail[0]='<img src=x onerror=BAD()>';c.editorial='PRIVATE_SENTINEL';const html=renderLibraryDetail(c);assert(!html.includes('<script>BAD()'));assert(!html.includes('<img src=x'));assert(!html.includes('PRIVATE_SENTINEL'));assert(html.includes('&lt;img'));
});
