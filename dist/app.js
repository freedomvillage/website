const categories=[['all','All']];
const items=[];
const filters=document.querySelector('#filters'),grid=document.querySelector('#grid'),collection=document.querySelector('#collection'),detail=document.querySelector('#detail');
let current='all',lastCard=null;const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function sizeCards(){for(const card of grid.children){card.style.gridRowEnd=`span ${Math.ceil((card.getBoundingClientRect().height+18)/4)}`}}
function render(){globalThis.contentView.render();}
window.addEventListener('hashchange',render);window.addEventListener('resize',sizeCards);new ResizeObserver(sizeCards).observe(grid);render();

// Scene keyframes: separate authored seasonal day/dusk/night paintings, no global tint.
const sceneTime=document.getElementById('scene-time'),sceneSeason=document.getElementById('scene-season');
const seasonNames=['Winter','Spring','Summer','Fall','Christmas'];
// Editable season calendar: verified USNO equinox/solstice Seoul civil dates (2026–2035).
// Date-only presets begin at KST midnight on each event date, not its precise astronomical instant.
// Source/evidence: docs/seasons-2026-2035-seoul.json; https://aa.usno.navy.mil/data/Earth_Seasons
// Christmas overrides December winter: Friday after US Thanksgiving through Dec 31.
// These astronomical boundaries are calendar conventions, not local foliage predictions.
const seasonCalendar=[
 {year:2026,spring:'03-20',summer:'06-21',fall:'09-23',winter:'12-22',christmas:'11-27',palmSunday:'03-29',easterSunday:'04-05'},
 {year:2027,spring:'03-21',summer:'06-21',fall:'09-23',winter:'12-22',christmas:'11-26',palmSunday:'03-21',easterSunday:'03-28'},
 {year:2028,spring:'03-20',summer:'06-21',fall:'09-22',winter:'12-21',christmas:'11-24',palmSunday:'04-09',easterSunday:'04-16'},
 {year:2029,spring:'03-20',summer:'06-21',fall:'09-23',winter:'12-21',christmas:'11-23',palmSunday:'03-25',easterSunday:'04-01'},
 {year:2030,spring:'03-20',summer:'06-21',fall:'09-23',winter:'12-22',christmas:'11-29',palmSunday:'04-14',easterSunday:'04-21'},
 {year:2031,spring:'03-21',summer:'06-21',fall:'09-23',winter:'12-22',christmas:'11-28',palmSunday:'04-06',easterSunday:'04-13'},
 {year:2032,spring:'03-20',summer:'06-21',fall:'09-22',winter:'12-21',christmas:'11-26',palmSunday:'03-21',easterSunday:'03-28'},
 {year:2033,spring:'03-20',summer:'06-21',fall:'09-23',winter:'12-21',christmas:'11-25',palmSunday:'04-10',easterSunday:'04-17'},
 {year:2034,spring:'03-20',summer:'06-21',fall:'09-23',winter:'12-22',christmas:'11-24',palmSunday:'04-02',easterSunday:'04-09'},
 {year:2035,spring:'03-21',summer:'06-21',fall:'09-23',winter:'12-22',christmas:'11-23',palmSunday:'03-18',easterSunday:'03-25'}
];
function seoulDateAt(instant){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instant);return ['year','month','day'].map(key=>Number(parts.find(p=>p.type===key).value));}
function seasonForDate([year,month,day]){
 // Outside the verified decade, approximate with the nearest verified row's month/day
 // boundaries (not exact future/past astronomy); compute Christmas for the actual year.
 const friday=1+(4-new Date(Date.UTC(year,10,1)).getUTCDay()+7)%7+22;
 const nearest=seasonCalendar[year<seasonCalendar[0].year?0:seasonCalendar.length-1];
 const row=seasonCalendar.find(r=>r.year===year)||{...nearest,christmas:`11-${friday}`};
 const md=`${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
 if(md>=row.christmas)return 4;if(md>=row.winter)return 0;if(md>=row.fall)return 3;if(md>=row.summer)return 2;if(md>=row.spring)return 1;return 0;
}
// Calendar selection is captured once; clock/solar refresh never changes this season or holiday date.
const pageLoadDate=Object.freeze(globalThis.sceneBoot?.date||seoulDateAt(new Date()));
let manualSeasonSelected=false;
sceneSeason.value=String(seasonForDate(pageLoadDate));
// Western Easter dates: https://www.census.gov/data/software/x13as/genhol/easter-dates.html
function holyWeekDayForDate([year,month,day]){const row=seasonCalendar.find(r=>r.year===year);if(!row)return null;const [pm,pd]=row.palmSunday.split('-').map(Number),elapsed=(Date.UTC(year,month-1,day)-Date.UTC(year,pm-1,pd))/86400000;return elapsed>=0&&elapsed<=7?elapsed:null;}
// End season calendar.
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
let seasonRequest=0,front=document.getElementById('scene-front'),back=document.getElementById('scene-back'),appliedSeason=Number(sceneSeason.value),sceneHasLoaded=false;
document.documentElement.dataset.season=seasonNames[appliedSeason].toLowerCase();
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
let appliedSolarDate=pageLoadDate,appliedSolarTimes=seoulSolarTimes(...pageLoadDate),appliedDateIsManual=false;
sceneTime.value=String(globalThis.sceneBoot?.minutes??((Date.now()/60000+540)%1440));
function solarClock(minutes){const n=Math.round(minutes);return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
function lightingAt(minutes,solar=appliedSolarTimes){const t=((Number(minutes)%1440)+1440)%1440;
 // Authored dusk painting peaks at sunrise/sunset; blend to day over the next/previous hour.
 const keys=[[0,0],[solar.dawn,0],[solar.sunrise,1],[solar.sunrise+60,2],[solar.sunset-60,2],[solar.sunset,1],[solar.dusk,0],[1440,0]];
 let i=0;while(t>keys[i+1][0])i++;const a=keys[i],b=keys[i+1],v=a[1]+(b[1]-a[1])*smooth((t-a[0])/(b[0]-a[0]));
 return {day:Math.max(0,v-1),dusk:1-Math.abs(v-1),night:Math.max(0,1-v)};
}
// End Seoul daylight calculations.
// Static, tree-localized Holy Week decoration; never changes the captured date.
const holyWeekNames=['Palm Sunday','Holy Monday','Holy Tuesday','Holy Wednesday','Maundy Thursday','Good Friday','Holy Saturday','Easter Sunday'];
function updateHolyWeek(w){
 const overlay=document.getElementById('holyweek-overlay');if(!overlay)return;
 const preview=document.getElementById('holyweek-preview'),slider=document.getElementById('holyweek-day'),output=document.getElementById('holyweek-readout'),note=document.getElementById('holyweek-note');
 const spring=appliedSeason===1;preview.disabled=!spring;slider.disabled=!spring||!preview.checked;
 const day=spring?(preview.checked?Number(slider.value):!appliedDateIsManual?holyWeekDayForDate(pageLoadDate):null):null;
 overlay.style.setProperty('--blossom-visible',day===null?'0':'1');
 for(let i=0;i<8;i++)overlay.style.setProperty('--blossom-step-'+i,day!==null&&i<=day?'1':'0');
 overlay.style.setProperty('--easter-banner',day===7?'1':'0');
 const color=(day,dusk,night)=>`rgb(${day.map((v,i)=>Math.round(v*w.day+dusk[i]*w.dusk+night[i]*w.night)).join(' ')})`;
 overlay.style.setProperty('--blossom-petal',color([255,253,240],[207,203,219],[133,153,179]));
 overlay.style.setProperty('--blossom-pink',color([227,150,172],[183,131,159],[112,105,145]));
 overlay.style.setProperty('--blossom-lavender',color([170,146,208],[143,125,177],[88,101,145]));
 overlay.style.setProperty('--blossom-yellow',color([237,203,120],[189,161,116],[117,125,107]));
 overlay.style.setProperty('--blossom-edge',color([184,180,164],[142,143,166],[83,104,137]));
 overlay.style.setProperty('--banner-purple',color([101,67,116],[74,54,95],[40,35,63]));
 overlay.style.setProperty('--banner-gold',color([228,199,126],[187,165,117],[122,119,106]));
 overlay.style.setProperty('--banner-edge',color([69,51,79],[53,42,67],[27,29,47]));
 overlay.style.setProperty('--vine-stem',color([89,107,72],[77,79,68],[40,55,55]));
 overlay.style.setProperty('--vine-leaf',color([117,137,89],[105,108,85],[54,73,66]));
 output.value=holyWeekNames[Number(slider.value)];slider.setAttribute('aria-valuetext',output.value);
 note.textContent=!spring?'Select Spring to preview Holy Week. The five seasons are unchanged.':preview.checked?`Preview override: ${holyWeekNames[day]}. ${day===7?'Easter banner shown.':'Banner appears on Easter Sunday only.'}`:day===null?'Automatic: no Holy Week decoration for this captured date or manual season preview.':`Automatic: ${holyWeekNames[day]} from the Seoul date captured on page load.`;
}
const lightPaper={day:[250,249,245],dusk:[136,156,184],night:[18,31,51]};
function sceneTheme(w){const paper=[0,1,2].map(i=>Math.round(w.day*lightPaper.day[i]+w.dusk*lightPaper.dusk[i]+w.night*lightPaper.night[i]));const lum=paper.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);const dark=lum>.179;return {paper,ink:w.day===1?[35,60,53]:dark?[0,0,0]:[255,255,255],muted:w.day===1?[82,103,91]:dark?[0,0,0]:[255,255,255]};}
function updateSceneTime(){const mins=Number(sceneTime.value)%1440,h=Math.floor(mins/60),m=Math.floor(mins%60);const text=`${h%12||12}${m?':'+String(m).padStart(2,'0'):''} ${h<12?'am':'pm'}`;document.getElementById('time-readout').value=text;sceneTime.setAttribute('aria-valuetext',text);const w=lightingAt(typeof effectiveTimeMinutes==='function'?effectiveTimeMinutes(mins):mins),root=document.documentElement,theme=sceneTheme(w);for(const [key,c]of Object.entries(theme))root.style.setProperty('--'+key,`rgb(${c.join(' ')})`);root.style.setProperty('--night',String(w.night));root.style.setProperty('--dusk-alpha',String(w.day+w.dusk?w.dusk/(w.day+w.dusk):0));root.style.setProperty('--night-alpha',String(w.night));root.style.setProperty('--festive-light',String(w.night+w.dusk*.4));root.style.setProperty('--line',w.night>.5?'#526178':'#a0aab3');root.dataset.light=w.night>.5?'night':w.dusk>.1?'twilight':'day';root.style.colorScheme=w.night>.5?'dark':'light';const solar=appliedSolarTimes,date=appliedSolarDate;document.getElementById('solar-note').textContent=`Seoul · ${date[0]}-${String(date[1]).padStart(2,'0')}-${String(date[2]).padStart(2,'0')} ${appliedDateIsManual?'manual preview':'current solar date; calendar captured on page load'} · sunrise ≈ ${solarClock(solar.sunrise)}, sunset ≈ ${solarClock(solar.sunset)} KST. Smooth civil-twilight transitions.`;updateHolyWeek(w);globalThis.airQualityClient?.tick();}
async function updateSceneSeason(manual=true){
 const index=Number(sceneSeason.value);if(!Number.isInteger(index)||!sceneNamesValid(index))return;
 if(manual)manualSeasonSelected=true;const dateIsManual=manualSeasonSelected,date=dateIsManual?previewDates[index]:(globalThis.sceneClock?.solarDate()||pageLoadDate);
 const text=seasonNames[index],request=++seasonRequest,status=document.getElementById('scene-status'),retry=document.getElementById('scene-retry');
 document.getElementById('season-readout').value=text;sceneSeason.setAttribute('aria-valuetext',text);sceneSeason.setAttribute('aria-busy','true');retry.hidden=true;
 status.textContent=sceneHasLoaded?`Loading ${text.toLowerCase()}… Showing ${seasonNames[appliedSeason].toLowerCase()} until ready.`:`Loading ${text.toLowerCase()} scene…`;
 try{
  const assets=sceneAssets[index];await Promise.all(assets.map(preloadAsset));if(request!==seasonRequest)return;
  // Each request prepares a detached stack: stale decodes never touch live images.
  const candidate=back.cloneNode(true);candidate.classList.remove('visible');
  const imgs=[...candidate.querySelectorAll('img')];assets.forEach((src,i)=>{imgs[i].src=src});candidate.querySelector('.tower-color-source').setAttribute('href',assets[2]);
  await Promise.all(imgs.map(im=>bounded(im.decode(),SCENE_DECODE_TIMEOUT,'Scene decode')));if(request!==seasonRequest)return;
  // Atomic commit only after all three light keyframes are ready for latest request.
  back.replaceWith(candidate);back=candidate;if(!sceneHasLoaded)back.style.transition='none';void back.offsetWidth;back.classList.add('visible');front.classList.remove('visible');[front,back]=[back,front];
  appliedSeason=index;appliedSolarDate=date;appliedSolarTimes=seoulSolarTimes(...date);appliedDateIsManual=dateIsManual;globalThis.sceneClock?.syncSolarDate();updateSceneTime();document.documentElement.dataset.sceneReady='true';document.documentElement.dataset.siteRevealed='true';if(!sceneHasLoaded){sceneHasLoaded=true;const initial=front;setTimeout(()=>{if(initial.style)initial.style.transition='';},0);}document.documentElement.dataset.season=text.toLowerCase();status.textContent=`${text} ready.`;
 }catch(error){
  if(request!==seasonRequest)return;
  document.documentElement.dataset.siteRevealed='true';
  // A decode failure must not poison retries, including already cached resources.
  sceneAssets[index].forEach(src=>assetCache.delete(src));
  status.textContent=sceneHasLoaded?`Could not load ${text.toLowerCase()}. Still showing ${seasonNames[appliedSeason].toLowerCase()}. Retry or choose another season.`:`Could not load the initial ${text.toLowerCase()} scene. Retry or choose another season.`;retry.hidden=false;
 }finally{if(request===seasonRequest)sceneSeason.setAttribute('aria-busy','false')}
}
function sceneNamesValid(index){return index>=0&&index<seasonNames.length}
document.getElementById('holyweek-preview')?.addEventListener('change',updateSceneTime);document.getElementById('holyweek-day')?.addEventListener('input',updateSceneTime);
sceneTime.addEventListener('input',updateSceneTime);sceneSeason.addEventListener('input',updateSceneSeason);document.getElementById('scene-retry').addEventListener('click',()=>updateSceneSeason(manualSeasonSelected));updateSceneTime();updateSceneSeason(false);

// Manual PM2.5 preview is an explicit override of the shared cached observation.
function airBand(value){if(value===null)return {name:'Unknown',hue:0,color:'transparent',saturation:0};if(value<=15)return {name:'Good',hue:160,color:'#3b87e8'};if(value<=35)return {name:'Fair',hue:65,color:'#4cbd78'};if(value<=75)return {name:'Bad',hue:10,color:'#e5bd37'};return {name:'Very bad',hue:-45,color:'#e7685c'};}
let liveAirReading=null;
function updateAirQuality(){
 globalThis.updateActualAirSummary?.();
 const input=document.getElementById('scene-air'),unknown=document.getElementById('scene-air-unknown'),manual=document.getElementById('scene-air-manual')?.checked===true;
 const cached=typeof globalThis.validateCachedAirReading==='function'?globalThis.validateCachedAirReading(liveAirReading,Date.now()):null;
 const value=manual?(unknown.checked?null:Number(input.value)):cached?cached.pm25:null,band=airBand(value);
 input.disabled=!manual||unknown.checked;unknown.disabled=!manual;
 document.getElementById('air-readout').value=(manual?'Preview · ':'Cached · ')+(value===null?'Unknown · color off':`${value} µg/m³ · ${band.name}`);
 input.setAttribute('aria-valuetext',value===null?'Unknown; air-quality color off':`${value} micrograms per cubic metre, ${band.name.toLowerCase()}`);
 document.documentElement.style.setProperty('--tower-hue',band.hue+'deg');document.documentElement.style.setProperty('--tower-saturation',String(band.saturation??1.3));document.documentElement.style.setProperty('--air-color',band.color);
 const note=document.getElementById('air-live-note');if(note)note.textContent=manual?'Manual preview override — not a live measurement.':value===null?'Unknown — no valid observation less than one hour old for the current Seoul night. Daytime does not fetch air data.':`AirKorea · ${liveAirReading.station} · observed ${new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(liveAirReading.observedAt))} KST. Observation less than one hour old; expires automatically. Shared cache, not actual tower lighting.`;
}
document.getElementById('scene-air').addEventListener('input',updateAirQuality);document.getElementById('scene-air-unknown').addEventListener('change',updateAirQuality);updateAirQuality();
document.getElementById('scene-air-manual')?.addEventListener('change',()=>{updateAirQuality();globalThis.airQualityClient?.tick();});
// The client gates requests by actual Seoul now, never the preview date/time slider.
if(typeof globalThis.createAirQualityClient==='function'){
 globalThis.airQualityClient=globalThis.createAirQualityClient({
  getState:()=>({manual:document.getElementById('scene-air-manual').checked,hidden:document.hidden,visualNight:Number(document.documentElement.style.getPropertyValue('--night-alpha'))}),
  isRealNight:instant=>{const solar=seoulSolarTimes(...seoulDateAt(new Date(instant))),minutes=((instant/60000+540)%1440+1440)%1440;return minutes>=solar.sunset||minutes<solar.dawn;},
  render:reading=>{liveAirReading=reading;updateAirQuality();}
 });
 document.addEventListener('visibilitychange',()=>globalThis.airQualityClient.tick());
 globalThis.airQualityClient.start();
}
