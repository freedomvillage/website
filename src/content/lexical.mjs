// Transparent comparison baseline, not a claim that lexical or semantic ranking wins.
const stop=new Set('a an and are as at be can for from have how i in is it me my of on or our the to us we what with would you your'.split(' '));
const tokenize=s=>(s.normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'').match(/[\p{L}\p{N}]+/gu)||[]).filter(x=>!stop.has(x));
function oneEdit(a,b){if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,edits=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}return edits+(i<a.length||j<b.length?1:0)<=1;}
export function lexicalRank(query,cards){
 const terms=[...new Set(tokenize(query))],docs=cards.map(c=>({id:c.id,title:c.title.toLowerCase(),text:tokenize([c.title,c.summary,...(c.facts||[c.date,c.time,c.venue].filter(Boolean))].join(' '))}));
 const avg=docs.reduce((n,d)=>n+d.text.length,0)/Math.max(1,docs.length);
 return docs.map(d=>{let score=0;for(const term of terms){const df=docs.filter(x=>x.text.includes(term)).length,idf=Math.log(1+(docs.length-df+.5)/(df+.5));let tf=d.text.filter(x=>x===term).length;if(!tf&&term.length>=4&&d.text.some(x=>x.length>=4&&oneEdit(term,x)))tf=.5;if(tf)score+=idf*(tf*2.2)/(tf+1.2*(.25+.75*d.text.length/Math.max(1,avg)));if(d.title.includes(term))score+=idf*.4;}const phrase=query.trim().toLowerCase();if(phrase.length>=4&&d.title.includes(phrase))score+=2;return {id:d.id,score:Number(score.toFixed(5))};}).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}
