// ============================================================
// REPORTES POR DEPARTAMENTO - SGT MUNICIPAL
// ============================================================

const db = dbLoad();
const sel = document.getElementById('selDepto');
// ---------- Cargar departamentos ----------
db.departamentos.forEach(d => {
  sel.innerHTML += `<option value="${d}">${d}</option>`;
});
sel.addEventListener('change', render);

// ---------- Fecha actual ----------
const fechaLarga = () => new Date().toLocaleDateString('es-CL', {
  day: '2-digit',
  month: 'long',
  year: 'numeric'
});

// ---------- Renderizar reporte ----------
function render() {
  const depto = sel.value;
  const cont = document.getElementById('contenido');

  if (!depto) {
    cont.innerHTML = `
      <div class="text-muted text-center py-4">
        Selecciona un Departamento para generar su reporte.
      </div>
    `;
    return;
  }

  const sols = Object.values(db.solicitudes).filter(
    s => solicitudVisiblePDF(s) && s.departamento === depto
  );

  // ---------- Agrupar por categoría ----------
  let cuerpo = '';

  CATEGORIAS.forEach(cat => {
    const delGrupo = sols.filter(s => s.categoria === cat);
    if (!delGrupo.length) return;

    cuerpo += `<div class="minuta-cat-titulo">${cat}</div>`;

    delGrupo.forEach(s => {
      const j = db.juntas[s.juntaId];

      cuerpo += `
        <div class="minuta-junta-nombre">${j ? j.nombre : '(Junta no identificada)'}</div>
        <p class="minuta-linea"><strong>Requerimiento:</strong> ${s.requerimiento || 'Sin especificar.'}</p>
        ${String(s.direccionProblema || '').trim() ? `<p class="minuta-linea"><strong>Ubicación del problema:</strong> ${s.direccionProblema}</p>` : ''}
        <p class="minuta-linea"><strong>Gestión acordada:</strong> ${s.gestion || 'Sin gestión registrada.'}</p>
        <p class="minuta-linea"><strong>Estado:</strong> ${s.estado}</p>
      `;
    });
  });

  // ---------- Mostrar reporte ----------
  cont.innerHTML = `
    <div class="minuta-header"><img src="../assets/branding/logo-municipal.png" alt="Ilustre Municipalidad de San Bernardo" style="width:210px;max-width:65%;height:auto;object-fit:contain"><div class="minuta-subtitulo">${depto.toUpperCase()}</div></div>
    ${cuerpo || `
      <div class="text-muted text-center py-4">
        Este departamento no tiene solicitudes asignadas.
      </div>
    `}
    <div class="minuta-footer">
      Reporte SGT Municipal — Departamento: ${depto} | ${fechaLarga()}
    </div>
  `;
}

// ---------- Exportar reporte como PDF ----------
async function exportarPDF() {
  if (!sel.value) { alert('Selecciona un Departamento primero.'); return; }

  const area = document.getElementById('reporteArea');
  const { jsPDF } = window.jspdf;

  const canvas = await html2canvas(area, { scale: 2, backgroundColor: '#fff' });
  const pdf = new jsPDF('p', 'mm', 'a4');

  const w = pdf.internal.pageSize.getWidth() - 16;
  const h = (canvas.height * w) / canvas.width;
  const pageH = pdf.internal.pageSize.getHeight() - 16;

  // ---------- Una sola página ----------
  if (h <= pageH) {
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 8, 8, w, h);
  }
  // ---------- Varias páginas ----------
  else {
    let y = 0;
    while (y < h) {
      const sliceH = Math.min(pageH, h - y);
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width;
      tmp.height = (sliceH / w) * canvas.width;

      tmp.getContext('2d').drawImage(
        canvas,
        0, (y / h) * canvas.height, canvas.width, tmp.height,
        0, 0, tmp.width, tmp.height
      );

      if (y > 0) pdf.addPage();
      pdf.addImage(tmp.toDataURL('image/jpeg', 0.92), 'JPEG', 8, 8, w, sliceH);
      y += sliceH;
    }
  }

  sgtDescargarPDF(pdf, `minuta-depto-${new Date().toISOString().slice(0,10)}.pdf`);
}

