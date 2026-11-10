const db = dbLoad();
const EXT_VALIDAS = ['.jpg','.jpeg','.png','.webp'];
const MIME = {jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
const MAX_LADO=1280, CALIDAD=0.7;
let archivosPorNombre=new Map();
let asignaciones=[];

const esImagen=n=>EXT_VALIDAS.some(e=>n.toLowerCase().endsWith(e));

async function comprimirADataURL(blob){
  const bmp=await createImageBitmap(blob); const escala=Math.min(1,MAX_LADO/Math.max(bmp.width,bmp.height));
  const c=document.createElement('canvas'); c.width=Math.round(bmp.width*escala); c.height=Math.round(bmp.height*escala);
  const ctx=c.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height); ctx.drawImage(bmp,0,0,c.width,c.height); bmp.close&&bmp.close();
  return c.toDataURL('image/jpeg',CALIDAD);
}

function interpretarNombre(nombre){
  // Formato: SGT-JV-CODIGO-0001-1.jpg
  // JV es el identificador fijo de Junta Vecinal; CODIGO es Codigo Junta;
  // 0001 es el numero de solicitud y el ultimo numero es el orden de foto.
  const m=nombre.match(/^sgt-jv-([a-z0-9]+)-(\d{4,})-(\d+)\.(jpg|jpeg|png|webp)$/i);
  if(!m) return null;
  const codigo=m[1].toUpperCase(), numero=m[2], foto=Number(m[3]);
  const folio=`SGT-${codigo}-${numero}`;
  const solicitud=db.solicitudes[folio];
  if(!solicitud || solicitud.eliminada) return {nombre,codigo,numero,foto,folio,solicitud:null};
  const junta=db.juntas[solicitud.juntaId];
  if(!junta || String(junta.codigo||'').trim().toUpperCase()!==codigo) return {nombre,codigo,numero,foto,folio,solicitud:null};
  return {nombre,codigo,numero,foto,folio,solicitud};
}

function recalcular(){
  asignaciones=[...archivosPorNombre.keys()].map(interpretarNombre);
  const validas=asignaciones.filter(x=>x&&x.solicitud), invalidas=asignaciones.filter(x=>!x||!x.solicitud);
  const grupos={}; validas.forEach(x=>{(grupos[x.folio]??=[]).push(x);});
  document.getElementById('mensaje').innerHTML=`<span class="text-success">${validas.length} foto(s) listas para ${Object.keys(grupos).length} solicitud(es).</span>`+(invalidas.length?` <span class="text-danger">${invalidas.length} sin coincidencia.</span>`:'');
  document.getElementById('archivosUl').innerHTML=asignaciones.map(x=>x&&x.solicitud?`<li>✓ ${x.nombre} → ${x.folio}</li>`:`<li class="text-danger">✗ ${x?x.nombre:'Nombre inválido'} — nombre o solicitud no reconocida</li>`).join('');
  document.getElementById('listaArchivos').classList.toggle('d-none',!asignaciones.length);
  document.getElementById('btnAdjuntar').disabled=!validas.length;
}

function procesarCarpeta(input){
  archivosPorNombre=new Map(); Array.from(input.files||[]).filter(f=>esImagen(f.name)).forEach(f=>archivosPorNombre.set(f.name,f)); recalcular();
}

async function confirmarAdjunto(){
  const validas=asignaciones.filter(x=>x&&x.solicitud); if(!validas.length){alert('No hay fotos válidas para integrar.');return;}
  const btn=document.getElementById('btnAdjuntar'), msg=document.getElementById('mensaje'); btn.disabled=true;
  let nuevas=0, omitidas=0;
  try{
    for(let i=0;i<validas.length;i++){
      const a=validas[i], s=db.solicitudes[a.folio]; msg.textContent=`Procesando ${i+1} de ${validas.length}: ${a.nombre}`;
      s.fotos=s.fotos||[]; s.fotosData=s.fotosData||{};
      if(s.fotos.includes(a.nombre)&&s.fotosData[a.nombre]){omitidas++;continue;}
      s.fotosData[a.nombre]=await comprimirADataURL(archivosPorNombre.get(a.nombre));
      if(!s.fotos.includes(a.nombre)) s.fotos.push(a.nombre);
      s.historial=s.historial||[]; s.historial.push({fecha:new Date().toLocaleString('es-CL'),usuario:usuarioActual(),accion:'Evidencia automática',detalle:`Foto ${a.nombre} integrada por carpeta global`});
      nuevas++;
    }
    dbSave(db); alert(`Carga global terminada. ${nuevas} foto(s) integradas y ${omitidas} ya existentes.`); location.reload();
  }catch(e){console.error(e);alert('No se pudieron guardar todas las fotografías: '+(e.message||e));btn.disabled=false;}
}
