// Only the explicit appearance preference is persisted; never prompt content.
const MODE_COOKIE='fv_scene_mode';
function readAppearanceCookie(cookieText){const pair=String(cookieText||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(MODE_COOKIE+'='));if(!pair)return 'clock';try{const value=decodeURIComponent(pair.slice(MODE_COOKIE.length+1));return ['clock','light','dark'].includes(value)?value:'clock'}catch{return 'clock'}}
let appearanceMode=readAppearanceCookie(document.cookie);
function effectiveTimeMinutes(manual){return appearanceMode==='light'?720:appearanceMode==='dark'?0:Number(manual);}
function setAppearanceMode(mode){if(!['clock','light','dark'].includes(mode))return false;appearanceMode=mode;try{document.cookie=`${MODE_COOKIE}=${mode}; Max-Age=15552000; Path=/; SameSite=Lax; Secure`;}catch{/* UI still works if cookies are blocked. */}return true;}
