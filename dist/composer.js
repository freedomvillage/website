const settingsDialog=document.getElementById('scene-settings-dialog'),advancedDialog=document.getElementById('advanced-settings-dialog'),settingsButton=document.getElementById('scene-settings'),promptForm=document.getElementById('prompt-composer'),promptText=document.getElementById('prompt-text');
let settingsReturnFocus=null,airSummaryExpiry=null,switchingSettings=false;
function updateActualAirSummary(){
 const valid=typeof globalThis.validateCachedAirReading==='function'&&typeof liveAirReading!=='undefined'?globalThis.validateCachedAirReading(liveAirReading,Date.now()):null;
 document.getElementById('actual-air-summary').hidden=!valid;
 document.getElementById('actual-air-value').textContent=valid?valid.pm25+' µg/m³':'';
 const detail=document.getElementById('actual-air-detail');
 detail.textContent=valid?((valid.station?valid.station+' · ':'')+'Observed '+new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(valid.observedAt))+' KST · '+Math.floor((Date.now()-Date.parse(valid.observedAt))/60000)+' min ago. Less than one hour old.'):'';
 if(airSummaryExpiry!==null)clearTimeout(airSummaryExpiry);airSummaryExpiry=valid?setTimeout(updateActualAirSummary,Math.max(1,Date.parse(valid.validUntil)-Date.now())):null;
}
globalThis.updateActualAirSummary=updateActualAirSummary;
function updateAppearanceControls(){settingsDialog.querySelectorAll('[data-scene-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.value===appearanceMode)));document.getElementById('mode-note').textContent=globalThis.sceneClock?globalThis.sceneClock.note():appearanceMode==='clock'?'Seoul clock · updates every 15 minutes.':appearanceMode==='light'?'Always light: scene fixed at noon.':'Always dark: scene fixed at midnight.';updateSceneTime();updateActualAirSummary();}
settingsDialog.querySelectorAll('[data-scene-mode]').forEach(b=>b.addEventListener('click',()=>{if(setAppearanceMode(b.value))updateAppearanceControls()}));
function openSettingsDialog(dialog,closeId){dialog.showModal();document.body.classList.add('settings-open');document.getElementById(closeId).focus();updateActualAirSummary();}
settingsButton.addEventListener('click',()=>{closeMenu();settingsReturnFocus=document.activeElement;openSettingsDialog(settingsDialog,'settings-close');});
document.getElementById('open-advanced-settings').addEventListener('click',()=>{switchingSettings=true;settingsDialog.close();openSettingsDialog(advancedDialog,'advanced-settings-close');switchingSettings=false;});
for(const [dialog,closeId]of [[settingsDialog,'settings-close'],[advancedDialog,'advanced-settings-close']]){
 document.getElementById(closeId).addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{if(switchingSettings||settingsDialog.open||advancedDialog.open)return;document.body.classList.remove('settings-open');if(settingsReturnFocus?.isConnected)settingsReturnFocus.focus();else settingsButton.focus();});
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
 dialog.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const targets=[...dialog.querySelectorAll('button:not([hidden]),input:not([disabled]),a[href]')].filter(el=>el.getClientRects().length);const first=targets[0],last=targets.at(-1);if(!first)return;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}});
}
setInterval(()=>{if(settingsDialog.open)updateActualAirSummary();},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateActualAirSummary();});
function submitPrototype(event){event?.preventDefault();document.getElementById('composer-status').textContent=promptText.value.trim()?'Prototype only—nothing was sent. Your draft remains here.':'Write a question to try the layout. Nothing will be sent.';promptText.focus();}
promptForm.addEventListener('submit',submitPrototype);document.getElementById('prompt-submit').addEventListener('click',submitPrototype);
promptText.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!event.isComposing)submitPrototype(event)});
promptText.addEventListener('input',()=>{promptText.style.height='auto';promptText.style.height=Math.min(150,promptText.scrollHeight)+'px'});
function updateKeyboardOffset(){const v=window.visualViewport;const editing=document.activeElement===promptText;const offset=v&&editing?Math.max(0,window.innerHeight-v.height-v.offsetTop):0;document.documentElement.style.setProperty('--keyboard-offset',Math.round(offset)+'px');}
window.visualViewport?.addEventListener('resize',updateKeyboardOffset);window.visualViewport?.addEventListener('scroll',updateKeyboardOffset);promptText.addEventListener('focus',updateKeyboardOffset);promptText.addEventListener('blur',()=>{document.documentElement.style.setProperty('--keyboard-offset','0px')});
updateAppearanceControls();

// Reserve the actual overlay height, including expanded drafts; no scroll hijack.
function updateComposerClearance(){const height=promptForm.getBoundingClientRect().height;if(Number.isFinite(height)&&height>0)document.documentElement.style.setProperty('--composer-height',Math.ceil(height)+'px');}
if(typeof ResizeObserver==='function')new ResizeObserver(updateComposerClearance).observe(promptForm);
window.addEventListener?.('resize',updateComposerClearance);updateComposerClearance();
