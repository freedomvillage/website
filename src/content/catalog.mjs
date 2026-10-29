import {prototypeCopy} from './prototype-copy.mjs';
// Private next-site experiment, not a public publication or final authoring schema.
export const PAGE_SIZE=24;
export const MAX_MEDIA_BYTES=8*1024*1024;
const ID=/^[a-z][a-z0-9-]{0,79}$/;
const text=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
const imagePath=/^\/media\/([a-z][a-z0-9-]{0,79})\.(png|jpg|jpeg|webp|avif)$/;
function safeLink(v){
 if(!text(v,2048)||/[\u0000-\u0020\u007f]/.test(v))return false;
 try{const u=new URL(v);if(u.protocol==='https:')return !u.username&&!u.password;
  if(u.protocol!=='mailto:'||!/^[-a-zA-Z0-9.!#$%&'*+/=?^_`{|}~]+@[-a-zA-Z0-9.]+\.[a-zA-Z]{2,}$/.test(u.pathname)||u.hash)return false;
  return [...u.searchParams.keys()].every(k=>k==='subject')&&u.searchParams.getAll('subject').length<=1&&(u.searchParams.get('subject')||'').length<=200&&!/[\r\n\u0000]/.test(u.searchParams.get('subject')||'');
 }catch{return false;}
}
const validAction=a=>text(a?.label,80)&&((typeof a.targetId==='string'&&ID.test(a.targetId)&&a.href===undefined)||(a.targetId===undefined&&safeLink(a.href)));
const projectAction=a=>a.targetId?{label:a.label,targetId:a.targetId}:{label:a.label,href:a.href};
const categories=new Set(['events','families','community','faith','prayer','watch-listen','next-steps']);
const designs=new Set(['paper','ink','forest','clay','youth','outline','sermon']);
export const normalizePriority=value=>Number.isSafeInteger(value)&&value>=0&&value<=100?value:50;
const fallbackDesign=Object.freeze({theme:'paper',layout:'text',motif:'none',motion:'none',size:'regular'});
function validDesign(d){return designs.has(d?.theme)&&['text','date','brand','graphic','image'].includes(d?.layout)&&['none','star','hills','rings'].includes(d?.motif)&&['none','gradient'].includes(d?.motion)&&['regular','feature'].includes(d?.size);}
const sourceAsset=v=>{try{const u=new URL(v);return u.origin==='https://cdn.prod.website-files.com'&&u.pathname.startsWith('/60e0035471e8115799a8640b/')&&/\.(png|jpe?g|webp|svg)$/i.test(u.pathname)&&!u.search&&!u.hash;}catch{return false;}};
function versionTwo(row,c){
 if(!ID.test(row.id)||c.hold===true||c.isSynthetic!==false||c.sourceStatus!=='draft'||
 !['actions','prayer','give','help','utility','media','resource-hub','event','story','ministry','resource','sermon','next-step','faq','group','gathering','opportunity','identity','beliefs'].includes(c.template)||
 !text(c.title,160)||!text(c.summary,600)||!Array.isArray(c.detail)||c.detail.length<1||c.detail.length>12||!c.detail.every(p=>text(p,2000))||
 !Array.isArray(c.facts)||c.facts.length>6||!c.facts.every(p=>text(p,160))||
 !Array.isArray(c.categories)||c.categories.length<1||c.categories.length>7||!c.categories.every(x=>categories.has(x))||new Set(c.categories).size!==c.categories.length||
 !Array.isArray(c.actions)||c.actions.length>6||!c.actions.every(validAction)||
 !Array.isArray(c.related)||c.related.length>6||!c.related.every(x=>ID.test(x)))return null;
 if(['actions','utility'].includes(c.template)&&c.actions.length===0)return null;
 let sections=[];
 if(c.sections!==undefined){
  if(!Array.isArray(c.sections)||c.sections.length>10)return null;
  for(const s of c.sections){
   if(!text(s?.heading,160)||!Array.isArray(s.paragraphs)||s.paragraphs.length<1||s.paragraphs.length>3||!s.paragraphs.every(p=>text(p,1600))||
    !Array.isArray(s.links)||s.links.length>12||!s.links.every(validAction)||!Array.isArray(s.cardIds)||s.cardIds.length>4||!s.cardIds.every(id=>ID.test(id)&&id!==row.id)||new Set(s.cardIds).size!==s.cardIds.length)return null;
   sections.push({heading:s.heading,paragraphs:[...s.paragraphs],links:s.links.map(projectAction),cardIds:[...s.cardIds]});
  }
  if(new Set(sections.flatMap(s=>s.cardIds)).size>16)return null;
 }
 let media=null;
 if(c.media!==null&&c.media!==undefined){
  if(c.media?.kind==='brand'&&sourceAsset(c.media.src)&&text(c.media.alt,300))media={kind:'brand',src:c.media.src,alt:c.media.alt};
  else if(c.media?.kind==='youtube'&&/^[A-Za-z0-9_-]{11}$/.test(c.media.videoId)&&text(c.media.title,160))media={kind:'youtube',videoId:c.media.videoId,title:c.media.title};
  else if(c.media?.kind==='image'&&imagePath.exec(c.media.src||'')?.[1]===row.id&&text(c.media.alt,300)&&text(c.media.caption,200)&&
   Number.isSafeInteger(c.media.width)&&c.media.width>0&&c.media.width<=12000&&Number.isSafeInteger(c.media.height)&&c.media.height>0&&c.media.height<=12000&&
   ['private-draft','historical','synthetic','source-artwork'].includes(c.media.disclosure)&&['contain','cover'].includes(c.media.fit)&&['1:1','4:3','3:2','16:9'].includes(c.media.ratio)&&
   ['x','y'].every(k=>typeof c.media.focalPoint?.[k]==='number'&&Number.isFinite(c.media.focalPoint[k])&&c.media.focalPoint[k]>=0&&c.media.focalPoint[k]<=100))
   media={kind:'image',src:c.media.src,alt:c.media.alt,caption:c.media.caption,width:c.media.width,height:c.media.height,disclosure:c.media.disclosure,fit:c.media.fit,ratio:c.media.ratio,focalPoint:{x:c.media.focalPoint.x,y:c.media.focalPoint.y}};
  else return null;
 }
 const presentationFallback=!validDesign(c.design)||(c.design.layout==='image'&&media?.kind!=='image');
 const design=presentationFallback?fallbackDesign:c.design;
 return {id:row.id,schemaVersion:2,template:c.template,title:c.title,summary:c.summary,detail:[...c.detail],facts:[...c.facts],...(sections.length?{sections}:{}),
 categories:[...c.categories],actions:c.actions.map(projectAction),related:[...c.related],media,
 design:{theme:design.theme,layout:design.layout,motif:design.motif,motion:design.motion,size:design.size},...(presentationFallback?{presentationFallback:true}:{}),homePriority:normalizePriority(c.homePriority),isSynthetic:false};
}
export function publicCard(row){
 let c;try{c=JSON.parse(row.content_json);}catch{return null;}
 if(c?.hold===true||c?.isSynthetic===true)return null;
 if(c?.schemaVersion===2){const projected=versionTwo(row,c);return projected?prototypeCopy(projected):null;}
 if(!ID.test(row.id)||c?.schemaVersion!==1||c.template!=='event'||!text(c.title,160)||!text(c.summary,600)||
 !text(c.date,80)||!text(c.time,80)||!text(c.venue,160)||(c.address!==null&&!text(c.address,200))||
 !['breakfast','city'].includes(c.theme)||!Array.isArray(c.detail)||c.detail.length>8||!c.detail.every(p=>text(p,2000))||
 !Array.isArray(c.actions)||c.actions.length>3||!c.actions.every(a=>text(a?.label,80)&&safeLink(a.href))||
 !imagePath.test(c.image?.src)||imagePath.exec(c.image.src)[1]!==row.id||!text(c.image.alt,300)||
 !Number.isSafeInteger(c.image.width)||!Number.isSafeInteger(c.image.height)||c.image.width<1||c.image.height<1)return null;
 // Staff/editorial/provenance fields never leave D1. No spreading stored documents.
 return {id:row.id,schemaVersion:1,template:'event',title:c.title,summary:c.summary,date:c.date,time:c.time,
 venue:c.venue,address:c.address,detail:[...c.detail],theme:c.theme,
 image:{src:c.image.src,alt:c.image.alt,width:c.image.width,height:c.image.height},actions:c.actions.map(a=>({label:a.label,href:a.href}))};
}
export function json(body,status=200,extra={}){return new Response(JSON.stringify(body),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex',...extra}});}
export function privateNextRequest(request,env){
 // Verified Cloudflare Access authenticates all paths. This additional origin guard
 // is not a replacement for Access JWT verification. Alternate Worker URLs stay disabled.
 return env.CONTENT_PILOT_ENABLED==='true'&&new URL(request.url).hostname==='next.freedomvillage.church'&&Boolean(request.headers.get('Cf-Access-Jwt-Assertion'));
}
export const TOPICS=Object.freeze({events:'Coming up',families:'Families',community:'Life together',faith:'Faith & belief',prayer:'Prayer','watch-listen':'Watch & listen','next-steps':'Next steps'});
export function validCursor(value){if(value==='')return true;const m=/^(\d{1,3}):([a-z][a-z0-9-]{0,79})$/.exec(value);return Boolean(m&&Number(m[1])<=100);}
export async function readCatalog(db,{after='',topic='',now=Date.now()}={}){
 if(!validCursor(after)||(topic!==''&&!Object.hasOwn(TOPICS,topic)))throw new TypeError('Invalid query');
 const [rank,id]=after?after.split(':'):['101',''];
 // Match normalizePriority exactly, before pagination. A cast would accept
 // numeric strings/fractions and let out-of-range values escape the cursor.
 const value="json_extract(content_json,'$.homePriority')";
 const order=`CASE WHEN json_type(content_json,'$.homePriority') IN ('integer','real') AND ${value} BETWEEN 0 AND 100 AND ${value}=CAST(${value} AS INTEGER) THEN CAST(${value} AS INTEGER) ELSE 50 END`;
 const result=await db.prepare(`SELECT id,content_json,${order} AS sort_rank FROM content_cards WHERE status='draft'
 AND (expires_at IS NULL OR expires_at>?) AND COALESCE(json_extract(content_json,'$.hold'),0)=0
 AND COALESCE(json_extract(content_json,'$.isSynthetic'),0)=0
 AND (?='' OR EXISTS(SELECT 1 FROM json_each(content_json,'$.categories') WHERE value=?) OR (?='events' AND json_extract(content_json,'$.schemaVersion')=1))
 AND (${order}<? OR (${order}=? AND id>?)) ORDER BY sort_rank DESC,id LIMIT ?`)
 .bind(new Date(now).toISOString(),topic,topic,topic,Number(rank),Number(rank),id,PAGE_SIZE+1).all();
 if(!Array.isArray(result.results))throw new Error('Content unavailable');
 const page=result.results.slice(0,PAGE_SIZE),last=page.at(-1);
 return {status:'ok',schemaVersion:1,items:page.map(publicCard).filter(Boolean),topic,
 nextCursor:result.results.length>PAGE_SIZE?`${last.sort_rank??50}:${last.id}`:null};
}
export async function readRankingCatalog(db,now){
 const cards=[],ids=new Set(),cursors=new Set();let after='';
 for(let page=0;page<32;page++){
  const result=await readCatalog(db,{after,now});
  for(const card of result.items){if(ids.has(card.id))throw Error('Duplicate catalog ID');ids.add(card.id);cards.push(card);}
  if(cards.length>256)throw Error('Catalog limit');
  if(!result.nextCursor)return cards;
  if(cursors.has(result.nextCursor))throw Error('Repeated cursor');
  cursors.add(result.nextCursor);after=result.nextCursor;
 }
 throw Error('Catalog limit');
}
export async function handleCatalogRequest(request,env,{now=Date.now()}={}){
 if(!privateNextRequest(request,env))return json({error:'Not found'},404);
 if(request.method!=='GET')return json({error:'Method not allowed'},405,{Allow:'GET'});
 const u=new URL(request.url),after=u.searchParams.get('after')||'',topic=u.searchParams.get('topic')||'';
 if(!validCursor(after)||(topic!==''&&!Object.hasOwn(TOPICS,topic))||[...u.searchParams.keys()].some(k=>!['after','topic'].includes(k))||u.searchParams.getAll('after').length>1||u.searchParams.getAll('topic').length>1)return json({error:'Invalid request'},400);
 try{return json(await readCatalog(env.CONTENT_DB,{after,topic,now}));}catch{return json({status:'unavailable',items:[]},503);}
}
export async function handleMediaRequest(request,env,{now=Date.now()}={}){
 if(!privateNextRequest(request,env))return json({error:'Not found'},404);
 if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405,{Allow:'GET, HEAD'});
 const u=new URL(request.url),match=imagePath.exec(u.pathname);if(!match||u.search)return json({error:'Not found'},404);
 try{
 const row=await env.CONTENT_DB.prepare(`SELECT id,content_json FROM content_cards WHERE id=? AND status='draft' AND (expires_at IS NULL OR expires_at>?)`).bind(match[1],new Date(now).toISOString()).first();
 const card=row&&publicCard(row);if(!card||(card.image?.src!==u.pathname&&(card.media?.kind!=='image'||card.media.src!==u.pathname)))return json({error:'Not found'},404);
 const object=await env.CONTENT_MEDIA[request.method==='HEAD'?'head':'get'](u.pathname.slice('/media/'.length));if(!object)return json({error:'Not found'},404);
 if(!Number.isSafeInteger(object.size)||object.size<0||object.size>MAX_MEDIA_BYTES){await object.body?.cancel();return json({error:'Media unavailable'},413);}
 const types={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',avif:'image/avif'};
 return new Response(request.method==='HEAD'?null:object.body,{headers:{'Content-Type':types[match[2]],'Content-Length':String(object.size),
 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex','Cross-Origin-Resource-Policy':'same-origin'}});
 }catch{return json({error:'Media unavailable'},503);}
}
