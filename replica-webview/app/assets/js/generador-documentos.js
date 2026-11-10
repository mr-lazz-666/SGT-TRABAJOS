const database=dbLoad();
const types={general:'Reporte general',junta:'Reporte por Junta',departamento:'Reporte por departamento',criticos:'Reporte de casos críticos',pendientes:'Reporte de pendientes',resueltas:'Reporte de resueltas',minuta:'Minuta de reunión',acuerdos:'Seguimiento de acuerdos',mensual:'Informe mensual',ejecutivo:'Informe ejecutivo'};
const $=id=>document.getElementById(id);const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('tipo').innerHTML=Object.entries(types).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');$('tipo').value=new URLSearchParams(location.search).get('tipo')||'general';
$('junta').innerHTML='<option value="">Todas las juntas</option>'+Object.values(database.juntas).sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(j=>`<option value="${esc(j.id)}">${esc(j.nombre)}</option>`).join('');
$('departamento').innerHTML='<option value="">Todos los departamentos</option>'+[...new Set(Object.values(database.solicitudes).map(s=>s.departamento).filter(Boolean))].sort().map(d=>`<option>${esc(d)}</option>`).join('');
function parseDate(v){if(!v)return null;const m=String(v).match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);if(m)return new Date(+m[3],+m[2]-1,+m[1]);const d=new Date(v);return isNaN(d)?null:d}
function reporteCerrado(s){return esSolicitudResuelta(s)||/resuelt|cerrad|finalizad|terminad/i.test(String(s.estado||""));}
function rows(){return Object.values(database.solicitudes).filter(s=>{if(s.eliminada)return false;const t=$('tipo').value,r=reporteCerrado(s);if(t!=='resueltas'&&!$('incluirResueltas').checked&&r)return false;const d=parseDate(s.fecha),from=$('desde').value?new Date($('desde').value+'T00:00:00'):null,to=$('hasta').value?new Date($('hasta').value+'T23:59:59'):null;if($('junta').value&&s.juntaId!==$('junta').value)return false;if($('departamento').value&&s.departamento!==$('departamento').value)return false;if(from&&(!d||d<from))return false;if(to&&(!d||d>to))return false;if(t==='criticos'&&!(String(s.prioridad||'').trim().toLowerCase().includes('crit')||String(s.prioridad||'').trim().toLowerCase()==='alta'||normalizarEstado(s.estado).key==='critica'))return false;if(t==='pendientes'&&r)return false;if(t==='resueltas'&&!r)return false;if(t==='mensual'&&!from&&!to){const now=new Date();if(!d||d.getFullYear()!==now.getFullYear()||d.getMonth()!==now.getMonth())return false}return true})}
// Minuta institucional: no se inventan datos y no se imprimen campos vacíos.
const present=v=>String(v??'').trim();
const prettyCat=v=>present(v).replace(/^\d+\.\s*/, '');
const tituloDocumento=()=>present($('tituloReunion').value)||'Solicitudes Juntas de vecinos';
function docModel(){
 const solicitudes=rows();const tipo=$('tipo').value;const reunion=['minuta','acuerdos'].includes(tipo);
 const grupos=new Map();
 solicitudes.forEach(s=>{const cat=prettyCat(s.categoria)||'Otras solicitudes';if(!grupos.has(cat))grupos.set(cat,[]);grupos.get(cat).push(s)});
 return {tipo,reunion,solicitudes,grupos:[...grupos.entries()].sort((a,b)=>a[0].localeCompare(b[0],'es'))};
}
function camposSolicitud(s){return [
 ['Requerimiento',s.requerimiento],['Ubicación del problema',s.direccionProblema],
 ['Gestión acordada',s.gestion],['Estado',s.estado],['Estatus',s.estatus],
 ['Departamento',s.departamento],['Encargado',s.encargado]
 ].filter(([k,v])=>present(v));}
function meetingData(){return [
 ['Fecha',$('fechaReunion').value?new Date($('fechaReunion').value+'T12:00:00').toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):''],
 ['Hora',$('horaReunion').value?$('horaReunion').value+' horas':''],
 ['Gestor territorial',$('gestorReunion').value]
 ].filter(([k,v])=>present(v));}
