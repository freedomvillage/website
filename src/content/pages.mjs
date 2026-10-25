import {privateNextRequest,publicCard,readCatalog,json,TOPICS,validCursor} from './catalog.mjs';
import {escape,cardPath,CORE_PAGES,renderLibraryCard,renderLibraryDetail} from './render.mjs';
import {renderFamilyContext,familyCollectionItems} from './families.mjs';
export {cardPath} from './render.mjs';
const ID=/^[a-z][a-z0-9-]{0,79}$/;
export function serializeBoot(value){return JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');}
function art(c,context){
 const crop=c.theme==='breakfast'?[1188,0,732,1080]:context==='detail'?[40,420,350,930]:[80,420,300,930],id='server-crop-'+c.id+'-'+context;
 return `<svg class="pilot-art" viewBox="${crop.join(' ')}" width="${crop[2]}" height="${crop[3]}" role="img" aria-label="${escape(c.theme==='breakfast'?'Coffee and breakfast illustration from the original announcement.':'Seoul tower photograph from the original announcement.')}"><defs><clipPath id="${id}" clipPathUnits="userSpaceOnUse"><rect x="${crop[0]}" y="${crop[1]}" width="${crop[2]}" height="${crop[3]}"/></clipPath></defs><image href="${escape(c.image.src)}" width="${c.image.width}" height="${c.image.height}" clip-path="url(#${id})"/></svg>`;
}
function facts(c){return `<div class="pilot-facts"><p class="pilot-date">${escape(c.date)}</p><p class="pilot-time">${escape(c.time)}</p><p class="pilot-venue">${escape(c.venue)}</p></div>`;}
export function renderCard(c,companions=[]){if(c.schemaVersion===2)return renderLibraryCard(c,'',2,Array.isArray(companions)?companions:[]);return `<article class="card pilot-card pilot-${c.theme}" id="card-${c.id}"><a class="pilot-card-link" href="${cardPath(c)}" aria-label="${escape(c.title)} — event details"><div class="pilot-copy"><h2>${escape(c.title)}</h2>${facts(c)}<p class="pilot-excerpt">${escape(c.summary)}</p><span class="pilot-detail-link">Event details ↗</span></div>${art(c,'card')}</a></article>`;}
export function renderDetail(c,related=[],embedded=[]){if(c.schemaVersion===2)return renderLibraryDetail(c,related,embedded);return `<article class="detail-shell pilot-detail pilot-${c.theme}"><a class="back" href="/">← Back</a><div class="pilot-detail-hero"><div class="pilot-detail-copy"><h1 tabindex="-1">${escape(c.title)}</h1>${facts(c)}${c.address?`<p class="pilot-address">${escape(c.address)}</p>`:''}${c.actions.length?`<nav class="detail-actions" aria-label="Event next steps">${c.actions.map(a=>`<a class="pilot-action" href="${escape(a.href)}"${a.href.startsWith('https:')?' target="_blank" rel="noopener noreferrer"':''}>${escape(a.label)}${a.href.startsWith('https:')?' ↗':''}</a>`).join('')}</nav>`:''}</div><figure class="pilot-detail-art">${art(c,'detail')}</figure></div><div class="detail-body">${c.detail.map(p=>`<p>${escape(p)}</p>`).join('')}</div></article>`;}
function mainHtml(catalog,card,message,related=[],embedded=[],listingPath=''){
 const content=message?`<article class="detail-shell"><h1>${escape(message.title)}</h1><p>${escape(message.text)}</p><a href="/">Return to cards</a></article>`:card?renderDetail(card,related,embedded):'';
 return `<main id="main" tabindex="-1"><section id="collection" data-topic="${escape(catalog.topic||'')}"${card||message?' hidden':''}><h1 class="${catalog.topic?'topic-title':'visually-hidden'}">${escape(TOPICS[catalog.topic]||'The Church at Freedom Village')}</h1>${renderFamilyContext(catalog,escape,listingPath)}<div class="collection-meta"><span id="collection-label"></span><span id="count" aria-live="polite"></span></div><div id="grid" class="grid server-content">${familyCollectionItems(catalog).map(c=>renderCard(c,catalog.items)).join('')}${!catalog.items.length&&!card&&!message?'<p class="empty-collection">No cards in this draft collection yet.</p>':''}</div>${catalog.nextCursor?`<a class="load-more" href="${catalog.topic?'/topics/'+catalog.topic:'/'}?after=${encodeURIComponent(catalog.nextCursor)}">More cards ↓</a>`:''}<footer><span>Private draft</span></footer></section><section id="detail"${!card&&!message?' hidden':''}>${content}</section></main>`;
}
export async function renderPageShell(request,env,catalog,card,status,message,related=[],mainOverride=null,embedded=[]){
 const asset=await env.ASSETS.fetch(new Request(new URL('/',request.url),{method:'GET'}));
 if(!asset.ok)throw new Error('Shell unavailable');
 let html=await asset.text();
 const title=message?.title||card?.title||TOPICS[catalog.topic]||'Freedom Village',description=card?.summary||'Private website draft for The Church at Freedom Village.';
 html=html.replace('<body>',card?'<body class="content-detail">':'<body>').replace('href="#main"',()=>`href="${escape(new URL(request.url).pathname)}#main"`).replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(title)} — The Church at Freedom Village</title>`)
 .replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${escape(description)}">`)
 .replace('<head>','<head><base href="/"><meta name="robots" content="noindex,nofollow"><meta property="og:type" content="website"><meta property="og:title" content="'+escape(title)+'"><meta property="og:description" content="'+escape(description)+'">')
 .replace(/<nav aria-label="Explore the community" id="filters"><\/nav>/,()=>`<nav aria-label="Explore the community" id="filters">${Object.entries(TOPICS).map(([id,label])=>`<a href="/topics/${id}"${catalog.topic===id?' aria-current="page"':''}>${escape(label)}</a>`).join('')}</nav>`)
 .replace(/<main id="main"[\s\S]*?<\/main>/,()=>mainOverride??mainHtml(catalog,card,message,related,embedded,new URL(request.url).pathname+new URL(request.url).search));
 const boot={...catalog,page:{path:new URL(request.url).pathname,status}};
 html=html.replace('<script src="content-view.js">',()=>`<script type="application/json" id="content-bootstrap">${serializeBoot(boot)}</script><script src="content-view.js">`)
 .replace('</head>','<noscript><style>#site-loading,.prompt-composer,.village-scene{display:none!important}html:not([data-site-revealed="true"]) body>:not(#site-loading){visibility:visible!important}.video-load,.motion-toggle,.video-player p{display:none!important}@media(max-width:700px){#menu-toggle,.drawer-close,#sidebar .brand{display:none!important}#sidebar{position:static!important;transform:none!important;width:auto!important;inset:auto!important;padding:0 20px 16px!important;background:transparent!important;border:0!important}#sidebar .sidebar-inner{max-height:none!important;overflow:visible!important}#filters{flex-direction:row;flex-wrap:wrap;gap:4px 16px}#filters a{min-height:44px;display:inline-flex;align-items:center;margin:0;padding:4px 0}}</style></noscript></head>');
 return new Response(request.method==='HEAD'?null:html,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'}});
}
export async function handleContentPage(request,env,{now=Date.now()}={}){
 if(!privateNextRequest(request,env))return json({error:'Not found'},404);
 if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405,{Allow:'GET, HEAD'});
 const url=new URL(request.url),path=url.pathname;
 if(path==='/robots.txt')return new Response(request.method==='HEAD'?null:'User-agent: *\nDisallow: /\n',{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});
 if(path==='/index.html'||(path.endsWith('/')&&Object.hasOwn(CORE_PAGES,path.slice(0,-1)))||(/^\/(events|cards)\/[a-z][a-z0-9-]{0,79}\/$/.test(path))){
  const to=path==='/index.html'?'/':path.slice(0,-1);return new Response(null,{status:308,headers:{Location:to,'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});
 }
 try{
  let catalog={status:'ok',schemaVersion:1,items:[],nextCursor:null},card=null,status=200,message=null,related=[],embedded=[];
  const after=url.searchParams.get('after')||'',topic=path.startsWith('/topics/')?path.slice(8):'';
  if(!validCursor(after)||[...url.searchParams.keys()].some(k=>k!=='after')||url.searchParams.getAll('after').length>1)return json({error:'Invalid query'},400);
  if(path==='/'||(topic&&Object.hasOwn(TOPICS,topic)))catalog=await readCatalog(env.CONTENT_DB,{now,after,topic});
  else if(Object.hasOwn(CORE_PAGES,path)||/^\/(events|cards)\/[a-z][a-z0-9-]{0,79}$/.test(path)){
   const row=await env.CONTENT_DB.prepare(`SELECT id,content_json FROM content_cards WHERE id=? AND status='draft' AND (expires_at IS NULL OR expires_at>?)`).bind(CORE_PAGES[path]||path.split('/')[2],new Date(now).toISOString()).first();
   card=row&&publicCard(row);if(card){
    if(path!==cardPath(card))return new Response(null,{status:308,headers:{Location:cardPath(card),'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});
    catalog.items=[card];
    const requested=[...new Set([...(card.related||[]),...(card.sections||[]).flatMap(s=>s.cardIds)])];
    if(requested.length){const rows=await env.CONTENT_DB.prepare(`SELECT id,content_json FROM content_cards WHERE id IN (${requested.map(()=>'?').join(',')}) AND status='draft' AND (expires_at IS NULL OR expires_at>?)`).bind(...requested,new Date(now).toISOString()).all();embedded=(rows.results||[]).map(publicCard).filter(c=>c&&c.schemaVersion===2&&c.id!==card.id);related=embedded.filter(c=>card.related?.includes(c.id)).sort((a,b)=>card.related.indexOf(a.id)-card.related.indexOf(b.id));}
   }else status=404;
  }else status=404;
  if(status===404)message={title:'Page not found',text:'This page is not available.'};
  return await renderPageShell(request,env,catalog,card,status,message,related,null,embedded);
 }catch{
  try{return await renderPageShell(request,env,{status:'unavailable',items:[],nextCursor:null},null,503,{title:'Content unavailable',text:'Please try again later.'});}
  catch{return new Response('Content unavailable',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});}
 }
}
