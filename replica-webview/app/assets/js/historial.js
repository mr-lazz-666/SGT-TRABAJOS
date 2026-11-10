const db = dbLoad();

function escapeHtmlHistorial(valor){
  return String(valor == null ? '' : valor)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function renderHistorial(){
  const buscador = document.getElementById('buscadorHistorial');
  const tbody = document.getElementById('tbodyHistorial');
  const total = document.getElementById('totalHistorial');
  if(!tbody || !total) return;

  const q = (buscador?.value || '').trim().toLowerCase();
  const rows = Object.values(db.solicitudes || {})
    .filter(s => !s.eliminada && esSolicitudResuelta(s))
    .filter(s => {
      const j = db.juntas[s.juntaId];
      return !q || [s.folio, j && j.nombre, s.requerimiento, s.departamento, s.encargado, s.fecha]
        .map(v => String(v || ''))
        .join(' ')
        .toLowerCase()
        .includes(q);
    });

  rows.sort((a,b) => String(b.fecha || '').localeCompare(String(a.fecha || ''), 'es'));
  total.textContent = `${rows.length} resuelta${rows.length === 1 ? '' : 's'}`;

  if(!rows.length){
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Aún no hay solicitudes resueltas.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(s => {
    const j = db.juntas[s.juntaId];
    return `<tr class="fila-resuelta">
      <td><strong>${escapeHtmlHistorial(s.folio || '-')}</strong></td>
      <td>${escapeHtmlHistorial(j ? j.nombre : '-')}</td>
      <td>${escapeHtmlHistorial(s.requerimiento || '-')}</td>
      <td>${escapeHtmlHistorial(s.departamento || '-')}</td>
      <td>${escapeHtmlHistorial(s.encargado || '-')}</td>
      <td>${escapeHtmlHistorial(s.fecha || '-')}</td>
      <td><span class="estado-historico">Resuelta</span></td>
      <td><a href="solicitud-detalle.html?folio=${encodeURIComponent(s.folio)}">Ver</a></td>
    </tr>`;
  }).join('');
}

const buscadorHistorial = document.getElementById('buscadorHistorial');
if(buscadorHistorial) buscadorHistorial.addEventListener('input', renderHistorial);
renderHistorial();
