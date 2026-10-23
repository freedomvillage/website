// Cloudflare workerd regression. Uses Wrangler's installed Miniflare; all outbound
// requests are intercepted locally. No credentials, provider calls or remote KV.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
const root=fileURLToPath(new URL('../',import.meta.url));
const entry=`import {createWorker} from './src/worker.mjs';
const now=Date.parse('2026-10-23T12:00:00Z');
export default {async fetch(){
 const data=new Map();const env={AIR_ENABLED:'true',AIR_PRODUCER_ENABLED:'true',AIR_DEPLOYMENT_KIND:'production',AIRKOREA_SERVICE_KEY:'RUNTIME_FIXTURE_ONLY+not/real=',AIR_STATION:'용산구',AIR_CACHE:{get:async k=>data.get(k)??null,put:async(k,v)=>data.set(k,v)}};
 const worker=createWorker({now:()=>now});
 await worker.scheduled({scheduledTime:now,cron:'*/15 * * * *'},env);
 return Response.json({diagnostic:JSON.parse(data.get('air-quality:diagnostic:v1')),reading:JSON.parse(data.get('air-quality:latest:v1'))});
}};`;
test('workerd manual redirect supports provider fetch but never follows authenticated redirects',async()=>{
 const modules=[{type:'ESModule',path:root+'runtime-entry.mjs',contents:entry}];
 for(const path of ['src/worker.mjs','src/seoul-night.mjs','src/air-diagnostics.mjs'])modules.push({type:'ESModule',path:root+path,contents:await readFile(root+path,'utf8')});
 for(const mode of ['success','redirect','unsupported-error-control']){
  let calls=0;
  const source=modules.map(m=>({...m,contents:mode==='unsupported-error-control'&&m.path.endsWith('/worker.mjs')?m.contents.replace("redirect:'manual'","redirect:'error'"):m.contents}));
  const options={modules:source,modulesRoot:root,compatibilityDate:'2026-10-23',outboundService:request=>{
   calls++;assert.equal(new URL(request.url).hostname,'apis.data.go.kr');
   if(mode==='redirect')return new Response('ignored',{status:302,headers:{Location:'https://never-follow.invalid/'}});
   return Response.json({response:{header:{resultCode:'00',resultMsg:'RUNTIME_FIXTURE_ONLY'},body:{items:[{stationName:'용산구',pm25Value:'0',dataTime:'2026-10-23 20:30'}]}}});
  }};
  const mf=new Miniflare(convertV4MiniflareOptions?convertV4MiniflareOptions(options):options);
  try{
   const text=await(await mf.dispatchFetch('https://local.test/')).text();assert(!text.includes('RUNTIME_FIXTURE_ONLY'));
   const result=JSON.parse(text);
   if(mode==='success'){assert.equal(calls,1);assert.equal(result.reading.pm25,0);assert.equal(result.diagnostic.category,'ok-or-reading-unknown')}
   if(mode==='redirect'){assert.equal(calls,1);assert.equal(result.reading.pm25,null);assert.deepEqual(result.diagnostic,{category:'http-error',httpStatus:302,providerCode:null})}
   if(mode==='unsupported-error-control'){assert.equal(calls,0);assert.deepEqual(result.diagnostic,{category:'transport',httpStatus:null,providerCode:null})}
  }finally{await mf.dispose()}
 }
});
