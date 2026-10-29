// Progressive enhancement: canonical cards, details and navigation arrive in server HTML.
(function(root){
 let started=false,loading=false,intentActive=false,restoring=false,pagesLoaded=1,feedHistory;
 const motionItems=new Set(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function legacyLink(){const p=new URLSearchParams(location.hash.slice(1)),id=p.get('story');if(id&&/^[a-z][a-z0-9-]{0,79}$/.test(id)){location.replace('/events/'+id);return true;}if(location.hash==='#all'){location.replace('/');return true;}return false;}
 function motionState(){for(const el of motionItems){
  const inView=el.dataset.inView==='true'&&!document.hidden;
  el.classList.toggle('is-visible',inView&&!reduced.matches);
  if(inView&&el.dataset.artEntrance==='true'&&!el.dataset.artSeen){el.dataset.artSeen='true';if(!reduced.matches)el.classList.add('art-entered');}
 }}
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const e of entries)e.target.dataset.inView=String(e.isIntersecting);motionState();},{threshold:.05}):null;
 function enhance(scope=document){
  for(const disclosure of scope.querySelectorAll('.craft-reveal'))if(!disclosure.dataset.ready){disclosure.dataset.ready='true';disclosure.addEventListener('toggle',()=>requestAnimationFrame(()=>{if(typeof sizeCards==='function')sizeCards();}));}

  for(const el of scope.querySelectorAll('.has-motion'))if(!motionItems.has(el)){
   motionItems.add(el);observer?.observe(el);
  }
  for(const button of scope.querySelectorAll('.series-load'))if(!button.dataset.ready){button.dataset.ready='true';button.hidden=false;button.addEventListener('click',()=>{
   const box=button.closest('[data-series]'),id=box?.dataset.series;if(!/^PL[A-Za-z0-9_-]{8,78}$/.test(id||''))return;
   const frame=document.createElement('iframe');frame.src='https://www.youtube-nocookie.com/embed/videoseries?list='+id;frame.title=button.dataset.seriesTitle||'Teaching series';frame.allow='encrypted-media; picture-in-picture';frame.allowFullscreen=true;frame.referrerPolicy='no-referrer';frame.loading='lazy';frame.tabIndex=0;button.replaceWith(frame);frame.focus({preventScroll:true});requestAnimationFrame(()=>{if(typeof sizeCards==='function')sizeCards();});
  });}
  for(const button of scope.querySelectorAll('.video-load'))if(!button.dataset.ready){button.dataset.ready='true';button.addEventListener('click',()=>{
   const box=button.closest('[data-video]'),id=box?.dataset.video;if(!/^[A-Za-z0-9_-]{11}$/.test(id||''))return;
   const frame=document.createElement('iframe');frame.src='https://www.youtube-nocookie.com/embed/'+id;frame.title=button.dataset.videoTitle||'Sermon video';frame.allow='encrypted-media; picture-in-picture';frame.allowFullscreen=true;frame.referrerPolicy='no-referrer';frame.loading='lazy';button.replaceWith(frame);
  });}
  document.querySelector('#grid')?.classList.remove('server-content');requestAnimationFrame(()=>{if(typeof sizeCards==='function')sizeCards();});
 }
 // Let native history restore the previous document, study hash, appended feed
 // cards, scroll and focus. A new fetch of "/" loses that context. Never send a
 // direct/external arrival back into an unrelated tab history.
 function detailBack(){
  const back=document.querySelector('#detail .detail-shell > a.back');
  if(!back||back.dataset.backReady)return;back.dataset.backReady='true';
  if(!document.referrer||root.history?.length<2||root.navigation?.canGoBack===false)return;
  let from;try{from=new URL(document.referrer);}catch{return;}
  const listing=from.pathname==='/'||/^\/topics\/[a-z][a-z0-9-]{0,79}$/.test(from.pathname);
  const detail=/^\/(?:cards|events|studies)\/[a-z][a-z0-9-]{0,79}$/.test(from.pathname)||['/connect','/give','/prayer','/resources'].includes(from.pathname);
  const after=from.searchParams.get('after')||'',cursor=/^(\d{1,3}):[a-z][a-z0-9-]{0,79}$/.exec(after);
  if(from.origin!==location.origin||from.username||from.password||from.href.length>512||(!listing&&!detail)||
   (from.search&&(!listing||from.searchParams.getAll('after').length!==1||[...from.searchParams.keys()].some(k=>k!=='after')||!cursor||Number(cursor[1])>100)))return;
  back.href=from.pathname+from.search+from.hash;
  let returning=false;
  // Fragment/state traversal can finish in this document without pageshow.
  for(const type of ['pageshow','popstate','hashchange'])root.addEventListener(type,()=>{returning=false;});
  back.addEventListener('click',event=>{
   if(event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||(event.button!==undefined&&event.button!==0))return;
   if(returning){event.preventDefault();return;}
   try{root.history.back();returning=true;event.preventDefault();}catch{/* Normal anchor remains the safe in-site fallback. */}
  });
 }
 function connectDraft(){
  const picker=document.querySelector('[data-connect-draft]');if(!picker||picker.dataset.ready)return;
  const email=picker.querySelector('[data-connect-email]'),status=picker.querySelector('[data-connect-status]'),choices=[...picker.querySelectorAll('input[name="connect-interest"]')];
  if(!email||!status||choices.length!==5||email.getAttribute('href')!=='mailto:contact@freedomvillage.church')return;
  picker.dataset.ready='true';
  function update(){
   const selected=choices.filter(c=>c.checked).map(c=>c.value);
   // Only fixed public interest labels enter the draft. No personal fields,
   // persistence, network call or send/success event is involved.
   const body=selected.length?'Hello, I would like to ask about:\r\n\r\n'+selected.map(v=>'• '+v).join('\r\n')+'\r\n\r\nMy question:\r\n':'Hello, I have a question about Freedom Village.\r\n\r\n';
   email.href='mailto:contact@freedomvillage.church?subject='+encodeURIComponent('My next step at Freedom Village')+'&body='+encodeURIComponent(body);
   status.textContent=selected.length+ (selected.length===1?' interest':' interests')+' selected. Review and send in your email app.';
  }
  for(const choice of choices)choice.addEventListener('change',update);
  update();picker.hidden=false;
 }
 function kidsContents(){
  // Local reading navigation replaces this document's fragment. It must not
  // add extra steps between the explicit Families return and its source feed.
  for(const link of document.querySelectorAll('.kids-contents a'))if(!link.dataset.ready){
   link.dataset.ready='true';link.addEventListener('click',event=>{
    if(event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||(event.button!==undefined&&event.button!==0))return;
    const destination=new URL(link.getAttribute('href'),location.href),hash=destination.hash;
    if(destination.origin!==location.origin||destination.pathname!==location.pathname||destination.search!==location.search||!/^#kids-freedom-kids-\d{1,2}$/.test(hash))return;
    const target=document.getElementById(hash.slice(1));if(!target)return;
    try{root.history.replaceState(root.history.state,'',location.pathname+location.search+hash);}catch{return;}
    event.preventDefault();target.scrollIntoView({block:'start',behavior:'auto'});target.focus({preventScroll:true});
   });
  }
 }
 function pagination(){
  const more=document.querySelector('.load-more');if(!more||more.dataset.ready)return;more.dataset.ready='true';
  let autoFailed=false,ended=false;
  const nearBottom=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)&&!autoFailed)load(false);},{rootMargin:'600px 0px',threshold:0}):null;
  async function load(manual,forRestore=false,signal){
   if(loading||ended||intentActive||(restoring&&!forRestore))return false;loading=true;nearBottom?.unobserve(more);more.textContent='Loading…';more.setAttribute('aria-busy','true');
   try{
    const url=new URL(more.href);if(url.origin!==location.origin)throw Error();
    const timeout=AbortSignal.timeout(10000),requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
    const response=await fetch(url,{credentials:'same-origin',cache:'no-store',redirect:'error',signal:requestSignal});
    if(!response.ok||!response.headers.get('Content-Type')?.includes('text/html'))throw Error();
    const page=new DOMParser().parseFromString(await response.text(),'text/html'),grid=document.getElementById('grid'),incoming=page.querySelector('#grid');if(!incoming||!grid)throw Error();
    const next=page.querySelector('.load-more'),href=next?new URL(next.getAttribute('href'),url):null;
    if(href&&(href.origin!==location.origin||href.href===url.href))throw Error();
    if(intentActive)return;
    let first=null;for(const article of incoming.children)if(article.matches('article.card')&&!document.getElementById(article.id)){const copy=document.importNode(article,true),order=Number(copy.dataset.familyOrder);const before=document.getElementById('collection')?.dataset?.topic==='families'&&Number.isInteger(order)?[...grid.children].find(card=>Number(card.dataset.familyOrder)>order):null;if(before)grid.insertBefore(copy,before);else grid.append(copy);first??=copy.querySelector('a');}
    enhance(grid);autoFailed=false;pagesLoaded++;
    if(href){more.href=href.href;more.textContent='More cards ↓';}else{ended=true;nearBottom?.disconnect();more.remove();}
    if(manual)first?.focus({preventScroll:true});
    return true;
   }catch{autoFailed=true;more.textContent='Could not load. Try again ↓';return false;}
   finally{loading=false;more.removeAttribute('aria-busy');if(!ended&&!autoFailed&&!restoring)requestAnimationFrame(()=>requestAnimationFrame(()=>nearBottom?.observe(more)));}
  }
  more.addEventListener('click',event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();load(true);});
  if(!restoring)nearBottom?.observe(more);
  return {load,observe(){if(!ended&&!autoFailed)nearBottom?.observe(more);}};
 }
 reduced.addEventListener('change',motionState);
 document.addEventListener('visibilitychange',motionState);
 root.contentView={render(){if(legacyLink())return;if(!started){started=true;enhance();detailBack();connectDraft();
  kidsContents();let paging;
  const history=feedHistory=root.createFeedHistory?.({pageCount:()=>pagesLoaded,isIntent:()=>intentActive,intentState:()=>root.visitorIntentState?.()||null,restoreIntent:(hint,signal)=>root.restoreVisitorIntent?.(hint,signal)||false,loadMore:signal=>paging?.load(false,true,signal)||false,measure:()=>{if(typeof sizeCards==='function')sizeCards();}});
  restoring=history?.willRestore()||false;paging=pagination();
  if(history)void history.restore().finally(()=>{restoring=false;paging?.observe();});
 }},saveNavigation({supersede=false}={}){feedHistory?.write(supersede);},showIntent(html,{append=false,selection,quiet=false}={}){
  const grid=document.getElementById('grid'),collection=document.getElementById('collection'),detail=document.getElementById('detail');if(!grid||!collection||!detail)throw Error('Results view unavailable');
  const parsed=new DOMParser().parseFromString('<div>'+html+'</div>','text/html'),articles=[...parsed.body.firstElementChild.children];
  if(articles.some(el=>!el.matches('article.card')))throw Error('Invalid results');
  if(!append){document.querySelector('.collection-context')?.remove();collection.removeAttribute('data-topic');}
  if(append&&!intentActive)throw Error('Results view changed');
  intentActive=true;document.querySelector('.load-more:not(#intent-more)')?.remove();
  // Keep the original grid node used by masonry sizing; no generated JS executes.
  const copies=articles.filter(el=>!append||!document.getElementById(el.id)).map(el=>document.importNode(el,true));
  if(append)grid.append(...copies);else grid.replaceChildren(...copies);
  collection.hidden=false;detail.hidden=true;document.body.classList.remove('content-detail');
  const heading=collection.querySelector('h1');if(heading){heading.className='topic-title';heading.textContent='For your question';heading.tabIndex=-1;}
  document.getElementById('collection-label').textContent=root.rankedResourceStatus?.(selection)||(selection.totalCount?'Saved ranked church resources':'No eligible resources remain in this saved result.');
  document.getElementById('count').textContent=grid.children.length+' ranked resources loaded';
  if(!document.getElementById('intent-return')){const back=document.createElement('a');back.id='intent-return';back.href=location.pathname+location.search;back.textContent='Return to browsing';collection.insertBefore(back,grid);}
  enhance(grid);if(!quiet){if(append)copies[0]?.querySelector('a')?.focus({preventScroll:true});else heading?.focus();}
 }};
})(globalThis);
