// Only intercepted Cloudflare identity responses; no real session credentials.
import test from 'node:test';import assert from 'node:assert/strict';
import {resolveIntentOwner} from '../src/content/intent-owner.mjs';
const ACCOUNT='9fa36317f1547f0da1fbcf97fc2529f6',UUID_A='11111111-1111-4111-8111-111111111111',UUID_B='22222222-2222-4222-8222-222222222222';
const request=(cookie='CF_Authorization=fixture.payload.signature')=>new Request('https://next.freedomvillage.church/api/content/intent',{headers:{Cookie:cookie,'Cf-Access-Authenticated-User-Email':'spoofed@example.invalid'}});
test('ownership comes from the existing Access identity service, never spoofable email headers',async()=>{
 let calls=0;const fetchIdentity=async(url,options)=>{calls++;assert.equal(url,'https://next.freedomvillage.church/cdn-cgi/access/get-identity');assert.equal(options.redirect,'manual');assert.equal(options.cache,'no-store');assert.equal(options.headers.Cookie,'CF_Authorization=fixture.payload.signature');assert.equal(Object.keys(options.headers).length,2);return Response.json({account_id:ACCOUNT,user_uuid:UUID_A,email:'PRIVATE_EMAIL',ip:'PRIVATE_IP'});};
 const owner=await resolveIntentOwner(request('other=PRIVATE_COOKIE; CF_Authorization=fixture.payload.signature'),{fetchIdentity});assert.match(owner,/^[a-f0-9]{64}$/);assert(!owner.includes(UUID_A));assert(!owner.includes('PRIVATE'));assert.equal(calls,1);
 assert.equal(await resolveIntentOwner(request(),{fetchIdentity}),owner);
 const other=await resolveIntentOwner(request(),{fetchIdentity:async()=>Response.json({account_id:ACCOUNT,user_uuid:UUID_B})});assert.notEqual(other,owner);
});
test('missing/ambiguous session, redirects, wrong account, service tokens and malformed identity fail closed',async()=>{
 for(const cookie of ['', 'other=value','CF_Authorization=not-a-token','CF_Authorization=a.b.c; CF_Authorization=d.e.f','CF_Authorization='+('x'.repeat(9000))+'.b.c']){
  let calls=0;assert.equal(await resolveIntentOwner(request(cookie),{fetchIdentity:async()=>{calls++;}}),null);assert.equal(calls,0);
 }
 const responses=[()=>new Response('',{status:302,headers:{Location:'https://outside.invalid'}}),()=>new Response('<html>Login</html>',{headers:{'Content-Type':'text/html'}}),()=>Response.json({account_id:'wrong',user_uuid:UUID_A}),()=>Response.json({account_id:ACCOUNT,user_uuid:'bad'}),()=>Response.json({account_id:ACCOUNT,user_uuid:UUID_A,service_token_status:true}),()=>new Response('x'.repeat(32769),{headers:{'Content-Type':'application/json'}})];
 for(const response of responses){let calls=0;assert.equal(await resolveIntentOwner(request(),{fetchIdentity:async()=>{calls++;return response();}}),null);assert.equal(calls,1);}
 assert.equal(await resolveIntentOwner(request(),{fetchIdentity:async()=>{throw Error('PRIVATE_ERROR');}}),null);
});
