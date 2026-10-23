import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const config=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));
assert.deepEqual(Object.keys(config.env),['staging','next']);
assert.deepEqual(config.assets.run_worker_first,['/api/*']);
for(const [name,e] of Object.entries(config.env)){assert.equal(e.vars.AIR_ENABLED,'false');assert.equal(e.workers_dev,false);assert.equal(e.preview_urls,false);for(const route of e.routes??[]){assert.equal(route.pattern,`${name}.freedomvillage.church`);assert.equal(route.custom_domain,true)}}
const assets=fs.readdirSync('dist');assert(assets.length<20000);
for(const name of assets){assert(fs.statSync('dist/'+name).size<25*1024*1024);assert(!name.startsWith('.'))}
const js=fs.readFileSync('dist/app.js','utf8');
for(const season of ['winter','spring','summer','fall','christmas'])for(const light of ['dusk','night'])assert(assets.includes(`village-${season}-${light}-v1.png`));
for(const name of ['village-panorama-v8.png','village-winter-v1.png','village-spring-v1.png','village-fall-v1.png','village-christmas-v1.png','church-vertical-canva.png','scene-edge-mask.svg'])assert(assets.includes(name));
assert(!fs.existsSync('ARTWORK.md'));assert(!fs.existsSync('.openai'));
assert(!js.includes('AIRKOREA_SERVICE_KEY'));
const manifest=JSON.parse(fs.readFileSync('source-manifest.json','utf8'));
for(const [path,hash] of Object.entries(manifest.preservedFiles)){assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'),hash)}
console.log(`PASS: config safety, ${assets.length} assets, dynamic seasonal references, preserved UI hashes, clean export boundaries`);
