const db = dbLoad();
const sel = document.getElementById('selJunta');
Object.values(db.juntas).forEach(j => sel.innerHTML += `<option value="${j.id}">${j.nombre}</option>`);

const pre = new URLSearchParams(location.search).get('id');
if(pre){ sel.value = pre; render(); }
sel.addEventListener('change', render);

function fechaLarga(){
  return new Date().toLocaleDateString('es-CL', { day:'2-digit', month:'long', year:'numeric' });
}

// Arma el cuerpo de la minuta (agrupado por categoría, en el orden
// oficial 1 a 9) para una Junta y su listado de solicitudes.
// La usan tanto render() como exportarMinuta(), para no duplicar
// la lógica de agrupación.
function construirCuerpoMinuta(j, sols){
  let cuerpo = '';
  CATEGORIAS.forEach(cat => {
    const delGrupo = sols.filter(s => s.categoria === cat);
    if(!delGrupo.length) return;

    cuerpo += `<div class="minuta-cat-titulo">${cat}</div>`;
    delGrupo.forEach(s => {
      cuerpo += `
        <div class="minuta-junta-nombre">${j.nombre}</div>
        <p class="minuta-linea"><strong>Requerimiento:</strong> ${s.requerimiento || 'Sin especificar.'}</p>
        ${String(s.direccionProblema || '').trim() ? `<p class="minuta-linea"><strong>Ubicación del problema:</strong> ${s.direccionProblema}</p>` : ''}
        <p class="minuta-linea"><strong>Gestión acordada:</strong> ${s.gestion || 'Sin gestión registrada.'}</p>
        <p class="minuta-linea"><strong>Estado:</strong> ${s.estado}</p>`;
    });
  });
  return cuerpo;
}

function render(){
  const j = db.juntas[sel.value];
  const cont = document.getElementById('contenido');
  if(!j){ cont.innerHTML = '<div class="text-muted text-center py-4">Selecciona una Junta de Vecinos para generar su reporte.</div>'; return; }

  const sols = solicitudesDeJunta(db, j.id).filter(solicitudVisiblePDF);
  const cuerpo = construirCuerpoMinuta(j, sols);

  cont.innerHTML = `
    <div class="minuta-header"><img src="../assets/branding/logo-municipal.png" alt="Ilustre Municipalidad de San Bernardo" style="width:210px;max-width:65%;height:auto;object-fit:contain"><div class="minuta-subtitulo"></div></div>
    ${cuerpo || '<div class="text-muted text-center py-4">Esta Junta de Vecinos no tiene solicitudes registradas.</div>'}
    <div class="minuta-footer">Reporte SGT Municipal — Junta de Vecinos: ${j.nombre} | ${fechaLarga()}</div>`;
}

async function exportarPDF(){
  if(!sel.value){ alert('Selecciona una Junta primero.'); return; }
  const area = document.getElementById('reporteArea');
  const { jsPDF } = window.jspdf;
  const canvas = await html2canvas(area, { scale:2, backgroundColor:'#fff' });
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
  sgtDescargarPDF(pdf, `minuta-junta-${db.juntas[sel.value].codigo}-${new Date().toISOString().slice(0,10)}.pdf`);
}

// ============================================================
// EXPORTAR COMO MINUTA (versión offscreen, mismo patrón que
// reportes.js — no depende del scroll/tamaño de la pantalla actual)
// ============================================================

async function exportarMinuta(){
  if(!sel.value){ alert('Selecciona una Junta primero.'); return; }

  const j = db.juntas[sel.value];
  const sols = solicitudesDeJunta(db, j.id).filter(solicitudVisiblePDF);

  if(!sols.length){ alert('Esta Junta no tiene solicitudes registradas para generar la minuta.'); return; }

  const cuerpo = construirCuerpoMinuta(j, sols);

  // Contenedor temporal, oculto, de ancho fijo, para no depender del
  // tamaño/scroll de la pantalla actual al generar el PDF.
  const temp = document.createElement('div');
  temp.style.cssText = 'position:fixed; left:-9999px; top:0; width:800px; background:#fff; padding:24px;';
  temp.innerHTML = `
    <div class="minuta-header"><img src="../assets/branding/logo-municipal.png" alt="Ilustre Municipalidad de San Bernardo" style="width:210px;max-width:65%;height:auto;object-fit:contain"><div class="minuta-subtitulo">REPORTE POR JUNTA</div></div>
    ${cuerpo}
    <div class="minuta-footer">Reporte SGT Municipal — Junta de Vecinos: ${j.nombre} | ${fechaLarga()}</div>`;
  document.body.appendChild(temp);

  const { jsPDF } = window.jspdf;
  const canvas = await html2canvas(temp, { scale:2, backgroundColor:'#fff' });
  document.body.removeChild(temp);

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
      const tmp2 = document.createElement('canvas');
      tmp2.width = canvas.width; tmp2.height = (sliceH / w) * canvas.width;
      tmp2.getContext('2d').drawImage(canvas, 0, (y/h)*canvas.height, canvas.width, tmp2.height, 0, 0, tmp2.width, tmp2.height);
      if(y > 0) pdf.addPage();
      pdf.addImage(tmp2.toDataURL('image/jpeg',0.92), 'JPEG', 8, 8, w, sliceH);
      y += sliceH;
    }
  }
  sgtDescargarPDF(pdf, `minuta-junta-${j.codigo}-${new Date().toISOString().slice(0,10)}.pdf`);
}
function incluirCerradasPDF(){return !!document.getElementById('incluirResueltas')?.checked;}
function solicitudVisiblePDF(s){return !s.eliminada&&(incluirCerradasPDF()||!(esSolicitudResuelta(s)||/resuelt|cerrad|finalizad|terminad/i.test(String(s.estado||''))));}
const chkPDF=document.getElementById('incluirResueltas');if(chkPDF)chkPDF.addEventListener('change',()=>render());
