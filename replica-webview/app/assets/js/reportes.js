// ============================================================
// REPORTES - SGT MUNICIPAL (Reporte General)
// ============================================================

const db = dbLoad();
let chartCategoria = null;
let chartEstado = null;

document.addEventListener('DOMContentLoaded', () => {
  const hoy = new Date();
  const fechaTxt = hoy.toLocaleDateString('es-CL', { day:'2-digit', month:'long', year:'numeric' });
  document.getElementById('current-date').textContent = fechaTxt;
  document.getElementById('fechaGeneracion').textContent = fechaTxt;

  llenarSelectCategorias();
  llenarSelectEstados();
  llenarSelectJuntas();

  ['filtroDesde','filtroHasta','filtroCategoria','filtroEstado','filtroJunta']
    .forEach(id => document.getElementById(id).addEventListener('change', renderReporte));

  renderReporte();
});

function parseFecha(valor){
  if(!valor) return null;
  if(valor instanceof Date) return isNaN(valor) ? null : valor;
  const s = String(valor).trim();
  if(!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if(m){ let a=Number(m[3]); if(a<100) a+=2000; return new Date(a, Number(m[2])-1, Number(m[1])); }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function llenarSelectCategorias(){
  const sel = document.getElementById('filtroCategoria');
  sel.innerHTML = `<option value="">Todas</option>` + CATEGORIAS.map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join('');
}
function llenarSelectEstados(){
  const sel = document.getElementById('filtroEstado');
  const estados = [...new Set(Object.values(db.solicitudes||{}).map(s=>s.estado).filter(Boolean))];
  sel.innerHTML = `<option value="">Todos</option>` + estados.map(e => `<option value="${escapeAttr(e)}">${escapeHtml(e)}</option>`).join('');
}
function llenarSelectJuntas(){
  const sel = document.getElementById('filtroJunta');
  const juntas = Object.values(db.juntas||{}).sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre)));
  sel.innerHTML = `<option value="">Todas</option>` + juntas.map(j => `<option value="${escapeAttr(j.id)}">${escapeHtml(j.nombre)}</option>`).join('');
}

function obtenerSolicitudesFiltradas(){
  const desde = parseFecha(document.getElementById('filtroDesde').value);
  const hasta = parseFecha(document.getElementById('filtroHasta').value);
  if(hasta) hasta.setHours(23,59,59,999);
  const cat = document.getElementById('filtroCategoria').value;
  const est = document.getElementById('filtroEstado').value;
  const jid = document.getElementById('filtroJunta').value;

  return Object.values(db.solicitudes||{}).filter(s => {
    if(s.eliminada) return false;
    if(cat && s.categoria !== cat) return false;
    if(est && s.estado !== est) return false;
    if(jid && s.juntaId !== jid) return false;
    const f = parseFecha(s.fecha);
    if(desde && f && f < desde) return false;
    if(hasta && f && f > hasta) return false;
    return true;
  });
}

function renderReporte(){
  const sols = obtenerSolicitudesFiltradas();
  renderStats(sols);
  renderGraficoCategoria(sols);
  renderGraficoEstado(sols);
  renderSintesis(sols);
  renderRanking(sols);
  renderPeriodoTexto();
}

function renderStats(sols){
  const total = sols.length;
  const resueltas = sols.filter(s => normalizarEstado(s.estado).key==='resuelta').length;
  const pendientes = sols.filter(s => normalizarEstado(s.estado).key==='pendiente').length;
  const proceso = sols.filter(s => normalizarEstado(s.estado).key==='proceso').length;
  const criticas = sols.filter(s => normalizarEstado(s.estado).key==='critica').length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statTotalSub').innerHTML = criticas ? `<b>${criticas}</b> crítica(s)` : 'Sin críticas';
  document.getElementById('statResueltas').textContent = resueltas;
  document.getElementById('statResueltasSub').innerHTML = total ? `<b>${((resueltas/total)*100).toFixed(1)}%</b> tasa resolución` : '—';
  document.getElementById('statPendientes').textContent = pendientes;
  document.getElementById('statPendientesSub').innerHTML = total ? `<b>${((pendientes/total)*100).toFixed(1)}%</b> del total` : '—';
  document.getElementById('statProceso').textContent = proceso;
  document.getElementById('statProcesoSub').innerHTML = total ? `<b>${((proceso/total)*100).toFixed(1)}%</b> en gestión` : '—';
  document.getElementById('statCriticas').textContent = criticas;
  document.getElementById('statCriticasSub').innerHTML = total ? `<b>${((criticas/total)*100).toFixed(1)}%</b> del total` : '—';
}

