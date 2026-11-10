// ============================================================
// DETALLE DE SOLICITUD - SGT MUNICIPAL
// ============================================================

const db = dbLoad();
const folio = new URLSearchParams(location.search).get('folio');
const s = db.solicitudes[folio];
const cont = document.getElementById('contenido');

// Estilos de la grilla de fotos (por si el CSS de la página no los tiene)
(function inyectarEstilosFotos(){
  const st = document.createElement('style');
  st.textContent = `
    .foto-grid { display:flex; flex-wrap:wrap; gap:12px; }
    .foto-thumb { position:relative; width:135px; height:135px; border:1px solid #ddd; border-radius:8px; overflow:hidden; background:#f1f2f4; }
    .foto-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
    .foto-nombre { position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,.65); color:#fff; font-size:11px; padding:2px 6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .foto-eliminar { position:absolute; top:6px; right:6px; z-index:2; width:22px; height:22px; border:0; border-radius:50%; background:#e03131; color:#fff; line-height:1; cursor:pointer; }
  `;
  document.head.appendChild(st);
})();

// ------------------------------------------------------------
// UTILIDADES
// ------------------------------------------------------------
function escapeHtml(v){
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Color + etiqueta según el tipo de evento de historial
function claseHistorial(accion){
  const a = String(accion || '').toLowerCase();

  if(a.includes('crític') || a.includes('critic'))
    return { color:'#dc2626', bg:'#fef2f2', label:'Crítica' };
  if(a.includes('resuel'))
    return { color:'#059669', bg:'#ecfdf5', label:'Resuelta' };
  if(a.includes('proceso'))
    return { color:'#2563eb', bg:'#eff6ff', label:'En proceso' };
  if(a.includes('pendient'))
    return { color:'#ca8a04', bg:'#fefce8', label:'Pendiente' };

  if(a.includes('crear') || a.includes('creaci') || a.includes('ingres'))
    return { color:'#4f46e5', bg:'#eef2ff', label:'Creación' };
  if(a.includes('edit') || a.includes('actualiz') || a.includes('modific'))
    return { color:'#0891b2', bg:'#ecfeff', label:'Actualización' };

  return { color:'#64748b', bg:'#f8fafc', label:'Registro' };
}

function renderTimeline(historial){
  if(!Array.isArray(historial) || !historial.length){
    return '<p class="text-muted small mb-0">Sin eventos registrados.</p>';
  }
  return historial.map(h => {
    const c = claseHistorial(h.accion);
    return `
      <div class="timeline-item" style="--h-color:${c.color};--h-bg:${c.bg}">
        <span class="t-tag">${c.label}</span>
        <div class="t-title">${escapeHtml(h.accion || '-')}</div>
        <div class="t-time">${escapeHtml(h.fecha || '-')} — ${escapeHtml(h.usuario || 'Sistema')}</div>
        ${h.detalle ? `<div class="t-detalle">${escapeHtml(h.detalle)}</div>` : ''}
      </div>`;
  }).join('');
}

function renderFotos(sol){
  const fotos = Array.isArray(sol.fotos) ? sol.fotos : [];
  const data = sol.fotosData || {};

  if(!fotos.length){
    return '<p class="text-muted small mb-0">Sin fotos asociadas todavía.</p>';
  }

  return `<div class="foto-grid">${fotos.map(f => {
    const nombre = escapeHtml(f);
    const src = data[f];
    return `
      <div class="foto-thumb" data-foto="${nombre}">
        <button type="button" class="foto-eliminar" title="Eliminar esta foto" data-accion="eliminar">✕</button>
        <div data-accion="ver" style="cursor:pointer;width:100%;height:100%">
          ${src
            ? `<img src="${src}" alt="${nombre}">`
            : '<div class="d-flex align-items-center justify-content-center h-100 text-muted" style="font-size:24px">📷</div>'}
          <div class="foto-nombre">${nombre}</div>
        </div>
      </div>`;
  }).join('')}</div>`;
}

// ------------------------------------------------------------
// RENDER PRINCIPAL
// ------------------------------------------------------------
if(!s){
  cont.innerHTML = `
    <div class="card-flat text-center text-muted py-5">
      Folio no encontrado.<br>
      <a href="solicitudes.html" class="small">← Volver a Solicitudes</a>
    </div>`;
} else {
  document.getElementById('bcFolio').textContent = s.folio;

  const j = db.juntas[s.juntaId];
  const info = normalizarEstado(s.estado);
  const prioCls = s.prioridad === 'Alta' ? 'badge-alta' : s.prioridad === 'Media' ? 'badge-media' : 'badge-baja';
  const confPct = pctConfianza(s.confianza);

  cont.innerHTML = `
    <!-- BLOQUE 1: Encabezado -->
    <div class="mb-2">
      <h4 class="fw-bold text-primary mb-1">${escapeHtml(s.folio)}</h4>
      <div class="d-flex gap-2 flex-wrap">
        <span class="badge-categoria">${escapeHtml(s.categoria || '-')}</span>
        <span class="badge-pill ${info.cls}">${escapeHtml(s.estado || '-')}</span>
        <span class="badge-pill ${prioCls}">${escapeHtml(s.prioridad || '-')}</span>
        <span class="badge-pill" style="background:#eef2ff;color:#4338ca">Confianza: ${Number(s.confianza) || 0}/10 (${confPct}%)</span>
      </div>
    </div>

    <!-- BLOQUE 2: Acciones -->
    <div class="card-flat d-flex justify-content-between align-items-center mb-3 py-2 flex-wrap gap-2">
      <span class="small text-muted">
        Junta: <a href="junta-detalle.html?id=${j ? j.id : ''}" class="fw-semibold">${escapeHtml(j ? j.nombre : '-')}</a>
        ${j && j.direccion ? ` (${escapeHtml(j.direccion)})` : ''}
        &nbsp;|&nbsp; Folio Junta: <strong>${escapeHtml(j ? (j.codigo || j.id) : '-')}</strong>
        &nbsp;|&nbsp; Fecha: <strong>${escapeHtml(s.fecha || '-')}</strong>
      </span>
      <a href="solicitud-form.html?folio=${encodeURIComponent(s.folio)}" class="btn btn-primary btn-sm">✎ Editar solicitud</a>
    </div>

    <div class="row g-3">
      <div class="col-lg-8">

        <div class="card-flat mb-3">
          <h6 class="fw-bold mb-3">Información general</h6>
          <div class="row g-3">
            <div class="col-6"><div class="text-muted small">Departamento</div><div class="fw-semibold">${escapeHtml(s.departamento || '-')}</div></div>
            <div class="col-6"><div class="text-muted small">Encargado</div><div class="fw-semibold">${escapeHtml(s.encargado || '-')}</div></div>
            <div class="col-6"><div class="text-muted small">Nivel de confianza</div><div class="fw-semibold">${Number(s.confianza) || 0}/10 (${confPct}%)</div></div>
            <div class="col-6"><div class="text-muted small">Estatus</div><div class="fw-semibold">${s.estatus ? escapeHtml(s.estatus) : '<span class="text-muted">No informado (opcional)</span>'}</div></div>
            <div class="col-12"><div class="text-muted small">Referencias de dirección aproximada</div><div class="fw-semibold">${s.referenciaDireccionAproximada ? escapeHtml(s.referenciaDireccionAproximada) : '<span class="text-muted">Sin referencias aproximadas</span>'}</div><small class="text-muted">Referencia descriptiva, no georreferenciada automáticamente.</small></div>
            <div class="col-6"><div class="text-muted small">Dirección del problema</div><div class="fw-semibold">${s.direccionProblema ? escapeHtml(s.direccionProblema) : '<span class="text-muted">No especificada (opcional)</span>'}</div></div>
          </div>
        </div>

        <div class="card-flat mb-3">
          <h6 class="fw-bold mb-2">Requerimiento</h6>
          <p class="mb-0" style="font-size:13.5px">${s.requerimiento ? escapeHtml(s.requerimiento) : '<span class="text-muted">Sin registrar.</span>'}</p>
        </div>

        <div class="card-flat mb-3">
          <h6 class="fw-bold mb-2">Gestión acordada</h6>
          <p class="mb-0" style="font-size:13.5px">${s.gestion ? escapeHtml(s.gestion) : '<span class="text-muted">Sin registrar.</span>'}</p>
        </div>

        <!-- EVIDENCIAS -->
        <div class="card-flat">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="fw-bold mb-0">Evidencias fotográficas</h6>
            <a href="adjuntar-carpeta.html?folio=${encodeURIComponent(s.folio)}" class="small text-decoration-none">+ Adjuntar carpeta</a>
          </div>
          ${renderFotos(s)}
        </div>
      </div>

      <div class="col-lg-4">
        <div class="card-flat">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-bold mb-0">Historial</h6>
            <a href="historial-junta.html?junta=${j ? j.id : ''}" class="small text-decoration-none">Ver más →</a>
          </div>
          <div class="timeline">${renderTimeline(s.historial)}</div>
        </div>
      </div>
    </div>`;

  // Delegación de eventos para ver / eliminar fotos
  cont.addEventListener('click', e => {
    const thumb = e.target.closest('.foto-thumb');
    if(!thumb) return;
    const nombre = thumb.dataset.foto;
    const accion = e.target.closest('[data-accion]')?.dataset.accion;

    if(accion === 'eliminar'){
      e.stopPropagation();
      eliminarFoto(nombre);
    } else if(accion === 'ver'){
      verFotoGrande(nombre);
    }
  });
}

// ------------------------------------------------------------
// FOTOS: VER Y ELIMINAR
// ------------------------------------------------------------
function verFotoGrande(nombre){
  const dataUrl = s.fotosData && s.fotosData[nombre];
  if(!dataUrl){
    alert('Esta foto no tiene vista previa guardada. Vuelve a adjuntar la carpeta para generarla.');
    return;
  }
  const ventana = window.open('', '_blank');
  if(!ventana){
    alert('Tu navegador bloqueó la ventana emergente. Permítela para ver la foto en grande.');
    return;
  }
  ventana.document.write(
    `<title>${escapeHtml(nombre)}</title>
     <body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;height:100vh">
       <img src="${dataUrl}" style="max-width:100%;max-height:100%">
     </body>`
  );
  ventana.document.close();
}

function eliminarFoto(nombre){
  if(!confirm(`¿Eliminar la foto "${nombre}" de esta solicitud?`)) return;

  const nuevasFotos = (s.fotos || []).filter(f => f !== nombre);
  const nuevasFotosData = { ...(s.fotosData || {}) };
  delete nuevasFotosData[nombre];

  actualizarSolicitud(
    db, s.folio,
    { fotos: nuevasFotos, fotosData: nuevasFotosData },
    'Eliminó foto',
    `Se eliminó la imagen "${nombre}"`
  );
  db.solicitudes[s.folio].fotosData = nuevasFotosData; // por si actualizarSolicitud ignora fotosData
  dbSave(db);
  location.reload();
}