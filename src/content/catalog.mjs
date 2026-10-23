// Private next-site experiment, not a public publication or final authoring schema.
export const PAGE_SIZE=24;
const ID=/^[a-z][a-z0-9-]{0,79}$/;
const text=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
const imagePath=/^\/media\/([a-z][a-z0-9-]{0,79})\.(png|jpg|jpeg|webp|avif)$/;
function safeLink(v){if(!text(v,2048)||/[\u0000-\u0020\u007f]/.test(v))return false;try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}
export function publicCard(row){
 let c;try{c=JSON.parse(row.content_json);}catch{return null;}
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
export async function readCatalog(db,{after='',now=Date.now()}={}){
 if(after!==''&&!ID.test(after))throw new TypeError('Invalid cursor');
 const result=await db.prepare(`SELECT id,content_json FROM content_cards WHERE status='draft'
 AND (expires_at IS NULL OR expires_at>?) AND id>? ORDER BY id LIMIT ?`).bind(new Date(now).toISOString(),after,PAGE_SIZE+1).all();
 if(!Array.isArray(result.results))throw new Error('Content unavailable');
 const page=result.results.slice(0,PAGE_SIZE);return {status:'ok',schemaVersion:1,items:page.map(publicCard).filter(Boolean),nextCursor:result.results.length>PAGE_SIZE?page.at(-1).id:null};
}
export async function handleCatalogRequest(request,env,{now=Date.now()}={}){
 if(!privateNextRequest(request,env))return json({error:'Not found'},404);
 if(request.method!=='GET')return json({error:'Method not allowed'},405,{Allow:'GET'});
 const u=new URL(request.url),after=u.searchParams.get('after')||'';
 if((after!==''&&!ID.test(after))||[...u.searchParams.keys()].some(k=>k!=='after')||u.searchParams.getAll('after').length>1)return json({error:'Invalid request'},400);
 try{return json(await readCatalog(env.CONTENT_DB,{after,now}));}catch{return json({status:'unavailable',items:[]},503);}
}
export async function handleMediaRequest(request,env,{now=Date.now()}={}){
 if(!privateNextRequest(request,env))return json({error:'Not found'},404);
 if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405,{Allow:'GET, HEAD'});
 const u=new URL(request.url),match=imagePath.exec(u.pathname);if(!match||u.search)return json({error:'Not found'},404);
 try{
 const row=await env.CONTENT_DB.prepare(`SELECT id,content_json FROM content_cards WHERE id=? AND status='draft' AND (expires_at IS NULL OR expires_at>?)`).bind(match[1],new Date(now).toISOString()).first();
 const card=row&&publicCard(row);if(!card||card.image.src!==u.pathname)return json({error:'Not found'},404);
 const object=await env.CONTENT_MEDIA[request.method==='HEAD'?'head':'get'](u.pathname.slice('/media/'.length));if(!object)return json({error:'Not found'},404);
 const types={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',avif:'image/avif'};
 return new Response(request.method==='HEAD'?null:object.body,{headers:{'Content-Type':types[match[2]],'Content-Length':String(object.size),
 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex','Cross-Origin-Resource-Policy':'same-origin'}});
 }catch{return json({error:'Media unavailable'},503);}
}
