// Structured source content only: no stored HTML, script or arbitrary styling is rendered.
export const escape=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export const CORE_PAGES=Object.freeze({'/connect':'connect-card','/give':'giving-overview','/prayer':'prayer-and-praise','/resources':'church-resources'});
export const cardPath=c=>Object.entries(CORE_PAGES).find(([,id])=>id===c.id)?.[0]||(c.template==='event'?'/events/':'/cards/')+c.id;
const actionHref=a=>a.targetId?cardPath({id:a.targetId}):a.href;
const actionAttrs=a=>`href="${escape(actionHref(a))}"${!a.targetId&&a.href.startsWith('https:')?' target="_blank" rel="noopener noreferrer"':''}`;
function motif(name){
 const shapes={star:'<path d="M100 6c6 57 31 82 88 88-57 6-82 31-88 88-6-57-31-82-88-88C69 88 94 63 100 6Z"/>',hills:'<path d="M-30 180Q40 30 110 130T250 100V230H-30Z"/><path d="M-20 210Q80 95 170 185T260 130V240H-20Z" opacity=".35"/>',rings:'<circle cx="100" cy="100" r="76" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="100" cy="100" r="52" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="100" cy="100" r="28" fill="none" stroke="currentColor" stroke-width="2"/>'};
 return shapes[name]?`<svg class="library-motif" viewBox="0 0 200 200" aria-hidden="true" focusable="false">${shapes[name]}</svg>`:'';
}
function genericArt(c,detail=false){
 if(c.media?.kind==='image'){
  const m=c.media,label={synthetic:'Concept artwork · synthetic portraits',historical:'Archive photograph','private-draft':'Private image draft','source-artwork':'Source artwork'}[m.disclosure];
  return `<figure class="library-image"><div class="library-image-frame" style="aspect-ratio:${m.ratio.replace(':','/')}"><img src="${escape(m.src)}" alt="${escape(m.alt)}" width="${m.width}" height="${m.height}" loading="lazy" decoding="async" style="object-fit:${m.fit};object-position:${m.focalPoint.x}% ${m.focalPoint.y}%"></div><figcaption>${escape(label)} · ${escape(m.caption)}</figcaption></figure>`;
 }
 if(c.media?.kind==='brand')return `<div class="library-brand-art"><img src="${escape(c.media.src)}" alt="${escape(c.media.alt)}" loading="lazy" decoding="async"></div>`;
 if(c.media?.kind==='youtube')return `<div class="library-sermon-art" aria-hidden="true"><span>▶</span>${motif('rings')}</div>`;
 return motif(c.design.motif);
}
const genericFacts=c=>c.facts.length?`<div class="library-facts">${c.facts.map(v=>`<p>${escape(v)}</p>`).join('')}</div>`:'';
const motionControl=c=>c.design.motion==='gradient'?'<button class="motion-toggle" type="button" aria-pressed="false" aria-label="Pause background animation" hidden>Pause animation</button>':'';
export function renderLibraryCard(c,namespace='',headingLevel=2){
 const heading=headingLevel===3?'h3':'h2';
 namespace=typeof namespace==='string'?namespace:'';
 const domId=escape((namespace?namespace+'-':'')+'card-'+c.id);
 if(['actions','utility'].includes(c.template))return `<article class="card library-card practical-card theme-${c.design.theme}" id="${domId}"><div class="library-copy"><${heading}><a href="${cardPath(c)}">${escape(c.title)}</a></${heading}><p class="library-excerpt">${escape(c.summary)}</p></div><div class="practical-actions">${c.actions.map(a=>`<a ${actionAttrs(a)}>${escape(a.label)} <span aria-hidden="true">↗</span></a>`).join('')}</div></article>`;
 const motion=c.design.motion==='gradient',art=genericArt(c);
 return `<article class="card library-card theme-${c.design.theme} layout-${c.design.layout} size-${c.design.size}${motion?' has-motion':''}" id="${domId}"><a class="library-card-link" href="${cardPath(c)}"><div class="library-copy"><${heading}>${escape(c.title)}</${heading}>${genericFacts(c)}<p class="library-excerpt">${escape(c.summary)}</p></div>${art}</a>${motionControl(c)}</article>`;
}
function authoredSections(c,embedded){
 const cards=new Map(embedded.map(card=>[card.id,card]));
 return (c.sections||[]).map((section,index)=>{
  const headingId='section-'+c.id+'-'+index;
  const chosen=section.cardIds.map(id=>cards.get(id)).filter(Boolean);
  return `<section class="authored-section" aria-labelledby="${headingId}"><h2 id="${headingId}">${escape(section.heading)}</h2>${section.paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}${section.links.length?`<ul class="reference-links">${section.links.map(a=>`<li><a ${actionAttrs(a)}>${escape(a.label)}</a></li>`).join('')}</ul>`:''}${chosen.length?`<div class="related-grid authored-card-set">${chosen.map(card=>renderLibraryCard(card,'embedded-'+c.id+'-'+index,3)).join('')}</div>`:''}</section>`;
 }).join('');
}
export function renderLibraryDetail(c,related=[],embedded=[]){
 const video=c.media?.kind==='youtube'?`<div class="video-player" data-video="${c.media.videoId}"><button type="button" class="video-load" data-video-title="${escape(c.media.title)}">▶ Load video</button><p>Video loads from YouTube when selected.</p><a href="https://www.youtube.com/watch?v=${c.media.videoId}" target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a></div>`:'';
 return `<article class="detail-shell library-detail theme-${c.design.theme}${c.design.motion==='gradient'?' has-motion':''}${c.media?.kind==='image'?' has-image':''}${c.media?.disclosure==='source-artwork'?' has-source-artwork':''}"><a class="back" href="/">← Back</a><header class="library-detail-heading"><div><h1 tabindex="-1">${escape(c.title)}</h1>${genericFacts(c)}</div>${genericArt(c,true)}</header>${motionControl(c)}<div class="detail-body">${c.detail.map(p=>`<p>${escape(p)}</p>`).join('')}${authoredSections(c,embedded)}${video}${c.actions.map(a=>`<a class="pilot-action" ${actionAttrs(a)}>${escape(a.label)} ↗</a>`).join('')}</div></article>${related.length?`<section class="related-content" aria-labelledby="related-title"><h2 id="related-title">Related</h2><div class="related-grid">${related.map(renderLibraryCard).join('')}</div></section>`:''}`;
}
