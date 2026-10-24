// Progressive enhancement: canonical cards, details and navigation arrive in server HTML.
(function(root){
 let started=false,loading=false;
 const motionItems=new Set(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function legacyLink(){const p=new URLSearchParams(location.hash.slice(1)),id=p.get('story');if(id&&/^[a-z][a-z0-9-]{0,79}$/.test(id)){location.replace('/events/'+id);return true;}if(location.hash==='#all'){location.replace('/');return true;}return false;}
 function motionState(){for(const el of motionItems)el.classList.toggle('is-visible',el.dataset.inView==='true'&&!document.hidden&&!reduced.matches);}
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const e of entries)e.target.dataset.inView=String(e.isIntersecting);motionState();},{threshold:.05}):null;
 function enhance(scope=document){
  for(const el of scope.querySelectorAll('.has-motion'))if(!motionItems.has(el)){
   motionItems.add(el);observer?.observe(el);
  }
  for(const button of scope.querySelectorAll('.video-load'))if(!button.dataset.ready){button.dataset.ready='true';button.addEventListener('click',()=>{
   const box=button.closest('[data-video]'),id=box?.dataset.video;if(!/^[A-Za-z0-9_-]{11}$/.test(id||''))return;
   const frame=document.createElement('iframe');frame.src='https://www.youtube-nocookie.com/embed/'+id;frame.title=button.dataset.videoTitle||'Sermon video';frame.allow='encrypted-media; picture-in-picture';frame.allowFullscreen=true;frame.referrerPolicy='no-referrer';frame.loading='lazy';button.replaceWith(frame);
  });}
  document.querySelector('#grid')?.classList.remove('server-content');requestAnimationFrame(()=>{if(typeof sizeCards==='function')sizeCards();});
 }
 function pagination(){
  const more=document.querySelector('.load-more');if(!more||more.dataset.ready)return;more.dataset.ready='true';
  let autoFailed=false,ended=false;
  const nearBottom=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)&&!autoFailed)load(false);},{rootMargin:'600px 0px',threshold:0}):null;
  async function load(manual){
   if(loading||ended)return;loading=true;nearBottom?.unobserve(more);more.textContent='Loading…';more.setAttribute('aria-busy','true');
   try{
    const url=new URL(more.href);if(url.origin!==location.origin)throw Error();
    const response=await fetch(url,{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
    if(!response.ok||!response.headers.get('Content-Type')?.includes('text/html'))throw Error();
    const page=new DOMParser().parseFromString(await response.text(),'text/html'),grid=document.getElementById('grid'),incoming=page.querySelector('#grid');if(!incoming||!grid)throw Error();
    const next=page.querySelector('.load-more'),href=next?new URL(next.getAttribute('href'),url):null;
    if(href&&(href.origin!==location.origin||href.href===url.href))throw Error();
    let first=null;for(const article of incoming.children)if(article.matches('article.card')&&!document.getElementById(article.id)){const copy=document.importNode(article,true);grid.append(copy);first??=copy.querySelector('a');}
    enhance(grid);autoFailed=false;
    if(href){more.href=href.href;more.textContent='More cards ↓';}else{ended=true;nearBottom?.disconnect();more.remove();}
    if(manual)first?.focus({preventScroll:true});
   }catch{autoFailed=true;more.textContent='Could not load. Try again ↓';}
   finally{loading=false;more.removeAttribute('aria-busy');if(!ended&&!autoFailed)requestAnimationFrame(()=>requestAnimationFrame(()=>nearBottom?.observe(more)));}
  }
  more.addEventListener('click',event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();load(true);});
  nearBottom?.observe(more);
 }
 reduced.addEventListener('change',motionState);
 document.addEventListener('visibilitychange',motionState);
 root.contentView={render(){if(legacyLink())return;if(!started){started=true;enhance();pagination();}}};
})(globalThis);