function renderGraficoCategoria(sols){
  const conteo = {};
  sols.forEach(s => { const c = s.categoria || 'Sin categoría'; conteo[c] = (conteo[c]||0)+1; });
  const entries = Object.entries(conteo).sort((a,b)=>b[1]-a[1]);

  if(chartCategoria) chartCategoria.destroy();
  chartCategoria = new Chart(document.getElementById('chartCategoria'), {
    type:'bar',
    data:{ labels: entries.map(e=>e[0]), datasets:[{ data: entries.map(e=>e[1]), backgroundColor:'rgba(37,99,235,.85)', borderRadius:6, barThickness:12 }] },
    options:{
      indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:ctx=>` ${ctx.parsed.x} solicitud(es)` } } },
      scales:{
        x:{ grid:{display:false}, ticks:{ precision:0, font:{size:10.5}, maxTicksLimit:5 } },
        y:{ grid:{display:false}, ticks:{ font:{size:10.5}, autoSkip:false, callback:function(v){ const l=this.getLabelForValue(v); return l.length>30?l.slice(0,28)+'…':l; } } }
      }
    }
  });
}

function renderGraficoEstado(sols){
  const total = sols.length || 1;
  const resueltas = sols.filter(s => normalizarEstado(s.estado).key==='resuelta').length;
  const pendientes = sols.filter(s => normalizarEstado(s.estado).key==='pendiente').length;
  const proceso = sols.filter(s => normalizarEstado(s.estado).key==='proceso').length;
  const criticas = sols.filter(s => normalizarEstado(s.estado).key==='critica').length;
  const pct = n => Number(((n/total)*100).toFixed(1));

  if(chartEstado) chartEstado.destroy();
  chartEstado = new Chart(document.getElementById('chartEstado'), {
    type:'doughnut',
    data:{
      labels:[`Resueltas (${pct(resueltas)}%)`,`Pendientes (${pct(pendientes)}%)`,`En proceso (${pct(proceso)}%)`,`Críticas (${pct(criticas)}%)`],
      datasets:[{ data:[resueltas,pendientes,proceso,criticas], backgroundColor:['#059669','#d97706','#7c3aed','#dc2626'], borderWidth:0 }]
    },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'58%', plugins:{ legend:{ position:'right', labels:{ boxWidth:9, font:{size:10} } } } }
  });
}

