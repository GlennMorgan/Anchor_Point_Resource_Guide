
const DATA_URL = 'data/resources.json';
const META_URL = 'data/resources_metadata.json';
const STORAGE_KEY = 'anchorPointSelectedResources.v12';
let resources = [];
let selectedIds = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));

const $ = (id) => document.getElementById(id);
const text = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const norm = (v) => text(v).toLowerCase();
const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b));
const safe = (s) => text(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function saveSelected(){ localStorage.setItem(STORAGE_KEY, JSON.stringify([...selectedIds])); updateSelectedBadges(); }
function updateSelectedBadges(){
  const n = selectedIds.size;
  ['selectedCountBadge','toolbarSelectedCount','statSelected'].forEach(id => { if($(id)) $(id).textContent = n; });
}
function showToast(msg){
  const old = document.querySelector('.toast'); if(old) old.remove();
  const t = document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t);
  setTimeout(()=>t.remove(),2200);
}
function resourceText(r){ return [r.category,r.serviceFunction,r.organization,r.phoneText,r.urgency,r.population,r.descriptionOfServices,r.location,r.hours,r.website,r.email,r.notes].map(text).join(' ').toLowerCase(); }
function validUrgency(v){
  const s=text(v); if(!s || /^https?:/i.test(s) || s.length>60) return false;
  if(/apply now|see website|contact/i.test(s)) return false;
  return true;
}
function getPopTags(r){
  let tags = Array.isArray(r.populationTags) ? r.populationTags : [];
  if(!tags.length && r.population) tags = r.population.split(/[;,]/);
  return tags.map(t=>text(t)).filter(Boolean);
}
async function loadData(){
  try{
    const [res, metaRes] = await Promise.all([fetch(DATA_URL), fetch(META_URL).catch(()=>null)]);
    if(!res.ok) throw new Error(`Could not load ${DATA_URL}. Status ${res.status}`);
    resources = await res.json();
    let meta = null;
    try{ if(metaRes && metaRes.ok) meta = await metaRes.json(); }catch(e){}
    hydrateGlobal(meta);
    routePage();
  } catch(err){
    console.error(err);
    const target = $('resourcesList') || $('matchResults') || document.querySelector('.main-panel');
    if(target) target.innerHTML = `<div class="error-box"><strong>Resource data did not load.</strong><br>${safe(err.message)}<br><br>When testing locally, use a local server or GitHub Pages instead of opening with file://.</div>`;
  }
}
function hydrateGlobal(meta){
  updateSelectedBadges();
  if($('railRecordCount')) $('railRecordCount').textContent = `${resources.length.toLocaleString()} records`;
  if($('statRecords')) $('statRecords').textContent = resources.length.toLocaleString();
  if($('statCategories')) $('statCategories').textContent = uniq(resources.map(r=>r.category)).length;
  if($('statVerified')) $('statVerified').textContent = resources.filter(r => /corrected|verified/i.test(`${r.correctionStatus||''} ${r.verificationStatus||''}`)).length.toLocaleString();
  document.querySelectorAll('.rail-nav a').forEach(a=>{ if(a.dataset.nav === document.body.dataset.page) a.classList.add('active'); });
}
function routePage(){
  const page = document.body.dataset.page;
  if(page === 'home') initHome();
  if(page === 'resources') initResources();
  if(page === 'guide') initGuide();
}
function initHome(){
  $('homeSearchBtn')?.addEventListener('click', () => {
    const q = encodeURIComponent($('homeQuickSearch').value.trim());
    location.href = `resources.html${q ? '?q='+q : ''}`;
  });
  $('homeQuickSearch')?.addEventListener('keydown', (e) => { if(e.key==='Enter') $('homeSearchBtn').click(); });
}
function fillSelect(el, vals){ vals.forEach(v => el.insertAdjacentHTML('beforeend', `<option value="${safe(v)}">${safe(v)}</option>`)); }
function initResources(){
  fillSelect($('categoryFilter'), uniq(resources.map(r=>r.category)));
  fillSelect($('urgencyFilter'), uniq(resources.map(r=>r.urgency).filter(validUrgency)));
  fillSelect($('populationFilter'), uniq(resources.flatMap(getPopTags)));
  const params = new URLSearchParams(location.search);
  if(params.get('q')) $('searchInput').value = params.get('q');
  if(params.get('urgency')) $('urgencyFilter').value = params.get('urgency');
  ['searchInput','categoryFilter','urgencyFilter','populationFilter','locationFilter'].forEach(id => $(id).addEventListener('input', renderResources));
  $('clearFiltersBtn').addEventListener('click',()=>{ ['searchInput','categoryFilter','urgencyFilter','populationFilter','locationFilter'].forEach(id=>$(id).value=''); renderResources(); });
  renderResources();
}
function filterResources({q='', category='', urgency='', population='', location=''}={}){
  const terms = norm(q).split(/\s+/).filter(Boolean);
  return resources.filter(r => {
    if(category && r.category !== category) return false;
    if(urgency && r.urgency !== urgency) return false;
    if(population && !getPopTags(r).some(t => norm(t) === norm(population))) return false;
    if(location && !norm(`${r.location} ${r.notes}`).includes(norm(location))) return false;
    if(terms.length && !terms.every(t => resourceText(r).includes(t))) return false;
    return true;
  });
}
function renderResources(){
  const filters = { q:$('searchInput').value, category:$('categoryFilter').value, urgency:$('urgencyFilter').value, population:$('populationFilter').value, location:$('locationFilter').value };
  const results = filterResources(filters);
  $('resultCount').textContent = `${results.length.toLocaleString()} resources`;
  const active = Object.entries(filters).filter(([k,v])=>v).map(([k,v])=>`${k}: ${v}`);
  $('filterSummary').textContent = active.length ? active.join(' • ') : 'Showing all records';
  $('resourcesList').innerHTML = results.slice(0,240).map(resourceCard).join('') + (results.length>240 ? `<div class="empty-state">Showing first 240 records. Narrow the search for more precision.</div>` : '');
  bindResourceButtons();
}
function resourceCard(r){
  const isSel = selectedIds.has(r.id);
  const urgencyClass = /immediate|urgent|crisis/i.test(r.urgency) ? ' urgent' : '';
  return `<article class="resource-card ${isSel?'selected':''}" data-id="${safe(r.id)}">
    <div class="card-top"><div><h3>${safe(r.organization||'Unnamed Resource')}</h3><div class="service-line">${safe(r.serviceFunction||r.category||'Resource')}</div></div><span class="chip${urgencyClass}">${safe(r.urgency||'No urgency')}</span></div>
    <p class="card-desc">${safe(r.descriptionOfServices||r.notes||'No description available.')}</p>
    <div class="chip-row">${[r.category, ...getPopTags(r).slice(0,2)].filter(Boolean).map(v=>`<span class="chip">${safe(v)}</span>`).join('')}</div>
    <div class="detail-grid"><div><b>Phone</b><br>${safe(r.phoneText||'Not listed')}</div><div><b>Location</b><br>${safe(r.location||'Not listed')}</div><div><b>Hours</b><br>${safe(r.hours||'Not listed')}</div><div><b>Audit</b><br>${safe(r.auditDate||r.auditDateOriginal||'Not listed')}</div></div>
    <div class="card-actions"><button class="ghost-btn small select-btn" data-id="${safe(r.id)}">${isSel?'Remove':'Select'}</button>${r.website?`<a class="ghost-btn small" target="_blank" rel="noopener" href="${safe(r.website)}">Website</a>`:''}</div>
  </article>`;
}
function bindResourceButtons(){
  document.querySelectorAll('.select-btn').forEach(btn => btn.addEventListener('click', () => toggleSelected(btn.dataset.id)));
}
function toggleSelected(id){
  if(selectedIds.has(id)){ selectedIds.delete(id); showToast('Removed from guide'); }
  else { selectedIds.add(id); showToast('Added to guide'); }
  saveSelected();
  if(document.body.dataset.page==='resources') renderResources();
  if(document.body.dataset.page==='guide') renderSelected();
}
function initGuide(){
  fillSelect($('callerPopulation'), uniq(resources.flatMap(getPopTags)));
  fillSelect($('callerUrgency'), uniq(resources.map(r=>r.urgency).filter(validUrgency)));
  $('findMatchesBtn').addEventListener('click', renderMatches);
  ['callerNeed','callerLocation','callerPopulation','callerUrgency'].forEach(id => $(id).addEventListener('keydown', e => { if(e.key==='Enter') renderMatches(); }));
  $('clearSelectedBtn').addEventListener('click',()=>{ selectedIds.clear(); saveSelected(); renderSelected(); renderPrintTable(); });
  $('copyGuideBtn').addEventListener('click',()=>copyText(buildGuideText(false),'Guide copied'));
  $('copyNoteBtn').addEventListener('click',()=>copyText(buildGuideText(true),'Call note copied'));
  $('printGuideBtn').addEventListener('click',()=>{ renderPrintTable(); window.print(); });
  renderSelected();
}
function renderMatches(){
  const filters = {q:$('callerNeed').value, location:$('callerLocation').value, population:$('callerPopulation').value, urgency:$('callerUrgency').value};
  const matches = filterResources(filters).slice(0,30);
  $('matchResults').innerHTML = matches.length ? matches.map(r => `<div class="mini-resource"><strong>${safe(r.organization)}</strong><p>${safe(r.serviceFunction)} • ${safe(r.phoneText||'No phone')} • ${safe(r.location||'No location')}</p><p>${safe(r.descriptionOfServices||'')}</p><div class="mini-actions"><button class="ghost-btn small select-btn" data-id="${safe(r.id)}">${selectedIds.has(r.id)?'Remove':'Select'}</button>${r.website?`<a class="ghost-btn small" target="_blank" rel="noopener" href="${safe(r.website)}">Website</a>`:''}</div></div>`).join('') : '<div class="empty-state">No matching resources found. Broaden the caller need or location.</div>';
  bindResourceButtons();
}
function selectedResources(){ return [...selectedIds].map(id => resources.find(r=>r.id===id)).filter(Boolean); }
function renderSelected(){
  const rows = selectedResources();
  $('selectedResources').innerHTML = rows.length ? rows.map(r => `<div class="selected-item"><div><strong>${safe(r.organization)}</strong><small>${safe(r.serviceFunction)} • ${safe(r.phoneText||'No phone')} • ${safe(r.location||'No location')}</small></div><button class="ghost-btn small select-btn" data-id="${safe(r.id)}">Remove</button></div>`).join('') : '<div class="empty-state">No resources selected. Use matching resources or search to add items.</div>';
  bindResourceButtons(); renderPrintTable();
}
function buildGuideText(noteOnly=false){
  const ctx = [$('callerNeed')?.value && `Need: ${$('callerNeed').value}`, $('callerLocation')?.value && `Location: ${$('callerLocation').value}`, $('callerPopulation')?.value && `Population: ${$('callerPopulation').value}`, $('callerUrgency')?.value && `Urgency: ${$('callerUrgency').value}`].filter(Boolean).join(' | ');
  const rows = selectedResources();
  if(noteOnly){ return `Anchor Point call note${ctx?' - '+ctx:''}. Resources provided: ${rows.map(r=>`${r.organization} (${r.phoneText||'no phone listed'})`).join('; ') || 'none selected'}.`; }
  return `Anchor Point Resource Guide${ctx?'\n'+ctx:''}\n\n` + rows.map((r,i)=>`${i+1}. ${r.organization}\nService: ${r.serviceFunction||''}\nPhone/Text: ${r.phoneText||'Not listed'}\nLocation: ${r.location||'Not listed'}\nHours: ${r.hours||'Not listed'}\nWebsite: ${r.website||'Not listed'}\nNotes: ${r.notes||r.descriptionOfServices||''}`).join('\n\n');
}
async function copyText(txt,msg){ await navigator.clipboard.writeText(txt); showToast(msg); }
function renderPrintTable(){
  const tbody = document.querySelector('#printTable tbody'); if(!tbody) return;
  const rows = selectedResources();
  const ctx = [$('callerNeed')?.value && `Need: ${$('callerNeed').value}`, $('callerLocation')?.value && `Location: ${$('callerLocation').value}`, $('callerPopulation')?.value && `Population: ${$('callerPopulation').value}`, $('callerUrgency')?.value && `Urgency: ${$('callerUrgency').value}`].filter(Boolean).join(' | ');
  if($('printContext')) $('printContext').textContent = ctx || 'Selected resources';
  tbody.innerHTML = rows.map((r,i)=>`<tr><td>${i+1}</td><td><div class="print-org">${safe(r.organization)}</div><div class="print-service">${safe(r.category)} / ${safe(r.serviceFunction)}</div><div class="print-desc">${safe(r.descriptionOfServices)}</div></td><td><strong>${safe(r.phoneText||'Not listed')}</strong><br>${r.email?`<span class="print-muted">${safe(r.email)}</span><br>`:''}${r.website?`<span class="print-url">${safe(r.website)}</span>`:''}</td><td>${safe(r.location||'Not listed')}<br><span class="print-muted">${safe(r.hours||'Hours not listed')}</span></td><td>${safe(r.notes||'')}<br><span class="print-muted">Urgency: ${safe(r.urgency||'')} | Audit: ${safe(r.auditDate||r.auditDateOriginal||'')}</span></td></tr>`).join('');
}
loadData();
