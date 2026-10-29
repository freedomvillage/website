// Navigation hints live only in this tab's history entry. Never cache content,
// composer text, result HTML, personal fields, credentials or private responses.
(function(root){
 const KEY='fvcFeedRestore',MAX_PAGES=32,TTL=30*60*1000;
 const number=(n,max)=>Number.isFinite(n)&&n>=0&&n<=max;
 function sourcePath(value){
  try{
   const u=new URL(value,root.location.href),listing=u.pathname==='/'||/^\/topics\/[a-z][a-z0-9-]{0,79}$/.test(u.pathname),study=/^\/studies\/[a-z][a-z0-9-]{0,79}$/.test(u.pathname),reader=['/cards/godly-play','/cards/village-youth','/cards/freedom-kids'].includes(u.pathname);
   if(u.origin!==root.location.origin||u.username||u.password||(!listing&&!study&&!reader)||u.href.length>512)return null;
   if(u.search){const after=u.searchParams.get('after')||'',m=/^(\d{1,3}):[a-z][a-z0-9-]{0,79}$/.exec(after);if(!listing||[...u.searchParams.keys()].some(k=>k!=='after')||u.searchParams.getAll('after').length!==1||!m||Number(m[1])>100)return null;}
   if(u.hash&&!/^#(?:main|study-[a-z0-9_-]{1,120}|card-[a-z][a-z0-9-]{0,79})$/.test(u.hash)&&!(u.pathname==='/cards/freedom-kids'&&/^#kids-freedom-kids-\d{1,2}$/.test(u.hash)))return null;
   return u.pathname+u.search+u.hash;
  }catch{return null;}
 }
 const destination=value=>{try{const u=new URL(value,root.location.href);return u.origin===root.location.origin&&!u.username&&!u.password&&!u.search&&!u.hash&&(/^\/(?:cards|events|studies)\/[a-z][a-z0-9-]{0,79}$/.test(u.pathname)||['/connect','/give','/prayer','/resources'].includes(u.pathname))?u.pathname:null;}catch{return null;}};
 const intentPath=value=>{try{const u=new URL(value,root.location.href);return !u.search&&(!u.hash||u.hash==='#main')&&destination(u.origin+u.pathname)?u.pathname+u.hash:null;}catch{return null;}};
 function valid(value,path){return [1,2].includes(value?.version)&&value.path===path&&Number.isInteger(value.pages)&&value.pages>=1&&value.pages<=MAX_PAGES&&(!path.startsWith('/cards/')||value.pages===1)&&number(value.y,10000000)&&number(Date.now()-value.at,TTL)&&
  (value.version===1||(value.intent&&/^jev-intent-request:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.intent.receipt)&&Number.isInteger(value.intent.pages)&&value.intent.pages>=1&&value.intent.pages<=11))&&
  (value.focus===null||(typeof value.focus?.cardId==='string'&&/^[a-zA-Z0-9_-]{1,180}$/.test(value.focus.cardId)&&destination(value.focus.href)===value.focus.href));}
 root.createFeedHistory=function({pageCount,isIntent,loadMore,measure,intentState=()=>null,restoreIntent=async()=>false}){
  const ordinaryPath=sourcePath(root.location.href),path=ordinaryPath||intentPath(root.location.href);if(!path||!root.history?.replaceState)return null;
  let saved;try{saved=root.history.state?.[KEY];}catch{}
  if(!valid(saved,path)||(!ordinaryPath&&saved?.version!==2))saved=null;
  let focus=null,cancelled=false,restoring=false,finished=false,revealObserver=null;
  const cancellation=root.AbortController?new root.AbortController():null;
  const navigation=root.performance?.getEntriesByType?.('navigation')?.[0]?.type;
  if(navigation&& !['back_forward','reload'].includes(navigation))saved=null;
  function write(supersede=false){
   if(supersede){cancelled=true;cancellation?.abort();restoring=false;saved=null;focus=null;revealObserver?.disconnect();}
   if(restoring)return;
   const currentPath=sourcePath(root.location.href)||intentPath(root.location.href);if(!currentPath)return;
   const pages=pageCount();if(!Number.isInteger(pages)||pages<1||pages>MAX_PAGES)return;
   const intent=isIntent()?intentState():null;if(isIntent()&&!intent)return;
   if(!ordinaryPath&&!intent)return;
   const value={version:intent?2:1,path:currentPath,pages,y:Math.max(0,Math.min(10000000,root.scrollY||0)),focus,at:Date.now(),...(intent?{intent}: {})};
   try{root.history.replaceState({...root.history.state,[KEY]:value},'');}catch{/* Storage-disabled history remains native navigation. */}
  }
  root.document.addEventListener('click',event=>{
   if(event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||(event.button!==undefined&&event.button!==0))return;
   const link=event.target?.closest?.('main a[href]'),href=link&&destination(link.href);if(!href||link.target==='_blank'||link.hasAttribute('download'))return;
   const card=link.closest('section[data-history-anchor][id]')||link.closest('details[data-history-anchor][id]')||link.closest('article[id]');focus=card&&/^[a-zA-Z0-9_-]{1,180}$/.test(card.id)?{cardId:card.id,href}:null;write();
  });
  root.addEventListener('pagehide',()=>{write();revealObserver?.disconnect();});
  const cancel=()=>{cancelled=true;cancellation?.abort();revealObserver?.disconnect();};
  for(const event of ['wheel','touchstart','pointerdown','keydown'])root.addEventListener(event,cancel,{passive:true});
  function place(){
   if(!saved||cancelled)return;
   const card=saved.focus&&root.document.getElementById(saved.focus.cardId),link=card&&[...card.querySelectorAll('a[href]')].find(a=>destination(a.href)===saved.focus.href);
   const target=link||(saved.intent?root.document.querySelector('#collection h1'):null);
   if(target&&root.getComputedStyle?.(target).visibility==='hidden'){
    // The scene loader temporarily hides content; focus() cannot succeed yet.
    // Retry after reveal, without caching content or stealing focus after input.
    if(!revealObserver&&root.MutationObserver&&root.document.documentElement){
     revealObserver=new root.MutationObserver(()=>{if(!cancelled)place();});
     revealObserver.observe(root.document.documentElement,{attributes:true,attributeFilter:['data-site-revealed']});
    }
   }else{revealObserver?.disconnect();revealObserver=null;target?.focus({preventScroll:true});}
   root.scrollTo({top:saved.y,left:0,behavior:'instant'});
  }
  // Native bfcache already has the full DOM. Only reconstructed documents need
  // this fallback; a late pageshow can otherwise apply a stale native offset.
  root.addEventListener('pageshow',event=>{if(finished&&!event.persisted)place();});
  return {willRestore:()=>Boolean(saved),async restore(){
   if(!saved)return;restoring=true;
   const timeout=root.AbortSignal?.timeout?.(20000),signal=cancellation?(timeout&&root.AbortSignal?.any?root.AbortSignal.any([cancellation.signal,timeout]):cancellation.signal):timeout,started=Date.now();
   let original;try{original=root.history.scrollRestoration;root.history.scrollRestoration='manual';}catch{}
   try{
    if(saved.intent){if(!await restoreIntent(saved.intent,signal,()=>!cancelled))return;}
    else for(let page=1;page<saved.pages&&!cancelled&&Date.now()-started<20000;page++)if(!await loadMore(signal))break;
    if(cancelled)return;
    // A reconstructed Kids reader must reopen the native source question before
    // measuring its saved departure position. The hint stores only a route/ID.
    if(path.startsWith('/cards/freedom-kids')&&saved.focus){
     const card=root.document.getElementById(saved.focus.cardId),link=card&&[...card.querySelectorAll('a[href]')].find(a=>destination(a.href)===saved.focus.href);
     const disclosure=link?.closest?.('details.kids-question');if(disclosure)disclosure.open=true;
    }
    measure();await new Promise(resolve=>root.requestAnimationFrame(()=>root.requestAnimationFrame(resolve)));
    if(cancelled)return;
    place();finished=true;
   }catch{/* Keep the current canonical feed usable if restoration cannot finish. */}
   finally{restoring=false;try{if(['auto','manual'].includes(original))root.history.scrollRestoration=original;}catch{}}
  },write,clear(){
   cancel();restoring=false;saved=null;focus=null;
   try{const value={...root.history.state};delete value[KEY];root.history.replaceState(value,'');}catch{}
  }};
 };
 root.keepContentFocusVisible=function(target){
  if(!target?.closest?.('main')||target.closest('[hidden]'))return;
  const composer=root.document.getElementById('prompt-composer');if(!composer)return;
  const overlay=composer.getBoundingClientRect(),v=root.visualViewport;
  const top=Math.max(12,(v?.offsetTop||0)+12),bottom=Math.min(root.innerHeight,(v?.offsetTop||0)+(v?.height||root.innerHeight),overlay.height>0?overlay.top:root.innerHeight)-12;
  if(bottom<=top)return;
  const landmark=target.matches('a')?(target.querySelector('h2:not(.visually-hidden),h3:not(.visually-hidden)')||target):target,rect=landmark.getBoundingClientRect();
  const delta=rect.height>bottom-top||rect.top<top?rect.top-top:rect.bottom>bottom?rect.bottom-bottom:0;
  if(delta)root.scrollBy({top:delta,left:0,behavior:'instant'});
 };
 root.document.addEventListener('focusin',event=>{
  const target=event.target;root.requestAnimationFrame(()=>{if(root.document.activeElement===target)root.keepContentFocusVisible(target);});
 });
})(globalThis);
