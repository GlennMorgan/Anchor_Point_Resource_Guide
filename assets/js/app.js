const DATA_URL = 'data/resources.json?v=1.10';
const META_URL = 'data/resources_metadata.json?v=1.10';
const STORE = 'anchorPoint.selected.v110';
const LEGACY_STORES = [
  'anchorPoint.selected',
  'anchorPoint.selected.v18',
  'anchorPoint.selected.v17',
  'anchorPoint.selected.v16',
  'anchorPoint.selected.v14',
  'anchorPoint.selected.v13',
  'anchorPoint.selected.v12',
  'anchorPointGuideSelection',
  'anchorPointSelectedResources',
  'anchorPointSelectedResourceIds',
  'selectedResources'
];
function purgeLegacySelectionStores(){
  for(const key of LEGACY_STORES){
    try{ localStorage.removeItem(key); sessionStorage.removeItem(key); }catch(e){}
  }
}
function readSelectedIds(){
  const params = new URLSearchParams(location.search);
  const idsFromUrl = (params.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean);
  if(idsFromUrl.length){
    purgeLegacySelectionStores();
    try{ sessionStorage.setItem(STORE, JSON.stringify(idsFromUrl)); }catch(e){}
    return idsFromUrl;
  }
  purgeLegacySelectionStores();
  try{
    const raw = sessionStorage.getItem(STORE);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter(Boolean) : [];
  }catch(e){
    console.warn('Unable to read selected resources from session storage', e);
    return [];
  }
}
function clearSelectionStorage(){
  purgeLegacySelectionStores();
  try{ sessionStorage.removeItem(STORE); }catch(e){}
}
let selected = new Set(readSelectedIds());
let showingSelectedOnly = false;
let activeWorkflow = '';
let viewMode = localStorage.getItem('anchorPoint.viewMode.v110') || 'cards';
let sortMode = localStorage.getItem('anchorPoint.sortMode.v110') || 'urgency';
const page = document.body.dataset.page || 'home';
const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const txt = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const low = (v) => txt(v).toLowerCase();
const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b));
const esc = (s) => txt(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field = (r, k) => txt(r[k]);
const allText = (r) => [r.category,r.serviceFunction,r.organization,r.phoneText,r.urgency,r.population,r.descriptionOfServices,r.location,r.hours,r.website,r.email,r.notes].map(txt).join(' ').toLowerCase();
const SEARCH_FIELDS = [
  ['organization','Organization'],
  ['serviceFunction','Service Function'],
  ['category','Category'],
  ['descriptionOfServices','Description'],
  ['notes','Notes'],
  ['location','Location'],
  ['population','Population'],
  ['phoneText','Phone'],
  ['hours','Hours'],
  ['website','Website'],
  ['email','Email'],
  ['urgency','Urgency']
];
function normalizeForSearch(v){
  return txt(v)
    .toLowerCase()
    .replace(/non[-\s]?crisis/g,'noncrisis')
    .replace(/[’']/g,'')
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function searchBlob(r){
  return SEARCH_FIELDS.map(([k])=>normalizeForSearch(r[k])).join(' ').replace(/\s+/g,' ').trim();
}
function parseKeywordQuery(q){
  const raw = txt(q);
  const quoted = raw.match(/^["“](.+?)["”]$/);
  if(quoted){
    const phrase = normalizeForSearch(quoted[1]);
    return {mode:'phrase', phrase, tokens: phrase ? phrase.split(' ') : []};
  }
  const tokens = normalizeForSearch(raw).split(' ').filter(Boolean);
  return {mode:'and', phrase:'', tokens};
}
function containsToken(blob, token){
  if(!token) return true;
  return new RegExp('(^|\\s)'+token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(\\s|$)').test(blob);
}
function queryMatchesBlob(blob, parsed){
  if(!parsed || (!parsed.phrase && !parsed.tokens?.length)) return true;
  if(parsed.mode === 'phrase') return blob.includes(parsed.phrase);
  return parsed.tokens.every(t=>containsToken(blob,t));
}
function keywordMatch(r, kw){
  if(!kw) return true;
  return queryMatchesBlob(searchBlob(r), parseKeywordQuery(kw));
}
function matchReasons(r, kw){
  if(!kw) return [];
  const parsed = parseKeywordQuery(kw);
  const reasons = [];
  for(const [k,label] of SEARCH_FIELDS){
    const value = normalizeForSearch(r[k]);
    if(value && queryMatchesBlob(value, parsed)) reasons.push(label);
  }
  return reasons.slice(0,4);
}

function searchRelevanceScore(r, kw){
  if(!kw) return 0;
  const parsed = parseKeywordQuery(kw);
  const phrase = parsed.mode === 'phrase' ? parsed.phrase : parsed.tokens.join(' ');
  const org = normalizeForSearch(r.organization);
  const svc = normalizeForSearch(r.serviceFunction);
  const cat = normalizeForSearch(r.category);
  const desc = normalizeForSearch(r.descriptionOfServices);
  const notes = normalizeForSearch(r.notes);
  const blob = searchBlob(r);
  let score = 0;
  if(phrase && org.includes(phrase)) score += 120;
  if(phrase && svc.includes(phrase)) score += 90;
  if(phrase && cat.includes(phrase)) score += 50;
  if(phrase && desc.includes(phrase)) score += 40;
  if(phrase && notes.includes(phrase)) score += 35;
  if(parsed.tokens?.length){
    for(const t of parsed.tokens){
      if(containsToken(org,t)) score += 15;
      if(containsToken(svc,t)) score += 10;
      if(containsToken(cat,t)) score += 5;
    }
  }
  if(queryMatchesBlob(blob, parsed)) score += 5;
  return score;
}

const workflows = {
  food: {label:'Food / EBT', terms:['food','calfresh','ebt','snap','pantry','meal','meals','nutrition','grocery','groceries','hunger']},
  housing: {label:'Housing / Shelter', terms:['housing','shelter','homeless','homelessness','outreach','coordinated entry','emergency housing','transitional','motel','rental']},
  recovery: {label:'Recovery / Health', terms:['recovery','sud','substance','behavioral health','mental health','medical','clinic','crisis','treatment','detox','health']},
  documents: {label:'ID / Documents', terms:['id','identification','documents','vital records','birth certificate','social security','mail','dmv','records']},
  families: {label:'Families', terms:['family','families','children','child','youth','school','parent','calworks','childcare','students']},
  jobs: {label:'Job Search', terms:['job','employment','workforce','career','careers','hiring','training','resume','application','edd']}
};
function persistSelected(){
  try{
    if(selected.size){
      sessionStorage.setItem(STORE, JSON.stringify([...selected]));
    }else{
      clearSelectionStorage();
    }
  }catch(e){console.warn('Unable to persist selected resources', e);}
}
function refreshSelectedFromStorage(){
  selected = new Set(readSelectedIds());
  return selected;
}
function save(){persistSelected(); renderSelected(); updateCounts(); renderGuidePreview(); wireGuideLinks();}
function toast(msg){const old=document.querySelector('.toast'); if(old) old.remove(); const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),1800);}
function recordById(id){return resources.find(r => r.id === id);}
function validUrgency(v){const s=txt(v); return s && !/^https?:/i.test(s) && !/apply now/i.test(s) && s.length < 60;}
function popTags(r){ if(Array.isArray(r.populationTags)) return r.populationTags.map(txt).filter(Boolean); return txt(r.population).split(/[;,]/).map(s=>s.trim()).filter(Boolean); }
function urgencyShort(urgency){const u=low(urgency); if(u.includes('immediate')||u.includes('24/7')) return 'Immediate'; if(u.includes('urgent')) return 'Urgent'; if(u.includes('school')) return 'School'; if(u.includes('referral')) return 'Referral'; if(u.includes('ongoing')||u.includes('non-crisis')) return 'Ongoing'; return txt(urgency)||'Unspecified';}
function urgencyMeta(urgency){const u=low(urgency); if(u.includes('24/7')) return '24/7'; if(u.includes('business')) return 'Business Hours'; if(u.includes('school')) return 'School Hours'; if(u.includes('non-crisis')) return 'Non-Crisis'; if(u.includes('referral')) return 'Referral Required'; return '';} 
function urgencyClass(urgency){const u=low(urgency); if(u.includes('immediate')||u.includes('24/7')) return 'status imm'; if(u.includes('urgent')) return 'status urgent'; if(u.includes('school')) return 'status school'; return 'status ongoing';}
function urgencyPriority(r){const u=low(r.urgency); if(u.includes('immediate')||u.includes('24/7')) return 0; if(u.includes('urgent')) return 1; if(u.includes('school')) return 2; return 3;}
function statusHTML(r){const s=urgencyShort(r.urgency), m=urgencyMeta(r.urgency); return `<span class="${urgencyClass(r.urgency)}"><b>${esc(s)}</b>${m?`<small>${esc(m)}</small>`:''}</span>`;}
function optionList(id, values){const el=$(id); if(!el) return; const first=el.options[0]?.outerHTML || '<option value="">All</option>'; el.innerHTML=first + values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');}
async function load(){try{const [r,m]=await Promise.all([fetch(DATA_URL,{cache:'no-store'}).then(x=>x.json()), fetch(META_URL,{cache:'no-store'}).then(x=>x.ok?x.json():{}).catch(()=>({}))]); resources = Array.isArray(r)?r:[]; metadata=m||{}; init();}catch(e){console.error(e); const target=$('results')||$('matchResults')||$('selectedList'); if(target) target.innerHTML=`<div class="empty">Could not load <b>data/resources.json</b>. On GitHub Pages, wait for deployment, then hard refresh with Ctrl+F5.</div>`;}}
function init(){refreshSelectedFromStorage(); populateFilters(); wireCommon(); if(page==='home') initHome(); if(page==='resources') initResources(); if(page==='guide') initGuide(); renderSelected(); updateCounts(); wireGuideLinks(); window.addEventListener('storage',()=>{refreshSelectedFromStorage(); renderSelected(); updateCounts(); renderGuidePreview(); if(page==='resources') renderResults(); if(page==='guide') renderMatches();});}
function updateCounts(){const cats=uniq(resources.map(r=>field(r,'category'))); if($('statRecords')) $('statRecords').textContent=resources.length.toLocaleString(); if($('railRecordCount')) $('railRecordCount').textContent=resources.length.toLocaleString(); if($('statCategories')) $('statCategories').textContent=cats.length; ['statSelected','topSelectedCount','trayCount'].forEach(id=>{ if($(id)) $(id).textContent=selected.size; });}
function populateFilters(){optionList('category', uniq(resources.map(r=>field(r,'category')))); optionList('urgency', uniq(resources.map(r=>field(r,'urgency')).filter(validUrgency))); optionList('population', uniq(resources.flatMap(popTags)));}
function wireGuideLinks(){
  const ids = [...selected];
  const suffix = ids.length ? '?ids=' + encodeURIComponent(ids.join(',')) : '';
  document.querySelectorAll('a[href^="guide.html"]').forEach(a=>{
    a.addEventListener('click',()=>persistSelected());
    if(a.dataset.baseHref === undefined) a.dataset.baseHref = 'guide.html';
    a.href = a.dataset.baseHref + suffix;
  });
}
function clearAllSelections(){
  selected.clear();
  clearSelectionStorage();
  renderSelected();
  updateCounts();
  renderGuidePreview();
  wireGuideLinks();
  if(page==='resources') renderResults();
  if(page==='guide') renderMatches();
  toast('Selected resources cleared.');
}
function setTrayCollapsed(collapsed){
  const app = document.querySelector('.app');
  const tray = $('guideTray');
  if(!app || !tray) return;
  app.classList.toggle('tray-collapsed', collapsed);
  tray.setAttribute('aria-hidden', collapsed ? 'true' : 'false');
  const label = collapsed ? 'Show Tray' : 'Hide Tray';
  $$('[id="trayCollapseBtn"]').forEach(b=>b.textContent = label);
  let floating = $('showTrayFloating');
  if(collapsed){
    if(!floating){
      floating = document.createElement('button');
      floating.id = 'showTrayFloating';
      floating.type = 'button';
      floating.className = 'btn primary floating-show-tray';
      floating.textContent = 'Show Guide Tray';
      floating.addEventListener('click',()=>setTrayCollapsed(false));
      document.body.appendChild(floating);
    }
    floating.style.display = 'block';
  }else if(floating){
    floating.style.display = 'none';
  }
  try{ sessionStorage.setItem('anchorPoint.trayCollapsed.v110', collapsed ? '1' : '0'); }catch(e){}
}
function toggleTrayCollapsed(){
  const app = document.querySelector('.app');
  setTrayCollapsed(!app?.classList.contains('tray-collapsed'));
}
function wireCommon(){
  $$('[id="clearSelectedBtn"], [id="clearSelectedBtn2"]').forEach(b=>b.addEventListener('click',()=>{clearAllSelections();}));
  $$('[id="copyGuideBtn"], [id="copyGuideBtn2"]').forEach(b=>b.addEventListener('click',copyGuide));
  $$('[id="printGuideBtn"], [id="printGuideBtn2"]').forEach(b=>b.addEventListener('click',printGuide));
  const tray=$('guideTray'); if($('trayToggle')) $('trayToggle').addEventListener('click',()=>tray.classList.toggle('open'));
  $$('[id="trayHideBtn"], [id="trayCollapseBtn"]').forEach(b=>b.addEventListener('click', toggleTrayCollapsed));
  try{
    const storedTray = sessionStorage.getItem('anchorPoint.trayCollapsed.v110');
    if(page === 'resources'){
      setTrayCollapsed(storedTray === null ? true : storedTray === '1');
    }else if(storedTray === '1'){
      setTrayCollapsed(true);
    }
  }catch(e){}
}
function initHome(){ const form=$('homeSearchForm'); if(form) form.addEventListener('submit',e=>{e.preventDefault(); location.href='resources.html?q='+encodeURIComponent($('homeSearch').value||'');}); }
function initResources(){
  const params=new URLSearchParams(location.search); const q=params.get('q')||''; activeWorkflow=params.get('workflow')||'';
  if($('keyword')) $('keyword').value=q; if($('q')) $('q').value=q; if(params.get('urgency') && $('urgency')) $('urgency').value=params.get('urgency');
  if($('viewMode')) $('viewMode').value=viewMode; if($('sortMode')) $('sortMode').value=sortMode;
  ['keyword','category','urgency','population','location'].forEach(id=>{ if($(id)) $(id).addEventListener('input', ()=>{activeWorkflow=''; renderResults();}); if($(id)) $(id).addEventListener('change', ()=>{activeWorkflow=''; renderResults();}); });
  if($('searchForm')) $('searchForm').addEventListener('submit',e=>{e.preventDefault(); activeWorkflow=''; $('keyword').value=$('q').value; renderResults();});
  if($('clearFilters')) $('clearFilters').addEventListener('click',()=>{['keyword','category','urgency','population','location','q'].forEach(id=>{if($(id)) $(id).value='';}); showingSelectedOnly=false; activeWorkflow=''; renderResults();});
  if($('showSelectedBtn')) $('showSelectedBtn').addEventListener('click',()=>{showingSelectedOnly=!showingSelectedOnly; $('showSelectedBtn').textContent=showingSelectedOnly?'Show All':'Show Selected'; renderResults();});
  if($('viewMode')) $('viewMode').addEventListener('change',e=>{viewMode=e.target.value; localStorage.setItem('anchorPoint.viewMode.v110',viewMode); renderResults();});
  if($('sortMode')) $('sortMode').addEventListener('change',e=>{sortMode=e.target.value; localStorage.setItem('anchorPoint.sortMode.v110',sortMode); renderResults();});
  renderResults();
}
function getFilters(){return {kw:low($('keyword')?.value||$('q')?.value),cat:txt($('category')?.value),urg:txt($('urgency')?.value),pop:txt($('population')?.value),loc:low($('location')?.value)};}
function workflowMatch(r){if(!activeWorkflow || !workflows[activeWorkflow]) return true; const blob=allText(r); return workflows[activeWorkflow].terms.some(t=>blob.includes(t));}
function filteredResources(){const f=getFilters(); let rows=resources.filter(r=>{
  if(showingSelectedOnly && !selected.has(r.id)) return false;
  if(!workflowMatch(r)) return false;
  if(f.kw && !keywordMatch(r,f.kw)) return false;
  if(f.cat && field(r,'category')!==f.cat) return false;
  if(f.urg && field(r,'urgency')!==f.urg) return false;
  if(f.pop && !popTags(r).includes(f.pop)) return false;
  if(f.loc && !low(r.location).includes(f.loc) && !low(r.notes).includes(f.loc)) return false;
  return true; });
  rows.sort((a,b)=>{
    if(f.kw){
      const rb = searchRelevanceScore(b,f.kw) - searchRelevanceScore(a,f.kw);
      if(rb) return rb;
    }
    if(sortMode==='name') return field(a,'organization').localeCompare(field(b,'organization'));
    if(sortMode==='category') return field(a,'category').localeCompare(field(b,'category')) || urgencyPriority(a)-urgencyPriority(b);
    if(sortMode==='verified') return field(b,'auditDate').localeCompare(field(a,'auditDate'));
    return urgencyPriority(a)-urgencyPriority(b) || field(a,'organization').localeCompare(field(b,'organization'));
  });
  return rows;
}
function renderResults(){
  const rows=filteredResources();
  const out=$('results');
  if(!out) return;
  out.classList.toggle('list-view', viewMode==='list');
  if($('resultCount')) $('resultCount').textContent=rows.length.toLocaleString()+' resources';
  const summary=[];
  const f=getFilters();
  if(activeWorkflow && workflows[activeWorkflow]) summary.push('Workflow: '+workflows[activeWorkflow].label);
  if(f.kw){
    const parsed=parseKeywordQuery(f.kw);
    summary.push(parsed.mode==='phrase' ? 'exact phrase' : 'all keywords');
  }
  if(f.cat) summary.push(f.cat);
  if(f.urg) summary.push(f.urg);
  if(f.pop) summary.push(f.pop);
  if(f.loc) summary.push('location');
  if(showingSelectedOnly) summary.push('selected only');
  if($('filterSummary')) $('filterSummary').textContent=summary.length?' · '+summary.join(' · '):'';
  if($('selectedInlineCount')) $('selectedInlineCount').textContent=selected.size;
  renderWorkflowContext();
  if(!rows.length){
    out.innerHTML='<div class="empty">No resources matched those filters. Try Clear Search, remove filters, or use a workflow from the Command page.</div>';
    return;
  }
  out.innerHTML=rows.slice(0,220).map(cardHTML).join('') + (rows.length>220?`<div class="empty">Showing first 220 of ${rows.length.toLocaleString()} matches. Narrow the search to reduce results.</div>`:'');
  wireCards();
}
function renderWorkflowContext(){const el=$('activeWorkflow'); if(!el) return; if(activeWorkflow && workflows[activeWorkflow]){const w=workflows[activeWorkflow]; el.innerHTML=`<strong>${esc(w.label)}</strong><span>Matched terms: ${esc(w.terms.join(', '))}</span><button class="mini-btn" id="clearWorkflowBtn" type="button">Clear workflow</button>`; el.classList.add('show'); $('clearWorkflowBtn')?.addEventListener('click',()=>{activeWorkflow=''; renderResults();});} else {el.innerHTML=''; el.classList.remove('show');}}
function cardHTML(r){
  const sel=selected.has(r.id);
  const url=field(r,'website');
  const f=getFilters();
  const reasons=f.kw ? matchReasons(r,f.kw) : [];
  const matched=reasons.length ? `<div class="matched">Matched: ${esc(reasons.join(', '))}</div>` : '';
  return `<article class="resource-card ${sel?'selected':''}" data-id="${esc(r.id)}"><div class="card-top"><div><h3>${esc(r.organization||'Unnamed Resource')}</h3><div class="service">${esc(r.serviceFunction||r.category||'Resource')}</div></div>${statusHTML(r)}</div><p class="desc">${esc(r.descriptionOfServices||r.notes||'No service description available.')}</p>${matched}<div class="chips"><span class="chip">${esc(r.category||'Category')}</span>${r.auditDate?`<span class="chip verified">Verified ${esc(r.auditDate)}</span>`:''}</div><div class="info"><div><b>Phone</b><br>${esc(r.phoneText||'Not listed')}</div><div><b>Hours</b><br>${esc(r.hours||'Not listed')}</div><div><b>Location</b><br>${esc(r.location||'Not listed')}</div><div><b>Population</b><br>${esc(r.population||'Not listed')}</div></div><div class="card-actions"><button class="mini-btn primary add-btn">${sel?'Added ✓':'Add to Guide'}</button><button class="mini-btn copy-one">Copy</button>${url?`<a class="mini-btn" href="${esc(url)}" target="_blank" rel="noopener">Open</a>`:''}</div></article>`;
}
function wireCards(){ $$('.resource-card').forEach(card=>{const id=card.dataset.id; card.querySelector('.add-btn')?.addEventListener('click',()=>toggle(id)); card.querySelector('.copy-one')?.addEventListener('click',()=>copyText(resourcePlain(recordById(id))));}); }
function toggle(id){ if(selected.has(id)){selected.delete(id); toast('Removed from guide.');} else {selected.add(id); toast('Added to guide.');} save(); if(page==='resources') renderResults(); if(page==='guide') renderMatches(); }
function renderSelected(){const list=$('selectedList'); if(!list) return; const rows=[...selected].map(recordById).filter(Boolean); if(!rows.length){list.innerHTML='<div class="empty">No resources selected yet.</div>'; return;} list.innerHTML=rows.map((r,i)=>`<div class="guide-item"><div><strong>${i+1}. ${esc(r.organization)}</strong><small>${esc(r.serviceFunction)} · ${esc(r.phoneText||'No phone')}</small><small>${esc(urgencyShort(r.urgency))} · ${esc(r.location||'No location')}</small></div><button class="mini-btn danger" title="Remove" data-remove="${esc(r.id)}">×</button></div>`).join(''); $$('[data-remove]').forEach(b=>b.addEventListener('click',()=>toggle(b.dataset.remove)));}
function initGuide(){refreshSelectedFromStorage(); ['callerNeed','callerLocation','callerPopulation','callerNotes'].forEach(id=>$(id)?.addEventListener('input',renderGuidePreview)); if($('guideSearchForm')) $('guideSearchForm').addEventListener('submit',e=>{e.preventDefault(); $('callerNeed').value=$('guideQuickSearch').value; renderMatches(); renderGuidePreview();}); if($('findMatchesBtn')) $('findMatchesBtn').addEventListener('click',renderMatches); renderGuidePreview(); renderSelected();}
function matchScore(r){const need=low($('callerNeed')?.value||$('guideQuickSearch')?.value); const loc=low($('callerLocation')?.value); const pop=low($('callerPopulation')?.value); let score=0; const blob=allText(r); if(need){need.split(/\s+/).filter(Boolean).forEach(t=>{ if(blob.includes(t)) score+=3; }); Object.values(workflows).forEach(w=>{ if(w.terms.some(t=>need.includes(t))) w.terms.forEach(t=>{ if(blob.includes(t)) score+=1; }); });} if(loc && (low(r.location).includes(loc)||low(r.notes).includes(loc))) score+=5; if(pop && low(r.population).includes(pop)) score+=4; if(low(r.urgency).includes('immediate')) score+=1; return score;}
function renderMatches(){const target=$('matchResults'); if(!target) return; const rows=resources.map(r=>[r,matchScore(r)]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1] || urgencyPriority(a[0])-urgencyPriority(b[0])).slice(0,20).map(x=>x[0]); if(!rows.length){target.innerHTML='<div class="empty">No matches yet. Try a simpler need such as shelter, food, benefits, recovery, family, or jobs.</div>'; return;} target.innerHTML=rows.map(r=>`<div class="guide-item"><div><strong>${esc(r.organization)}</strong><small>${esc(r.serviceFunction)} · ${esc(r.location||'No location')}</small><small>${esc(urgencyShort(r.urgency))} · ${esc(r.phoneText||'No phone')}</small></div><button class="mini-btn primary" data-addmatch="${esc(r.id)}">${selected.has(r.id)?'Added ✓':'Add'}</button></div>`).join(''); $$('[data-addmatch]').forEach(b=>b.addEventListener('click',()=>toggle(b.dataset.addmatch)));}
function selectedRows(){return [...selected].map(recordById).filter(Boolean);}
function context(){return {need:txt($('callerNeed')?.value),location:txt($('callerLocation')?.value),population:txt($('callerPopulation')?.value),notes:txt($('callerNotes')?.value)};}
function renderGuidePreview(){const p=$('guidePreview'); if(!p) return; const c=context(); const rows=selectedRows(); p.innerHTML=`<h2>Anchor Point Resource Guide</h2><p>Generated from approved resource records. Confirm audit dates before time-sensitive referrals.</p><div class="preview-meta"><div><b>Need</b><br>${esc(c.need||'Not specified')}</div><div><b>Location</b><br>${esc(c.location||'Not specified')}</div><div><b>Population</b><br>${esc(c.population||'Not specified')}</div></div>${c.notes?`<p><b>Notes:</b> ${esc(c.notes)}</p>`:''}<div class="preview-list">${rows.length?rows.map((r,i)=>`<div class="preview-row"><div class="idx">${i+1}</div><div class="content"><h3>${esc(r.organization)}</h3><p><b>${esc(r.serviceFunction)}</b> · ${esc(r.urgency)}</p><p>${esc(r.descriptionOfServices||r.notes)}</p><p><b>Phone:</b> ${esc(r.phoneText||'Not listed')} &nbsp; <b>Hours:</b> ${esc(r.hours||'Not listed')}</p><p><b>Location:</b> ${esc(r.location||'Not listed')}</p></div></div>`).join(''):'<div class="empty">No resources selected yet.</div>'}</div>`;}
function resourcePlain(r,i){if(!r) return ''; return `${i?i+'. ':''}${txt(r.organization)}\nService: ${txt(r.serviceFunction)}\nPhone: ${txt(r.phoneText)||'Not listed'}\nLocation: ${txt(r.location)||'Not listed'}\nHours: ${txt(r.hours)||'Not listed'}\nWebsite: ${txt(r.website)||'Not listed'}\nNotes: ${txt(r.notes)||txt(r.descriptionOfServices)||''}\nAudit Date: ${txt(r.auditDate)||'Not listed'}`;}
function guidePlain(){const c=context(); const rows=selectedRows(); return `ANCHOR POINT RESOURCE GUIDE\nNeed: ${c.need||'Not specified'}\nLocation: ${c.location||'Not specified'}\nPopulation: ${c.population||'Not specified'}\nNotes: ${c.notes||'None'}\n\n${rows.map((r,i)=>resourcePlain(r,i+1)).join('\n\n')}\n\nConfirm audit dates before time-sensitive referrals.`;}
async function copyText(t){try{await navigator.clipboard.writeText(t); toast('Copied.');}catch(e){toast('Copy failed.');}}
function copyGuide(){copyText(guidePlain());}
function printGuide(){refreshSelectedFromStorage(); const rows=selectedRows(); const c=context(); const html=`<div class="print-head"><div><h1>Anchor Point Resource Guide</h1><p>Generated from approved resource records. Confirm audit dates before time-sensitive referrals.</p></div><p>${new Date().toLocaleDateString()}</p></div><div class="print-meta"><div><b>Need</b><br>${esc(c.need||'Not specified')}</div><div><b>Location</b><br>${esc(c.location||'Not specified')}</div><div><b>Population</b><br>${esc(c.population||'Not specified')}</div><div><b>Notes</b><br>${esc(c.notes||'None')}</div></div><table class="print-table"><thead><tr><th>#</th><th>Resource</th><th>Contact</th><th>Location / Hours</th><th>Service / Notes</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td><div class="p-org">${esc(r.organization)}</div><div class="p-service">${esc(r.serviceFunction)}</div><div>${esc(r.urgency)}</div></td><td><b>${esc(r.phoneText||'Not listed')}</b><br>${r.website?`<span class="p-url">${esc(r.website)}</span>`:''}</td><td>${esc(r.location||'Not listed')}<br>${esc(r.hours||'Not listed')}</td><td>${esc(r.descriptionOfServices||'')}<br>${r.notes?`<b>Notes:</b> ${esc(r.notes)}<br>`:''}<span>Audit: ${esc(r.auditDate||'Not listed')}</span></td></tr>`).join('')}</tbody></table>`; $('printArea').innerHTML=html; window.print();}
load();