function renderSintesis(sols){
  const ul = document.getElementById('sintesisList');
  if(!sols.length){ ul.innerHTML = `<li><span class="dot"></span><span>No hay solicitudes en el período seleccionado.</span></li>`; return; }

  const bullets = [];
  const porCat = {}; sols.forEach(s => { porCat[s.categoria]=(porCat[s.categoria]||0)+1; });
  const topCat = Object.entries(porCat).sort((a,b)=>b[1]-a[1])[0];
  if(topCat) bullets.push({tipo:'info', html:`La categoría con más solicitudes es <strong>${escapeHtml(topCat[0])}</strong> con <strong>${topCat[1]}</strong> caso(s).`});

  const porJunta = {}; sols.forEach(s => { porJunta[s.juntaId]=(porJunta[s.juntaId]||0)+1; });
  const topJunta = Object.entries(porJunta).sort((a,b)=>b[1]-a[1])[0];
  if(topJunta){ const j = db.juntas[topJunta[0]]; if(j) bullets.push({tipo:'info', html:`La junta con más solicitudes es <strong>${escapeHtml(j.nombre)}</strong> con <strong>${topJunta[1]}</strong> caso(s).`}); }

  const criticas = sols.filter(s => normalizarEstado(s.estado).key==='critica').length;
  if(criticas) bullets.push({tipo:'danger', html:`Hay <strong>${criticas}</strong> solicitud(es) en estado <strong>crítico</strong> que requieren atención inmediata.`});

  const pendientes = sols.filter(s => normalizarEstado(s.estado).key==='pendiente').length;
  if(pendientes) bullets.push({tipo:'warn', html:`Existen <strong>${pendientes}</strong> solicitud(es) <strong>pendientes</strong> en el período seleccionado.`});

  const total = sols.length;
  const resueltas = sols.filter(s => normalizarEstado(s.estado).key==='resuelta').length;
  const tasa = ((resueltas/total)*100).toFixed(1);
  bullets.push({tipo: Number(tasa)>=60?'ok':'warn', html:`La tasa de resolución del período es de <strong>${tasa}%</strong>.`});

  bullets.length = Math.min(bullets.length, 4);
  const clase = {info:'', warn:'warn', danger:'danger', ok:'ok'};
  ul.innerHTML = bullets.map(b => `<li><span class="dot ${clase[b.tipo]||''}"></span><span>${b.html}</span></li>`).join('');
}