function preview(){
 const m=docModel(),parts=['<div class="minuta-vista" style="font-family:Arial,sans-serif;color:#222;max-width:790px;margin:auto;padding:38px 44px;background:#fff;font-size:12px;line-height:1.38">'];
 parts.push('<div style="margin-bottom:23px"><img src="../assets/branding/logo-municipal.png" alt="Ilustre Municipalidad de San Bernardo" style="width:195px;height:auto;object-fit:contain"></div>');
 parts.push('<h2 style="text-align:center;font-size:19px;letter-spacing:.4px;margin:0 0 3px;text-transform:uppercase">'+esc(m.reunion?tituloDocumento():types[m.tipo])+'</h2>');
 if(m.reunion){
  if(present($('sectorReunion').value))parts.push('<div style="text-align:center;font-weight:600;margin-bottom:17px">'+esc($('sectorReunion').value)+'</div>');
  const meta=meetingData();if(meta.length)parts.push('<table style="width:100%;border-collapse:collapse;margin:16px 0 12px">'+meta.map(([k,v])=>'<tr><th style="background:#e6e6e6;text-align:left;padding:7px 9px;width:29%;font-weight:700">'+esc(k)+'</th><td style="padding:7px 9px;border-bottom:1px solid #e8e8e8">'+esc(v)+'</td></tr>').join('')+'</table>');
  if(present($('objetivoReunion').value))parts.push('<p style="margin:13px 0"><strong>Objetivo:</strong> '+esc($('objetivoReunion').value)+'</p>');
 }else parts.push('<p style="margin:13px 0">Fecha de emisión: '+new Date().toLocaleDateString('es-CL')+'</p>');
 if(present($('autor').value))parts.push('<p style="margin:8px 0"><strong>Elaborado por:</strong> '+esc($('autor').value)+'</p>');
 if(m.reunion)[['Asistentes','asistentes'],['Temas tratados','temas'],['Acuerdos y compromisos','acuerdos'],['Próxima reunión / observaciones','observaciones']].forEach(([k,id])=>{
  const value=present($(id).value);
  if(value)parts.push('<div style="margin:10px 0;break-inside:avoid"><strong>'+esc(k)+':</strong><div style="white-space:pre-wrap;margin-top:3px">'+esc(value)+'</div></div>');
 });
 m.grupos.forEach(([cat,arr],i)=>{
  parts.push('<h3 style="font-size:15px;text-decoration:underline;margin:21px 0 9px;padding-left:18px">'+(i+1)+'. &nbsp;'+esc(cat)+'</h3>');
  arr.forEach(s=>{const j=database.juntas[s.juntaId];parts.push('<section style="margin:10px 0 12px;break-inside:avoid"><div style="font-weight:700;font-size:12.5px;margin-bottom:3px">'+esc(j?.nombre||'Junta no registrada')+'</div>');camposSolicitud(s).forEach(([k,v])=>parts.push('<div style="margin:2px 0"><strong>'+esc(k)+':</strong> '+esc(v)+'</div>'));parts.push('</section>')});
 });

 if(!m.solicitudes.length)parts.push('<p>No hay solicitudes para los filtros seleccionados.</p>');
 parts.push('<div style="text-align:center;color:#777;font-size:10px;margin-top:25px">'+esc(m.reunion?tituloDocumento():'Informe SGT')+'</div></div>');$('docPreview').innerHTML=parts.join('');
}
const LOGO_PATH='../assets/branding/logo-municipal.png';
let logoCache=null;
const logoImage=new Image();
logoImage.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=logoImage.naturalWidth;canvas.height=logoImage.naturalHeight;canvas.getContext('2d').drawImage(logoImage,0,0);logoCache=canvas.toDataURL('image/png')}catch(e){console.warn('Logo no disponible',e)}};
logoImage.onerror=()=>console.info('Para usar el logotipo municipal, agrega assets/branding/logo-municipal.png');
logoImage.src=LOGO_PATH;
function pdf(){
 if(!window.jspdf?.jsPDF){alert('No se pudo cargar el generador PDF. Comprueba la conexión a internet.');return}
 const m=docModel(),doc=new window.jspdf.jsPDF({unit:'mm',format:'a4'}),left=19,right=191,maxW=right-left,bottom=275;
 let y=0;const title=m.reunion?tituloDocumento():types[m.tipo];
 function header(){
  if(logoCache){try{const prop=doc.getImageProperties(logoCache),w=58,h=w*prop.height/prop.width;doc.addImage(logoCache,'PNG',left,10,w,h)}catch(e){console.warn('Logo PDF',e)}}
  y=37;
 }
 function page(){doc.addPage();header()}
 function ensure(h){if(y+h>bottom)page()}
 function write(value,{size=9.3,bold=false,indent=0,after=1.2}={}){
  if(!present(value))return;
  doc.setTextColor(38,38,38);doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);
  const lines=doc.splitTextToSize(String(value),maxW-indent),step=size*.38+1.5,h=lines.length*step+after;
  ensure(h);doc.text(lines,left+indent,y);y+=h;
 }
 function field(k,v){if(!present(v))return;write(k+': '+present(v),{size:9.2,indent:1,after:1.2})}
 header();
 doc.setFont('helvetica','bold');doc.setFontSize(15);const titleLines=doc.splitTextToSize(title.toUpperCase(),maxW);doc.text(titleLines,105,y,{align:'center'});y+=titleLines.length*7.2+1;
 if(m.reunion){
  if(present($('sectorReunion').value)){doc.setFontSize(10);doc.text(doc.splitTextToSize($('sectorReunion').value,maxW),105,y,{align:'center'});y+=8}
  y+=5;
  meetingData().forEach(([k,v])=>{
   doc.setFontSize(9);const wrap=doc.splitTextToSize(String(v),115),h=Math.max(9,wrap.length*4.6+3);ensure(h);
   doc.setFillColor(229,229,229);doc.rect(left,y-5,50,h,'F');doc.setDrawColor(234,234,234);doc.line(left+50,y-5,left+50,y-5+h);
   doc.setFont('helvetica','bold');doc.text(k,left+3,y);doc.setFont('helvetica','normal');doc.text(wrap,left+53,y);y+=h;
  });
  y+=5;field('Objetivo',$('objetivoReunion').value);
 }else{write('Fecha de emisión: '+new Date().toLocaleDateString('es-CL'),{size:9})}
 field('Elaborado por',$('autor').value);
 if(m.reunion)[['Asistentes','asistentes'],['Temas tratados','temas'],['Acuerdos y compromisos','acuerdos'],['Próxima reunión / observaciones','observaciones']].forEach(([k,id])=>{
  const value=present($(id).value);
  if(!value)return;
  y+=3;write(k+':',{size:9.5,bold:true,after:1.2});
  value.split(/\r?\n/).forEach(line=>{if(present(line))write(line,{size:9.2,indent:2,after:1})});
  y+=2;
 });
 m.grupos.forEach(([cat,arr],i)=>{
  const heading=(i+1)+'.  '+cat;
  ensure(19);y+=5;const yy=y;write(heading,{size:11.5,bold:true,indent:7,after:2});
  doc.setDrawColor(70,70,70);doc.setLineWidth(.23);doc.line(left+7,yy+1,Math.min(right,left+7+doc.getTextWidth(heading)),yy+1);
  arr.forEach(s=>{
   const j=database.juntas[s.juntaId];const campos=camposSolicitud(s);
   ensure(14);y+=2;write(j?.nombre||'Junta no registrada',{size:10,bold:true,after:1.2});
   campos.forEach(([k,v])=>field(k,v));y+=2;
  });
 });

 if(!m.solicitudes.length)write('No hay solicitudes para los filtros seleccionados.');
 const pages=doc.internal.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setTextColor(115,115,115);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(title,105,288,{align:'center'});doc.text(i+' / '+pages,right,288,{align:'right'})}
 sgtDescargarPDF(doc,'SGT_'+m.tipo+'_'+new Date().toISOString().slice(0,10)+'.pdf');
}
$('preview').onclick=preview;$('download').onclick=pdf;['tipo','junta','departamento','desde','hasta','incluirResueltas'].forEach(id=>$(id).addEventListener('change',preview));$('tipo').addEventListener('change',()=>{$('incluirResueltas').disabled=$('tipo').value==='resueltas';$('meeting').style.display=['minuta','acuerdos'].includes($('tipo').value)?'block':'none'});$('tipo').dispatchEvent(new Event('change'));preview();

$('downloadMinuta').onclick=()=>{$('tipo').value='minuta';$('tipo').dispatchEvent(new Event('change'));preview();pdf()};

['autor','tituloReunion','fechaReunion','horaReunion','sectorReunion','gestorReunion','objetivoReunion','asistentes','temas','acuerdos','observaciones'].forEach(id=>$(id).addEventListener('input',preview));