// ---------- Exportar como minuta ----------
// Genera una versión independiente del reporte mediante un
// contenedor temporal oculto, evitando depender del tamaño,
// scroll o posición actual de la pantalla.
async function exportarMinuta() {
  if (!sel.value) { alert('Selecciona un Departamento primero.'); return; }

  const depto = sel.value;

  // ---------- Obtener solicitudes del departamento ----------
  const sols = Object.values(db.solicitudes).filter(
    s => solicitudVisiblePDF(s) && s.departamento === depto
  );

  if (!sols.length) {
    alert('Este Departamento no tiene solicitudes registradas para generar la minuta.');
    return;
  }

  // ---------- Construir cuerpo de la minuta ----------
  let cuerpo = '';

  CATEGORIAS.forEach(cat => {
    const delGrupo = sols.filter(s => s.categoria === cat);
    if (!delGrupo.length) return;

    cuerpo += `<div class="minuta-cat-titulo">${cat}</div>`;

    delGrupo.forEach(s => {
      const j = db.juntas[s.juntaId];

      cuerpo += `
        <div class="minuta-junta-nombre">${j ? j.nombre : '(Junta no identificada)'}</div>
        <p class="minuta-linea"><strong>Requerimiento:</strong> ${s.requerimiento || 'Sin especificar.'}</p>
        ${String(s.direccionProblema || '').trim() ? `<p class="minuta-linea"><strong>Ubicación del problema:</strong> ${s.direccionProblema}</p>` : ''}
        <p class="minuta-linea"><strong>Gestión acordada:</strong> ${s.gestion || 'Sin gestión registrada.'}</p>
        <p class="minuta-linea"><strong>Estado:</strong> ${s.estado}</p>
      `;
    });
  });

  // ---------- Crear contenedor temporal ----------
  const temp = document.createElement('div');
  temp.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: 800px;
    background: #fff;
    padding: 24px;
  `;

  temp.innerHTML = `
    <div class="minuta-header"><img src="../assets/branding/logo-municipal.png" alt="Ilustre Municipalidad de San Bernardo" style="width:210px;max-width:65%;height:auto;object-fit:contain"><div class="minuta-subtitulo">REPORTE POR DEPARTAMENTO</div></div>
    <div style="margin-bottom:20px;">
      <strong>Departamento:</strong> ${depto}
    </div>
    ${cuerpo}
    <div class="minuta-footer">
      Reporte SGT Municipal — Departamento: ${depto} | ${fechaLarga()}
    </div>
  `;

  document.body.appendChild(temp);

  // ---------- Generar canvas ----------
  const { jsPDF } = window.jspdf;
  const canvas = await html2canvas(temp, { scale: 2, backgroundColor: '#fff' });
  document.body.removeChild(temp);

  // ---------- Crear PDF ----------
  const pdf = new jsPDF('p', 'mm', 'a4');

  const w = pdf.internal.pageSize.getWidth() - 16;
  const h = (canvas.height * w) / canvas.width;
  const pageH = pdf.internal.pageSize.getHeight() - 16;

  // ---------- Si cabe en una página ----------
  if (h <= pageH) {
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 8, 8, w, h);
  }
  // ---------- Si necesita varias páginas ----------
  else {
    let y = 0;
    while (y < h) {
      const sliceH = Math.min(pageH, h - y);
      const tmp2 = document.createElement('canvas');
      tmp2.width = canvas.width;
      tmp2.height = (sliceH / w) * canvas.width;

      tmp2.getContext('2d').drawImage(
        canvas,
        0, (y / h) * canvas.height, canvas.width, tmp2.height,
        0, 0, tmp2.width, tmp2.height
      );

      if (y > 0) pdf.addPage();
      pdf.addImage(tmp2.toDataURL('image/jpeg', 0.92), 'JPEG', 8, 8, w, sliceH);
      y += sliceH;
    }
  }

  // ---------- Nombre del archivo ----------
  const nombreArchivo = depto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  sgtDescargarPDF(pdf, `minuta-depto-${nombreArchivo}-${new Date().toISOString().slice(0,10)}.pdf`);
}
function incluirCerradasPDF(){return !!document.getElementById('incluirResueltas')?.checked;}
function solicitudVisiblePDF(s){return !s.eliminada&&(incluirCerradasPDF()||!(esSolicitudResuelta(s)||/resuelt|cerrad|finalizad|terminad/i.test(String(s.estado||''))));}
const chkPDF=document.getElementById('incluirResueltas');if(chkPDF)chkPDF.addEventListener('change',()=>render());
