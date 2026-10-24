// Synthetic projection and DOM contracts, cloud CI only; no mail client or real sends.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PROTOTYPE_COPY} from '../src/content/prototype-copy-data.mjs';
import {publicCard} from '../src/content/catalog.mjs';
import {renderLibraryDetail} from '../src/content/render.mjs';
const fixture=(extra={})=>({schemaVersion:2,template:'next-step',...PROTOTYPE_COPY.connect.before,detail:['A synthetic existing paragraph.'],facts:[],categories:['next-steps'],actions:[{...PROTOTYPE_COPY.connect.emailAction},{label:'Kakao channel',href:'https://pf.kakao.com/_nEAVn'}],related:[],media:null,design:{theme:'forest',layout:'text',motif:'none',motion:'none',size:'regular'},homePriority:83,sourceStatus:'draft',isSynthetic:false,...extra});
const project=(content,id='connect-card')=>publicCard({id,content_json:JSON.stringify(content)});
test('checked Connect gains independent source interests without altering authored content or contact paths',()=>{
 const input=fixture({editorial:'PRIVATE_SENTINEL',connectDraft:{email:'mailto:attacker@example.org'}}),snapshot=JSON.stringify(input),c=project(input);
 assert.deepEqual(c.connectDraft.options.map(o=>o.label),['Attending FVC101','Growing in Community','Joining a Serve Team','Knowing the Gospel','Being Baptized']);
 assert.equal(c.connectDraft.email,'mailto:contact@freedomvillage.church');assert.deepEqual(c.actions,input.actions);assert.deepEqual(c.detail,input.detail);assert(!JSON.stringify(c).includes('PRIVATE_SENTINEL'));assert(!JSON.stringify(c).includes('attacker'));assert.equal(JSON.stringify(input),snapshot);
 for(const extra of [{title:'Edited title'},{summary:'Edited summary'},{actions:[{label:'New contact',href:'mailto:other@example.org'}]}])assert.equal(project(fixture(extra)).connectDraft,undefined);
 for(const extra of [{hold:true},{isSynthetic:true},{sourceStatus:'pending'}])assert.equal(project(fixture(extra)),null);
 assert.equal(project(fixture(),'other-card').connectDraft,undefined);
});
test('SSR chooser is hidden until enhanced, uses labels and canonical learn links, and leaves ordinary contact available',()=>{
 const html=renderLibraryDetail(project(fixture()));
 assert(html.includes('data-connect-draft hidden'));assert(html.includes('Nothing is sent from this page.'));
 assert.equal((html.match(/type="checkbox"/g)||[]).length,5);assert.equal((html.match(/name="connect-interest"/g)||[]).length,5);assert(!html.includes('<form'));assert(!html.includes('type="submit"'));
 for(const o of PROTOTYPE_COPY.connect.options){assert(html.includes('for="connect-interest-'+o.id+'"'));assert(html.includes('href="/cards/'+o.targetId+'"'));}
 assert(html.includes('mailto:contact@freedomvillage.church'));assert(html.includes('https://pf.kakao.com/_nEAVn'));
 assert(!renderLibraryDetail(project(fixture({summary:'New owner intro'}))).includes('data-connect-draft'));
});
function harness({wrongEmail=false}={}){
 const choices=PROTOTYPE_COPY.connect.options.map(o=>({value:o.label,checked:false,handlers:[],addEventListener(type,fn){assert.equal(type,'change');this.handlers.push(fn);}}));
 const email={href:wrongEmail?'mailto:other@example.org':'mailto:contact@freedomvillage.church',getAttribute(){return this.href;}};const status={textContent:''};
 const picker={dataset:{},hidden:true,querySelector(s){return s==='[data-connect-email]'?email:s==='[data-connect-status]'?status:null;},querySelectorAll(){return choices;}};
 let networkCalls=0;const context={URL,URLSearchParams,Set,encodeURIComponent,location:{origin:'https://next.freedomvillage.church',hash:''},matchMedia(){return {matches:false,addEventListener(){}};},requestAnimationFrame(fn){fn();},addEventListener(){},fetch(){networkCalls++;throw Error('No requests expected');},document:{hidden:false,querySelector(s){return s==='[data-connect-draft]'?picker:null;},querySelectorAll(){return [];},addEventListener(){}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../dist/content-view.js',import.meta.url),'utf8'),context);context.contentView.render();
 return {picker,choices,email,status,context,get networkCalls(){return networkCalls;},change(index,checked){choices[index].checked=checked;choices[index].handlers.forEach(fn=>fn());}};
}
test('independent multiselect builds a reviewed email draft, clears deselected interests and never sends or fetches',()=>{
 const h=harness();assert.equal(h.picker.hidden,false);assert.match(h.status.textContent,/0 interests selected/);
 h.change(0,true);h.change(2,true);h.change(4,true);
 let draft=new URL(h.email.href);assert.equal(draft.protocol,'mailto:');assert.equal(draft.pathname,'contact@freedomvillage.church');assert.equal(draft.searchParams.get('subject'),'My next step at Freedom Village');
 let body=draft.searchParams.get('body');for(const i of [0,2,4])assert(body.includes(h.choices[i].value));for(const i of [1,3])assert(!body.includes(h.choices[i].value));assert.match(h.status.textContent,/3 interests selected/);
 h.change(2,false);assert(!new URL(h.email.href).searchParams.get('body').includes('Joining a Serve Team'));assert.match(h.status.textContent,/2 interests selected/);
 h.change(0,false);h.change(4,false);assert(!new URL(h.email.href).searchParams.get('body').includes('Being Baptized'));assert.equal(h.networkCalls,0);
 h.context.contentView.render();assert(h.choices.every(c=>c.handlers.length===1));
 const wrong=harness({wrongEmail:true});assert.equal(wrong.picker.hidden,true);assert(wrong.choices.every(c=>!c.handlers.length));
});
