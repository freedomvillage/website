// Deterministic, code-native artwork fitted to existing spring tree crowns.
// Never changes the approved raster paintings. Regenerate embedded SVG with this script.
const fs=require('node:fs');let seed=4096;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
const crowns=[
 [49,690,34,36],[158,689,43,41],[336,671,42,43],[633,684,48,37],
 [677,697,47,29],[855,682,49,40],[1020,646,33,31],[1139,713,36,20],
 [1490,711,39,21],[1678,709,46,24],[1740,691,39,30],[1820,610,48,35],
 [2122,606,43,39],[2158,540,18,29]
];
const groups=Array.from({length:8},()=>[]);
for(const [cx,cy,rx,ry]of crowns){for(let i=0;i<104;i++){
 const angle=rnd()*Math.PI*2,r=Math.sqrt(rnd())*.98,x=cx+Math.cos(angle)*rx*r,y=cy+Math.sin(angle)*ry*r;
 const scale=1.15+rnd()*2.1,rotation=rnd()*360,level=i%8;
 // Irregular scalloped paint dabs, not circular particles; clusters follow tree crowns.
 groups[level].push(`<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotation.toFixed(1)}) scale(${scale.toFixed(2)})" d="M-.1-1.2C.3-1.65.82-1.35.81-.86C1.6-1 1.65-.18 1.05.12C1.65.69.96 1.2.4.95C.25 1.7-.6 1.4-.63.9C-1.42 1.1-1.62.28-.97-.02C-1.65-.6-1-1.23-.52-.91Z" fill="var(--blossom-petal,#fffdf0)" stroke="var(--blossom-edge,#b8b4a4)" stroke-width=".075" opacity="${(.5+rnd()*.37).toFixed(2)}"/>`);
}}
const svg=`<svg id="holyweek-overlay" class="holyweek-overlay" viewBox="0 0 2172 724" aria-hidden="true" style="--blossom-visible:0"><defs><filter id="blossom-softness" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation=".15"/></filter><linearGradient id="banner-fold" x1="0" x2="1"><stop stop-color="#fff" stop-opacity=".05"/><stop offset=".35" stop-color="#000" stop-opacity=".15"/><stop offset=".65" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient></defs><g class="holyweek-flowers" filter="url(#blossom-softness)">${groups.map((p,i)=>`<g style="opacity:var(--blossom-step-${i},0)">${p.join('')}</g>`).join('')}</g><g class="easter-banner" style="opacity:var(--easter-banner,0)" transform="matrix(1 -.06 0 1 253 404)"><path d="M0 0Q32 2 65 .6T130 0L130 32Q99 34 64 32.5T0 32Z" fill="var(--banner-purple,#654374)" stroke="var(--banner-edge,#45334f)" stroke-width=".8"/><path d="M0 0Q32 2 65 .6T130 0L130 32Q99 34 64 32.5T0 32Z" fill="url(#banner-fold)"/><path d="M3 3L127 3M3 29L127 29" stroke="var(--banner-gold,#e4c77e)" stroke-opacity=".65" stroke-width=".7"/><path d="M1 1L-3-4M129 1L133-4M1 31L-3 35M129 31L133 35" stroke="var(--banner-edge,#45334f)" stroke-width="1"/><text x="65" y="21" text-anchor="middle" fill="var(--banner-gold,#e4c77e)" font-family="Georgia,serif" font-weight="bold" font-size="12.5" letter-spacing=".8">HE IS RISEN</text></g></svg>`;
const p='dist/index.html',html=fs.readFileSync(p,'utf8');const block=`<!-- Holy Week artwork start -->${svg}<!-- Holy Week artwork end -->`;const updated=html.includes('<!-- Holy Week artwork start -->')?html.replace(/<!-- Holy Week artwork start -->[\s\S]*?<!-- Holy Week artwork end -->/,block):html.replace('<svg class="ambient-lights"',block+'<svg class="ambient-lights"');fs.writeFileSync(p,updated);if(process.env.HOLYWEEK_QA_SVG)fs.writeFileSync(process.env.HOLYWEEK_QA_SVG,svg);console.log('Generated',crowns.length,'tree-localized clusters;',groups.flat().length,'irregular flower dabs');
