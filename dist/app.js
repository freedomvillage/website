const categories=[['all','Everything'],['sundays','Sundays'],['community','Community'],['faith','Faith & teaching'],['serve','Serve & care']];
const items=[
{id:'welcome',category:'sundays',label:'WELCOME / FEATURED',title:'There’s room\nfor you here.',text:'Come as you are. Find a moment to breathe, a reason to hope, and people to walk alongside.',style:'featured',action:'Discover Sundays',art:'landscape',detail:['A Sunday, imagined','This is a sample welcome page showing how a featured card can open into a quiet, focused reading experience. A real version could introduce the gathering, what to expect, and helpful information for a first visit.','A simple next step','The final page could include verified gathering times, a location, accessibility information, and a way to get in touch. No schedule or address is being asserted in this prototype.']},
{id:'table',category:'community',label:'LIFE TOGETHER',title:'Good things begin\naround a table.',text:'A shared meal. An honest conversation. A place to be known.',style:'peach',action:'Explore community',detail:['More than a moment','This sample story gives community life room to breathe. It could become a gathering overview, an invitation to a group, or a story from the church.','Make space for connection','A full version would use approved photography, real stories, and confirmed details. For now, this is an illustration of the reading experience.']},
{id:'pause',category:'faith',label:'A MOMENT TO PAUSE',title:'',text:'“Be still, and know that I am God.”',style:'olive small',quote:true,foot:'Psalm 46:10 · A card-only reflection'},
{id:'ordinary',category:'faith',label:'FAITH IN THE EVERYDAY',title:'Finding hope in\nordinary days.',text:'A little encouragement for the space between Sundays.',style:'cream',art:'window',action:'Read the reflection',detail:['Small things, held with care','This illustrative reflection shows how longer editorial content can grow naturally out of a card. A full page offers space for a thoughtful introduction, a central idea, and a practical response.','A question for the week','Where might you notice goodness in an ordinary moment? This question is sample editorial content, not a quotation from a church message.']},
{id:'care',category:'serve',label:'LOVE YOUR NEIGHBOUR',title:'Small acts.\nDeep roots.',text:'There are many ways to show up for someone. Start with what is in your hands.',style:'dark',action:'Explore ways to care',detail:['Care that feels personal','This sample overview demonstrates a home for serving and care opportunities without inventing any active church programs.','From interest to action','Verified opportunities and contact information could appear here in a future version. This prototype does not collect information or submit requests.']},
{id:'kids',category:'sundays',label:'FOR THE WHOLE FAMILY',title:'Little people.\nBig belonging.',text:'A warm welcome for every generation.',style:'lavender small',art:'circle',action:'A family welcome',detail:['A reassuring first look','A real family welcome page could explain the age groups, check-in experience, safeguarding practices, and what parents can expect.','The right details matter','All operational details would need to be supplied and approved by the church. This prototype is about the shape of that experience.']},
{id:'together',category:'community',label:'OUR SHARED LIFE',title:'Known by name.\nLoved as you are.',text:'Church is more than a place we go. It is a life we share.',style:'sand small',foot:'A card-only thought · No detail page'},
{id:'listen',category:'faith',label:'ROOM TO GROW',title:'Bring your\nquestions.',text:'Faith has room for curiosity, conversation, and the next small step.',style:'olive',action:'Keep exploring',detail:['An open conversation','This sample page could become a place to explore faith, learn about the church, or find a thoughtful next step.','Designed to stay simple','Menu filters narrow the collection. Cards with an arrow open a page. Short reflections stay right where they are. Every view has its own shareable hash within this private prototype.']}
];
const filters=document.querySelector('#filters'),grid=document.querySelector('#grid'),sidebar=document.querySelector('#sidebar'),toggle=document.querySelector('#menu-toggle'),scrim=document.querySelector('#scrim'),collection=document.querySelector('#collection'),detail=document.querySelector('#detail');
let current='all',lastCard=null;const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function closeMenu(){document.getElementById('prompt-composer')?.removeAttribute('inert');sidebar.classList.remove('open');toggle.setAttribute('aria-expanded','false');scrim.hidden=true;document.body.style.overflow='';if(window.innerWidth<=700)sidebar.inert=true;document.querySelector('main').inert=false;document.querySelector('.mobile-bar').inert=false;}
function openMenu(){document.getElementById('prompt-composer')?.setAttribute('inert','');sidebar.inert=false;sidebar.classList.add('open');toggle.setAttribute('aria-expanded','true');scrim.hidden=false;document.body.style.overflow='hidden';document.querySelector('main').inert=true;document.querySelector('.mobile-bar').inert=true;sidebar.querySelector('a').focus();}
toggle.onclick=openMenu;document.querySelector('#drawer-close').onclick=()=>{closeMenu();toggle.focus()};scrim.onclick=()=>{closeMenu();toggle.focus()};
document.addEventListener('keydown',e=>{if(!sidebar.classList.contains('open'))return;if(e.key==='Escape'){closeMenu();toggle.focus()}if(e.key==='Tab'){const focusable=[...sidebar.querySelectorAll('a,button')];let first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
function sizeCards(){for(const card of grid.children){card.style.gridRowEnd=`span ${Math.ceil((card.getBoundingClientRect().height+18)/4)}`}}
function render(){const p=new URLSearchParams(location.hash.slice(1).replace(/^([^=]+)$/,'filter=$1'));current=categories.some(c=>c[0]===p.get('filter'))?p.get('filter'):'all';const item=items.find(i=>i.id===p.get('story'));filters.innerHTML=categories.map(([key,label])=>`<a href="#${key}" ${key===current?'aria-current="page"':''}>${label}<span>${key==='all'?items.length:items.filter(i=>i.category===key).length}</span></a>`).join('');closeMenu();
if(item&&item.detail){collection.hidden=true;detail.hidden=false;detail.innerHTML=`<article class="detail-shell"><a class="back" href="#${current}">← Back to ${current==='all'?'everything':categories.find(c=>c[0]===current)[1].toLowerCase()}</a><p class="eyebrow">${item.label} / SAMPLE PAGE</p><h1 tabindex="-1">${item.title.replaceAll('\n',' ')}</h1><p class="detail-deck">${item.text}</p><div class="detail-visual"><div class="art-landscape"></div></div><div class="detail-body">${item.detail.map((t,i)=>i%2===0?`<h2>${t}</h2>`:`<p>${t}</p>`).join('')}<p class="sample-note">Design prototype only. All content is illustrative; this is not a live announcement, event listing, or sign-up form.</p></div></article>`;lastCard=item.id;window.scrollTo(0,0);detail.querySelector('h1').focus({preventScroll:true});document.title=`${item.title.replaceAll('\n',' ')} — The Church at Freedom Village prototype`;return;}
collection.hidden=false;detail.hidden=true;const selected=items.filter(i=>current==='all'||i.category===current);document.querySelector('#page-title').textContent=current==='all'?'A place to belong.':categories.find(c=>c[0]===current)[1]+'.';document.querySelector('#page-intro').textContent=current==='all'?'Faith for everyday life. People to share it with.':'A closer look at this part of life together.';document.querySelector('#collection-label').textContent=current==='all'?'A little of everything':'Selected collection';document.querySelector('#count').textContent=selected.length+' cards';
grid.innerHTML=selected.map(i=>`<article class="card ${i.style}" id="card-${i.id}">${i.detail?`<a href="#filter=${current}&story=${i.id}" aria-label="${esc(i.action)}: ${esc(i.title.replaceAll('\n',' '))}">`:''}${i.art==='landscape'?'<div class="art-landscape" aria-hidden="true"></div>':i.art==='window'?'<div class="art-window" aria-hidden="true"></div>':i.art==='circle'?'<div class="circle-art" aria-hidden="true">✳</div>':''}<div class="card-content"><span class="category">${i.label}</span>${i.title?`<h2>${i.title.replaceAll('\n','<br>')}</h2>`:'<span class="quote-mark" aria-hidden="true">“</span>'}<p class="${i.quote?'quote':''}">${i.text}</p>${i.action?`<div class="action">${i.action}<span aria-hidden="true">↗</span></div>`:''}${i.foot?`<p class="card-note">${i.foot}</p>`:''}</div>${i.detail?'</a>':''}</article>`).join('');requestAnimationFrame(sizeCards);document.title='The Church at Freedom Village — A place to belong';if(lastCard){document.querySelector(`#card-${lastCard} a`)?.focus({preventScroll:true});lastCard=null;}}
filters.addEventListener('click',()=>{if(window.innerWidth<=700){closeMenu();document.querySelector('#main').focus({preventScroll:true})}});window.addEventListener('hashchange',render);window.addEventListener('resize',()=>{if(window.innerWidth>700){closeMenu();sidebar.inert=false}else if(!sidebar.classList.contains('open'))sidebar.inert=true;sizeCards()});new ResizeObserver(sizeCards).observe(grid);render();

// Scene keyframes: separate authored seasonal day/dusk/night paintings, no global tint.
const sceneTime=document.getElementById('scene-time'),sceneSeason=document.getElementById('scene-season');
const seasonNames=['Winter','Spring','Summer','Fall','Christmas'];
const seasonAssets=['village-winter-v1.png','village-spring-v1.png','village-panorama-v8.png','village-fall-v1.png','village-christmas-v1.png'];
const sceneAssets=seasonNames.map((name,i)=>[seasonAssets[i],`village-${name.toLowerCase()}-dusk-v1.png`,`village-${name.toLowerCase()}-night-v1.png`]);
const assetCache=new Map();
const SCENE_LOAD_TIMEOUT=15000,SCENE_DECODE_TIMEOUT=8000;
function bounded(promise,ms,label){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(label+' timed out')),ms);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)})})}
function preloadAsset(src){
 if(assetCache.has(src))return assetCache.get(src);
 const pending=new Promise((resolve,reject)=>{
  const im=new Image();let settled=false;const timer=setTimeout(()=>finish(new Error('Image loading timed out')),SCENE_LOAD_TIMEOUT);
  function finish(error){if(settled)return;settled=true;clearTimeout(timer);im.onload=null;im.onerror=null;error?reject(error):resolve(src)}
  function loaded(){if(!im.naturalWidth){finish(new Error('Image unavailable'));return}bounded(typeof im.decode==='function'?im.decode():Promise.resolve(),SCENE_DECODE_TIMEOUT,'Image decode').then(()=>finish(),finish)}
  im.onload=loaded;im.onerror=()=>finish(new Error('Image unavailable'));im.src=src;if(im.complete&&im.naturalWidth)loaded();
 });
 assetCache.set(src,pending);pending.catch(()=>{if(assetCache.get(src)===pending)assetCache.delete(src)});return pending;
}
let seasonRequest=0,front=document.getElementById('scene-front'),back=document.getElementById('scene-back'),appliedSeason=2;
document.documentElement.dataset.season='summer';
const smooth=t=>t*t*(3-2*t);
// Seoul daylight preview: NOAA fractional-year approximation, fixed KST (UTC+9).
// https://gml.noaa.gov/grad/solcalc/solareqns.PDF ; no device-local dates or API.
const previewDates=[[2026,1,15],[2026,4,15],[2026,7,15],[2026,10,15],[2026,12,25]];
function seoulSolarTimes(year,month,day){
 const rad=Math.PI/180,lat=37.5665*rad,lon=126.978,offset=540;
 const start=Date.UTC(year,0,1),date=Date.UTC(year,month-1,day),days=(Date.UTC(year+1,0,1)-start)/86400000;
 const g=2*Math.PI/days*((date-start)/86400000);
 const eq=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
 const dec=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
 const noon=720-4*lon-eq+offset;
 const span=alt=>4/rad*Math.acos((Math.sin(alt*rad)-Math.sin(lat)*Math.sin(dec))/(Math.cos(lat)*Math.cos(dec)));
 const riseSpan=span(-.833),civilSpan=span(-6);
 return {dawn:noon-civilSpan,sunrise:noon-riseSpan,sunset:noon+riseSpan,dusk:noon+civilSpan};
}
const previewSolarTimes=previewDates.map(date=>seoulSolarTimes(...date));
function solarClock(minutes){const n=Math.round(minutes);return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
function lightingAt(minutes,solar=previewSolarTimes[appliedSeason]){const t=((Number(minutes)%1440)+1440)%1440;
 // Authored dusk painting peaks at sunrise/sunset; blend to day over the next/previous hour.
 const keys=[[0,0],[solar.dawn,0],[solar.sunrise,1],[solar.sunrise+60,2],[solar.sunset-60,2],[solar.sunset,1],[solar.dusk,0],[1440,0]];
 let i=0;while(t>keys[i+1][0])i++;const a=keys[i],b=keys[i+1],v=a[1]+(b[1]-a[1])*smooth((t-a[0])/(b[0]-a[0]));
 return {day:Math.max(0,v-1),dusk:1-Math.abs(v-1),night:Math.max(0,1-v)};
}
// End Seoul daylight calculations.
const lightPaper={day:[250,249,245],dusk:[136,156,184],night:[18,31,51]};
function sceneTheme(w){const paper=[0,1,2].map(i=>Math.round(w.day*lightPaper.day[i]+w.dusk*lightPaper.dusk[i]+w.night*lightPaper.night[i]));const lum=paper.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);const dark=lum>.179;return {paper,ink:w.day===1?[35,60,53]:dark?[0,0,0]:[255,255,255],muted:w.day===1?[82,103,91]:dark?[0,0,0]:[255,255,255]};}
function updateSceneTime(){const mins=Number(sceneTime.value)%1440,h=Math.floor(mins/60),m=mins%60;const text=`${h%12||12}${m?':'+String(m).padStart(2,'0'):''} ${h<12?'am':'pm'}`;document.getElementById('time-readout').value=text;sceneTime.setAttribute('aria-valuetext',text);const w=lightingAt(typeof effectiveTimeMinutes==='function'?effectiveTimeMinutes(mins):mins),root=document.documentElement,theme=sceneTheme(w);for(const [key,c]of Object.entries(theme))root.style.setProperty('--'+key,`rgb(${c.join(' ')})`);root.style.setProperty('--night',String(w.night));root.style.setProperty('--dusk-alpha',String(w.day+w.dusk?w.dusk/(w.day+w.dusk):0));root.style.setProperty('--night-alpha',String(w.night));root.style.setProperty('--festive-light',String(w.night+w.dusk*.4));root.style.setProperty('--line',w.night>.5?'#526178':'#a0aab3');root.dataset.light=w.night>.5?'night':w.dusk>.1?'twilight':'day';root.style.colorScheme=w.night>.5?'dark':'light';const solar=previewSolarTimes[appliedSeason],date=previewDates[appliedSeason];document.getElementById('solar-note').textContent=`Seoul · ${date[0]}-${String(date[1]).padStart(2,'0')}-${String(date[2]).padStart(2,'0')} preview · sunrise ≈ ${solarClock(solar.sunrise)}, sunset ≈ ${solarClock(solar.sunset)} KST. Smooth civil-twilight transitions; not live time.`;}
async function updateSceneSeason(){
 const index=Number(sceneSeason.value);if(!Number.isInteger(index)||!sceneNamesValid(index))return;
 const text=seasonNames[index],request=++seasonRequest,status=document.getElementById('scene-status'),retry=document.getElementById('scene-retry');
 document.getElementById('season-readout').value=text;sceneSeason.setAttribute('aria-valuetext',text);sceneSeason.setAttribute('aria-busy','true');retry.hidden=true;
 status.textContent=`Loading ${text.toLowerCase()}… Showing ${seasonNames[appliedSeason].toLowerCase()} until ready.`;
 try{
  const assets=sceneAssets[index];await Promise.all(assets.map(preloadAsset));if(request!==seasonRequest)return;
  // Each request prepares a detached stack: stale decodes never touch live images.
  const candidate=back.cloneNode(true);candidate.classList.remove('visible');
  const imgs=[...candidate.querySelectorAll('img')];assets.forEach((src,i)=>{imgs[i].src=src});candidate.querySelector('.tower-color-source').setAttribute('href',assets[2]);
  await Promise.all(imgs.map(im=>bounded(im.decode(),SCENE_DECODE_TIMEOUT,'Scene decode')));if(request!==seasonRequest)return;
  // Atomic commit only after all three light keyframes are ready for latest request.
  back.replaceWith(candidate);back=candidate;void back.offsetWidth;back.classList.add('visible');front.classList.remove('visible');[front,back]=[back,front];
  appliedSeason=index;updateSceneTime();document.documentElement.dataset.season=text.toLowerCase();status.textContent=`${text} ready.`;
 }catch(error){
  if(request!==seasonRequest)return;
  // A decode failure must not poison retries, including already cached resources.
  sceneAssets[index].forEach(src=>assetCache.delete(src));
  status.textContent=`Could not load ${text.toLowerCase()}. Still showing ${seasonNames[appliedSeason].toLowerCase()}. Retry or choose another season.`;retry.hidden=false;
 }finally{if(request===seasonRequest)sceneSeason.setAttribute('aria-busy','false')}
}
function sceneNamesValid(index){return index>=0&&index<seasonNames.length}
sceneTime.addEventListener('input',updateSceneTime);sceneSeason.addEventListener('input',updateSceneSeason);document.getElementById('scene-retry').addEventListener('click',updateSceneSeason);updateSceneTime();updateSceneSeason();

