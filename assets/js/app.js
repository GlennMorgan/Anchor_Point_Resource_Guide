
const DATA_URL = 'data/resources.json';
const META_URL = 'data/resources_metadata.json';
const SELECTED_KEY = 'anchorPointSelectedResources.v2';
const GUIDE_KEY = 'anchorPointGuideFields.v2';
let allResources = [], metadata = {}, filteredResources = [], visibleCount = 60, showSelectedOnly = false;
const page = document.body.dataset.page;
const $ = (id) => document.getElementById(id);
const clean = (v) => String(v ?? '').trim();
const lower = (v) => clean(v).toLowerCase();
const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
function getSelected(){ try{return JSON.parse(localStorage.getItem(SELECTED_KEY)||'[]')}catch{return []} }
function setSelected(ids){ localStorage.setItem(SELECTED_KEY, JSON.stringify([...new Set(ids)])); updateSelectedCount(); }
function isSelected(id){ return getSelected().includes(id); }
function updateSelectedCount(){ const el=$('selectedCountBadge'); if(el) el.textContent = getSelected().length; }
function escapeHtml(v){ return clean(v).replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function toast(message){ let el=$('toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el);} el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2200); }
async function loadData(){
  try{
    const [res, meta] = await Promise.all([fetch(DATA_URL), fetch(META_URL).catch(()=>null)]);
    if(!res.ok) throw new Error('Could not load data/resources.json');
    allResources = await res.json();
    metadata = meta && meta.ok ? await meta.json() : {recordCount: allResources.length};
    filteredResources = allResources;
    hydrateCommonStats();
    if(page==='home') initHome();
    if(page==='resources') initResources();
    if(page==='guide') initGuide();
    updateSelectedCount();
  }catch(err){
    console.error(err);
    const msg = `<div class="empty-state"><strong>Resource data did not load.</strong><p>This usually happens only when opening the files directly from Windows. Upload to GitHub Pages or run a local web server. The browser must load <code>data/resources.json</code> over http/https.</p></div>`;
    ['results','selectedResources','guideOutput','homeStatus'].forEach(id=>{ if($(id)) $(id).innerHTML=msg; });
  }
}
function hydrateCommonStats(){
  const total = allResources.length;
  const cats = uniq(allResources.map(r=>r.category)).length;
  const urgent = allResources.filter(r=>lower(r.urgency).includes('urgent') || lower(r.urgency).includes('crisis')).length;
  const audited = allResources.filter(r=>r.auditDate).length;
  const map = {statTotal:total, statCategories:cats, statUrgent:urgent, statAudited:audited, heroTotal:total, heroCategories:cats, heroUrgent:urgent, heroSelected:getSelected().length};
  Object.entries(map).forEach(([id,val])=>{ if($(id)) $(id).textContent = Number(val).toLocaleString(); });
  if($('dataLine')) $('dataLine').textContent = `Loaded ${total.toLocaleString()} records from resources.json. Metadata count: ${(metadata.recordCount||total).toLocaleString()}.`;
}
function optionList(select, values, allLabel){ select.innerHTML = `<option value="">${allLabel}</option>` + values.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join(''); }
function populationValues(){ return uniq(allResources.flatMap(r=>Array.isArray(r.populationTags)?r.populationTags:clean(r.population).split(';')).map(clean)); }
function urgencyClass(u){ const x=lower(u); if(x.includes('crisis')||x.includes('emergency')) return 'crisis'; if(x.includes('urgent')) return 'urgent'; return 'ok'; }
function resourceCard(r){
  const selected = isSelected(r.id);
  const phone = r.phoneText ? `<div class="detail"><b>Phone</b><span>${escapeHtml(r.phoneText)}</span></div>` : '';
  const loc = r.location ? `<div class="detail"><b>Location</b><span>${escapeHtml(r.location)}</span></div>` : '';
  const hours = r.hours ? `<div class="detail"><b>Hours</b><span>${escapeHtml(r.hours)}</span></div>` : '';
  const web = r.website ? `<div class="detail"><b>Website</b><a href="${escapeHtml(r.website)}" target="_blank" rel="noopener">Open site</a></div>` : '';
  const notes = r.notes ? `<div class="detail"><b>Notes</b><span>${escapeHtml(r.notes)}</span></div>` : '';
  const audit = r.auditDate || r.auditDateOriginal ? `<span class="chip">Verified ${escapeHtml(r.auditDate || r.auditDateOriginal)}</span>` : '';
  return `<article class="resource-card ${selected?'selected-card':''}" data-id="${escapeHtml(r.id)}">
    <div class="resource-top"><div><h3>${escapeHtml(r.organization || 'Unnamed Resource')}</h3><p class="service">${escapeHtml(r.serviceFunction || r.category || '')}</p></div></div>
    <div class="chip-row" style="margin-top:14px"><span class="tag ${urgencyClass(r.urgency)}">${escapeHtml(r.urgency || 'No urgency set')}</span>${audit}</div>
    <p class="resource-desc">${escapeHtml(r.descriptionOfServices || r.description || 'No description provided.')}</p>
    <div class="detail-list">${phone}${loc}${hours}${web}${notes}</div>
    <div class="card-actions no-print"><button class="btn ${selected?'success':'primary'}" data-action="toggle" data-id="${escapeHtml(r.id)}">${selected?'Selected for Guide':'Add to Guide'}</button><button class="btn secondary" data-action="copy" data-id="${escapeHtml(r.id)}">Copy</button></div>
  </article>`;
}
function resourceText(r){ return `${r.organization || 'Resource'}\nService: ${r.serviceFunction || r.category || ''}\nPhone: ${r.phoneText || 'Not listed'}\nLocation: ${r.location || 'Not listed'}\nHours: ${r.hours || 'Not listed'}\nPurpose: ${r.descriptionOfServices || ''}\nWebsite: ${r.website || 'Not listed'}\nNotes: ${r.notes || ''}\nVerified: ${r.auditDate || r.auditDateOriginal || 'Not listed'}`.trim(); }
function toggleResource(id){ const ids=getSelected(); const next=ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]; setSelected(next); hydrateCommonStats(); if(page==='resources') renderResults(); if(page==='guide') renderGuide(); toast(ids.includes(id)?'Removed from guide':'Added to guide'); }
function initResources(){ optionList($('categoryFilter'), uniq(allResources.map(r=>r.category)), 'All categories'); optionList($('urgencyFilter'), uniq(allResources.map(r=>r.urgency)), 'All urgency levels'); optionList($('populationFilter'), populationValues(), 'All populations'); ['searchInput','categoryFilter','urgencyFilter','populationFilter','locationFilter'].forEach(id=>$(id).addEventListener(id.includes('Filter')?'change':'input', applyFilters)); $('clearFilters').addEventListener('click',()=>{ ['searchInput','categoryFilter','urgencyFilter','populationFilter','locationFilter'].forEach(id=>$(id).value=''); showSelectedOnly=false; applyFilters(); }); $('showSelected').addEventListener('click',()=>{ showSelectedOnly=!showSelectedOnly; applyFilters(); }); $('clearSelected').addEventListener('click',()=>{ setSelected([]); renderResults(); toast('Guide selections cleared'); }); $('loadMore').addEventListener('click',()=>{ visibleCount += 60; renderResults(); }); $('results').addEventListener('click',handleCardClick); applyFilters(); }
function applyFilters(){ const q=lower($('searchInput')?.value), cat=lower($('categoryFilter')?.value), urg=lower($('urgencyFilter')?.value), pop=lower($('populationFilter')?.value), loc=lower($('locationFilter')?.value); const selectedSet=new Set(getSelected()); filteredResources = allResources.filter(r=>{ const hay=lower([r.category,r.serviceFunction,r.organization,r.phoneText,r.urgency,r.population,r.descriptionOfServices,r.location,r.hours,r.website,r.email,r.notes].join(' ')); const pops = lower([r.population, ...(r.populationTags||[])].join(' ')); return (!q||hay.includes(q)) && (!cat||lower(r.category)===cat) && (!urg||lower(r.urgency)===urg) && (!pop||pops.includes(pop)) && (!loc||lower(r.location).includes(loc) || lower(r.notes).includes(loc)) && (!showSelectedOnly||selectedSet.has(r.id)); }); visibleCount=60; renderResults(); }
function renderResults(){ const box=$('results'), count=$('resultCount'); if(count) count.textContent=filteredResources.length.toLocaleString(); if($('selectedInlineCount')) $('selectedInlineCount').textContent=getSelected().length; if(!filteredResources.length){ box.innerHTML='<div class="empty-state"><strong>No matching resources.</strong><p>Try clearing a filter or broadening the keyword search.</p></div>'; return; } box.innerHTML = `<div class="resource-grid">${filteredResources.slice(0,visibleCount).map(resourceCard).join('')}</div>`; $('loadMore').style.display = filteredResources.length>visibleCount ? 'inline-flex' : 'none'; updateSelectedCount(); }
function handleCardClick(e){ const btn=e.target.closest('button'); if(!btn) return; const id=btn.dataset.id; const r=allResources.find(x=>x.id===id); if(btn.dataset.action==='toggle') toggleResource(id); if(btn.dataset.action==='copy' && r){ navigator.clipboard.writeText(resourceText(r)); toast('Resource copied'); } }
function initHome(){ const recent = [...allResources].sort((a,b)=>clean(b.auditDate).localeCompare(clean(a.auditDate))).slice(0,5); if($('homeStatus')) $('homeStatus').innerHTML = recent.map(r=>`<div class="selected-item"><div><strong>${escapeHtml(r.organization)}</strong><span class="muted tiny">${escapeHtml(r.category)} • Verified ${escapeHtml(r.auditDate || r.auditDateOriginal || 'n/a')}</span></div></div>`).join(''); }
function selectedResources(){ const ids=new Set(getSelected()); return allResources.filter(r=>ids.has(r.id)); }
function initGuide(){ ['callerNeed','callerLocation','callerPopulation','staffNotes'].forEach(id=>{ const el=$(id); if(el){ el.value=(JSON.parse(localStorage.getItem(GUIDE_KEY)||'{}')[id]||''); el.addEventListener('input',saveGuideFields); }}); $('clearGuide').addEventListener('click',()=>{ setSelected([]); renderGuide(); toast('Guide cleared'); }); $('printGuide').addEventListener('click',()=>window.print()); $('copyGuide').addEventListener('click',()=>{ navigator.clipboard.writeText(buildGuideText(false)); toast('Caller guide copied'); }); $('copyNotes').addEventListener('click',()=>{ navigator.clipboard.writeText(buildGuideText(true)); toast('Internal notes copied'); }); $('selectedResources').addEventListener('click',e=>{ const b=e.target.closest('button[data-remove]'); if(b) toggleResource(b.dataset.remove); }); renderGuide(); }
function saveGuideFields(){ const data={}; ['callerNeed','callerLocation','callerPopulation','staffNotes'].forEach(id=>data[id]=$(id)?.value||''); localStorage.setItem(GUIDE_KEY, JSON.stringify(data)); renderGuide(); }
function buildGuideText(internal=false){ const f=JSON.parse(localStorage.getItem(GUIDE_KEY)||'{}'); const list=selectedResources(); let text = internal ? 'ANCHOR POINT INTERNAL CALL NOTE\n' : 'ANCHOR POINT RESOURCE GUIDE\n'; text += `Need: ${f.callerNeed || 'Not specified'}\nLocation: ${f.callerLocation || 'Not specified'}\nPopulation: ${f.callerPopulation || 'Not specified'}\n`;
  if(f.staffNotes) text += `${internal?'Staff Notes':'Notes'}: ${f.staffNotes}\n`; text += '\nRecommended Resources:\n';
  if(!list.length) text += 'No resources selected yet.\n';
  list.forEach((r,i)=>{ text += `\n${i+1}. ${r.organization || 'Resource'}\nService: ${r.serviceFunction || r.category || ''}\nPhone: ${r.phoneText || 'Not listed'}\nLocation: ${r.location || 'Not listed'}\nHours: ${r.hours || 'Not listed'}\nPurpose: ${r.descriptionOfServices || ''}\nWebsite: ${r.website || 'Not listed'}\nVerified: ${r.auditDate || r.auditDateOriginal || 'Not listed'}\n`; });
  text += '\nUse listed audit dates before giving time-sensitive referrals.'; return text; }
function renderGuide(){ const list=selectedResources(); updateSelectedCount(); if($('guideCount')) $('guideCount').textContent=list.length; const selectedBox=$('selectedResources'); if(selectedBox){ selectedBox.innerHTML = list.length ? list.map(r=>`<div class="selected-item"><div><strong>${escapeHtml(r.organization)}</strong><span class="muted tiny">${escapeHtml(r.serviceFunction || r.category || '')}</span></div><button class="btn danger" data-remove="${escapeHtml(r.id)}">Remove</button></div>`).join('') : '<div class="empty-state"><strong>No resources selected.</strong><p>Use the Search page to add resources to this caller guide.</p></div>'; }
  const f=JSON.parse(localStorage.getItem(GUIDE_KEY)||'{}'); const out=$('guideOutput'); if(!out) return; out.innerHTML = `<div class="guide-document"><div class="guide-header-box"><div><p class="kicker">Anchor Point</p><h2>Custom Resource Guide</h2><p class="muted">Generated from approved resource records. Confirm audit dates before time-sensitive referrals.</p></div><div class="chip">${list.length} selected</div></div><div class="script-box"><strong>Caller Summary</strong>\nNeed: ${escapeHtml(f.callerNeed || 'Not specified')}\nLocation: ${escapeHtml(f.callerLocation || 'Not specified')}\nPopulation: ${escapeHtml(f.callerPopulation || 'Not specified')}\n${f.staffNotes?`Notes: ${escapeHtml(f.staffNotes)}`:''}</div>${list.length?list.map((r,i)=>`<section class="print-resource"><h3>${i+1}. ${escapeHtml(r.organization)}</h3><p><strong>${escapeHtml(r.serviceFunction || r.category || '')}</strong></p><p>${escapeHtml(r.descriptionOfServices || '')}</p><div class="detail-list"><div class="detail"><b>Phone</b><span>${escapeHtml(r.phoneText || 'Not listed')}</span></div><div class="detail"><b>Location</b><span>${escapeHtml(r.location || 'Not listed')}</span></div><div class="detail"><b>Hours</b><span>${escapeHtml(r.hours || 'Not listed')}</span></div><div class="detail"><b>Website</b><span>${escapeHtml(r.website || 'Not listed')}</span></div><div class="detail"><b>Verified</b><span>${escapeHtml(r.auditDate || r.auditDateOriginal || 'Not listed')}</span></div></div></section>`).join(''):'<div class="empty-state"><strong>No resources selected.</strong><p>Add resources from the Search page.</p></div>'}</div>`; }
loadData();
