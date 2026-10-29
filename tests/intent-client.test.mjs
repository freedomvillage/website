import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync('dist/intent.js','utf8');
function setup(fetch){
 const events={},documentEvents={};
 const node=()=>({style:{values:{},setProperty(k,v){this.values[k]=v;}},dataset:{},attrs:{},handlers:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},focus(){this.focused=true;},addEventListener(k,v){this.handlers[k]=v;},remove(){this.removed=true;}});
 const nodes=Object.fromEntries(['prompt-composer','prompt-text','prompt-submit','composer-status','grid','collection'].map(id=>[id,node()]));nodes.grid.after=el=>{nodes[el.id]=el;};
 let uuid=0;
 const reflectedFetch=async(url,options)=>{const response=await fetch(url,options);if(options.method==='POST'&&response.headers.get('Content-Type')?.includes('application/json')){const value=await response.json();if(value.receipt)value.receipt.requestId=JSON.parse(options.body).requestId;return Response.json(value,{status:response.status});}return response;};
 const rendered=[],context={URL,location:new URL('https://next.freedomvillage.church/'),history:{state:{},replaceState(value,title,path){this.state=value;if(path)context.location.href=new URL(path,context.location).href;}},addEventListener(type,fn){(events[type]??=[]).push(fn);},document:{getElementById:id=>nodes[id],createElement:node,addEventListener(type,fn){(documentEvents[type]??=[]).push(fn);}},fetch:reflectedFetch,URLSearchParams,crypto:{randomUUID:()=> (++uuid===1?'11111111-1111-4111-8111-111111111111':'22222222-2222-4222-8222-222222222222')},AbortSignal,contentView:{showIntent:(html,options)=>rendered.push({html,options}),clearNavigation(){const state={...context.history.state};delete state.fvcFeedRestore;context.history.replaceState(state);}}};
 context.location.reload=()=>{context.reloads=(context.reloads||0)+1;};
 vm.createContext(context);vm.runInContext(source,context);return {context,nodes,rendered,emit:(type,event={})=>(events[type]||[]).forEach(fn=>fn(event)),click:link=>{const event={target:{closest:()=>link},preventDefault(){this.defaultPrevented=true;}};for(const fn of documentEvents.click||[])fn(event);return event;}};
}
const result=(selection={})=>{const s={version:2,selectedIds:['connect-card'],after:'',nextCursor:null,totalCount:1,closeMatchCount:1,unavailableIds:[],...selection};return {status:'ok',selectedIds:s.selectedIds,html:'<article class="card">Connect</article>',renderSelection:s,receipt:{status:'ok',requestId:'jev-intent-request:11111111-1111-4111-8111-111111111111'}};};
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
 for(const selection of [{version:1},{totalCount:-1},{closeMatchCount:2},{nextCursor:'other-card'},{unavailableIds:['../bad']},{unavailableIds:['connect-card']}]){const {context,rendered}=setup(async()=>Response.json(result(selection)));await context.submitVisitorIntent('Question');assert.equal(rendered.length,0);}
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

test('confirmed success creates a fresh same-text claim and visibly labels the next submission as a new search',async()=>{
 const requests=[],{context,nodes}=setup(async(_,options)=>{requests.push(JSON.parse(options.body));return ok();});await context.submitVisitorIntent('Same question');assert(nodes['composer-status'].textContent.includes('start a new search'));assert.equal(nodes['prompt-submit'].attrs['aria-label'],'Start a new search');await context.submitVisitorIntent('Same question');assert.notEqual(requests[0].requestId,requests[1].requestId);
});
test('reconstructed replay is exact owned GET, with bounded progress and no POST/question body',async()=>{
 let optionsSeen,urlSeen;const {context,rendered}=setup(async(url,options)=>{urlSeen=url;optionsSeen=options;return ok();});
 assert(await context.restoreVisitorIntent({receipt:'jev-intent-request:11111111-1111-4111-8111-111111111111',pages:3}));assert(urlSeen.includes('replay=first'));assert(urlSeen.includes('pages=3'));assert(!urlSeen.includes('latest'));assert.equal(optionsSeen.body,undefined);assert.equal(optionsSeen.method,undefined);assert.equal(rendered[0].options.quiet,true);assert.equal(context.visitorIntentState().pages,3);
});
test('a new query supersedes pending GET replay without late overwrite',async()=>{
 let release;const wait=new Promise(r=>release=r);const {context,rendered}=setup(async(url)=>{if(url.includes('?')){await wait;return ok();}return ok();});
 const replay=context.restoreVisitorIntent({receipt:'jev-intent-request:11111111-1111-4111-8111-111111111111',pages:3});await context.submitVisitorIntent('New question');release();assert.equal(await replay,false);assert.equal(rendered.length,1);
});

