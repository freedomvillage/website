// Resolve the existing Access session at Cloudflare, rather than trusting a
// caller-supplied email/owner header or merely decoding an unverified JWT.
// https://developers.cloudflare.com/cloudflare-one/tutorials/extend-sso-with-workers/
const ENDPOINT='https://next.freedomvillage.church/cdn-cgi/access/get-identity';
const ACCOUNT='9fa36317f1547f0da1fbcf97fc2529f6';
export async function resolveIntentOwner(request,{fetchIdentity=fetch}={}){
 const cookies=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith('CF_Authorization='));
 if(cookies.length!==1)return null;
 const token=cookies[0].slice('CF_Authorization='.length);
 if(token.length>8192||!/^[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+$/.test(token))return null;
 try{
  const response=await fetchIdentity(ENDPOINT,{method:'GET',headers:{Cookie:'CF_Authorization='+token,Accept:'application/json'},cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(3000)});
  if(!response.ok||!response.headers.get('Content-Type')?.includes('application/json')){await response.body?.cancel();return null;}
  const reader=response.body?.getReader();if(!reader)return null;
  let text='',bytes=0;const decoder=new TextDecoder('utf-8',{fatal:true});
  try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>32768){await reader.cancel();return null;}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();}
  finally{reader.releaseLock();}
  const identity=JSON.parse(text);
  if(identity.account_id!==ACCOUNT||typeof identity.user_uuid!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity.user_uuid)||identity.service_token_status===true)return null;
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('fvc-intent-owner-v1|'+ACCOUNT+'|'+identity.user_uuid.toLowerCase()));
  return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
 }catch{return null;/* Never log session cookies, identity JSON or exceptions. */}
}
