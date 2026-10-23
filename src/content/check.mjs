import {readCatalog,privateNextRequest,json} from './catalog.mjs';
import {rankPublishedCards} from './jev.mjs';
const CHECK='two-card-jev-v1',QUERY='I would like to join the men for breakfast in November.';
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function page(result){const attempted=!['not-run','unconfigured','invalid-catalog'].includes(result.status);return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Private ranking check</title><h1>Private ranking check</h1><h2>${attempted?'Submitted query':'Query to submit'}</h2><blockquote>${escape(QUERY)}</blockquote><p>One sample request using existing credits. Reopening this page does not call Jev.</p>${attempted?'':'<form method="post"><button>Run the one-time sample</button></form>'}<h2>Result</h2><pre>${escape(JSON.stringify(result,null,2))}</pre></html>`,{headers:{
 'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
 'Content-Security-Policy':"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",'X-Robots-Tag':'noindex'}});}
export async function handleJevCheck(request,env){
 if(!privateNextRequest(request,env))return json({error:'Not found'},404);
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405,{Allow:'GET, POST'});
 if(request.method==='POST'&&request.headers.get('Origin')!=='https://next.freedomvillage.church')return json({error:'Invalid origin'},403);
 try{
 const existing=await env.CONTENT_DB.prepare('SELECT result_json FROM content_checks WHERE id=?').bind(CHECK).first();
 if(existing)return page(existing.result_json?JSON.parse(existing.result_json):{status:'pending-or-interrupted',attempted:true});
 if(request.method==='GET')return page({status:'not-run'});
 if(env.JEV_ENABLED!=='true'||!env.TYPESAFE_API_KEY)return page({status:'unconfigured',attempted:false});
 const cards=(await readCatalog(env.CONTENT_DB)).items;if(cards.length<1||cards.length>12)return page({status:'invalid-catalog',attempted:false});
 // Atomic D1 claim bounds this diagnostic to one call, including concurrent POSTs.
 const claim=await env.CONTENT_DB.prepare('INSERT OR IGNORE INTO content_checks(id,created_at) VALUES(?,?)').bind(CHECK,new Date().toISOString()).run();
 if(claim.meta?.changes!==1)return page({status:'already-attempted'});
 const result=await rankPublishedCards(QUERY,cards,env);
 await env.CONTENT_DB.prepare('UPDATE content_checks SET result_json=? WHERE id=?').bind(JSON.stringify(result),CHECK).run();return page(result);
 }catch{return json({status:'unavailable'},503);}
}
