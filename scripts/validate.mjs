import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const config=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));
const privateWorkerRoutes=['/','/index.html','/connect','/connect/','/give','/give/','/prayer','/prayer/','/resources','/resources/','/events/*','/cards/*','/topics/*','/studies/*','/api/*','/media/*','/robots.txt','/sitemap.xml','/llms.txt'];
assert.deepEqual([...config.assets.run_worker_first].sort(),privateWorkerRoutes.sort());
assert.equal(config.assets.not_found_handling,'none');
assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);
for(const settings of Object.values(config.env??{})){assert.equal(settings.workers_dev,false);assert.equal(settings.preview_urls,false);}
assert.deepEqual(config.env.next.routes,[{pattern:'next.freedomvillage.church',custom_domain:true}]);
assert.equal(config.env.next.vars.CONTENT_PILOT_ENABLED,'true');
function checkAirSettings(settings,isPreview=false){
 const vars=settings.vars||{};
 if(vars.AIR_ENABLED!==undefined)assert(['true','false'].includes(vars.AIR_ENABLED));
 if(isPreview){assert.notEqual(vars.AIR_PRODUCER_ENABLED,'true');assert.notEqual(vars.AIR_DEPLOYMENT_KIND,'production');assert(!settings.triggers?.crons?.length);}
 if(vars.AIR_PRODUCER_ENABLED==='true'){assert.equal(vars.AIR_DEPLOYMENT_KIND,'production');assert.deepEqual(settings.triggers?.crons,['*/15 * * * *']);}
 for(const route of settings.routes??[]){assert(['staging.freedomvillage.church','next.freedomvillage.church'].includes(route.pattern));assert.equal(route.custom_domain,true)}
}
checkAirSettings(config);
for(const [name,e] of Object.entries(config.env??{})){checkAirSettings(e,name==='staging'||name==='preview');if(e.previews)checkAirSettings(e.previews,true)}
if(config.previews)checkAirSettings(config.previews,true);
const assets=fs.readdirSync('dist');assert(assets.length<20000);
for(const name of assets){assert(fs.statSync('dist/'+name).size<25*1024*1024);assert(!name.startsWith('.'))}
const js=fs.readFileSync('dist/app.js','utf8');
for(const season of ['winter','spring','summer','fall','christmas'])for(const light of ['dusk','night'])assert(assets.includes(`village-${season}-${light}-v1.png`));
for(const name of ['village-panorama-v8.png','village-winter-v1.png','village-spring-v1.png','village-fall-v1.png','village-christmas-v1.png','church-vertical-canva.png','scene-edge-mask.svg'])assert(assets.includes(name));
assert(!fs.existsSync('ARTWORK.md'));assert(!fs.existsSync('.openai'));
assert(!js.includes('AIRKOREA_SERVICE_KEY'));
const manifest=JSON.parse(fs.readFileSync('source-manifest.json','utf8'));
for(const [path,hash] of Object.entries({...manifest.preservedFiles,...manifest.adaptedFiles})){assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'),hash)}
console.log(`PASS: config safety, ${assets.length} assets, dynamic seasonal references, preserved UI hashes, clean export boundaries`);
