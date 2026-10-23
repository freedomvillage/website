// Private, finite design comparisons. Study definitions never join the content/ranking pool.
import {privateNextRequest,publicCard,json} from './catalog.mjs';
import {escape,renderLibraryCard} from './render.mjs';
import {renderPageShell} from './pages.mjs';
const ID=/^[a-z][a-z0-9-]{0,79}$/;
const text=(s,n)=>typeof s==='string'&&s.trim()&&s.length<=n;
export function validStudy(s){
 if(s?.version!==1||s.isDesignStudy!==true||!text(s.title,160)||!text(s.summary,600)||!Array.isArray(s.alternatives)||s.alternatives.length<2||s.alternatives.length>3)return false;
 const names=new Set(),ids=new Set();
 for(const a of s.alternatives){
  if(!ID.test(a?.id||'')||names.has(a.id)||!text(a.label,100)||!text(a.description,400)||!Array.isArray(a.groups)||!a.groups.length||a.groups.length>4)return false;names.add(a.id);
  for(const g of a.groups){if(!text(g?.title,120)||!Array.isArray(g.cardIds)||!g.cardIds.length||g.cardIds.length>6||new Set(g.cardIds).size!==g.cardIds.length||!g.cardIds.every(id=>typeof id==='string'&&ID.test(id)))return false;for(const id of g.cardIds)ids.add(id);}
 }
 return ids.size<=24;
}
function studyHtml(s,cards){
 const byId=new Map(cards.map(c=>[c.id,c]));
 return `<main id="main" tabindex="-1"><section id="collection"><header class="study-heading"><a href="/">← Return to cards</a><p class="study-label">Private draft comparison</p><h1>${escape(s.title)}</h1><p>${escape(s.summary)}</p><nav aria-label="Compare alternatives">${s.alternatives.map(a=>`<a href="/studies/${s.slug}#study-${a.id}">${escape(a.label)}</a>`).join('')}</nav></header>${s.alternatives.map(a=>`<section class="design-alternative" id="study-${a.id}" aria-labelledby="study-title-${a.id}"><header><h2 id="study-title-${a.id}">${escape(a.label)}</h2><p>${escape(a.description)}</p></header>${a.groups.map((g,i)=>`<section class="study-group" aria-labelledby="study-${a.id}-group-${i}"><h3 id="study-${a.id}-group-${i}">${escape(g.title)}</h3><div class="related-grid study-grid">${g.cardIds.map(id=>byId.get(id)).filter(Boolean).map(c=>renderLibraryCard(c,'study-'+a.id+'-'+i)).join('')}</div></section>`).join('')}</section>`).join('')}<div id="grid" hidden></div></section><section id="detail" hidden></section></main>`;
}
export async function handleStudyRequest(request,env,{now=Date.now()}={}){
 if(!privateNextRequest(request,env))return json({error:'Not found'},404);
 if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405,{Allow:'GET, HEAD'});
 const url=new URL(request.url),m=/^\/studies\/([a-z][a-z0-9-]{0,79})(\/?)$/.exec(url.pathname);
 if(!m||url.search)return json({error:'Not found'},404);
 if(m[2])return new Response(null,{status:308,headers:{Location:'/studies/'+m[1],'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});
 try{
  const row=await env.CONTENT_DB.prepare('SELECT result_json FROM content_checks WHERE id=?').bind('design-study:'+m[1]).first();
  if(typeof row?.result_json!=='string'||row.result_json.length>16000)return json({error:'Not found'},404);
  const study=JSON.parse(row.result_json);if(!validStudy(study))return json({error:'Not found'},404);
  const ids=[...new Set(study.alternatives.flatMap(a=>a.groups.flatMap(g=>g.cardIds)))];
  const rows=await env.CONTENT_DB.prepare(`SELECT id,content_json FROM content_cards WHERE id IN (${ids.map(()=>'?').join(',')}) AND status='draft' AND (expires_at IS NULL OR expires_at>?)`).bind(...ids,new Date(now).toISOString()).all();
  const cards=(rows.results||[]).map(publicCard).filter(c=>c?.schemaVersion===2);
  return await renderPageShell(request,env,{status:'ok',items:[],nextCursor:null},null,200,{title:study.title,text:study.summary},[],studyHtml({...study,slug:m[1]},cards));
 }catch{return json({error:'Study unavailable'},503);}
}
