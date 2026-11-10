// ============================================================
// SOLICITUDES - SGT MUNICIPAL
// ============================================================
const db = dbLoad();
document.getElementById('fCategoria').innerHTML += CATEGORIAS.map(c=>`<option>${c}</option>`).join('');
document.getElementById('fDepto').innerHTML += db.departamentos.map(d=>`<option>${d}</option>`).join('');

function render(){
  const texto = document.getElementById('buscador').value.toLowerCase();
  const est = document.getElementById('fEstado').value;
  const cat = document.getElementById('fCategoria').value;
  const dep = document.getElementById('fDepto').value;
  const rows = Object.values(db.solicitudes).filter(s=>{
    if(s.eliminada || esSolicitudResuelta(s)) return false;
    if(est && normalizarEstado(s.estado).key !== est) return false;
    if(cat && s.categoria !== cat) return false;
    if(dep && s.departamento !== dep) return false;
    if(texto && !(s.folio+s.requerimiento).toLowerCase().includes(texto)) return false;
    return true;
  });
  document.getElementById('tbody').innerHTML = rows.map(s=>{
    const j = db.juntas[s.juntaId]; const info = normalizarEstado(s.estado);
    return `<tr><td><a href="solicitud-detalle.html?folio=${encodeURIComponent(s.folio)}">${s.folio}</a></td><td>${j?j.nombre:'-'}</td>
      <td><span class="badge-categoria">${s.categoria}</span></td><td class="small">${s.departamento||'-'}</td>
      <td><span class="badge-pill badge-${s.prioridad==='Alta'?'alta':s.prioridad==='Media'?'media':'baja'}">${s.prioridad}</span></td>
      <td><span class="badge-pill ${info.cls}">${s.estado}</span></td>
      <td>${pctConfianza(s.confianza)}%</td>
      <td><a href="solicitud-detalle.html?folio=${encodeURIComponent(s.folio)}">Ver detalles</a></td></tr>`;
  }).join('') || '<tr><td colspan="8" class="text-center text-muted py-4">Sin resultados.</td></tr>';
}
['buscador','fEstado','fCategoria','fDepto'].forEach(id=>document.getElementById(id).addEventListener('input', render));
render();

// ============================================================
// RELLENAR SELECTS
// ============================================================

document.getElementById('fCategoria').innerHTML +=
  (typeof CATEGORIAS !== 'undefined' ? CATEGORIAS : [])
    .map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`)
    .join('');

document.getElementById('fDepto').innerHTML +=
  (db.departamentos || [])
    .map(d => `<option value="${escapeAttr(d)}">${escapeHtml(d)}</option>`)
    .join('');

// ============================================================
// RENDER
// ============================================================

function render(){
  const texto = document.getElementById('buscador').value.toLowerCase().trim();
  const est = document.getElementById('fEstado').value;
  const cat = document.getElementById('fCategoria').value;
  const dep = document.getElementById('fDepto').value;

  const rows = Object.values(db.solicitudes || {}).filter(s => {
    if(s.eliminada || esSolicitudResuelta(s)) return false;

    if(est && normalizarEstado(s.estado).key !== est) return false;
    if(cat && s.categoria !== cat) return false;
    if(dep && s.departamento !== dep) return false;

    if(texto){
      const blob = (
        String(s.folio || '') + ' ' +
        String(s.requerimiento || '') + ' ' +
        String(s.gestion || '')
      ).toLowerCase();
      if(!blob.includes(texto)) return false;
    }

    return true;
  });

  // Ordenar por fecha descendente (las más nuevas primero)
  rows.sort((a, b) => {
    const fa = parseFecha(a.fecha)?.getTime() || 0;
    const fb = parseFecha(b.fecha)?.getTime() || 0;
    return fb - fa;
  });

  const tbody = document.getElementById('tbody');

  if(!rows.length){
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-4">
          Sin resultados.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map(s => {
    const j = db.juntas[s.juntaId];
    const info = normalizarEstado(s.estado);

    const prioCls =
      s.prioridad === 'Alta'  ? 'badge-alta'  :
      s.prioridad === 'Media' ? 'badge-media' :
                                'badge-baja';

    return `
      <tr>
        <td>
          <a href="solicitud-detalle.html?folio=${encodeURIComponent(s.folio)}"
             class="fw-semibold text-decoration-none">
            ${escapeHtml(s.folio)}
          </a>
        </td>
        <td>${escapeHtml(j ? j.nombre : '-')}</td>
        <td><span class="badge-categoria">${escapeHtml(s.categoria || '-')}</span></td>
        <td class="small">${escapeHtml(s.departamento || '-')}</td>
        <td>
          <span class="badge-pill ${prioCls}">
            ${escapeHtml(s.prioridad || '-')}
          </span>
        </td>
        <td>
          <span class="badge-pill ${info.cls}">
            ${escapeHtml(s.estado || '-')}
          </span>
        </td>
        <td>
          <a href="solicitud-detalle.html?folio=${encodeURIComponent(s.folio)}"
             class="small text-decoration-none">
            Ver detalles →
          </a>
        </td>
      </tr>
    `;
  }).join('');
}

// ============================================================
// EVENTOS
// ============================================================

['buscador','fEstado','fCategoria','fDepto'].forEach(id => {
  const el = document.getElementById(id);
  if(el) el.addEventListener('input', render);
});

render();

// ============================================================
// UTILIDADES LOCALES
// ============================================================

function parseFecha(valor){
  if(!valor) return null;
  if(valor instanceof Date) return isNaN(valor) ? null : valor;

  const s = String(valor).trim();
  if(!s) return null;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if(m){
    let anio = Number(m[3]);
    if(anio < 100) anio += 2000;
    return new Date(anio, Number(m[2]) - 1, Number(m[1]));
  }

  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function escapeHtml(v){
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
function escapeAttr(v){ return escapeHtml(v); }


function render(){
  const texto = document.getElementById('buscador').value.toLowerCase();
  const est = document.getElementById('fEstado').value;
  const cat = document.getElementById('fCategoria').value;
  const dep = document.getElementById('fDepto').value;
  const rows = Object.values(db.solicitudes).filter(s=>{
    if(s.eliminada || esSolicitudResuelta(s)) return false;
    if(est && normalizarEstado(s.estado).key !== est) return false;
    if(cat && s.categoria !== cat) return false;
    if(dep && s.departamento !== dep) return false;
    if(texto && !(s.folio+s.requerimiento).toLowerCase().includes(texto)) return false;
    return true;
  });
  document.getElementById('tbody').innerHTML = rows.map(s=>{
    const j = db.juntas[s.juntaId]; const info = normalizarEstado(s.estado);
    return `<tr><td><a href="solicitud-detalle.html?folio=${encodeURIComponent(s.folio)}">${s.folio}</a></td><td>${j?j.nombre:'-'}</td>
      <td><span class="badge-categoria">${s.categoria}</span></td><td class="small">${s.departamento||'-'}</td>
      <td><span class="badge-pill badge-${s.prioridad==='Alta'?'alta':s.prioridad==='Media'?'media':'baja'}">${s.prioridad}</span></td>
      <td><span class="badge-pill ${info.cls}">${s.estado}</span></td>
      <td>${pctConfianza(s.confianza)}%</td>
      <td><a href="solicitud-detalle.html?folio=${encodeURIComponent(s.folio)}">Ver detalles</a></td></tr>`;
  }).join('') || '<tr><td colspan="8" class="text-center text-muted py-4">Sin resultados.</td></tr>';
}
['buscador','fEstado','fCategoria','fDepto'].forEach(id=>document.getElementById(id).addEventListener('input', render));
render();