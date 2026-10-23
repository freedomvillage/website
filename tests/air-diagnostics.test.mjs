import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorker,CACHE_KEY} from '../src/worker.mjs';
import {DIAGNOSTIC_KEY,diagnostic,xmlCode,boundedBody} from '../src/air-diagnostics.mjs';
const now=Date.parse('2026-10-23T12:00:00Z');
const poison='SECRET_SENTINEL+key/== https://private.invalid/?serviceKey=SECRET_SENTINEL provider-freeform';
const payload=(row={})=>({response:{header:{resultCode:'00',resultMsg:poison},body:{items:[{stationName:'용산구',pm25Value:'0',dataTime:'2026-10-23 20:30',...row}]}}});
async function attempt(make){
 const data=new Map(),writes=[],logs=[];let calls=0;
 const env={AIR_ENABLED:'true',AIR_PRODUCER_ENABLED:'true',AIR_DEPLOYMENT_KIND:'production',AIRKOREA_SERVICE_KEY:poison,AIR_STATION:'용산구',AIR_CACHE:{get:async(k,type)=>{const v=data.get(k);return type==='json'&&v?JSON.parse(v):v??null},put:async(k,v,options)=>{writes.push({k,v,options});data.set(k,v)}}};
 const worker=createWorker({now:()=>now,fetchUpstream:async()=>{calls++;return make()}});
 const original={};for(const method of ['log','warn','error','info','debug']){original[method]=console[method];console[method]=(...args)=>logs.push(args)}
 try{await worker.scheduled({scheduledTime:now,cron:'*/15 * * * *'},env);await worker.scheduled({scheduledTime:now,cron:'*/15 * * * *'},env)}finally{Object.assign(console,original)}
 const publicBody=await(await worker.fetch(new Request('https://example.test/api/air-quality'),env)).text();
 assert.equal(calls,1);assert.deepEqual(logs,[]);
 assert(!JSON.stringify(writes).includes('SECRET_SENTINEL'));assert(!publicBody.includes('SECRET_SENTINEL'));
 const entry=writes.find(x=>x.k===DIAGNOSTIC_KEY);assert.equal(entry.options.expirationTtl,86400);
 const d=JSON.parse(entry.v);assert.deepEqual(Object.keys(d).sort(),['category','httpStatus','providerCode']);
 assert(!publicBody.includes('providerCode'));assert(!publicBody.includes('httpStatus'));
 assert.equal((await worker.fetch(new Request('https://example.test/api/air-quality/diagnostic'),env)).status,404);
 return {d,record:JSON.parse(data.get(CACHE_KEY))};
}
test('diagnostic boundary permits only fixed categories, integer statuses and exact codes',()=>{
 for(const code of ['00','01','04','05','10','12','20','22','23','29','30','31'])assert.equal(diagnostic('provider-error',200,code).providerCode,code);
 for(const code of ['99','30 '+poison,30,{resultCode:'30'},null])assert.equal(diagnostic(poison,poison,code).providerCode,null);
 assert.deepEqual(diagnostic(poison,poison,poison),{category:'transport',httpStatus:null,providerCode:null});
});
test('bounded XML code extraction never expands entities or accepts DTDs/attributes/freeform',()=>{
 assert.equal(xmlCode('<OpenAPI_ServiceResponse><returnReasonCode>30</returnReasonCode></OpenAPI_ServiceResponse>'),'30');
 for(const raw of ['<!DOCTYPE a [<!ENTITY x SYSTEM "https://private.invalid">]><resultCode>30</resultCode>','<resultCode>&x;</resultCode>','<resultCode x="30">30</resultCode>','<resultCode>99</resultCode>','<resultCode>'+poison+'</resultCode>','x'.repeat(65537)+'<resultCode>30</resultCode>'])assert.equal(xmlCode(raw),null);
});
test('stream bound cancels oversized body without accumulating it',async()=>{let canceled=false;const r=new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(65537))},cancel(){canceled=true}}));assert.equal(await boundedBody(r),null);assert(canceled)});
test('provider JSON result codes are allowlisted and no arbitrary body/message survives',async()=>{
 for(const code of ['30','99',poison]){const p=payload();p.response.header.resultCode=code;const {d}=await attempt(()=>Response.json(p));assert.equal(d.category,'provider-error');assert.equal(d.providerCode,code==='30'?'30':null)}
});
test('HTTP/XML, non-JSON, thrown exception and oversized response are safe and do not retry',async()=>{
 for(const [make,category,code,status] of [
 [()=>new Response('<returnReasonCode>30</returnReasonCode>'+poison,{status:403}),'http-error','30',403],
 [()=>new Response('<returnReasonCode>20</returnReasonCode>'+poison),'non-json','20',200],
 [()=>new Response(poison),'non-json',null,200],
 [()=>{throw Error(poison)},'transport',null,null],
 [()=>new Response(poison.repeat(1000)),'body-too-large',null,200]]){
 const {d,record}=await attempt(make);assert.deepEqual(d,{category,httpStatus:status,providerCode:code});assert.equal(record.pm25,null)}
});
test('schema categories distinguish missing/flagged PM2.5 and timestamp without changing fail-closed output',async()=>{
 const variants=[['schema-shape',{}],['empty-items',{response:{header:{resultCode:'00'},body:{items:[]}}}],['station-mismatch',payload({stationName:poison})],['pm25-missing',payload({pm25Value:null})],['pm25-flagged',payload({pm25Flag:poison})],['pm25-invalid',payload({pm25Value:poison})],['timestamp-invalid',payload({dataTime:poison})]];
 for(const [category,p] of variants){const {d,record}=await attempt(()=>Response.json(p));assert.equal(d.category,category);assert.equal(record.pm25,null)}
 const {d,record}=await attempt(()=>Response.json(payload()));assert.equal(d.category,'ok-or-reading-unknown');assert.equal(record.pm25,0);
});
test('diagnostic persistence failure is swallowed and never retries upstream',async()=>{
 let calls=0;const values=new Map();const env={AIR_ENABLED:'true',AIR_PRODUCER_ENABLED:'true',AIR_DEPLOYMENT_KIND:'production',AIRKOREA_SERVICE_KEY:poison,AIR_STATION:'용산구',AIR_CACHE:{get:async k=>values.get(k)??null,put:async(k,v)=>{if(k===DIAGNOSTIC_KEY)throw Error(poison);values.set(k,v)}}};
 const w=createWorker({now:()=>now,fetchUpstream:async()=>{calls++;return Response.json(payload())}});const event={scheduledTime:now,cron:'*/15 * * * *'};await w.scheduled(event,env);await w.scheduled(event,env);assert.equal(calls,1);assert.equal(JSON.parse(values.get(CACHE_KEY)).pm25,0);
});