test('Return from a fragment clears the owned hint and explicitly reloads canonical browsing with no request',async()=>{
 for(const path of ['/#main','/studies/families#study-ministry-first','/cards/freedom-kids#kids-freedom-kids-2']){
 let calls=0;const h=setup(async()=>{calls++;return ok();});h.context.location.href='https://next.freedomvillage.church'+path;await h.context.submitVisitorIntent('Synthetic question');h.context.history.state={unrelated:'preserve',fvcFeedRestore:{intent:h.context.visitorIntentState()}};
 const event=h.click({id:'intent-return',href:'https://next.freedomvillage.church'+path.split('#')[0]});assert(event.defaultPrevented);assert.equal(h.context.location.hash,'');assert.equal(h.context.reloads,1);assert.equal(h.context.history.state.unrelated,'preserve');assert.equal(h.context.history.state.fvcFeedRestore,undefined);assert.equal(h.context.visitorIntentState(),null);assert.equal(calls,1);
 }
});
test('cached-document lifecycle masks old results and requests exact GET reconstruction without a second POST',async()=>{
 const requests=[],h=setup(async(url,options)=>{requests.push({url,options});return options.method==='POST'?ok():Response.json({...result({selectedIds:[],totalCount:0,closeMatchCount:0,unavailableIds:['connect-card']}),html:''});});
 await h.context.submitVisitorIntent('Synthetic question');const hint=h.context.visitorIntentState();h.emit('pagehide');assert.equal(h.nodes.collection.style.values.visibility,'hidden');h.emit('pageshow',{persisted:true});assert.equal(h.context.reloads,1);assert.equal(requests.length,1,'native reload is GET, never automatic POST');
 // Explicit event-level simulation of the reconstructed document after reload.
 // This is not proof that a native browser actually admitted a bfcache entry.
 assert(await h.context.restoreVisitorIntent(hint));assert.equal(requests.length,2);assert.equal(requests[1].options.method,undefined);assert(requests[1].url.includes(encodeURIComponent(hint.receipt)));assert(!requests[1].url.includes('latest'));assert.equal(h.rendered.at(-1).html,'');
});
test('aborted user restoration and ordinary navigation prevent delayed GET from replacing canonical content or focus',async()=>{
 for(const interaction of ['abort','navigation']){
 let release;const wait=new Promise(r=>release=r),requests=[],h=setup(async(url,options)=>{requests.push({url,options});await wait;return ok();}),controller=new AbortController(),focus={id:'canonical-link'};h.context.document.activeElement=focus;
 const pending=h.context.restoreVisitorIntent({receipt:'jev-intent-request:11111111-1111-4111-8111-111111111111',pages:3},controller.signal);
 if(interaction==='abort')controller.abort();else h.click({id:'browse',href:'https://next.freedomvillage.church/topics/faith'});
 release();assert.equal(await pending,false);assert.equal(h.rendered.length,0);assert.equal(h.context.document.activeElement,focus);assert.equal(requests.length,1);assert.equal(requests[0].options.method,undefined);
 }
});
