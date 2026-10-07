'use strict';
const DATA = JSON.parse(document.getElementById('wiki-data').textContent);
const main = document.getElementById('main');
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const norm = value => value.toLocaleLowerCase('hu').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const title = value => value.charAt(0).toLocaleUpperCase('hu') + value.slice(1);
const number = value => Number(value).toLocaleString('hu-HU');
const termHref = (term, tab = null) => '#term/' + encodeURIComponent(term) + '/' + (tab || (DATA.concepts[term]?.article ? 'overview' : 'defs'));
const chip = term => `<a class="chip" href="${termHref(term)}">${esc(term)}</a>`;
const searchForm = (value = '', small = false) => `<div class="${small ? 'smallsearch' : ''}"><form class="searchform" role="search"><input aria-label="Fogalom vagy bírói rezümé keresése" placeholder="Keress egy fogalmat vagy bírói megállapítást…" value="${esc(value)}"><button class="primary" type="submit">Keresés</button></form></div>`;
const definitionCount = concept => new Set(concept.defs.map(definition => definition.law)).size;
const articleCount = Object.values(DATA.concepts).filter(concept=>concept.article).length;
function tile(term) {
  const concept = DATA.concepts[term];
  return `<a class="tile" href="${termHref(term)}"><span class="arrow">↗</span><strong>${esc(title(term))}</strong>${concept.article?'<span class="badge article-badge">Magyarázó szócikk</span>':''}<span class="meta">${number(definitionCount(concept))} jogszabály · ${number(concept.totalCards)} kapcsolódó rezümérészlet</span></a>`;
}
function home() {
  main.innerHTML = `<section class="hero"><div class="eyebrow">Jogszabályok és bírói gyakorlat, összekötve</div><h1>Jogi elnevezések,<br>meghatározások és bírói értelmezések.</h1><p class="lead">Mit jelent a jogszabályban? Mit mondanak róla a bíróságok? Indulj el egy szóból, és kövesd a kapcsolatait.</p>${searchForm()}<p class="hint">POC: ${number(Object.keys(DATA.concepts).length)} fogalom és ${number(DATA.cards.length)} bírói rezümérészlet válogatott mintája.</p></section><section class="examples"><div class="sectionhead"><h2>Innen is elindulhatsz</h2><span>Valódi forrásokból, kattintható kapcsolatokkal</span></div><div class="tiles">${DATA.seeds.map(tile).join('')}</div></section><section class="route"><div><b>01 · Találd meg</b><p>Keress, vagy válassz egy fogalmat.</p></div><div><b>02 · Olvasd együtt</b><p>Meghatározások és bírói megállapítások.</p></div><div><b>03 · Menj tovább</b><p>Kapcsolódó fogalmak és bejárható térképek.</p></div></section>`;
}
function search(query) {
  const needle = norm(query.trim());
  const terms = Object.keys(DATA.concepts).filter(term => norm(term+' '+(DATA.concepts[term].article?.sections.map(section=>section.heading+' '+section.text).join(' ')||'')).includes(needle)).sort((a,b) => (norm(a) === needle ? -1 : norm(b) === needle ? 1 : a.localeCompare(b,'hu')));
  const cards = needle ? DATA.cards.filter(card => norm(card.text + ' ' + card.case).includes(needle)) : [];
  main.innerHTML = `<section class="results">${searchForm(query,true)}<div class="crumb"><a href="#">Kezdőlap</a> / Keresés</div><h1>${esc(query ? `Találatok: „${query}”` : 'Mit szeretnél megtalálni?')}</h1><p class="subtitle">${number(terms.length)} fogalom · ${number(cards.length)} bírói rezümérészlet a POC mintájában</p><h2>Fogalmak</h2><div class="tiles">${terms.slice(0,60).map(tile).join('')}</div>${!terms.length ? '<p class="empty">Ez a fogalom nincs a POC válogatott mintájában. Ez nem jelenti, hogy a teljes gyűjteményben sem szerepel.</p>' : ''}${terms.length>60 ? '<p class="hint">Az első 60 fogalom látható. Pontosítsd a keresést, vagy böngéssz az A–Z nézetben.</p>':''}${cards.length ? `<h2 style="margin-top:30px">Bírói megállapítások</h2>${cards.slice(0,15).map(courtCard).join('')}${cards.length>15 ? '<p class="hint">Az első 15 szöveges találat látható. Pontosítsd a keresést.</p>' : ''}`:''}</section>`;
}
function courtCard(card) {
  return `<article class="courtcard"><div class="case"><span>${esc(card.court)} · ${esc(card.case)}</span><span>${esc(card.year)}</span></div><p>${esc(card.text.length > 420 ? card.text.slice(0,420) + '…' : card.text)}</p><a href="#case/${card.id}">Megállapítás és kapcsolatai →</a></article>`;
}
function related(term) {
  return DATA.edges.filter(edge => [edge.child,edge.parent,edge.from,edge.to].includes(term))
    .sort((a,b)=>(a.kind==='reference')-(b.kind==='reference') || other(a,term).localeCompare(other(b,term),'hu'));
}
function other(edge, term) {
  return [edge.child,edge.parent,edge.from,edge.to].find(endpoint => endpoint && endpoint!==term);
}
function relationText(edge, term) {
  if (edge.kind==='reference') return edge.from===term ? 'A meghatározás hivatkozik rá' : 'Meghatározása erre a fogalomra hivatkozik';
  return edge.child===term ? 'Tágabb fogalom' : 'Szűkebb fogalom';
}
function sourceHref(definition, current=false) {
  const eli = definition.eli;
  const celex = celexOf(eli);
  if (celex) return current ? euHrefs(celex).inForce : euHrefs(celex).published;
  if (!/^https:\/\/(njt\.hu|eur-lex\.europa\.eu)\//.test(eli)) return '';
  if (current || !eli.includes('njt.hu')) return eli;
  // Same verified anchor rule as the existing Defs viewer. Book/section
  // numbering is not a verified NJT anchor; link to the document in that case.
  const section = /^\d+(?:\/[A-Za-z])?$/.test(definition.section) ? definition.section : '';
  return eli.replace(/\/$/,'') + '/kozlony' + (section ? '#SZ'+encodeURIComponent(section) : '');
}
function definitionCard(definition, index = -1) {
  const source = sourceHref(definition), current = sourceHref(definition,true);
  const sectionLabel = /^\d+(?:\/[A-Za-z])?$/.test(definition.section) ? `${definition.section}. §` : `forráshely: ${definition.section}`;
  return `<article class="definition" id="definition-${index}"><span class="badge">${esc(definition.year)} · kihirdetett szöveg</span><div class="law">${esc(definition.law || 'A forrás címe nem feloldott')}${definition.section ? ` · ${esc(sectionLabel)}` : ''}</div><div class="subject">${esc(definition.subject)}</div><blockquote>${esc(definition.text)}</blockquote><div class="sourcebar">${source ? `<a href="${esc(source)}" target="_blank" rel="noopener">${definition.eli.includes('njt.hu')?'Közlönyállapot az NJT-ben':'Forrás az EUR-Lexen'} ↗</a>`:'<span>Nincs közvetlen forráslink az exportban.</span>'}${current && current!==source ? `<a href="${esc(current)}" target="_blank" rel="noopener">Hatályos szöveg ↗</a>`:''}</div></article>`;
}
function article(term, tab, sourceIndex) {
  const concept = DATA.concepts[term];
  if (!concept) return missing('Ez a fogalom nincs a POC mintájában.');
  if (!['overview','defs','courts','map'].includes(tab)) tab=concept.article?'overview':'defs';
  if (tab==='overview' && !concept.article) tab='defs';
  const neighbors = [...new Set(related(term).map(edge=>other(edge,term)))].filter(Boolean);
  const tabs=[...(concept.article?[['overview','Szócikk']]:[]),['defs','Meghatározások'],['courts','Bírói gyakorlat'],['map','Fogalmi térkép']];
  main.innerHTML = `${searchForm('',true)}<div class="crumb"><a href="#">Kezdőlap</a> / <a href="#browse">Fogalmak</a> / ${esc(title(term))}</div><div class="articlehead"><div><div class="eyebrow">Fogalom</div><h1>${esc(title(term))}</h1><p class="subtitle">${number(definitionCount(concept))} jogszabályban meghatározva · ${number(concept.totalCards)} rezümérészletben fordul elő</p></div><span class="stamp">Egy fogalom, több jogszabályi jelentés</span></div><nav class="tabs" aria-label="A fogalom nézetei">${tabs.map(([key,label])=>`<a class="${tab===key?'active':''}" ${tab===key?'aria-current="page"':''} href="${termHref(term,key)}">${label}</a>`).join('')}</nav><div class="articlegrid"><section id="article-content"></section><aside class="side"><div class="sidebox"><h3>Ugyanez a fogalom a bíróságokon</h3><p>A jogszabályi meghatározástól egy lépés a kapcsolódó bírói megállapítás.</p><a href="${termHref(term,'courts')}">Bírói gyakorlat →</a></div><div class="sidebox"><h3>Kapcsolódó fogalmak</h3>${neighbors.slice(0,7).map(neighbor=>`<a href="${termHref(neighbor)}">${esc(title(neighbor))} →</a>`).join('') || '<p>Nincs kapcsolat a POC mintájában.</p>'}<a href="${termHref(term,'map')}">A fogalmi térkép megnyitása →</a></div><div class="sidebox"><h3>Forrás és időállapot</h3><p>A meghatározások kihirdetéskori szövegek. A későbbi módosításokat ez a gyűjtemény nem követi. A forráslink mellett külön elérhető a hatályos szöveg.</p><a href="#about">Az adatok eredete →</a></div></aside></div>`;
  const content = document.getElementById('article-content');
  if (tab==='overview') {
    content.innerHTML=`<div class="ai-disclosure" role="note"><strong>Mesterséges intelligenciával készült összefoglaló.</strong><span>Emberi szakmai ellenőrzés nem történt.</span></div><div class="wiki-prose" data-ai-generated="true"><p class="notice">A magyarázat az alább hivatkozott, kihirdetéskori meghatározások és a mintában szereplő bírói rezümék alapján készült.</p>${concept.article.sections.map(section=>`<section><h2>${esc(section.heading)}</h2><p>${esc(section.text)}</p><div class="article-citations"><span>Források:</span>${section.refs.map(reference=>`<a href="${reference.definition!==undefined?termHref(term,'defs')+'/'+reference.definition:'#case/'+reference.card}">${esc(reference.label)} →</a>`).join('')}</div></section>`).join('')}</div><div class="article-next"><a href="${termHref(term,'defs')}">Az összes meghatározás →</a><a href="${termHref(term,'courts')}">Kapcsolódó bírói gyakorlat →</a></div>`;
  } else if (tab==='defs') {
    const laws=[...new Set(concept.defs.map(definition=>definition.law))].sort((a,b)=>a.localeCompare(b,'hu'));
    content.innerHTML=`<h2>Mit jelent a jogszabályokban?</h2><p class="notice">Mindegyik meghatározás a saját jogszabályának alkalmazásában értendő. Az eltérő szövegek nem feltétlenül egymás időbeli változatai.</p><div class="toolbar"><span id="def-count"></span><select id="law-filter" aria-label="Jogszabály kiválasztása"><option value="">Minden jogszabály</option>${laws.map(law=>`<option>${esc(law)}</option>`).join('')}</select></div><div id="definition-list"></div>`;
    let limit=6;
    const citedDefinition = sourceIndex!==undefined && /^\d+$/.test(sourceIndex) ? concept.defs[Number(sourceIndex)] : null;
    if(citedDefinition){document.getElementById('law-filter').value=citedDefinition.law;limit=concept.defs.length;}
    const show=()=>{
      const filtered=concept.defs.filter(definition=>!document.getElementById('law-filter').value || definition.law===document.getElementById('law-filter').value);
      document.getElementById('def-count').textContent=`${filtered.length} meghatározás`;
      document.getElementById('definition-list').innerHTML=filtered.slice(0,limit).map(definition=>definitionCard(definition,concept.defs.indexOf(definition))).join('') + (filtered.length>limit?'<button class="more" id="more-defs">További meghatározások</button>':'') + (!filtered.length?'<p class="empty">Ehhez a fogalomhoz nincs jogszabályi meghatározás a mintában. A bírói szövegekben ettől még szerepelhet.</p>':'');
      if(citedDefinition) document.getElementById('definition-'+sourceIndex)?.classList.add('cited-source');
      document.getElementById('more-defs')?.addEventListener('click',()=>{limit+=6;show();});
    };
    document.getElementById('law-filter').addEventListener('change',()=>{limit=6;show();});show();
  } else if(tab==='courts') {
    content.innerHTML=`<h2>Mit mondanak róla a bíróságok?</h2><p class="notice">A fogalom szótövezett szövegegyezéssel szerepel ezekben a rezümékben. Ez nem igazolja, hogy a bíróság a fenti jogszabályi meghatározást alkalmazta.</p><p class="hint">A teljes kapcsolási exportban ${number(concept.totalCards)} rezümérészlet; ebből ${number(concept.cards.length)} szerepel ebben a POC-ban.</p><div id="court-list"></div>`;
    let limit=6;
    const show=()=>{document.getElementById('court-list').innerHTML=concept.cards.slice(0,limit).map(id=>courtCard(DATA.cards[id])).join('')+(concept.cards.length>limit?'<button class="more" id="more-courts">További bírói találatok</button>':'')+(!concept.cards.length?'<p class="empty">Ehhez a fogalomhoz nem választottunk bírói találatot a POC mintájába. Ez nem állítás a bírói gyakorlat hiányáról.</p>':'');document.getElementById('more-courts')?.addEventListener('click',()=>{limit+=6;show();});};show();
  } else {
    content.innerHTML=`<h2>Merre vezet a fogalom?</h2><p class="notice">Kattints egy fogalomra a továbblépéshez. A térkép a meglévő fogalmi gráf válogatott részét mutatja, több jogszabály jelentéseiből együtt.</p>${conceptMap(term)}<div class="graphlist">${related(term).slice(0,12).map(edge=>`<details><summary>${esc(title(other(edge,term)))} · ${esc(relationText(edge,term))}</summary><p>${esc(edge.evidence || `${edge.laws} jogszabály meghatározásaiban feltárt szöveges hivatkozás; nem minden jelentésre igaz.`)}</p><a href="${termHref(other(edge,term))}">Fogalom megnyitása →</a></details>`).join('')}</div>`;
  }
}
function graphMarkup(centerLabel, centerHref, nodes, reference=false) {
  const height=Math.max(360,nodes.length*62+60), mid=height/2;
  return `<div class="graphwrap"><svg viewBox="0 0 700 ${height}" role="group" aria-label="Kattintható kapcsolati térkép">${nodes.map((node,index)=>{
    const y=40+index*(height-80)/Math.max(1,nodes.length-1);
    return `<path class="graphline ${reference?'ref':''}" d="M260 ${mid} C340 ${mid},340 ${y},410 ${y}"/><text class="graphlabel" x="324" y="${y-9}">${esc(node.label)}</text>`;
  }).join('')}<a class="graphnode center" href="${centerHref}"><rect x="20" y="${mid-27}" width="240" height="54" rx="8"/><text x="140" y="${mid+5}" text-anchor="middle">${esc(centerLabel.slice(0,27))}</text><title>${esc(centerLabel)}</title></a>${nodes.map((node,index)=>{
    const y=40+index*(height-80)/Math.max(1,nodes.length-1);
    return `<a class="graphnode" href="${node.href}" aria-label="${esc(node.text)}"><rect x="410" y="${y-25}" width="270" height="50" rx="8"/><text x="545" y="${y+5}" text-anchor="middle">${esc(node.text.slice(0,32))}${node.text.length>32?'…':''}</text><title>${esc(node.text)}</title></a>`;
  }).join('')}</svg><div class="graphlegend">${reference?'Szaggatott vonal: ugyanazon fogalomhoz kapcsolt találat.':'Folytonos vonal: tágabb vagy szűkebb fogalom; szaggatott: szöveges hivatkozás.'} Kattintás a csomópontra → részletes oldal.</div></div>`;
}
function conceptMap(term) {
  const seen=new Set(), nodes=[];
  for(const edge of related(term)) {
    const neighbor=other(edge,term);
    if(!neighbor || seen.has(neighbor)) continue;
    seen.add(neighbor);nodes.push({text:title(neighbor),href:termHref(neighbor),label:edge.kind==='reference'?'hivatkozás':edge.child===term?'tágabb':'szűkebb',reference:edge.kind==='reference'});
    if(nodes.length===8) break;
  }
  if(!nodes.length) return '<p class="empty">Nincs kirajzolható kapcsolat a POC mintájában.</p>';
  let markup=graphMarkup(title(term),termHref(term),nodes);
  // Preserve edge semantics rather than inventing a single relation type.
  let index=0;
  return markup.replace(/class="graphline "/g,()=>`class="graphline ${nodes[index++].reference?'ref':''}"`);
}
function casePage(id) {
  const card=DATA.cards[id];
  if(!card) return missing('Ez a bírói találat nincs a POC mintájában.');
  const nearest=card.peers.map(peer=>({id:peer,...DATA.leaves[String(peer)]}));
  main.innerHTML=`<section class="reading"><div class="crumb"><a href="#">Kezdőlap</a> / Bírói gyakorlat / ${esc(card.case)}</div><div class="eyebrow">Bírói rezümé${card.fragment?' · '+esc(card.fragment)+'. rész':''}</div><h1>${esc(card.case)}</h1><p class="subtitle">${esc(card.court)} · ${esc(card.year)}</p><article class="definition"><span class="badge gold">Bírói megállapítás</span><blockquote>${esc(card.text)}</blockquote><div class="sourcebar"><span>BHGY · ${esc(card.court)} · ${esc(card.case)}</span></div><p class="sourcecode">A kapcsolási export forrásazonosítója: ${esc(card.sourceId || 'nincs')}</p></article><h2>A szövegben szereplő fogalmak</h2><p class="hint">A Refs meglévő, közvetlen szövegegyezései. A fogalomra kattintva elérhetők a jogszabályi meghatározások.</p><div class="chips">${card.terms.map(chip).join('')}</div><h2 style="margin-top:32px">Kapcsolati térkép</h2>${graphMarkup(card.case,`#case/${id}`,card.terms.slice(0,6).map(term=>({text:title(term),href:termHref(term,'courts'),label:'szerepel a szövegben'})),true)}<h2 style="margin-top:32px">Hasonló bírói megállapítások</h2><p class="notice">A Sentencies már kiszámolt hasonlósági fájából, az adott rezüméhez legközelebb egyesülő levelek. Szöveges hasonlóság, nem jogi azonosság.</p>${nearest.map(peer=>`<article class="courtcard"><div class="case"><span>${esc(peer.cases[0]?.birosag)} · ${esc(peer.cases[0]?.ugyszam)}</span><span>${esc(peer.cases[0]?.ev)}</span></div><p>${esc(peer.text)}</p><a href="#leaf/${peer.id}">Rezümé és forrásadatai →</a></article>`).join('')||'<p class="empty">Ehhez a részlethez nincs pontosan összekapcsolható Sentencies-levél vagy közeli szomszéd a POC-ban.</p>'}</section>`;
}
function leafPage(id) {
  const leaf=DATA.leaves[id];
  if(!leaf) return missing('Ez a rezümé nincs a POC mintájában.');
  const matching=DATA.cards.find(card=>card.text===leaf.text && leaf.cases.some(item=>item.index_id===card.sourceId));
  if(matching) return casePage(matching.id);
  const terms=Object.keys(DATA.concepts).filter(term=>DATA.cards.some(card=>card.text===leaf.text && card.terms.includes(term)));
  main.innerHTML=`<section class="reading"><div class="crumb"><a href="#">Kezdőlap</a> / Hasonló bírói megállapítás</div><div class="eyebrow">Sentencies · szöveges szomszéd</div><h1>${esc(leaf.cases[0]?.ugyszam || 'Bírói rezümé')}</h1><article class="definition"><blockquote>${esc(leaf.text)}</blockquote></article><h2>Forrásadatok</h2>${leaf.cases.map(item=>`<article class="courtcard"><b>${esc(item.birosag)} · ${esc(item.ugyszam)}</b><p>${esc(item.ev)} · BHGY</p><div class="sourcecode">${esc(item.azonosito)} · ${esc(item.index_id)}</div></article>`).join('')}<div class="chips">${terms.map(chip).join('')}</div><p class="notice">A POC itt a forrásadatokat mutatja. Közvetlen határozatlinket a jelenlegi export nem tartalmaz.</p><button class="more" data-back>Vissza az előző oldalra</button></section>`;
}
function browse() {
  const terms=Object.keys(DATA.concepts).sort((a,b)=>a.localeCompare(b,'hu'));
  const letters=[...new Set(terms.map(term=>title(term)[0]))];
  main.innerHTML=`<section class="results">${searchForm('',true)}<div class="crumb"><a href="#">Kezdőlap</a> / Fogalmak A–Z</div><h1>Fogalmak A–Z</h1><p class="subtitle">A POC ${number(terms.length)} fogalma. A mintából hiányzó fogalom nem feltétlenül hiányzik a teljes gyűjteményből.</p><div class="az">${letters.map(letter=>`<a href="#browse/${encodeURIComponent(letter)}">${esc(letter)}</a>`).join('')}<a href="#browse">Mind</a></div><div class="tiles">${terms.filter(term=>!routeParts()[1] || title(term)[0]===routeParts()[1]).map(tile).join('')}</div></section>`;
}
function about() {
  main.innerHTML=`<section class="reading"><div class="eyebrow">A gyűjteményről</div><h1>Három adatforrás.<br>Egy bejárható fogalomtár.</h1><p>A Defs jogszabályi meghatározásait, a Sentencies bírói rezüméit és a Refs fogalom–rezümé kapcsolatait egy közös olvasási útvonalon próbáljuk ki.</p><h2>Mit mutat ez a POC?</h2><p>${number(Object.keys(DATA.concepts).length)} fogalmat, ${number(DATA.cards.length)} rezümérészletet és ${number(DATA.edges.length)} fogalmi kapcsolatot a meglévő exportokból. A nyitólap példáit és a körülöttük lévő mintát válogattuk ki; a fogalomoldalak meghatározásai a rendelkezésre álló éves exportokból származnak.</p><h2>Mit jelentenek a kapcsolatok?</h2><p>A Refs közvetlen kapcsolatai szótövezett szövegegyezések. A Sentencies szomszédai szöveges hasonlóságon alapulnak. A fogalmi térkép a Defs meglévő kapcsolatait jeleníti meg, az eredeti bizonyítékkal, ahol van ilyen. Ezek önmagukban nem jogi következtetések.</p><h2>Időállapot</h2><p>A jogszabályi meghatározások kihirdetéskori szövegek, nem egységes szerkezetű, hatályos állapotok. A bírói rezümék a forrásban közzétett szövegek. A fogalomra való találat nem igazolja egy konkrét jogszabályi meghatározás alkalmazását.</p><h2>A próba határai</h2><p>Nincs közösségi szerkesztés. A keresés csak a POC mintájában keres; a rezümékhez az exportban meglévő forrásadatok tartoznak. Közvetlen határozatlink hiányában nem készítünk feltételezett URL-t.</p><details><summary>Felhasznált exportok és fájldátumok</summary><p>POC összeállítva: ${esc(DATA.built)}. Az alábbi dátumok fájlmódosítási időpontok, nem a jogi tartalom időállapotai.</p>${DATA.sources.map(source=>`<p class="sourcecode">${esc(source.file)}<br>${esc(source.modified)}</p>`).join('')}</details></section>`;
}
function missing(message) {main.innerHTML=`<section class="reading"><h1>Ez az oldal nem elérhető</h1><p>${esc(message)}</p><a href="#">Vissza a kezdőlapra →</a></section>`;}
function routeParts() {try{return location.hash.slice(1).split('/').map(decodeURIComponent);}catch{return [];}}
function render() {
  const [route,value,tab,sourceIndex]=routeParts();
  if(route==='term') article(value,tab,sourceIndex);
  else if(route==='case') casePage(value);
  else if(route==='leaf') leafPage(value);
  else if(route==='search') search(value||'');
  else if(route==='browse') browse();
  else if(route==='about') about();
  else home();
  if (!route) main.querySelector('.hint').textContent += ` ${articleCount} fogalomhoz magyarázó szócikk is tartozik.`;
  if (route==='about') main.querySelector('.reading').insertAdjacentHTML('beforeend', `<h2>Magyarázó szócikkek</h2><p>${articleCount} kezdőlapi fogalomhoz mesterséges intelligenciával készült összefoglaló tartozik. Emberi szakmai ellenőrzés nem történt. A magyarázat minden bekezdéséből elérhető a felhasznált meghatározás vagy bírói rezümé; ezek időállapota és korlátai az összefoglalóra is érvényesek.</p>`);
  document.title=(route==='term'&&value?title(value)+' · ':'')+'HJus · Jogi fogalomtár';
  main.querySelectorAll('.searchform').forEach(form=>form.addEventListener('submit',event=>{event.preventDefault();location.hash='search/'+encodeURIComponent(form.querySelector('input').value.trim());}));
  main.querySelector('[data-back]')?.addEventListener('click',()=>history.back());
  window.scrollTo(0,0);
}
window.addEventListener('hashchange',render);
render();
