import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const cfg = window.APP_CONFIG || {};
if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) throw new Error('Falta APP_CONFIG en js/config.js');

const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
window.supabase = supabase;

let pendingFiles = [];
let proveedores = [];
let hoteleriaByCodigo = {};

const el = (id) => document.getElementById(id);
const txt = (v) => (v ?? '').toString().trim();
const intv = (v) => { const n = parseInt(String(v ?? '').replace(/[^\d-]/g,''), 10); return Number.isFinite(n) ? n : 0; };
const boolv = (v) => ['si','sí','true','1','x','ok','yes'].includes(txt(v).toLowerCase());
const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function setLoginMsg(text, isErr=false){ const box = el('loginMsg'); if(box){ box.textContent=text; box.className='login-msg'+(isErr?' err':''); } }
function setUploadStatus(text, type=''){ const n=el('uploadStatus'); if(n){ n.style.display='inline-block'; n.className='upload-status'+(type?' '+type:''); n.textContent=text; } }
function resetUploadStatus(){ const n=el('uploadStatus'); if(n){ n.style.display='none'; n.className='upload-status'; n.textContent=''; } }

function renderFileChips(){
  const box = el('fileChips');
  if(!box) return;
  if(!pendingFiles.length){ box.style.display='none'; box.innerHTML=''; return; }
  box.style.display='flex';
  box.innerHTML = pendingFiles.map((f,i)=>`<span class="file-chip">${esc(f.name)} <button data-i="${i}" type="button">×</button></span>`).join('');
  box.querySelectorAll('button').forEach(btn => btn.addEventListener('click', ()=>{
    pendingFiles.splice(Number(btn.dataset.i),1); renderFileChips(); el('btnLoad').disabled = pendingFiles.length===0;
  }));
}

async function getSession(){ const {data,error}=await supabase.auth.getSession(); if(error) throw error; return data.session; }
async function login(email,password){ const {data,error}=await supabase.auth.signInWithPassword({email,password}); if(error) throw error; return data; }
async function logout(){ await supabase.auth.signOut(); location.reload(); }

async function updateHeaderUser(){
  const session = await getSession().catch(()=>null);
  el('headerUser').textContent = session?.user?.email || 'Sin sesión';
  el('loginOverlay').classList.toggle('hidden', !!session);
}

async function loadDataFromDB(){
  const {data,error} = await supabase.from('proveedores').select('*').eq('activo', true).order('razon_social', {ascending:true});
  if(error) throw error;
  proveedores = data || [];
  hoteleriaByCodigo = {};
  const codigos = proveedores.map(p=>p.proveedor_codigo).filter(Boolean);
  if(codigos.length){
    const {data:hot,error:hError} = await supabase.from('hoteleria').select('*').in('proveedor_codigo', codigos);
    if(hError) throw hError;
    (hot || []).forEach(h => hoteleriaByCodigo[h.proveedor_codigo] = h);
  }
  renderAll();
}

