import {PROTOTYPE_COPY} from './prototype-copy-data.mjs';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Receives an already validated public projection. No records are created, no
// eligibility flags are altered, and D1 writes or private source data are absent.
export function prototypeCopy(card){
 if(card.id==='sunday-gatherings'&&card.summary===PROTOTYPE_COPY.sunday.summary&&same(card.facts,PROTOTYPE_COPY.sunday.beforeFacts)){
  return {...card,facts:[...PROTOTYPE_COPY.sunday.facts]};
 }
 const before=PROTOTYPE_COPY.beliefs.before,after=PROTOTYPE_COPY.beliefs.after;
 if(card.id==='what-we-believe'&&card.sections?.length===before.length&&card.sections.every((section,i)=>section.heading===before[i].heading&&same(section.paragraphs,before[i].paragraphs))){
  return {...card,sections:card.sections.map((section,i)=>({...section,paragraphs:[...after[i].paragraphs]}))};
 }
 // A future author edit takes precedence over the checked baseline. This also
 // makes the layer inert once the same copy has been imported into D1.
 return card;
}
