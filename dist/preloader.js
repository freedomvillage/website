/* Latest reviewed R8.1 arch preloader, integrated with the existing scene lifecycle.
   No page composition, navigation, content, composer, provider or storage changes. */
(function(root){
 'use strict';
 const html=document.documentElement,reduced=matchMedia('(prefers-reduced-motion:reduce)');
 let internal=false;
 try{const type=performance.getEntriesByType('navigation')[0]?.type;internal=type==='back_forward'||(type==='navigate'&&Boolean(document.referrer)&&new URL(document.referrer).origin===location.origin)}catch{}
 html.dataset.preloaderMode=internal?'internal':'initial';
 html.dataset.preloaderState='waiting';
const DURATION = 1260;
const clamp=v=>Math.max(0,Math.min(1,v));
const out=t=>1-Math.pow(1-clamp(t),5);
const io=t=>{t=clamp(t);return t<.5?16*t*t*t*t*t:1-Math.pow(-2*t+2,5)/2};
const segment=(t,a,b,fn=io)=>fn((t-a)/(b-a));
function arch(ctx,cx,cy,aw,ah){
  const x=cx-aw/2,y=cy-ah/2,r=aw/2;
  ctx.beginPath();ctx.moveTo(x,y+ah);ctx.lineTo(x,y+r);
  ctx.bezierCurveTo(x,y+r*.448,x+r*.448,y,x+r,y);
  ctx.bezierCurveTo(x+aw-r*.448,y,x+aw,y+r*.448,x+aw,y+r);
  ctx.lineTo(x+aw,y+ah);ctx.closePath();
}
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
let coverMemo={};
function fittedArchCover(w,h,s){const key=w+':'+h+':'+s;if(coverMemo.key===key)return coverMemo.value;const cx=w/2,cy=h/2-57*s;
 const contains=(x,y,k)=>{const aw=80*s*k,ah=96*s*k,r=aw/2,top=cy-ah/2;if(x<cx-r||x>cx+r||y<top||y>top+ah)return false;return y>=top+r||(x-cx)**2+(y-top-r)**2<=r*r};const fits=k=>[[-3,-3],[w+3,-3],[-3,h+3],[w+3,h+3]].every(([x,y])=>contains(x,y,k));let lo=1,hi=2;while(!fits(hi))hi*=2;for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(fits(mid))hi=mid;else lo=mid}coverMemo={key,value:hi*1.002};return coverMemo.value}
function wordmarkOpacity(t){return 1-smooth((t-100)/140)}
function renderRefinedA(ctx,img,whiteStar,w,h,isMobile,t){
 ctx.clearRect(0,0,w,h);if(t>=DURATION)return{done:true,underlayTransform:'translate(0px,0px) scale(1)'};
 ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);const s=isMobile?.85:Math.min(1,w/600),left=w/2-300*s,top=h/2-200*s;
 // Exact original raster split only at blank row205. The entire lettering fades as one unit
 // before the aperture reaches it; the authentic arch/star retains its current wipe.
 ctx.drawImage(img,0,0,600,205,left,top,600*s,205*s);
 ctx.save();ctx.globalAlpha=wordmarkOpacity(t);ctx.drawImage(img,0,205,600,195,left,top+205*s,600*s,195*s);ctx.restore();
 const q=clamp((t-100)/(DURATION-100)),p=smooth(q),k=Math.exp(Math.log(fittedArchCover(w,h,s))*p),fill=clamp(p/.06),cx=w/2,cy=h/2-57*s,aw=80*s*k,ah=96*s*k;
 if(fill>0){ctx.save();ctx.globalAlpha=fill;ctx.globalCompositeOperation='destination-out';arch(ctx,cx,cy,aw,ah);ctx.fill();ctx.globalCompositeOperation='source-over';
  // Whole-contour transparency avoids a flat loading-bar fill or a clipped star.
  ctx.globalAlpha=fill*(1-smooth((p-.15)/.28));if(whiteStar)ctx.drawImage(whiteStar,w/2-35*s,h/2-92*s,70*s,70*s);ctx.restore();}
 return{done:false,underlayTransform:`translate(0px,${8*(1-p)}px) scale(${1.028-.028*p})`};
}
 let overlay,logo,canvas,context,paint,whiteStar,originalTransform='',initialized=false;
 let ready=false,started=false,finished=false,elapsed=0,last=0,frame=0,animationTimer=0,logoTimer=0;
 const signal=(phase,reason)=>root.dispatchEvent(new CustomEvent('fvc:preloader',{detail:{phase,reason,elapsed,duration:DURATION}}));
 // Existing image pipeline bounds network + two decode stages to at most31s.
 // This independent guard also releases the page if the app never calls ready/fail.
 const readinessTimer=setTimeout(()=>finish('readiness-timeout'),35000);
 function init(){
  if(initialized)return;
  overlay=document.getElementById('site-loading');logo=overlay?.querySelector('.loading-logo');canvas=overlay?.querySelector('canvas');paint=document.querySelector('.scene-stage');
  initialized=Boolean(overlay&&logo&&canvas);
  if(initialized)originalTransform=paint?.style.transform||'';
 }
 function finish(reason='complete'){
  if(finished)return;finished=true;cancelAnimationFrame(frame);clearTimeout(readinessTimer);clearTimeout(animationTimer);clearTimeout(logoTimer);
  if(paint)paint.style.transform=originalTransform;
  html.dataset.siteRevealed='true';delete html.dataset.preloaderState;delete html.dataset.preloaderMode;
  signal('complete',reason);
 }
 function prepareStar(){
  whiteStar=document.createElement('canvas');whiteStar.width=whiteStar.height=70;
  const c=whiteStar.getContext('2d');if(!c)throw Error('Canvas unavailable');
  c.drawImage(logo,265,108,70,70,0,0,70,70);
  const im=c.getImageData(0,0,70,70);
  for(let y=0;y<70;y++)for(let x=0;x<70;x++){const i=(y*70+x)*4,l=(im.data[i]+im.data[i+1]+im.data[i+2])/3;im.data[i]=im.data[i+1]=im.data[i+2]=255;im.data[i+3]=(Math.abs(x-35)+Math.abs(y-35)<=35)?Math.max(0,Math.min(255,(255-l)*1.6)):0}
  c.putImageData(im,0,0);
 }
 function draw(){
  const w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,2);
  const physicalWidth=Math.round(w*dpr),physicalHeight=Math.round(h*dpr);
  if(canvas.width!==physicalWidth||canvas.height!==physicalHeight){canvas.width=physicalWidth;canvas.height=physicalHeight}
  context.setTransform(dpr,0,0,dpr,0,0);
  const state=renderRefinedA(context,logo,whiteStar,w,h,w<=700,elapsed);
  if(paint)paint.style.transform=state.underlayTransform;
 }
 function tick(now){
  if(finished)return;
  try{if(last)elapsed+=Math.min(now-last,70);last=now;elapsed=Math.min(elapsed,DURATION);draw();if(elapsed>=DURATION)finish();else frame=requestAnimationFrame(tick)}catch{finish('canvas-fallback')}
 }
 async function reveal(){
  if(ready||finished)return;ready=true;init();
  if(!initialized){finish('markup-fallback');return}
  if(internal||reduced.matches){finish(internal?'internal-navigation':'reduced-motion');return}
  try{
   await Promise.race([logo.decode(),new Promise((_,reject)=>{logoTimer=setTimeout(()=>reject(Error('Logo decode timeout')),5000)})]);clearTimeout(logoTimer);
   if(finished)return;if(reduced.matches){finish('reduced-motion');return}
   context=canvas.getContext('2d');if(!context)throw Error('Canvas unavailable');
   prepareStar();started=true;html.dataset.preloaderState='opening';
   animationTimer=setTimeout(()=>finish('animation-watchdog'),DURATION+650);
   draw();logo.hidden=true;signal('start');frame=requestAnimationFrame(tick);
  }catch{finish('canvas-or-logo-fallback')}
 }
 root.scenePresentation=Object.freeze({ready:reveal,failed:()=>finish('scene-fallback')});
 document.addEventListener('DOMContentLoaded',init,{once:true});
 addEventListener('resize',()=>{if(started&&!finished)try{draw()}catch{finish('resize-fallback')}});
 reduced.addEventListener('change',()=>{if(reduced.matches&&ready&&!finished)finish('preference-reduced')});
 addEventListener('pagehide',()=>{if(!finished)finish('page-departure')});
})(globalThis);