function renderAll(){
  const q = txt(el('searchInput')?.value).toLowerCase();
  let rows = [...proveedores];
  if(q){
    rows = rows.filter(p => [p.proveedor_codigo,p.razon_social,p.nombre_fantasia,p.localidad,p.giro_principal,p.categoria,p.subcategoria,p.descripcion]
      .some(v => txt(v).toLowerCase().includes(q)));
  }
  el('kpiTotal').textContent = proveedores.length;
  el('kpiHoteles').textContent = proveedores.filter(p => /hotel/i.test(txt(p.categoria)+' '+txt(p.subcategoria)+' '+txt(p.giro_principal))).length;
  el('kpiLocalidades').textContent = new Set(proveedores.map(p => txt(p.localidad)).filter(Boolean)).size;
  el('kpiRubros').textContent = new Set(proveedores.map(p => txt(p.giro_principal)).filter(Boolean)).size;
  const grid = el('cardsGrid'), empty = el('emptyState');
  if(!rows.length){
    grid.classList.add('hidden'); empty.classList.remove('hidden');
    empty.textContent = proveedores.length ? 'No hay resultados para tu búsqueda.' : 'La base está vacía. Inicia sesión y carga el Excel para poblarla.';
    grid.innerHTML=''; return;
  }
  empty.classList.add('hidden'); grid.classList.remove('hidden');
  grid.innerHTML = rows.map(p => {
    const h = hoteleriaByCodigo[p.proveedor_codigo] || null;
    const hotelInfo = h ? `<div class="card-info-row"><strong>Hotelería:</strong> ${[
      `S Priv ${h.hab_simples_privado||0}`,`S Comp ${h.hab_simples_compartido||0}`,
      `D Priv ${h.hab_dobles_privado||0}`,`D Comp ${h.hab_dobles_compartido||0}`,
      `T Priv ${h.hab_triples_privado||0}`,`T Comp ${h.hab_triples_compartido||0}`,
      `Camas MGI ${h.camas_instaladas_mgi||0}`,`Prog. Centinela ${txt(h.participa_programa_centinela)||'N/D'}`
    ].join(' · ')}</div>` : '';
    return `<article class="card"><div class="card-header"><span class="card-loc">${esc(p.localidad || 'Sin localidad')}</span><div class="card-nombre">${esc(p.nombre_fantasia || p.razon_social || 'Sin nombre')}</div><div class="card-razon">${esc(p.razon_social || '')}</div></div><div class="card-body"><div>${txt(p.giro_principal)?`<span class="giro-tag">${esc(p.giro_principal)}</span>`:''}</div><div class="card-info-row"><strong>Código:</strong> ${esc(p.proveedor_codigo||'—')}</div><div class="card-info-row"><strong>RUT:</strong> ${esc(p.rut_empresa||'—')}</div><div class="card-info-row"><strong>Comuna:</strong> ${esc(p.comuna||'—')}</div><div class="card-info-row"><strong>Teléfono:</strong> ${esc(p.telefono||'—')}</div><div class="card-info-row"><strong>Email:</strong> ${esc(p.email||'—')}</div>${hotelInfo}</div></article>`;
  }).join('');
}

function mapProveedorRow(r){
  return {
    proveedor_codigo: txt(r.proveedor_codigo || r.PROVEEDOR_CODIGO),
    rut_empresa: txt(r.rut_empresa || r.RUT_EMPRESA),
    razon_social: txt(r.razon_social || r.RAZON_SOCIAL),
    nombre_fantasia: txt(r.nombre_fantasia || r.NOMBRE_FANTASIA),
    comuna: txt(r.comuna || r.COMUNA),
    localidad: txt(r.localidad || r.LOCALIDAD),
    direccion: txt(r.direccion || r.DIRECCION),
    telefono: txt(r.telefono || r.TELEFONO),
    email: txt(r.email || r.EMAIL),
    sitio_web: txt(r.sitio_web || r.SITIO_WEB),
    descripcion: txt(r.descripcion || r.DESCRIPCION),
    giro_principal: txt(r.giro_principal || r.GIRO_PRINCIPAL),
    categoria: txt(r.categoria || r.CATEGORIA),
    subcategoria: txt(r.subcategoria || r.SUBCATEGORIA),
    estado_validacion: txt(r.estado_validacion || r.ESTADO_VALIDACION || 'pendiente'),
    tiene_servicio_am: boolv(r.tiene_servicio_am || r.TIENE_SERVICIO_AM),
    estado_servicio_am: txt(r.estado_servicio_am || r.ESTADO_SERVICIO_AM),
    observaciones: txt(r.observaciones || r.OBSERVACIONES),
    activo: true
  };
}

