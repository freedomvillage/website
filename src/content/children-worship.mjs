// Record-bound typography uses the source invitation itself, with no invented identity art.
const invitation=c=>c.summary.match(/^(.*\S)\s+(together[.!?]?)$/i);
const matches=c=>c.id==='children-in-worship'&&c.template==='faq'&&c.media===null&&c.categories.includes('families')&&c.detail.filter(p=>p!==c.summary).length>=2&&!c.sections?.length&&invitation(c);
function deck(c,escape){const [,lead,word]=invitation(c);return `<p class="worship-invitation"><span>${escape(lead)}</span> <strong class="worship-shared-word">${escape(word)}</strong></p>`;}
const actions=(c,h)=>c.actions.map(a=>`<a ${h.actionAttrs(a)}>${h.escape(a.label)} <span aria-hidden="true">↗</span></a>`).join('');
export function renderWorshipCard(c,h){
 if(!matches(c))return '';
 const {escape,cardPath,heading,domId}=h;
 return `<article class="card content-presentation worship-card" id="${domId}"><a class="worship-card-link" href="${cardPath(c)}"><p class="craft-kicker">Families</p><${heading}>${escape(c.title)}</${heading}>${h.facts(c)}${deck(c,escape)}<span class="worship-card-route">Read more <span aria-hidden="true">→</span></span></a>${c.actions.length?`<nav class="worship-actions" aria-label="Next steps">${actions(c,h)}</nav>`:''}</article>`;
}
export function renderWorshipDetail(c,related,h){
 if(!matches(c))return '';
 const {escape,renderCard}=h,prose=c.detail.filter(p=>p!==c.summary);
 return `<article class="detail-shell worship-detail" id="worship-reader"><a class="back" href="/topics/families">← Back</a><header class="worship-heading"><div><p class="craft-kicker">Families</p><h1 tabindex="-1">${escape(c.title)}</h1>${h.facts(c)}</div>${deck(c,escape)}</header><div class="worship-reading">${prose.map((p,i)=>`<p${i?' class="worship-response"':''}>${escape(p)}</p>`).join('')}</div>${c.actions.length?`<nav class="worship-actions" aria-label="Next steps">${actions(c,h)}</nav>`:''}</article>${related.length?`<section class="related-content" aria-labelledby="related-title"><h2 id="related-title">Related</h2><div class="related-grid">${related.map(c=>renderCard(c)).join('')}</div></section>`:''}`;
}
