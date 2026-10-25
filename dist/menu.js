// One sidebar: a desktop rail or a native modal drawer. History holds only a
// versioned scroll-position hint; content, questions and responses are never saved.
(function(root){
 const sidebar=document.getElementById('sidebar'),toggle=document.getElementById('menu-toggle'),dialog=document.getElementById('site-menu-dialog'),body=dialog.querySelector('.menu-drawer-body'),close=document.getElementById('drawer-close'),main=document.getElementById('main');
 const breakpoint=matchMedia('(max-width:700px)'),motion=matchMedia('(prefers-reduced-motion:reduce)'),slot=document.createComment('desktop navigation');
 sidebar.before(slot);
 let phase='closed',animation=null,epoch=0,returnTo=null,lock=null,owned=false,moving=false,pendingRoute=null,reopen=false,deferredRestoration=null;
 dialog.dataset.phase=phase;
 function cancelAnimation(){epoch++;animation?.cancel();animation=null;}
 const hint=()=>{const value=history.state?.fvcMenu;return value?.version===1&&Number.isFinite(value.y)&&value.y>=0&&value.y<=10000000?value:null;};
 function flushRestoration(){if(deferredRestoration!==null){history.scrollRestoration=deferredRestoration;deferredRestoration=null;}}
 function lockPage(sourceY=scrollY){
  if(lock)return;
  const restoration=deferredRestoration??history.scrollRestoration;deferredRestoration=null;
  lock={y:sourceY,restoration,style:document.body.getAttribute('style'),inert:[main,document.getElementById('prompt-composer'),document.querySelector('.mobile-bar')].filter(Boolean).map(el=>[el,el.inert])};
  history.scrollRestoration='manual';lock.inert.forEach(([el])=>el.inert=true);
  const gap=innerWidth-document.documentElement.clientWidth;
  Object.assign(document.body.style,{position:'fixed',top:-lock.y+'px',left:'0',width:'100%',overflow:'hidden',paddingRight:gap?gap+'px':''});
 }
 function unlockPage(){
  if(!lock)return;
  const saved=lock;lock=null;saved.inert.forEach(([el,value])=>el.inert=value);
  if(saved.style===null)document.body.removeAttribute('style');else document.body.setAttribute('style',saved.style);
  scrollTo({top:saved.y,left:0,behavior:'instant'});
  // Restore the native policy after the history traversal, without a second
  // scroll that could overwrite the user's next wheel or key input.
  deferredRestoration=saved.restoration;
  requestAnimationFrame(()=>{if(!lock)flushRestoration();});
 }
 function openMenu({fromHistory=false,sourceY=scrollY}={}){
  if(!breakpoint.matches)return;
  if(moving){reopen=true;return;}
  if(phase==='open'||phase==='opening')return;
  const transform=dialog.open?getComputedStyle(dialog).transform:'translateX(-101%)';
  cancelAnimation();
  if(!dialog.open){returnTo=document.activeElement;lockPage(sourceY);sidebar.inert=false;dialog.showModal();sidebar.scrollTop=0;}
  phase='opening';dialog.dataset.phase=phase;toggle.setAttribute('aria-expanded','true');
  if(!fromHistory&&!owned){history.pushState({...history.state,fvcMenu:{version:1,y:Math.max(0,Math.min(10000000,lock.y))}},'',location.href);owned=true;}else if(fromHistory)owned=true;
  close.focus({preventScroll:true});
  if(motion.matches){phase='open';dialog.dataset.phase=phase;return;}
  const version=epoch;
  animation=dialog.animate([{transform},{transform:'translateX(0)'}],{duration:180,easing:'cubic-bezier(.2,.8,.2,1)'});
  animation.finished.then(()=>{if(version!==epoch)return;phase='open';dialog.dataset.phase=phase;animation=null;}).catch(()=>{});
 }
 function closeMenu({immediate=false,returnFocus=true,fromHistory=false,skipHistory=false}={}){
  if(moving&&!fromHistory&&!skipHistory)return;
  if(owned&&!fromHistory&&!skipHistory){owned=false;moving=true;history.back();return;}
  if(phase==='closed'&&!dialog.open)return;
  const transform=getComputedStyle(dialog).transform;
  cancelAnimation();const version=epoch;phase='closing';dialog.dataset.phase=phase;toggle.setAttribute('aria-expanded','false');
  const finish=()=>{
   if(version!==epoch)return;
   phase='closed';dialog.dataset.phase=phase;if(dialog.open)dialog.close();animation?.cancel();animation=null;unlockPage();sidebar.inert=breakpoint.matches;
   if(returnFocus){const target=returnTo?.isConnected&&returnTo.getClientRects().length?returnTo:toggle;if(!target.closest('[inert]')&&target.getClientRects().length)target.focus({preventScroll:true});}
   returnTo=null;
  };
  if(immediate||motion.matches){finish();return;}
  animation=dialog.animate([{transform},{transform:'translateX(-101%)'}],{duration:150,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
  animation.finished.then(finish).catch(()=>{});
 }
 root.openMenu=openMenu;root.closeMenu=closeMenu;
 toggle.addEventListener('click',()=>phase==='open'||phase==='opening'?closeMenu():openMenu());close.addEventListener('click',()=>closeMenu());
 dialog.addEventListener('cancel',event=>{event.preventDefault();closeMenu();});
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeMenu();});
 dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const controls=[...dialog.querySelectorAll('a[href],button,[tabindex]')].filter(el=>el.tabIndex>=0&&!el.disabled&&el.getClientRects().length&&!el.closest('[inert]')),first=controls[0],last=controls.at(-1);
  if(!first)return;
  if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus({preventScroll:true});}
  else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus({preventScroll:true});}
 });
 sidebar.addEventListener('click',event=>{
  const link=event.target.closest('a[href]');
  if(!dialog.open||!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target==='_blank'||link.hasAttribute('download'))return;
  const target=new URL(link.href,location.href);if(target.origin!==location.origin)return;
  event.preventDefault();if(moving)return;
  pendingRoute=target.href;
  if(owned){owned=false;moving=true;history.back();}
  else{const route=pendingRoute;pendingRoute=null;closeMenu({immediate:true,returnFocus:false,skipHistory:true});if(route===location.href)main.focus({preventScroll:true});else location.assign(route);}
 });
 root.addEventListener('popstate',()=>{
  moving=false;
  const saved=hint();
  if(saved&&breakpoint.matches&&!pendingRoute){openMenu({fromHistory:true,sourceY:saved.y});return;}
  owned=false;const route=pendingRoute;pendingRoute=null;const openAgain=reopen;reopen=false;
  closeMenu({fromHistory:true,immediate:!!route||openAgain,returnFocus:!route});
  if(route){if(route===location.href)main.focus({preventScroll:true});else location.assign(route);}
  else if(openAgain)openMenu();
 });
 function reconcile(){
  const wasInside=sidebar.contains(document.activeElement),wasOpen=dialog.open;
  document.documentElement.dataset.menuMode=breakpoint.matches?'drawer':'rail';
  const saved=hint();
  if(breakpoint.matches){if(sidebar.parentElement!==body)body.append(sidebar);sidebar.inert=!dialog.open;if(wasInside&&!dialog.open)toggle.focus({preventScroll:true});if(saved&&!dialog.open&&!moving)openMenu({fromHistory:true,sourceY:saved.y});}
  else{
   if(saved&&!owned&&!moving){owned=true;lockPage(saved.y);unlockPage();}
   closeMenu({immediate:true,returnFocus:false,skipHistory:true});slot.after(sidebar);sidebar.inert=false;
   if(owned&&!moving){owned=false;moving=true;history.back();}
   if(wasInside||wasOpen)(sidebar.querySelector('[aria-current="page"]')||sidebar.querySelector('.brand')).focus({preventScroll:true});
  }
 }
 breakpoint.addEventListener('change',reconcile);
 motion.addEventListener('change',()=>{if(!motion.matches||!dialog.open)return;if(phase==='closing')closeMenu({immediate:true,skipHistory:true});else{cancelAnimation();phase='open';dialog.dataset.phase=phase;}});
 root.addEventListener('pagehide',()=>{pendingRoute=null;reopen=false;closeMenu({immediate:true,returnFocus:false,skipHistory:true});flushRestoration();owned=false;moving=false;});
 root.addEventListener('pageshow',reconcile);
 reconcile();
})(globalThis);
