// Subject-bound composition; content and inquiry destinations remain canonical.
const SOURCE='https://cdn.prod.website-files.com/60e0035471e8115799a8640b/64e0f1446e4ab5692426f843_Village-Youth-Logo.svg';
const matches=c=>c.id==='village-youth'&&c.template==='ministry'&&c.media?.kind==='brand'&&c.media.src===SOURCE&&c.detail.filter(p=>p!==c.summary).length>=2&&c.actions.length&&!c.sections?.length;
export function renderYouthDetail(c,related,h){
 if(!matches(c))return '';
 const {escape,renderCard,actionAttrs}=h,prose=c.detail.filter(p=>p!==c.summary);
 const actions=()=>c.actions.map(a=>`<a ${actionAttrs(a)}>${escape(a.label)} <span aria-hidden="true">↗</span></a>`).join('');
 return `<article class="detail-shell youth-detail${c.design.motion==='gradient'?' has-motion':''}" id="youth-reader">
 <a class="back" href="/topics/families">← Back</a>
 <header class="youth-hero"><div class="library-brand-art youth-identity"><img src="/village-youth-source.svg" alt="${escape(c.media.alt)}" width="2200" height="2200" decoding="async"></div><div class="youth-hero-copy"><h1 tabindex="-1">${escape(c.title)}</h1>${h.facts(c)}<p>${escape(c.summary)}</p><nav class="youth-hero-actions" aria-label="Youth inquiry">${actions()}</nav></div></header>
 <section class="youth-reading" aria-labelledby="youth-reading-title"><h2 id="youth-reading-title">Faith in everyday life</h2><div>${prose.slice(0,1).map(p=>`<p>${escape(p)}</p>`).join('')}</div></section>
 <section class="youth-inquiry" aria-labelledby="youth-inquiry-title"><div><h2 id="youth-inquiry-title">Ask about joining</h2>${prose.slice(1).map(p=>`<p>${escape(p)}</p>`).join('')}</div><nav aria-label="Youth next steps">${actions()}</nav></section>
 </article>${related.length?`<section class="related-content" aria-labelledby="related-title"><h2 id="related-title">Related</h2><div class="related-grid">${related.map(card=>renderCard(card)).join('')}</div></section>`:''}`;
}
