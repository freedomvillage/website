/* Real Seoul clock; calendar season and holiday capture remain session-stable. */
(function(root){
 let manual=false;
 const now=()=>new Date(),minutes=d=>((d.getTime()/60000+540)%1440+1440)%1440;
 function syncSolarDate(){if(!appliedDateIsManual&&!manual&&appearanceMode==='clock'){appliedSolarDate=seoulDateAt(now());appliedSolarTimes=seoulSolarTimes(...appliedSolarDate);}}
 function note(){return appearanceMode==='light'?'Always light: fixed at noon.':appearanceMode==='dark'?'Always dark: fixed at midnight.':manual?'Manual time preview — paused. Return to Seoul clock to resume.':'Seoul clock · refreshed every 15 minutes and on return. Season and holidays stay at the page-load date.';}
 function controls(){const el=document.getElementById('mode-note');if(el)el.textContent=note();const advanced=document.getElementById('advanced-mode-note');if(advanced)advanced.textContent=note();const resume=document.getElementById('resume-clock');if(resume)resume.hidden=!manual||appearanceMode!=='clock';}
 function tick(){if(appearanceMode==='clock'&&!manual){sceneTime.value=String(Math.floor(minutes(now())));syncSolarDate();updateSceneTime();}controls();}
 function modeChanged(mode){if(mode==='clock')manual=false;tick();if(mode!=='clock')updateSceneTime();}
 root.sceneClock={tick,modeChanged,syncSolarDate,note,solarDate:()=>!manual&&appearanceMode==='clock'?seoulDateAt(now()):pageLoadDate};
 sceneTime.addEventListener('input',()=>{manual=true;controls();});
 document.getElementById('resume-clock')?.addEventListener('click',()=>{manual=false;tick();});
 // Clicking the already-selected Clock button also exits a manual slider override.
 document.querySelectorAll('[data-scene-mode]').forEach(r=>{if(r.value==='clock')r.addEventListener('click',()=>{manual=false;tick();});});
 setInterval(tick,15*60*1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
 root.addEventListener('pageshow',tick);root.addEventListener('focus',tick);
 tick();
})(globalThis);
