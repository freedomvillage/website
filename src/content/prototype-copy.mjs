import {PROTOTYPE_COPY} from './prototype-copy-data.mjs';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Receives an already validated public projection. No records are created, no
// eligibility flags are altered, and D1 writes or private source data are absent.
export function prototypeCopy(card){
 if(card.id==='sunday-gatherings'&&card.summary===PROTOTYPE_COPY.sunday.summary&&same(card.facts,PROTOTYPE_COPY.sunday.beforeFacts)){
  return {...card,facts:[...PROTOTYPE_COPY.sunday.facts]};
 }
 const connect=PROTOTYPE_COPY.connect;
 // An additive local email-draft helper, not a submission or enrollment flow.
 // Changed identity/intro/contact destination disables this checked prototype.
 if(card.id==='connect-card'&&Object.entries(connect.before).every(([key,value])=>same(card[key],value))&&card.actions.some(a=>same(a,connect.emailAction))){
  return {...card,connectDraft:{version:1,email:connect.emailAction.href,options:connect.options.map(o=>({...o}))}};
 }
 const visit=PROTOTYPE_COPY.visit;
 if(card.id==='visit-help'&&!card.sections&&Object.entries(visit.before).every(([key,value])=>same(card[key],value))){
  return {...card,summary:visit.after.summary,detail:[...visit.after.detail],facts:[...PROTOTYPE_COPY.sunday.facts,...visit.after.facts],
   actions:[...visit.after.mapActions.map(a=>({...a})),...card.actions],
   sections:visit.after.sections.map(s=>({...s,paragraphs:[...s.paragraphs],links:s.links.map(a=>({...a})),cardIds:[...s.cardIds]}))};
 }
 const before=PROTOTYPE_COPY.beliefs.before,after=PROTOTYPE_COPY.beliefs.after;
 if(card.id==='what-we-believe'&&card.sections?.length===before.length&&card.sections.every((section,i)=>section.heading===before[i].heading&&same(section.paragraphs,before[i].paragraphs))){
  return {...card,sections:card.sections.map((section,i)=>({...section,paragraphs:[...after[i].paragraphs]}))};
 }
 // A future author edit takes precedence over the checked baseline. This also
 // makes the layer inert once the same copy has been imported into D1.
 return card;
}
