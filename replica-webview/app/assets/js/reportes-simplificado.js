const db = dbLoad();
document.getElementById('fechaGeneracion').textContent = new Date().toLocaleDateString('es-CL', {day:'2-digit',month:'long',year:'numeric'});

// Estilos en línea para que html2canvas los capture bien en el PDF
const ESTADOS = {
  critica:   { label: 'Crítica',    plural: 'Críticas',   bg: '#fee2e2', color: '#b91c1c' },
  proceso:   { label: 'En proceso', plural: 'En proceso', bg: '#ede9fe', color: '#7c3aed' },
  pendiente: { label: 'Pendiente',  plural: 'Pendientes', bg: '#fef3c7', color: '#b45309' },
  resuelta:  { label: 'Resuelta',   plural: 'Resueltas',  bg: '#dcfce7', color: '#15803d' }
};

function badgeEstado(estadoRaw){
  const key = normalizarEstado(estadoRaw).key;
  const e = ESTADOS[key];
  if(!e) return '<span class="text-muted">-</span>';
  return `<span style="background:${e.bg};color:${e.color};padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;white-space:nowrap">${e.label}</span>`;
}

let estadoActivo = null;
document.querySelectorAll('[data-est]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    estadoActivo = btn.dataset.est || null; // "" = todas
    render();
  });
});

function render(){
  document.getElementById('tituloReporte').textContent =
    estadoActivo ? `Solicitudes: ${ESTADOS[estadoActivo].plural}` : 'Todas las solicitudes';

  const sols = Object.values(db.solicitudes).filter(s =>
    solicitudVisiblePDF(s) && (!estadoActivo || normalizarEstado(s.estado).key === estadoActivo)
  );

  document.getElementById('tbody').innerHTML = sols.map(s=>{
    const j = db.juntas[s.juntaId];
    return `<tr>
      <td><a href="solicitud-detalle.html?folio=${encodeURIComponent(s.folio)}">${s.folio}</a></td>
      <td>${badgeEstado(s.estado)}</td>
      <td>${j?j.nombre:'-'}</td>
      <td><span class="badge-categoria">${s.categoria}</span></td>
      <td>${s.departamento||'-'}</td>
      <td class="small">${s.requerimiento||'<span class="text-muted">Sin especificar.</span>'}${String(s.direccionProblema||'').trim()?`<div class="mt-1"><strong>Ubicación del problema:</strong> ${s.direccionProblema}</div>`:''}</td>
      <td class="small">${s.gestion||'<span class="text-muted">Sin gestión registrada.</span>'}</td>
      <td>${s.fecha||'-'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" class="text-center text-muted py-3">Sin resultados para este estado.</td></tr>';
}
render();

async function exportarPDF(){
  const area = document.getElementById('reporteArea');
  const noPrint = document.querySelectorAll('.no-print');
  noPrint.forEach(el => el.style.display = 'none');
  await new Promise(r => setTimeout(r, 200));

  const { jsPDF } = window.jspdf;
  const canvas = await html2canvas(area, { scale:2, backgroundColor:'#fff' });
  noPrint.forEach(el => el.style.display = '');

  const pdf = new jsPDF('p','mm','a4');
  const w = pdf.internal.pageSize.getWidth() - 16;
  const h = (canvas.height * w) / canvas.width;
  const pageH = pdf.internal.pageSize.getHeight() - 16;

  if(h <= pageH){
    pdf.addImage(canvas.toDataURL('image/jpeg',0.92), 'JPEG', 8, 8, w, h);
  } else {
    let y = 0;
    while(y < h){
      const sliceH = Math.min(pageH, h - y);
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width; tmp.height = (sliceH / w) * canvas.width;
      tmp.getContext('2d').drawImage(canvas, 0, (y/h)*canvas.height, canvas.width, tmp.height, 0, 0, tmp.width, tmp.height);
      if(y > 0) pdf.addPage();
      pdf.addImage(tmp.toDataURL('image/jpeg',0.92), 'JPEG', 8, 8, w, sliceH);
      y += sliceH;
    }
  }
  sgtDescargarPDF(pdf, `reporte-simplificado-${new Date().toISOString().slice(0,10)}.pdf`);
}
function incluirCerradasPDF(){return !!document.getElementById('incluirResueltas')?.checked;}
function solicitudVisiblePDF(s){return !s.eliminada&&(incluirCerradasPDF()||!(esSolicitudResuelta(s)||/resuelt|cerrad|finalizad|terminad/i.test(String(s.estado||''))));}
const chkPDF=document.getElementById('incluirResueltas');if(chkPDF)chkPDF.addEventListener('change',()=>render());
