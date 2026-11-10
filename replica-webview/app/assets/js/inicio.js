const db = dbLoad();
const sols = Object.values(db.solicitudes).filter(s => !s.eliminada && !esSolicitudResuelta(s));

// -------- Estadísticas --------
const conteo = { pendiente:0, proceso:0, critica:0, resuelta:0 };
sols.forEach(s => conteo[normalizarEstado(s.estado).key]++);
document.getElementById('stats').innerHTML = `
  <div class="col"><div class="stat-card blue"><div class="stat-label">Total solicitudes</div><div class="stat-value">${sols.length}</div></div></div>
  <div class="col"><div class="stat-card orange"><div class="stat-label">Pendientes</div><div class="stat-value">${conteo.pendiente}</div></div></div>
  <div class="col"><div class="stat-card purple"><div class="stat-label">En proceso</div><div class="stat-value">${conteo.proceso}</div></div></div>
  <div class="col"><div class="stat-card red"><div class="stat-label">Críticas</div><div class="stat-value">${conteo.critica}</div></div></div>
  <div class="col"><div class="stat-card green"><div class="stat-label">Resueltas</div><div class="stat-value">${conteo.resuelta}</div></div></div>`;

// -------- Solicitudes prioritarias (prioridad Alta) --------
document.getElementById('tbodyPrioritarias').innerHTML = sols
  .filter(s => s.prioridad === 'Alta')
  .slice(0, 8)
  .map(s => {
    const j = db.juntas[s.juntaId];
    const info = normalizarEstado(s.estado);
    return `<tr>
      <td><a href="solicitud-detalle.html?folio=${encodeURIComponent(s.folio)}">${s.folio}</a></td>
      <td>${j ? j.nombre : '-'}</td>
      <td><span class="badge-categoria">${s.categoria}</span></td>
      <td><span class="badge-pill badge-alta">${s.prioridad}</span></td>
      <td><span class="badge-pill ${info.cls}">${s.estado}</span></td>
      <td>${s.fecha || '-'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" class="text-center text-muted py-3">Sin solicitudes prioritarias registradas.</td></tr>';

// -------- Actividad reciente (últimos eventos de historial, de todas las solicitudes) --------
const eventos = [];
sols.forEach(s => s.historial.forEach(h => eventos.push({ ...h, folio: s.folio })));
eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

document.getElementById('timelineReciente').innerHTML = eventos.slice(0, 6).map(ev => `
  <div class="timeline-item">
    <span class="timeline-dot" style="background:#2563eb"></span>
    <div class="t-title">${ev.folio} — ${ev.accion}</div>
    <div class="t-time">${ev.fecha} · ${ev.usuario}</div>
  </div>`).join('') || '<div class="text-muted small">Sin actividad reciente.</div>';

// -------- Mini mapa de vista previa (no interactivo) --------
const miniMap = L.map('miniMap', {
  zoomControl:false, dragging:false, scrollWheelZoom:false, doubleClickZoom:false,
  touchZoom:false, boxZoom:false, keyboard:false, attributionControl:false
}).setView([-33.5928, -70.7053], 14);
SGTMaps.addBaseLayer(miniMap);

function crearPinMini(color){
  return L.divIcon({ className:'', html:`<div class="pin-icon" style="background:${color}"></div>`, iconSize:[16,16], iconAnchor:[8,16] });
}
Object.values(db.juntas).forEach(j => {
  const sJ = solicitudesDeJunta(db, j.id).filter(s => !esSolicitudResuelta(s));
  const color = sJ.some(s => normalizarEstado(s.estado).key === 'critica') ? '#dc2626'
    : sJ.some(s => normalizarEstado(s.estado).key === 'proceso') ? '#7c3aed'
    : sJ.some(s => normalizarEstado(s.estado).key === 'pendiente') ? '#d97706' : '#16a34a';
  L.marker([j.lat, j.lng], { icon: crearPinMini(color) }).addTo(miniMap);
});
setTimeout(() => miniMap.invalidateSize(), 200);

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