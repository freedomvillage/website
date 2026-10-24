import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync('dist/intent.js','utf8');
function setup(fetch){
 const nodes=Object.fromEntries(['prompt-composer','prompt-text','prompt-submit','composer-status'].map(id=>[id,{dataset:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},focus(){this.focused=true;}}]));
 const rendered=[],context={document:{getElementById:id=>nodes[id]},fetch,crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},AbortSignal,contentView:{showIntent:html=>rendered.push(html)}};
 vm.createContext(context);vm.runInContext(source,context);return {context,nodes,rendered};
}
const ok=()=>Response.json({status:'ok',selectedIds:['connect-card'],html:'<article class="card">Connect</article>',receipt:{status:'ok',requestId:'jev-intent-request:11111111-1111-4111-8111-111111111111'}});
test('actual query goes only to the same-origin POST and returned cards render; no automatic second request',async()=>{
 let calls=0;const {context,nodes,rendered}=setup(async(url,options)=>{calls++;assert.equal(url,'/api/content/intent');assert.equal(options.method,'POST');assert.equal(options.credentials,'same-origin');assert.equal(options.redirect,'error');assert.equal(JSON.parse(options.body).query,'Children and community');return ok();});
 await context.submitVisitorIntent(' Children and community ');assert.equal(calls,1);assert.equal(rendered.length,1);assert(nodes['composer-status'].textContent.includes('1 matches'));assert.equal(nodes['prompt-submit'].disabled,false);assert.equal(nodes['prompt-composer'].attrs['aria-busy'],undefined);assert(nodes['prompt-composer'].dataset.receipt);assert.equal(nodes['prompt-text'].maxLength,500);
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
 const composer=fs.readFileSync('dist/composer.js','utf8'),html=fs.readFileSync('dist/index.html','utf8');assert(composer.includes('globalThis.submitVisitorIntent(promptText.value)'));assert(html.includes('<script src="intent.js"></script>'));assert(!/localStorage|sessionStorage|TYPESAFE_API_KEY|api\.typesafe\.ai/.test(source));
 const view=fs.readFileSync('dist/content-view.js','utf8');assert(view.includes('grid.replaceChildren('));assert(view.includes('if(intentActive)return;'));assert(view.includes('loading||ended||intentActive'));
});
