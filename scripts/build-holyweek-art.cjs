// Deterministic, code-native artwork fitted to existing spring tree crowns.
// Never changes the approved raster paintings. Regenerate embedded SVG with this script.
const fs=require('node:fs');let seed=4096;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
const crowns=[
 [49,690,34,36],[158,689,43,41],[336,671,42,43],[633,684,48,37],
 [677,697,47,29],[855,682,49,40],[1020,646,33,31],[1139,713,36,20],
 [1490,711,39,21],[1678,709,46,24],[1740,691,39,30],[1820,610,48,35],
 [2122,606,43,39],[2158,540,18,29]
];
// Green broadleaf crowns: foreground only, kept inside foliage and clear of facades.
// More contrast than pale cherry trees; leave trunks/branch gaps exposed.
const greenCrowns=[
 [477,615,27,31,'green'],[548,678,34,37,'green'],[759,671,30,37,'green'],
 [951,674,29,36,'green'],[1240,683,29,37,'green'],[1585,682,24,31,'green'],
 [1978,666,27,36,'green'],[1850,547,24,30,'green'],
 [246,605,24,25,'green'],[403,634,23,31,'green'],[622,588,25,29,'green'],
 [1341,709,28,14,'green'],[1782,653,24,28,'green'],[2070,496,22,29,'green']
];
const greenRamp=[3,12,28,52,84,124,172,224];
const cherryRamp=[6,16,32,54,82,116,154,196];
const palette=['petal','petal','pink','pink','lavender','yellow'];
const petalColor=(patch=0)=>{const key=rnd()<.23?'petal':palette[Math.abs(Math.floor(patch))%palette.length];return 'var(--blossom-'+key+','+{petal:'#fffdf0',pink:'#e396ac',lavender:'#aa92d0',yellow:'#edcb78'}[key]+')'};
// Three asymmetric brush silhouettes and compressed/rotated petals avoid circular polka dots.
const brushShapes=['M-1.5-.8Q-.4-1.9 .2-.7L1.7-1Q1.3.1 .5.4L.2 1.7Q-.7.7-.8.2L-1.8.4Z','M-1.6-.4L-.4-1.5Q.4-1.2.2-.2L1.5-.6Q1.8.5.4.7L-.7 1.4Q-.3.1-1.6-.4Z','M-1.5-1.2Q.1-1.4.3-.3L1.6.1Q1.2 1.2.2.5L-.4 1.7Q-1.4.8-.7.2Z'];
const brush=()=>brushShapes[Math.floor(rnd()*brushShapes.length)];
const groups=Array.from({length:8},()=>[]);
for(const [cx,cy,rx,ry,kind]of [...crowns,...greenCrowns]){const green=kind==='green';const patches=Array.from({length:9},(_,n)=>{const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*.7;return [cx+Math.cos(a)*rx*r,cy+Math.sin(a)*ry*r,n+Math.floor(cx/70)]});for(let i=0;i<(green?224:196);i++){
 const patch=patches[i%patches.length],angle=rnd()*Math.PI*2,r=Math.sqrt(rnd()),x=patch[0]+Math.cos(angle)*rx*.33*r,y=patch[1]+Math.sin(angle)*ry*.30*r;
 const level=(green?greenRamp:cherryRamp).findIndex(count=>i<count),scale=((green?1.0:.95)+rnd()*2.5)*(1+level*.055),rotation=rnd()*360;
 // Irregular scalloped paint dabs, not circular particles; clusters follow tree crowns.
 groups[level].push(`<path${green?' data-crown="green"':''} transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotation.toFixed(1)}) scale(${scale.toFixed(2)} ${(.5+rnd()*.6).toFixed(2)*scale})" d="${brush()}" fill="${petalColor(patch[2])}" stroke="var(--blossom-edge,#b8b4a4)" stroke-width=".075" opacity="${(.3+level*.045+rnd()*.37).toFixed(2)}"/>`);
}}
// Exterior corners, cage posts and fence rails only: never windows or banner.
const vines=[[397,559,443],[245,449,386],[460,487,411],[134,480,350]];
for(const [vx,bottom,top]of vines){for(let day=0;day<8;day++){
 const y1=bottom+(top-bottom)*day/8,y2=bottom+(top-bottom)*(day+1)/8,bend=day%2?4.5:-3.5;
 let vine=`<g data-vine="exterior"><path d="M${vx} ${y1}Q${vx+bend} ${(y1+y2)/2} ${vx} ${y2}" fill="none" stroke="var(--vine-stem,#596b48)" stroke-width="1.1" stroke-linecap="round"/>`;
 for(let j=0;j<5;j++){const y=y1+(y2-y1)*rnd(),side=rnd()>.5?1:-1,x=vx+side*(1+rnd()*3.6);
 vine+=`<path d="M${vx} ${y+2}Q${vx+side*6} ${y+1} ${vx+side*4} ${y-3}Q${vx+side*.5} ${y-2} ${vx} ${y+2}Z" fill="var(--vine-leaf,#758959)" opacity=".9"/>`;
 if(day>=3||(day+j)%3===0)vine+=`<path transform="translate(${x} ${y}) rotate(${rnd()*360}) scale(${(1.1+day*.14+rnd()*1.7).toFixed(2)} ${(.8+rnd()*1.4).toFixed(2)})" d="${brush()}" fill="${petalColor(Math.floor(vx/80)+Math.floor(day/3))}" opacity="${.45+day*.045+rnd()*.2}" stroke="var(--blossom-edge,#b8b4a4)" stroke-width=".08"/>`;
 }
 groups[day].push(vine+'</g>');
}}
// Flowering rails follow cage/retaining-fence perspective, with clear text above.
for(const [x1,y1,x2,y2]of [[250,449,393,449],[397,451,460,484],[1900,595,2110,532]]){
 for(let day=0;day<8;day++){const t1=day/8,t2=(day+1)/8,ax=x1+(x2-x1)*t1,ay=y1+(y2-y1)*t1,bx=x1+(x2-x1)*t2,by=y1+(y2-y1)*t2;
 let vine=`<g data-vine="rail"><path d="M${ax} ${ay}Q${(ax+bx)/2} ${(ay+by)/2+7} ${bx} ${by}" fill="none" stroke="var(--vine-stem,#596b48)" stroke-width="1.4"/>`;
 for(let j=0;j<7;j++){const t=rnd(),x=ax+(bx-ax)*t,y=ay+(by-ay)*t,dy=(rnd()-.5)*12;
 vine+=`<path d="M${x} ${y}q-5 ${dy} -1 ${dy*2}q6 -2 1 ${-dy*2}" fill="var(--vine-leaf,#758959)" opacity=".85"/>`;
 if(day>1||j%3===0)vine+=`<path transform="translate(${x} ${y+dy}) rotate(${rnd()*360}) scale(${1+day*.14+rnd()*2} ${.7+day*.1+rnd()*1.5})" d="${brush()}" fill="${petalColor(Math.floor(x1/70)+Math.floor(day/3))}" opacity="${.45+day*.045+rnd()*.2}"/>`;
 }groups[day].push(vine+'</g>');
 }
}
const svg=`<svg id="holyweek-overlay" class="holyweek-overlay" viewBox="0 0 2172 724" aria-hidden="true" style="--blossom-visible:0"><defs><filter id="blossom-softness" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation=".32"/></filter><linearGradient id="banner-fold" x1="0" x2="1"><stop stop-color="#fff" stop-opacity=".05"/><stop offset=".35" stop-color="#000" stop-opacity=".15"/><stop offset=".65" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient></defs><g class="holyweek-flowers" filter="url(#blossom-softness)">${groups.map((p,i)=>`<g style="opacity:var(--blossom-step-${i},0)">${p.join('')}</g>`).join('')}</g><g class="easter-banner" style="opacity:var(--easter-banner,0)" transform="matrix(1 -.06 0 1 253 404)"><path d="M0 0Q32 2 65 .6T130 0L130 32Q99 34 64 32.5T0 32Z" fill="var(--banner-purple,#654374)" stroke="var(--banner-edge,#45334f)" stroke-width=".8"/><path d="M0 0Q32 2 65 .6T130 0L130 32Q99 34 64 32.5T0 32Z" fill="url(#banner-fold)"/><path d="M3 3L127 3M3 29L127 29" stroke="var(--banner-gold,#e4c77e)" stroke-opacity=".65" stroke-width=".7"/><path d="M1 1L-3-4M129 1L133-4M1 31L-3 35M129 31L133 35" stroke="var(--banner-edge,#45334f)" stroke-width="1"/><text x="65" y="21" text-anchor="middle" fill="var(--banner-gold,#e4c77e)" font-family="Georgia,serif" font-weight="bold" font-size="12.5" letter-spacing=".8">HE IS RISEN</text></g></svg>`;
const p='dist/index.html',html=fs.readFileSync(p,'utf8');const block=`<!-- Holy Week artwork start -->${svg}<!-- Holy Week artwork end -->`;const updated=html.includes('<!-- Holy Week artwork start -->')?html.replace(/<!-- Holy Week artwork start -->[\s\S]*?<!-- Holy Week artwork end -->/,block):html.replace('<svg class="ambient-lights"',block+'<svg class="ambient-lights"');fs.writeFileSync(p,updated);if(process.env.HOLYWEEK_QA_SVG)fs.writeFileSync(process.env.HOLYWEEK_QA_SVG,svg);console.log('Generated',crowns.length+greenCrowns.length,'tree-localized clusters;',groups.flat().length,'irregular flower dabs');