// Manual PM2.5 preview, not live AQI or a real tower operating schedule.
function airBand(value){if(value===null)return {name:'Unknown',hue:0,color:'transparent',saturation:0};if(value<=15)return {name:'Good',hue:160,color:'#3b87e8'};if(value<=35)return {name:'Fair',hue:65,color:'#4cbd78'};if(value<=75)return {name:'Bad',hue:10,color:'#e5bd37'};return {name:'Very bad',hue:-45,color:'#e7685c'};}
function updateAirQuality(){const input=document.getElementById('scene-air'),unknown=document.getElementById('scene-air-unknown').checked,value=unknown?null:Number(input.value),band=airBand(value);input.disabled=unknown;document.getElementById('air-readout').value=unknown?'Unknown · color off':`${value} µg/m³ · ${band.name}`;input.setAttribute('aria-valuetext',unknown?'Unknown; air-quality color off':`${value} micrograms per cubic metre, ${band.name.toLowerCase()}`);document.documentElement.style.setProperty('--tower-hue',band.hue+'deg');document.documentElement.style.setProperty('--tower-saturation',String(band.saturation??1.3));document.documentElement.style.setProperty('--air-color',band.color);}
document.getElementById('scene-air').addEventListener('input',updateAirQuality);document.getElementById('scene-air-unknown').addEventListener('change',updateAirQuality);updateAirQuality();