function renderRanking(sols){
  const tbody = document.querySelector('#tablaRanking tbody');
  const porJunta = {};
  sols.forEach(s => {
    const id = s.juntaId || '__sin_junta__';
    if(!porJunta[id]) porJunta[id] = { total:0, resueltas:0, pendientes:0, alta:0 };
    porJunta[id].total++;
    const key = normalizarEstado(s.estado).key;
    if(key==='resuelta') porJunta[id].resueltas++;
    if(key==='pendiente') porJunta[id].pendientes++;
    if(String(s.prioridad||'').toLowerCase()==='alta') porJunta[id].alta++;
  });

  const filas = Object.entries(porJunta).map(([id,v]) => {
    const j = db.juntas[id] || {};
    const nombre = id==='__sin_junta__' ? '(sin junta)' : (j.nombre || '(sin nombre)');
    const tasa = v.total ? (v.resueltas/v.total)*100 : 0;
    return { nombre, ...v, tasa };
  }).sort((a,b)=>b.total-a.total);

  const top = filas.slice(0,5);
  if(!top.length){ tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">Sin datos en el período.</td></tr>`; return; }

  tbody.innerHTML = top.map((f,i) => {
    const tasaTxt = f.tasa.toFixed(1)+'%';
    const tasaCls = f.tasa>=70?'alta':f.tasa>=40?'media':'baja';
    const rankCls = i===0?'top1':i===1?'top2':i===2?'top3':'';
    return `<tr>
      <td><span class="badge-rank ${rankCls}">${i+1}</span></td>
      <td>${escapeHtml(f.nombre)}</td>
      <td class="num"><strong>${f.total}</strong></td>
      <td class="num">${f.resueltas}</td>
      <td class="num">${f.pendientes}</td>
      <td class="num"><span class="tasa ${tasaCls}">${tasaTxt}</span></td>
      <td class="num">${f.alta ? `<span class="prioridad-alta">${f.alta}</span>` : '<span class="text-muted">0</span>'}</td>
    </tr>`;
  }).join('');
}

function renderPeriodoTexto(){
  const d = document.getElementById('filtroDesde').value;
  const h = document.getElementById('filtroHasta').value;
  const fmt = v => { const f = parseFecha(v); return f ? f.toLocaleDateString('es-CL') : '—'; };
  document.getElementById('periodoTexto').textContent = (!d && !h) ? 'Histórico completo' : `${fmt(d)} al ${fmt(h)}`;
}

function limpiarFiltros(){
  ['filtroCategoria','filtroEstado','filtroJunta','filtroDesde','filtroHasta'].forEach(id => document.getElementById(id).value = '');
  renderReporte();
}

// Exporta SOLO el área del reporte (oculta filtros/botones con .no-print durante la captura)
async function exportarPDF(){
  const { jsPDF } = window.jspdf;
  const area = document.getElementById('reporteArea');
  const noPrint = document.querySelectorAll('.no-print');
  noPrint.forEach(el => el.style.display = 'none');
  await new Promise(r => setTimeout(r, 250));

  const canvas = await html2canvas(area, { scale:2, backgroundColor:'#ffffff' });
  noPrint.forEach(el => el.style.display = '');

  const pdf = new jsPDF('p','mm','a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const imgW = pageW - margin*2;
  const imgH = (canvas.height * imgW) / canvas.width;
  const imgData = canvas.toDataURL('image/jpeg', 0.92);

  if(imgH <= pageH - margin*2){
    pdf.addImage(imgData, 'JPEG', margin, margin, imgW, imgH);
  } else {
    let y = 0;
    const pageContentH = pageH - margin*2;
    while(y < imgH){
      const sliceH = Math.min(pageContentH, imgH - y);
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width; tmp.height = (sliceH/imgW)*canvas.width;
      tmp.getContext('2d').drawImage(canvas, 0, (y/imgH)*canvas.height, canvas.width, tmp.height, 0, 0, tmp.width, tmp.height);
      if(y>0) pdf.addPage();
      pdf.addImage(tmp.toDataURL('image/jpeg',0.92), 'JPEG', margin, margin, imgW, sliceH);
      y += sliceH;
    }
  }
  sgtDescargarPDF(pdf, `reporte-sgt-general-${new Date().toISOString().slice(0,10)}.pdf`);
}

function escapeHtml(v){ return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function escapeAttr(v){ return escapeHtml(v).replace(/"/g,'&quot;'); }






// ============================================================
// EXPORTAR COMO MINUTA (agrupado por categoría, respetando los filtros activos)
// ============================================================

async function exportarMinuta(){
  const sols = obtenerSolicitudesFiltradas();

  if(!sols.length){ alert('No hay solicitudes con los filtros actuales para generar la minuta.'); return; }

  // Agrupa por categoría oficial (1 a 9), y dentro de cada una lista cada solicitud con su Junta
  let cuerpo = '';
  CATEGORIAS.forEach(cat => {
    const delGrupo = sols.filter(s => s.categoria === cat);
    if(!delGrupo.length) return;

    cuerpo += `<div class="minuta-cat-titulo">${cat}</div>`;
    delGrupo.forEach(s => {
      const j = db.juntas[s.juntaId];
      cuerpo += `
        <div class="minuta-junta-nombre">${j ? j.nombre : '(Junta no identificada)'}</div>
        <p class="minuta-linea"><strong>Requerimiento:</strong> ${s.requerimiento || 'Sin especificar.'}</p>
        ${String(s.direccionProblema || '').trim() ? `<p class="minuta-linea"><strong>Ubicación del problema:</strong> ${s.direccionProblema}</p>` : ''}
        <p class="minuta-linea"><strong>Gestión acordada:</strong> ${s.gestion || 'Sin gestión registrada.'}</p>
        <p class="minuta-linea"><strong>Estado:</strong> ${s.estado}</p>`;
    });
  });

  const fechaLarga = new Date().toLocaleDateString('es-CL', { day:'2-digit', month:'long', year:'numeric' });

  // Contenedor temporal, oculto, para no alterar la vista de estadísticas que ya está en pantalla
  const temp = document.createElement('div');
  temp.style.cssText = 'position:fixed; left:-9999px; top:0; width:800px; background:#fff; padding:24px;';
  temp.innerHTML = `
    <div class="minuta-header"><img src="../assets/branding/logo-municipal.png" alt="Ilustre Municipalidad de San Bernardo" style="width:210px;max-width:65%;height:auto;object-fit:contain"><div class="minuta-subtitulo">REPORTE GENERAL</div></div>
    ${cuerpo}
    <div class="minuta-footer">Reporte SGT Municipal — Minuta general | ${fechaLarga}</div>`;
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
  sgtDescargarPDF(pdf, `minuta-general-${new Date().toISOString().slice(0,10)}.pdf`);
}