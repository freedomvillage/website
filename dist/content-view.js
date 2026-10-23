// The private pilot reads canonical records from D1; it contains no source records or images.
(function(root){
 let cards=[],state='loading',started=false,lastId=null,artSerial=0;
 const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 function artwork(card,context='card'){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),image=document.createElementNS(ns,'image');
  // Recompose source imagery only; facts are live text, rather than duplicated poster text.
  const crop=card.theme==='breakfast'?[1188,0,732,1080]:context==='detail'?[40,420,350,930]:[80,420,300,930];
  svg.setAttribute('viewBox',crop.join(' '));svg.setAttribute('width',crop[2]);svg.setAttribute('height',crop[3]);
  // A viewBox alone does not clip artwork in letterboxed parts of the viewport.
  const defs=document.createElementNS(ns,'defs'),clip=document.createElementNS(ns,'clipPath'),rect=document.createElementNS(ns,'rect'),clipId='pilot-crop-'+(++artSerial);
  clip.id=clipId;clip.setAttribute('clipPathUnits','userSpaceOnUse');['x','y','width','height'].forEach((key,i)=>rect.setAttribute(key,crop[i]));clip.append(rect);defs.append(clip);svg.append(defs);image.setAttribute('clip-path','url(#'+clipId+')');
  svg.setAttribute('role','img');svg.setAttribute('aria-label',card.theme==='breakfast'?'Coffee and breakfast illustration from the original announcement.':'Seoul tower photograph from the original announcement.');
  svg.classList.add('pilot-art');image.setAttribute('href',card.image.src);image.setAttribute('width',card.image.width);image.setAttribute('height',card.image.height);svg.append(image);return svg;
 }
 function facts(card){const box=node('div','pilot-facts');box.append(node('p','pilot-date',card.date),node('p','pilot-time',card.time),node('p','pilot-venue',card.venue));return box;}
 function cardElement(card){
  const article=node('article','card pilot-card pilot-'+card.theme),link=node('a','pilot-card-link'),copy=node('div','pilot-copy');
  article.id='card-'+card.id;link.href='#story='+encodeURIComponent(card.id);link.setAttribute('aria-label',card.title+' — event details');
  copy.append(node('h2','',card.title),facts(card),node('p','pilot-excerpt',card.summary),node('span','pilot-detail-link','Event details ↗'));
  link.append(copy,artwork(card));article.append(link);return article;
 }
 function render(){
  const grid=document.getElementById('grid'),collection=document.getElementById('collection'),detail=document.getElementById('detail'),filters=document.getElementById('filters');
  filters.replaceChildren();filters.hidden=true;
  const params=new URLSearchParams(location.hash.slice(1)),id=params.get('story'),card=cards.find(c=>c.id===id);
  document.getElementById('count').textContent='';document.getElementById('collection-label').textContent='';
  if(card){
   collection.hidden=true;detail.hidden=false;detail.replaceChildren();const article=node('article','detail-shell pilot-detail pilot-'+card.theme),back=node('a','back','← Back');back.href='#all';
   const title=node('h1','',card.title);title.tabIndex=-1;const hero=node('div','pilot-detail-hero'),copy=node('div','pilot-detail-copy'),visual=node('figure','pilot-detail-art');copy.append(title,facts(card));visual.append(artwork(card,'detail'));hero.append(copy,visual);article.append(back,hero);const body=node('div','detail-body');
   if(card.address)body.append(node('p','pilot-address',card.address));for(const p of card.detail)body.append(node('p','',p));
   for(const action of card.actions){const a=node('a','pilot-action',action.label+' ↗');a.href=action.href;a.target='_blank';a.rel='noopener noreferrer';body.append(a);}
   article.append(body);detail.append(article);document.title=card.title+' — the church at Freedom Village';
   if(lastId!==id){window.scrollTo(0,0);title.focus({preventScroll:true});}lastId=id;return;
  }
  collection.hidden=false;detail.hidden=true;grid.replaceChildren();
  document.title='the church at Freedom Village';
  if(state==='ready'){for(const card of cards)grid.append(cardElement(card));if(!cards.length)grid.append(node('p','','No current draft cards.'));}
  else{const status=node('p','pilot-state',state==='loading'?'Loading…':'The cards could not load.');status.setAttribute('role','status');grid.append(status);if(state==='error'){const retry=node('button','pilot-retry','Try again');retry.type='button';retry.addEventListener('click',load);grid.append(retry);}}
  requestAnimationFrame(()=>{if(typeof sizeCards==='function')sizeCards();});
  if(lastId){document.querySelector('#card-'+lastId+' a')?.focus({preventScroll:true});lastId=null;}
 }
 async function load(){state='loading';render();try{const response=await fetch('/api/content',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});if(!response.ok||!response.headers.get('Content-Type')?.includes('application/json'))throw Error();const data=await response.json();if(data.status!=='ok'||!Array.isArray(data.items))throw Error();cards=data.items;state='ready';}catch{state='error';}render();}
 root.contentView={render(){if(!started){started=true;load();}else render();}};
})(globalThis);
