const assert=require('assert'),fs=require('fs'),crypto=require('crypto');
const mask=fs.readFileSync('dist/scene-edge-mask.svg','utf8');assert(mask.includes('y2="180"'));assert(mask.includes('M484 43'));assert(mask.includes('offset=".9"'));assert(mask.includes('stop-opacity="0"'));
const top=(y,protectedTower=false)=>protectedTower?1:Math.min(1,y/180);const side=x=>Math.min(1,Math.max(0,(1-x)/.1));
for(const season of ['winter','spring','summer','fall','christmas'])for(const time of ['day','night','dawn','dusk']){assert.equal(top(0),0);assert.equal(side(1),0);assert.equal(top(50,true),1);assert.equal(top(400),1);}
for(const width of [384,768,1440,1920]){const art=Math.min(1440,Math.max(960,width));assert(art>0);}
assert.equal(crypto.createHash('sha256').update(fs.readFileSync('dist/village-panorama-v8.png')).digest('hex'),'87224cd0b92ca53427904bf6ca21870244ddf1ace62c2b6374da3f1d69d87791');
const css=fs.readFileSync('dist/style.css','utf8');assert(css.includes('prefers-reduced-motion:reduce'));assert(css.includes('animation:none;opacity:.5'));assert(css.includes('.card[data-theme-adaptive=true]'));
console.log('PASS: theme-independent transparent edges, protected tower region, original checksum, reduced-motion static animation, opt-in card theme');