function mapHoteleriaRow(r){
  return {
    proveedor_codigo: txt(r.proveedor_codigo || r.PROVEEDOR_CODIGO),
    habitaciones_totales: intv(r.habitaciones_totales || r.HABITACIONES_TOTALES),
    hab_simples_privado: intv(r.hab_simples_privado || r.HAB_SIMPLES_PRIVADO),
    hab_simples_compartido: intv(r.hab_simples_compartido || r.HAB_SIMPLES_COMPARTIDO),
    hab_dobles_privado: intv(r.hab_dobles_privado || r.HAB_DOBLES_PRIVADO),
    hab_dobles_compartido: intv(r.hab_dobles_compartido || r.HAB_DOBLES_COMPARTIDO),
    hab_triples_privado: intv(r.hab_triples_privado || r.HAB_TRIPLES_PRIVADO),
    hab_triples_compartido: intv(r.hab_triples_compartido || r.HAB_TRIPLES_COMPARTIDO),
    camas_instaladas_mgi: intv(r.camas_instaladas_mgi || r.CAMAS_INSTALADAS_MGI),
    participa_programa_centinela: txt(r.participa_programa_centinela || r.PARTICIPA_PROGRAMA_CENTINELA),
    cliente: txt(r.cliente || r.CLIENTE),
    observaciones: txt(r.observaciones || r.OBSERVACIONES),
    fecha_reporte: txt(r.fecha_reporte || r.FECHA_REPORTE) || null
  };
}

async function upsertRows(table, rows, conflict){ if(!rows.length) return; const {error} = await supabase.from(table).upsert(rows, {onConflict: conflict}); if(error) throw error; }

async function processExcelFiles(){
  if(!pendingFiles.length) return;
  setUploadStatus('Procesando archivos...');
  const proveedorRows = [], hoteleriaRows = [];
  for(const file of pendingFiles){
    const wb = XLSX.read(await file.arrayBuffer(), {type:'array'});
    if(wb.Sheets['Proveedores']) XLSX.utils.sheet_to_json(wb.Sheets['Proveedores'], {defval:''}).map(mapProveedorRow).filter(r => r.proveedor_codigo || r.razon_social).forEach(r => proveedorRows.push(r));
    if(wb.Sheets['Hoteleria']) XLSX.utils.sheet_to_json(wb.Sheets['Hoteleria'], {defval:''}).map(mapHoteleriaRow).filter(r => r.proveedor_codigo).forEach(r => hoteleriaRows.push(r));
  }
  if(!proveedorRows.length){ setUploadStatus('No se encontraron filas válidas en la hoja Proveedores.','err'); return; }
  try{
    await upsertRows('proveedores', proveedorRows, 'proveedor_codigo');
    if(hoteleriaRows.length) await upsertRows('hoteleria', hoteleriaRows, 'proveedor_codigo');
    pendingFiles = []; renderFileChips(); el('btnLoad').disabled = true;
    setUploadStatus(`Carga completada: ${proveedorRows.length} proveedores${hoteleriaRows.length ? ` · ${hoteleriaRows.length} filas hotelería` : ''}`,'ok');
    await loadDataFromDB();
  }catch(err){ console.error(err); setUploadStatus('Error al guardar en la base de datos: '+err.message,'err'); }
}

function bindUpload(){
  const input = el('fileInput'), drop = el('dropArea'), load = el('btnLoad');
  input.addEventListener('change', e => { pendingFiles = Array.from(e.target.files || []).filter(f => /\.(xlsx|xls)$/i.test(f.name)); renderFileChips(); load.disabled = pendingFiles.length===0; if(pendingFiles.length) resetUploadStatus(); });
  ['dragenter','dragover'].forEach(evt => drop.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); drop.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(evt => drop.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('dragover'); }));
  drop.addEventListener('drop', e => { pendingFiles = Array.from(e.dataTransfer.files || []).filter(f => /\.(xlsx|xls)$/i.test(f.name)); renderFileChips(); load.disabled = pendingFiles.length===0; if(pendingFiles.length) resetUploadStatus(); });
  load.addEventListener('click', processExcelFiles);
}

async function boot(){
  bindUpload();
  el('searchInput').addEventListener('input', renderAll);
  el('btnLogout').addEventListener('click', logout);
  el('btnLogin').addEventListener('click', async () => {
    try{
      setLoginMsg('Validando sesión...');
      await login(el('loginEmail').value.trim(), el('loginPassword').value);
      await updateHeaderUser(); await loadDataFromDB(); setLoginMsg('Sesión iniciada.');
    }catch(err){ console.error(err); setLoginMsg(err.message || 'No fue posible iniciar sesión.', true); }
  });
  await updateHeaderUser();
  const session = await getSession().catch(()=>null);
  if(session){ await loadDataFromDB(); setLoginMsg('Sesión activa.'); }
}

window.addEventListener('DOMContentLoaded', boot);
