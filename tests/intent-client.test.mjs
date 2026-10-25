import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync('dist/intent.js','utf8');
function setup(fetch){
 const node=()=>({dataset:{},attrs:{},handlers:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},focus(){this.focused=true;},addEventListener(k,v){this.handlers[k]=v;},remove(){this.removed=true;}});
 const nodes=Object.fromEntries(['prompt-composer','prompt-text','prompt-submit','composer-status','grid'].map(id=>[id,node()]));nodes.grid.after=el=>{nodes[el.id]=el;};
 const rendered=[],context={document:{getElementById:id=>nodes[id],createElement:node},fetch,URLSearchParams,crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},AbortSignal,contentView:{showIntent:(html,options)=>rendered.push({html,options})}};
 vm.createContext(context);vm.runInContext(source,context);return {context,nodes,rendered};
}
const result=(selection={})=>{const s={version:2,selectedIds:['connect-card'],after:'',nextCursor:null,totalCount:1,closeMatchCount:1,...selection};return {status:'ok',selectedIds:s.selectedIds,html:'<article class="card">Connect</article>',renderSelection:s,receipt:{status:'ok',requestId:'jev-intent-request:11111111-1111-4111-8111-111111111111'}};};
const ok=()=>Response.json(result());
test('actual query goes only to the same-origin POST and returned cards render; no automatic second request',async()=>{
 let calls=0;const {context,nodes,rendered}=setup(async(url,options)=>{calls++;assert.equal(url,'/api/content/intent');assert.equal(options.method,'POST');assert.equal(options.credentials,'same-origin');assert.equal(options.redirect,'error');assert.equal(JSON.parse(options.body).query,'Children and community');return ok();});
 await context.submitVisitorIntent(' Children and community ');assert.equal(calls,1);assert.equal(rendered.length,1);assert(nodes['composer-status'].textContent.includes('resources ranked'));assert.equal(nodes['prompt-submit'].disabled,false);assert.equal(nodes['prompt-composer'].attrs['aria-busy'],undefined);assert(nodes['prompt-composer'].dataset.receipt);assert.equal(nodes['prompt-text'].maxLength,500);
});
test('no-close notice retains results and continuation reads the saved ranking with one single-flight GET',async()=>{
 let calls=0,release;const wait=new Promise(r=>release=r),requests=[];
 const {context,nodes,rendered}=setup(async(url,options)=>{requests.push({url,options});if(++calls===1)return Response.json(result({totalCount:2,closeMatchCount:0,nextCursor:'connect-card'}));await wait;return Response.json(result({selectedIds:['freedom-kids'],after:'connect-card',totalCount:2,closeMatchCount:0}));});
 await context.submitVisitorIntent('An unrelated question');assert(nodes['composer-status'].textContent.includes('No close matches'));assert.equal(rendered.length,1);
 const more=nodes['intent-more'],first=more.handlers.click();await more.handlers.click();assert.equal(calls,2);assert.equal(more.disabled,true);assert.equal(requests[1].options.method,undefined);assert.equal(requests[1].options.body,undefined);assert(requests[1].url.includes('after=connect-card'));assert(!requests[1].url.includes('unrelated'));
 release();await first;assert.equal(rendered.length,2);assert.equal(rendered[1].options.append,true);assert.equal(more.removed,true);assert(nodes['composer-status'].textContent.includes('No close matches'));
});
test('continuation failure can retry the same saved page; a new question discards a stale page',async()=>{
 let calls=0,release;const wait=new Promise(r=>release=r),requests=[];
 const {context,nodes,rendered}=setup(async(url,options)=>{requests.push(url);calls++;if(calls===1)return Response.json(result({totalCount:2,nextCursor:'connect-card'}));if(calls===2)throw Error('Synthetic network failure');if(calls===3){await wait;return Response.json(result({selectedIds:['freedom-kids'],after:'connect-card',totalCount:2}));}return ok();});
 await context.submitVisitorIntent('First question');const old=nodes['intent-more'];await old.handlers.click();assert(old.textContent.includes('Try again'));const stale=old.handlers.click();await context.submitVisitorIntent('New question');release();await stale;
 assert.equal(requests[1],requests[2]);assert.equal(rendered.length,2);assert(rendered.every(r=>!r.options.append));assert.equal(old.removed,true);assert.equal(nodes['prompt-submit'].disabled,false);
});
test('invalid paging metadata never replaces existing results',async()=>{
 for(const selection of [{version:1},{totalCount:-1},{closeMatchCount:2},{nextCursor:'other-card'}]){const {context,rendered}=setup(async()=>Response.json(result(selection)));await context.submitVisitorIntent('Question');assert.equal(rendered.length,0);}
});
test('pending submit is single flight and uncertain retry reuses the exact claim',async()=>{
 let release;const wait=new Promise(r=>release=r),requests=[];const {context,nodes}=setup(async(_,options)=>{requests.push(JSON.parse(options.body));await wait;throw Error('Unconfirmed outcome');});
 const first=context.submitVisitorIntent('A question');assert.equal(nodes['prompt-submit'].disabled,true);assert(nodes['prompt-composer'].dataset.requestId);await context.submitVisitorIntent('A question');assert.equal(requests.length,1);release();await first;assert(nodes['composer-status'].textContent.includes('not been retried'));await context.submitVisitorIntent('A question');assert.equal(requests.length,2);assert.equal(requests[0].requestId,requests[1].requestId);
});
test('bounds, server failures and expired authentication never masquerade as results',async()=>{
 for(const response of [()=>Response.json({status:'recovery-failed'},{status:503}),()=>new Response('<html>Sign in</html>',{headers:{'Content-Type':'text/html'}})]){
  let calls=0;const {context,nodes,rendered}=setup(async()=>{calls++;return response();});await context.submitVisitorIntent('');await context.submitVisitorIntent('x'.repeat(501));assert.equal(calls,0);await context.submitVisitorIntent('A question');assert.equal(calls,1);assert.equal(rendered.length,0);assert(!nodes['composer-status'].textContent.includes('found'));assert.equal(nodes['prompt-submit'].disabled,false);
 }
});
test('composer routes to real handler when installed; API secret and query persistence are absent from client',()=>{
 const composer=fs.readFileSync('dist/composer.js','utf8'),html=fs.readFileSync('dist/index.html','utf8');assert(composer.includes('globalThis.submitVisitorIntent(promptText.value)'));assert(html.includes('<script src="intent.js"></script>'));assert(!/localStorage|sessionStorage|TYPESAFE_API_KEY|api\.typesafe\.ai/.test(source));assert(!html.includes('composer-privacy'));assert(html.includes('aria-describedby="composer-status"'));assert(!html.includes('Your question is sent to Jev.'));
 const view=fs.readFileSync('dist/content-view.js','utf8');assert(view.includes('grid.replaceChildren('));assert(view.includes('if(intentActive)return;'));assert(view.includes('loading||ended||intentActive'));
});

// Visitor status remains useful without exposing the provider in the interface.
test('all request failures retain live feedback without provider branding or helper warnings',async()=>{
 const cases=[['identity-unavailable','No question was sent'],['unconfigured','not configured'],['recovery-failed','paused for review'],['recovery-needs-review','No new request was sent'],['prior-attempt-needs-review','paused after a failed request'],['unknown-failure','No results have been substituted']];
 for(const [status,expected]of cases){
  let calls=0;const {context,nodes,rendered}=setup(async()=>{calls++;return Response.json({status},{status:503});});
  await context.submitVisitorIntent('Synthetic question');const text=nodes['composer-status'].textContent;
  assert.equal(calls,1);assert.equal(rendered.length,0);assert(text.includes(expected));assert.doesNotMatch(text,/\bJev\b|sensitive (?:data|details)/i);assert.equal(nodes['prompt-submit'].disabled,false);
 }
});
