// Three record-bound display treatments. Canonical copy/actions and source files stay intact.
function kind(c){
 if(c.id==='johns-gospel'&&c.media?.kind==='image'&&c.media.src==='/media/johns-gospel.jpg'&&c.media.width===1080&&c.media.height===1080&&c.media.disclosure==='source-artwork')return 'teaching';
 if(c.id==='missional-families'&&c.media?.kind==='image'&&c.media.src==='/media/missional-families.jpg'&&c.media.width===1024&&c.media.height===769&&['private-draft','historical'].includes(c.media.disclosure))return 'community';
 if(c.id==='sunday-gatherings'&&c.media===null&&c.actions.some(a=>a.targetId==='visit-help'))return 'visit';
 return null;
}
export function renderCraftArt(c,escape){
 const type=kind(c);if(!type)return '';
 if(type==='visit')return '<svg class="craft-visit-mark" viewBox="50 148 65 70" aria-hidden="true" focusable="false"><image href="/church-horizontal-canva.png" width="548" height="365"/></svg>';
 const teaching=type==='teaching',view=teaching?'200 130 680 500':'0 300 850 400';
 const label=teaching?'Lamb illustration from the original John’s Gospel series cover.':c.media.alt;
 const disclosure=teaching?'Source artwork':c.media.disclosure==='historical'?'Archive photograph':'Private image draft';
 return `<figure class="library-image craft-${type}-art"><svg class="craft-art" viewBox="${view}" role="img" aria-label="${escape(label)}" focusable="false"><image href="${escape(c.media.src)}" width="${c.media.width}" height="${c.media.height}"/></svg><figcaption>${escape(disclosure)} · ${escape(c.media.caption)}</figcaption></figure>`;
}
export function renderCraftCard(c,{escape,cardPath,heading,domId}){
 const type=kind(c);if(!type)return '';
 const labels={teaching:'Teaching series',visit:'Gather with us',community:'Life together'},reveals={teaching:'Watch or listen',visit:'Plan your visit',community:'Life in a Missional Family'};
 const actions=c.actions.map(a=>`<a href="${escape(a.targetId?cardPath({id:a.targetId}):a.href)}"${!a.targetId&&a.href.startsWith('https:')?' target="_blank" rel="noopener noreferrer"':''}>${escape(a.label)}</a>`).join('');
 const facts=c.facts.length?`<div class="library-facts craft-facts">${c.facts.map(v=>`<p>${escape(v)}</p>`).join('')}</div>`:'';
 const paragraphs=type==='teaching'?'':c.detail.filter(p=>p!==c.summary).slice(0,2).map(p=>`<p>${escape(p)}</p>`).join('');
 const reveal=actions||paragraphs?`<details class="craft-reveal"><summary>${reveals[type]}</summary><div class="craft-reveal-body">${paragraphs}${actions?`<div class="craft-links">${actions}</div>`:''}</div></details>`:'';
 const art=renderCraftArt(c,escape);
 return `<article class="card library-card craft-card craft-${type} theme-${c.design.theme} size-${c.design.size}" id="${domId}">${type!=='visit'?art:''}<div class="craft-copy"><div class="craft-heading"><p class="craft-kicker">${labels[type]}</p>${type==='visit'?art:''}</div><${heading}><a href="${cardPath(c)}">${escape(c.title)}</a></${heading}>${facts}<p class="craft-excerpt">${escape(c.summary)}</p>${reveal}</div></article>`;
}
