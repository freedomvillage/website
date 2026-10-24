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
 const image=`<svg class="craft-art" viewBox="${view}" role="img" aria-label="${escape(label)}" focusable="false"><image href="${escape(c.media.src)}" width="${c.media.width}" height="${c.media.height}"/></svg>`;
 return `<figure class="library-image craft-${type}-art">${teaching?`<div class="craft-teaching-window">${image}</div>`:image}<figcaption>${escape(disclosure)} · ${escape(c.media.caption)}</figcaption></figure>`;
}
function actions(c,{escape,cardPath}){
 return c.actions.map(a=>`<a href="${escape(a.targetId?cardPath({id:a.targetId}):a.href)}"${!a.targetId&&a.href.startsWith('https:')?' target="_blank" rel="noopener noreferrer"':''}>${escape(a.label)}</a>`).join('');
}
function seriesPlayer(c,escape){
 let id;for(const action of c.actions){try{const u=new URL(action.href);const candidate=u.searchParams.get('list');if(u.origin==='https://www.youtube.com'&&u.pathname==='/playlist'&&/^PL[A-Za-z0-9_-]{8,78}$/.test(candidate||'')){id=candidate;break;}}catch{}}
 return id?`<div class="craft-series" data-series="${escape(id)}"><button class="series-load" type="button" data-series-title="${escape(c.title)}" hidden>Load the series here</button><p>YouTube loads when selected.</p></div>`:'';
}
function reveal(c,label,helpers,includeDetail=true){
 const links=actions(c,helpers),player=includeDetail?'':seriesPlayer(c,helpers.escape),paragraphs=includeDetail?c.detail.filter(p=>p!==c.summary).slice(0,2).map(p=>`<p>${helpers.escape(p)}</p>`).join(''):'';
 return links||paragraphs?`<details class="craft-reveal"><summary>${label}</summary><div class="craft-reveal-body">${player}${paragraphs}${links?`<div class="craft-links">${links}</div>`:''}</div></details>`:'';
}
const title=(c,{heading,cardPath,escape})=>`<${heading}><a href="${cardPath(c)}">${escape(c.title)}</a></${heading}>`;
const attrs=(c,type,domId)=>`class="card content-presentation presentation-${type} size-${c.design.size}${type==='teaching'?' has-motion':''}"${type==='teaching'?' data-art-entrance="true"':''} id="${domId}"`;
export function renderCraftCard(c,helpers){
 const type=kind(c);if(!type)return '';
 const {escape,domId}=helpers,art=renderCraftArt(c,escape);
 // Column-sized units share only semantics/sizing. Each type owns its composition.
 if(type==='teaching')return `<article ${attrs(c,type,domId)}>${art}<header class="teaching-type"><p class="craft-kicker">Teaching series</p>${title(c,helpers)}<p class="teaching-deck">${escape(c.summary)}</p></header>${reveal(c,'Watch here or listen',helpers,false)}</article>`;
 if(type==='visit')return `<article ${attrs(c,type,domId)}><div class="visit-rail">${art}<div class="visit-invitation"><p class="craft-kicker">Gather with us</p>${c.facts.length?`<div class="library-facts visit-time">${c.facts.map(v=>`<p>${escape(v)}</p>`).join('')}</div>`:''}${title(c,helpers)}<p class="visit-deck">${escape(c.summary)}</p>${reveal(c,'Plan your visit',helpers)}</div></div></article>`;
 return `<article ${attrs(c,type,domId)}><div class="community-collage">${art}<div class="community-type"><p class="craft-kicker">Life together</p>${title(c,helpers)}<p class="community-deck">${escape(c.summary)}</p>${reveal(c,'Life in a Missional Family',helpers)}</div></div></article>`;
}
