// Private AQ-only KV diagnostics: fixed enums and numeric codes, never provider text.
export const DIAGNOSTIC_KEY='air-quality:diagnostic:v1';
const CODES=new Set(['00','01','04','05','10','12','20','22','23','29','30','31']);
const CATEGORIES=new Set(['transport','fetch-timeout','http-error','body-too-large','non-json','provider-error','schema-shape','empty-items','station-mismatch','pm25-missing','pm25-flagged','pm25-invalid','timestamp-invalid','ok-or-reading-unknown']);
export function diagnostic(category,httpStatus=null,providerCode=null){
 return {category:CATEGORIES.has(category)?category:'transport',httpStatus:Number.isInteger(httpStatus)&&httpStatus>=100&&httpStatus<=599?httpStatus:null,providerCode:typeof providerCode==='string'&&CODES.has(providerCode)?providerCode:null};
}
export function xmlCode(raw){
 // Not an XML parser: no entities, DTDs, external resources, attributes or expansion.
 if(typeof raw!=='string'||raw.length>65536||/<!DOCTYPE|<!ENTITY/i.test(raw))return null;
 const match=raw.match(/<(returnReasonCode|resultCode)>\s*([0-9]{2})\s*<\/\1>/);
 return diagnostic('non-json',null,match?.[2]).providerCode;
}
export async function boundedBody(response){
 const reader=response.body?.getReader();if(!reader)return '';
 const parts=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){try{await reader.cancel()}catch{}return null}parts.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.byteLength}return new TextDecoder().decode(bytes);
}
export function payloadCategory(payload,station){
 if(!payload?.response?.header||!Object.hasOwn(payload.response.header,'resultCode'))return 'schema-shape';
 if(String(payload.response.header.resultCode)!=='00')return 'provider-error';
 const items=payload?.response?.body?.items;if(!Array.isArray(items))return 'schema-shape';
 const row=items[0];if(!row)return 'empty-items';
 if(row.stationName&&row.stationName!==station)return 'station-mismatch';
 if(row.pm25Value==null||String(row.pm25Value).trim()==='')return 'pm25-missing';
 if(row.pm25Flag!=null&&String(row.pm25Flag).trim()!=='')return 'pm25-flagged';
 const raw=String(row.pm25Value).trim();if(!/^\d+(?:\.\d+)?$/.test(raw)||!Number.isFinite(Number(raw))||Number(raw)>1000)return 'pm25-invalid';
 // The existing normalizer remains authoritative for timestamp/freshness checks.
 return 'timestamp-invalid';
}
