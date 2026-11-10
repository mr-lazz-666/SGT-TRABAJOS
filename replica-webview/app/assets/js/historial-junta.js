




function cargarFolios(){
  selF.innerHTML = '<option value="">Seleccione Folio...</option>';
  solicitudesDeJunta(db, selJ.value, true).forEach(s => selF.innerHTML += `<option value="${s.folio}">${s.folio} — ${s.categoria}</option>`);
  document.getElementById('cardTimeline').innerHTML = '<div class="text-muted text-center py-4">Selecciona un Folio.</div>';
}
selJ.addEventListener('change', cargarFolios);
if(preJunta) cargarFolios();

selF.addEventListener('change', ()=>{
  const s = db.solicitudes[selF.value];
  if(!s){ return; }
  document.getElementById('cardTimeline').innerHTML = `
    <h6 class="fw-bold mb-3">Historial de ${s.folio}</h6>
    <div class="timeline">${s.historial.map(h=>`<div class="timeline-item"><span class="timeline-dot" style="background:#2563eb"></span><div class="t-title">${h.accion}</div><div class="t-time">${h.fecha} — ${h.usuario}</div><div class="small text-muted">${h.detalle}</div></div>`).join('')}</div>`;
});

function claseHistorial(accion){
  const a = String(accion || '').toLowerCase();

  // Estados (prioridad más alta, colores exactos pedidos)
  if(a.includes('crític') || a.includes('critic'))
    return { color:'#dc2626', bg:'#fef2f2', label:'Crítica' };          // rojo
  if(a.includes('resuel'))
    return { color:'#059669', bg:'#ecfdf5', label:'Resuelta' };         // verde
  if(a.includes('proceso'))
    return { color:'#2563eb', bg:'#eff6ff', label:'En proceso' };       // azul
  if(a.includes('pendient'))
    return { color:'#ca8a04', bg:'#fefce8', label:'Pendiente' };        // amarillo

  // Otros tipos de evento (no son cambio de estado)
  if(a.includes('crear') || a.includes('creaci') || a.includes('ingres'))
    return { color:'#4f46e5', bg:'#eef2ff', label:'Creación' };
  if(a.includes('edit') || a.includes('actualiz') || a.includes('modific'))
    return { color:'#0891b2', bg:'#ecfeff', label:'Actualización' };

  return { color:'#64748b', bg:'#f8fafc', label:'Registro' };
}

const db = dbLoad();
const selJ = document.getElementById('selJunta'), selF = document.getElementById('selFolio');
Object.values(db.juntas).forEach(j=> selJ.innerHTML += `<option value="${j.id}">${j.nombre}</option>`);

const preJunta = new URLSearchParams(location.search).get('junta');
if(preJunta) selJ.value = preJunta;

function claseHistorial(accion){
  const a = String(accion || '').toLowerCase();

  // Estados (prioridad más alta, colores exactos pedidos)
  if(a.includes('crític') || a.includes('critic'))
    return { color:'#dc2626', bg:'#fef2f2', label:'Crítica' };          // rojo
  if(a.includes('resuel'))
    return { color:'#059669', bg:'#ecfdf5', label:'Resuelta' };         // verde
  if(a.includes('proceso'))
    return { color:'#2563eb', bg:'#eff6ff', label:'En proceso' };       // azul
  if(a.includes('pendient'))
    return { color:'#ca8a04', bg:'#fefce8', label:'Pendiente' };        // amarillo

  // Otros tipos de evento (no son cambio de estado)
  if(a.includes('crear') || a.includes('creaci') || a.includes('ingres'))
    return { color:'#4f46e5', bg:'#eef2ff', label:'Creación' };
  if(a.includes('edit') || a.includes('actualiz') || a.includes('modific'))
    return { color:'#0891b2', bg:'#ecfeff', label:'Actualización' };

  return { color:'#64748b', bg:'#f8fafc', label:'Registro' };
}

function renderTimeline(historial){
  if(!historial || !historial.length) return '<p class="text-muted small mb-0">Sin eventos registrados.</p>';
  return historial.map(h => {
    const c = claseHistorial(h.accion);
    return `
      <div class="timeline-item" style="--h-color:${c.color};--h-bg:${c.bg}">
        <span class="t-tag">${c.label}</span>
        <div class="t-title">${h.accion || '-'}</div>
        <div class="t-time">${h.fecha || '-'} — ${h.usuario || 'Sistema'}</div>
        ${h.detalle ? `<div class="t-detalle">${h.detalle}</div>` : ''}
      </div>`;
  }).join('');
}

function cargarFolios(){
  selF.innerHTML = '<option value="">Seleccione Folio...</option>';
  solicitudesDeJunta(db, selJ.value, true).forEach(s => selF.innerHTML += `<option value="${s.folio}">${s.folio} — ${s.categoria}</option>`);
  document.getElementById('cardTimeline').innerHTML = '<div class="text-muted text-center py-4">Selecciona un Folio.</div>';
}
selJ.addEventListener('change', cargarFolios);
if(preJunta) cargarFolios();

selF.addEventListener('change', ()=>{
  const s = db.solicitudes[selF.value];
  if(!s){ return; }
  const j = db.juntas[s.juntaId];
  const confPct = pctConfianza(s.confianza);
  document.getElementById('cardTimeline').innerHTML = `
    <h6 class="fw-bold mb-1">Historial de ${s.folio}</h6>
    <div class="info-folio">
      Junta: <strong>${j?j.nombre:'-'}</strong>${j&&j.direccion?` (${j.direccion})`:''}
      &nbsp;|&nbsp; Folio Junta: <strong>${j?(j.codigo||j.id):'-'}</strong>
      &nbsp;|&nbsp; Confianza: <strong>${s.confianza||0}/10 (${confPct}%)</strong>
    </div>
    <div class="timeline">${renderTimeline(s.historial)}</div>`;
});