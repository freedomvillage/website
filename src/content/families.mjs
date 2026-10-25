// Record-bound composition; prose, facts, destinations and eligibility remain canonical.
const KIDS_SOURCE='https://cdn.prod.website-files.com/60e0035471e8115799a8640b/615a16d6ad04b5b28a15036a_Freedom-Kids-Logo.png';
const kids=c=>c.id==='freedom-kids'&&c.media?.kind==='brand'&&c.media.src===KIDS_SOURCE&&c.sections?.length;
const godly=c=>c.id==='godly-play'&&c.template==='faq'&&c.media?.kind==='brand'&&c.media.src===KIDS_SOURCE&&c.detail.filter(p=>p!==c.summary).length>=2&&!c.sections?.length;
// Contextual parent only; never changes stored related IDs, catalog membership or ranking.
export const familyDetailIds=c=>godly(c)?['freedom-kids']:[];
const family=c=>c.id==='families-growing-together'&&c.sections?.length&&c.actions.some(a=>a.targetId==='freedom-kids');
const children=['freedom-kids','junior-village','village-youth'];
// Presentation metadata merges appended pages without changing canonical catalog cursors or Jev order.
export function familyCollectionPriority(c){
 const lead=['families-growing-together',...children],support=['sunday-gatherings','visit-help'];
 return lead.includes(c.id)?lead.indexOf(c.id):support.includes(c.id)?100+support.indexOf(c.id):10;
}
export function familyCollectionItems(catalog){
 return catalog.topic==='families'?[...catalog.items].sort((a,b)=>familyCollectionPriority(a)-familyCollectionPriority(b)):catalog.items;
}
const logo='<img class="kids-source-mark" src="/freedom-kids-source.png" width="398" height="216" alt="" loading="lazy" decoding="async">';
function action(a,{escape,cardPath}){return `<a href="${escape(a.targetId?cardPath({id:a.targetId}):a.href)}"${!a.targetId&&a.href.startsWith('https:')?' target="_blank" rel="noopener noreferrer"':''}>${escape(a.label)} <span aria-hidden="true">↗</span></a>`;}
export function renderFamilyContext(catalog,escape,path='/topics/families'){
 if(catalog.topic!=='families')return '';
 const parent=catalog.items.find(family);if(!parent)return '';
 const chosen=children.map(id=>catalog.items.find(c=>c.id===id)).filter(Boolean);
 return `<header class="collection-context family-context"><div><p class="family-context-lead">${escape(parent.summary)}</p>${parent.sections[0].paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}</div>${chosen.length?`<nav aria-label="Find your place in Families">${chosen.map(c=>`<a href="${escape(path)}#card-${c.id}">${escape(c.title)} <span aria-hidden="true">↓</span></a>`).join('')}</nav>`:''}</header>`;
}
export function renderFamilyCard(c,h){
 const {escape,heading,domId,cardPath}=h;
 if(family(c))return `<article class="card content-presentation family-entry size-feature" id="${domId}"><div class="family-entry-heading"><p class="craft-kicker">Families</p><${heading}><a href="${cardPath(c)}">${escape(c.title)}</a></${heading}>${h.facts(c)}<p>${escape(c.summary)}</p><a class="family-entry-route" href="/topics/families">Explore Families <span aria-hidden="true">→</span></a></div><ul class="family-paths">${c.actions.map(a=>`<li>${action(a,h)}</li>`).join('')}</ul></article>`;
 if(godly(c))return `<article class="card content-presentation godly-card" id="${domId}"><a class="godly-card-link" href="${cardPath(c)}"><p class="craft-kicker">${escape(c.media.alt)}</p><${heading}>${escape(c.title)}</${heading}>${h.facts(c)}<p class="godly-card-deck">${escape(c.summary)}</p><span class="godly-card-route">Read the explanation <span aria-hidden="true">→</span></span></a></article>`;
 if(!kids(c))return '';
 return `<article class="card content-presentation kids-card" id="${domId}"><header><a class="kids-brand-link" href="${cardPath(c)}">${logo}<${heading} class="visually-hidden">${escape(c.title)}</${heading}></a>${h.facts(c)}<p class="kids-card-deck">${escape(c.summary)}</p></header><details class="craft-reveal kids-wonder"><summary>${escape(c.sections[0].heading)}</summary>${c.sections[0].paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}<a href="${cardPath(c)}">Explore ${escape(c.title)} <span aria-hidden="true">→</span></a></details></article>`;
}
export function renderGodlyDetail(c,related,embedded,h){
 if(!godly(c))return '';
 const {escape,cardPath,renderCard}=h,parent=embedded.find(p=>kids(p)),prose=c.detail.filter(p=>p!==c.summary);
 return `<article class="detail-shell godly-detail" id="godly-play-reader"><a class="back" href="/topics/families">← Back</a><header class="godly-heading"><div><p class="craft-kicker">${escape(c.media.alt)}</p><h1 tabindex="-1">${escape(c.title)}</h1>${h.facts(c)}</div>${logo}</header><p class="godly-intro">${escape(c.summary)}</p><div class="godly-reading"><section class="godly-story" aria-labelledby="godly-story-title"><h2 id="godly-story-title">Story and wonder</h2><div>${prose.slice(0,1).map(p=>`<p>${escape(p)}</p>`).join('')}</div></section><section class="godly-exploration" aria-labelledby="godly-exploration-title"><h2 id="godly-exploration-title">Time to explore</h2><div>${prose.slice(1).map(p=>`<p>${escape(p)}</p>`).join('')}</div></section></div>${c.actions.length?`<nav class="godly-actions" aria-label="Next steps">${c.actions.map(a=>action(a,h)).join('')}</nav>`:''}${parent?`<section class="godly-parent" aria-labelledby="godly-parent-title"><div><p class="craft-kicker">Keep exploring</p><h2 id="godly-parent-title">${escape(parent.title)}</h2><p>${escape(parent.summary)}</p></div><a href="${cardPath(parent)}">Explore ${escape(parent.title)} <span aria-hidden="true">→</span></a></section>`:''}</article>${related.length?`<section class="related-content" aria-labelledby="related-title"><h2 id="related-title">Related</h2><div class="related-grid">${related.map(card=>renderCard(card)).join('')}</div></section>`:''}`;
}
export function renderKidsDetail(c,related,embedded,h){
 if(!kids(c))return '';
 const {escape,cardPath,renderCard}=h,byId=new Map(embedded.map(c=>[c.id,c])),sectionId=i=>'kids-'+c.id+'-'+i;
 const questions=related.filter(c=>['godly-play','children-in-worship'].includes(c.id)),others=related.filter(c=>!questions.includes(c));
 return `<article class="detail-shell kids-detail"><a class="back" href="/topics/families">← Back</a><header class="kids-heading"><div><p class="craft-kicker">Families</p><h1 tabindex="-1">${escape(c.title)}</h1>${h.facts(c)}<p class="kids-intro">${escape(c.summary)}</p></div>${logo}</header><div class="kids-reading"><nav class="kids-contents" aria-label="On this page">${c.sections.map((s,i)=>`<a href="${cardPath(c)}#${sectionId(i)}">${escape(s.heading)}</a>`).join('')}</nav><div class="kids-story">${c.detail.filter(p=>p!==c.summary).map(p=>`<p>${escape(p)}</p>`).join('')}${c.sections.map((s,i)=>`<section class="kids-chapter" aria-labelledby="${sectionId(i)}"><h2 id="${sectionId(i)}" tabindex="-1">${escape(s.heading)}</h2>${s.paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}${s.links.length?`<div class="kids-source-links">${s.links.map(a=>action(a,h)).join('')}</div>`:''}${s.cardIds.length?`<div class="related-grid">${s.cardIds.map(id=>byId.get(id)).filter(Boolean).map(card=>renderCard(card,'kids-'+c.id+'-'+i,3)).join('')}</div>`:''}</section>`).join('')}</div></div>${questions.length?`<section class="kids-questions" aria-labelledby="kids-questions-title"><h2 id="kids-questions-title">Questions and next steps</h2>${questions.map(q=>`<details class="kids-question"><summary>${escape(q.title)}</summary>${h.facts(q)}${q.detail.map(p=>`<p>${escape(p)}</p>`).join('')}${q.actions.map(a=>action(a,h)).join('')}<a href="${cardPath(q)}">Read more <span class="visually-hidden">about ${escape(q.title)}</span> →</a></details>`).join('')}</section>`:''}<footer class="kids-next"><p>Keep exploring</p><div>${c.actions.map(a=>action(a,h)).join('')}<a href="/topics/families">Explore Families →</a></div></footer></article>${others.length?`<section class="related-content" aria-labelledby="related-title"><h2 id="related-title">Related</h2><div class="related-grid">${others.map(c=>renderCard(c)).join('')}</div></section>`:''}`;
}
