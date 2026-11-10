// SGT Excel 2026: se leen únicamente las filas de ingreso, nunca las solicitudes históricas.
let excelSGTPendiente=null;
const textoSGT = x => String(x==null?'':x).trim();
function mensajeExcelSGT(texto, error=false){
  const el=document.getElementById('excelMensaje');
  el.textContent=texto;
  el.className='alert '+(error?'alert-danger':'alert-info');
  el.classList.remove('d-none');
}
async function solicitarExcelSGT(){
  if(!esAdministrador())return mensajeExcelSGT('Solo administración puede descargar la plantilla.',true);
  const btn=document.getElementById('btnPlantillaSGT');btn.disabled=true;
  try{
    const r=await fetch('/api/excel-template',{headers:{Authorization:'Bearer '+authToken()},cache:'no-store'});
    const data=await r.json();if(!r.ok)throw Error(data.error||'Error al generar Excel');
    mensajeExcelSGT('Planilla generada: '+data.nombre+'. Revisa las descargas del navegador. Conserva el nombre original.');
  }catch(err){mensajeExcelSGT(err.message,true);}finally{btn.disabled=false;}
}
function obtenerFilas(sheet, desde, hasta, columnas){
  const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});
  const salida=[];
  for(let row=desde;row<=hasta;row++){
    const values=rows[row-1]||[];
    const o={fila:row};
    for(const [key,index] of Object.entries(columnas))o[key]=textoSGT(values[index]);
    if(Object.keys(columnas).some(k=>o[k]))salida.push(o);
  }
  return salida;
}
async function procesarExcelSGT(input){
  excelSGTPendiente=null;
  document.getElementById('excelPrevisualizacion').classList.add('d-none');
  document.getElementById('btnImportarSGT').disabled=true;
  const file=input.files&&input.files[0];if(!file)return;
  try{
    const nativo=/^SGT_SOLICITUDES_JUNTAS_[A-F0-9]{24}\.xlsx$/.test(file.name);
    const forms=/^SGTE_FORMS(?:[ _(-][A-Za-z0-9 _().-]*)?\.xlsx$/i.test(file.name);
    const madre=/^(?:SGT_MADRE|plantilla_sgt_v5_MADRE)(?:[ _(-][A-Za-z0-9 _().-]*)?\.xlsx$/i.test(file.name);
    if(!nativo&&!forms&&!madre)
      throw Error('Archivo no admitido. Se admite Excel SGT, SGTE_FORMS.xlsx o SGT_MADRE.xlsx.');
    const bytes=await file.arrayBuffer();
    const wb=XLSX.read(bytes,{type:'array',cellDates:true});
    if(madre){
      if(!esAdministrador())throw Error('Solo administración puede importar el Excel madre.');
      const solicitudes=obtenerSolicitudesMadreSGT(wb);
      if(!solicitudes.length)throw Error('SGT_MADRE no tiene solicitudes con requerimiento.');
      excelSGTPendiente={tipo:'madre',filename:file.name,solicitudes};
      await previsualizarExcelSGT(excelSGTPendiente);
      document.getElementById('btnImportarSGT').disabled=false;
      mensajeExcelSGT('Excel madre reconocido. Revisa las filas y su georreferenciación antes de importar.');
      return;
    }
    if(forms){
      const solicitudes=obtenerSolicitudesFormsSGT(wb);
      if(!solicitudes.length)throw Error('SGTE_FORMS no contiene solicitudes completas.');
      excelSGTPendiente={tipo:'forms',filename:file.name,solicitudes};
      document.getElementById('excelResumen').textContent=`${solicitudes.length} solicitud(es) SGTE_FORMS para revisar. Este formato NO crea juntas nuevas.`;
      await previsualizarExcelSGT(excelSGTPendiente);
      document.getElementById('btnImportarSGT').disabled=false;
      mensajeExcelSGT('SGTE_FORMS reconocido: se comprobarán juntas existentes y duplicados antes de importar.');
      return;
    }
    for(const name of ['SGT CONTROL','Solicitudes','Nueva solicitud','Crear juntas','Juntas definidas']){
      if(!wb.Sheets[name])throw Error('Falta la hoja '+name+'. Selecciona la plantilla oficial de SGT.');
    }
    const meta=XLSX.utils.sheet_to_json(wb.Sheets['SGT CONTROL'],{header:1,defval:''});
    const id=textoSGT(meta[0]&&meta[0][1]);
    if(id!==file.name.replace('SGT_SOLICITUDES_JUNTAS_','').replace('.xlsx',''))
      throw Error('El identificador interno no coincide con el nombre del archivo.');
    if(textoSGT(meta[1]&&meta[1][1])!=='SGT_EXCEL_2026_1')
      throw Error('Versión de plantilla no reconocida.');
    const juntas=obtenerFilas(wb.Sheets['Crear juntas'],7,56,{
      nombre:1,direccion:2,representante:3,sector:4,observaciones:5});
    const solicitudes=obtenerFilas(wb.Sheets['Nueva solicitud'],25,74,{
      junta:1,requerimiento:2,direccionProblema:3,referencia:4,observaciones:5});
    if(!esAdministrador()&&juntas.length)
      throw Error('El archivo contiene juntas nuevas. Solo un administrador puede importarlas.');
    if(!juntas.length&&!solicitudes.length)throw Error('El Excel no contiene juntas ni solicitudes nuevas.');
    excelSGTPendiente={id,filename:file.name,juntas,solicitudes};
    document.getElementById('excelResumen').textContent=`${juntas.length} junta(s) nueva(s) y ${solicitudes.length} solicitud(es) para revisar.`;
    await previsualizarExcelSGT(excelSGTPendiente);
    document.getElementById('btnImportarSGT').disabled=false;
    mensajeExcelSGT('Archivo SGT reconocido. Se importarán únicamente las filas válidas que no se hayan registrado antes.');
  }catch(err){mensajeExcelSGT(err.message,true);}
}
// Segundo formato autorizado: exportación de Google Forms de 20 columnas.
// El nombre del archivo NO es suficiente: se exige la hoja Solicitudes y
// encabezados reales compatibles con SGTE_FORMS.
function encabezadoFormsSGT(s){
  return textoSGT(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,' ').trim();
}
function obtenerSolicitudesFormsSGT(wb){
  if(!wb.Sheets['Solicitudes'])throw Error('SGTE_FORMS debe contener una hoja llamada Solicitudes.');
  const rows=XLSX.utils.sheet_to_json(wb.Sheets['Solicitudes'],{header:1,defval:'',raw:false});
  if(!rows.length)throw Error('SGTE_FORMS no contiene encabezados.');
  const headers=rows[0].map(encabezadoFormsSGT);
  if(headers.length!==20)throw Error('SGTE_FORMS debe tener exactamente las 20 columnas del formato oficial.');
  const getIndex=(...names)=>names.map(encabezadoFormsSGT).map(n=>headers.indexOf(n)).find(i=>i>=0);
  const indices={
    folioJunta:getIndex('Folio Junta'), codigo:getIndex('Codigo Junta'),
    juntaReal:getIndex('Junta de Vecinos (nombre real)'),
    requerimiento:getIndex('Requerimiento'),
    direccion:getIndex('Direccion Problema (Opcional)','Dirección del problema (Opcional)'),
    observaciones:getIndex('Observaciones'),
    fecha:getIndex('Fecha')
  };
  if(['folioJunta','codigo','requerimiento','juntaReal','fecha'].some(k=>indices[k]===undefined))
    throw Error('Encabezados SGTE_FORMS incompatibles: se requieren Folio Junta, Codigo Junta, Junta de Vecinos (nombre real), Requerimiento y Fecha.');
  if(new Set(headers).size!==20)throw Error('SGTE_FORMS tiene encabezados duplicados.');
  if(rows.length>10001)throw Error('SGTE_FORMS supera el límite de 10.000 filas.');
  const salida=[];
  for(let i=1;i<rows.length;i++){
    const row=rows[i];
    const val=k=>indices[k]===undefined?'':textoSGT(row[indices[k]]);
    const req=val('requerimiento');
    if(!req)continue; // no importar filas vacías o incompletas
    salida.push({fila:i+1,folioJunta:val('folioJunta'),codigo:val('codigo'),
      junta:val('juntaReal')||val('folioJunta'),requerimiento:req,
      direccionProblema:val('direccion'),observaciones:val('observaciones'),fecha:val('fecha')});
  }
  return salida;
}

// FIX12: cada junta nueva se geocodifica ANTES de enviarla a SQLite.
// SGTMaps.geocode exige dirección numerada y comprueba San Bernardo.
// No usar coordenadas por defecto: producirían pines falsos.
async function ubicarJuntasExcelSGT(juntas){
  const nuevas=[];
  const fallidas=[];
  const cache=new Map();
  for(const item of juntas){
    const dir=textoSGT(item.direccion);
    const clave=dir.toLocaleLowerCase('es-CL');
    try{
      if(!dir || !/\b\d{1,6}[a-z]?\s*,\s*san bernardo\s*$/i.test(dir)){
        throw Error('debe indicar calle y número, San Bernardo');
      }
      let punto;
      if(cache.has(clave)) punto=cache.get(clave);
      else {
        punto=await SGTMaps.geocode(dir);
        cache.set(clave,punto);
      }
      if(!punto) throw Error('Google no encontró un domicilio exacto dentro de San Bernardo');
      const dentro=await SGTMaps.validarPuntoSanBernardo(punto.lat,punto.lng);
      if(dentro!==true) throw Error('no se pudo confirmar la ubicación dentro del límite comunal');
      nuevas.push({...item,lat:Number(punto.lat),lng:Number(punto.lng)});
    }catch(err){
      // Enviar igualmente la fila original: el servidor podrá marcarla como
      // omitida si ya se importó antes, o rechazarla sin crear un pin falso.
      nuevas.push(item);
      fallidas.push(`Junta fila ${item.fila} (${item.nombre||'sin nombre'}): ${err.message}`);
    }
  }
  return {nuevas,fallidas};
}

async function importarExcelSGT(){
  if(!excelSGTPendiente)return;
  const btn=document.getElementById('btnImportarSGT');btn.disabled=true;
  try{
    // Si falla una ubicación, no crear una junta invisible en el mapa.
    // Las solicitudes de otras juntas sí pueden importarse normalmente.
    const pendientes=excelSGTPendiente;
    if(pendientes.tipo==='madre'){
      const r=await fetch('/api/excel/madre-import',{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken()},
        body:JSON.stringify(pendientes)});
      const data=await r.json();if(!r.ok)throw Error(data.error||'Error al importar SGT_MADRE');
      const errores=(data.errores||[]).slice(0,20);
      mensajeExcelSGT(`SGT_MADRE: ${data.juntas} junta(s) y ${data.solicitudes} solicitud(es) incorporadas; ${data.omitidas} duplicadas.`+
        (errores.length?'\nObservaciones:\n'+errores.join('\n'):''),errores.length>0);
      return;
    }
    if(pendientes.tipo==='forms'){
      const r=await fetch('/api/excel/forms-import',{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken()},
        body:JSON.stringify(pendientes)});
      const data=await r.json();if(!r.ok)throw Error(data.error||'Error al importar SGTE_FORMS');
      const errores=(data.errores||[]).slice(0,15);
      mensajeExcelSGT(`SGTE_FORMS: ${data.solicitudes} solicitud(es) incorporada(s), ${data.omitidas} duplicada(s).`+
        (errores.length?'\nObservaciones:\n'+errores.join('\n'):''),errores.length>0);
      document.getElementById('excelResumen').textContent='Puedes volver a importar SGTE_FORMS sin duplicar solicitudes existentes.';
      return;
    }
    let geofallidas=[];
    let juntas=pendientes.juntas;
    if(juntas.length){
      mensajeExcelSGT(`Validando ubicaciones en Google Maps (0/${juntas.length})...`);
      const resultado=await ubicarJuntasExcelSGT(juntas);
      juntas=resultado.nuevas;
      geofallidas=resultado.fallidas;
    }
    const r=await fetch('/api/excel/import',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken()},
      body:JSON.stringify({...pendientes,juntas})});
    const data=await r.json();if(!r.ok)throw Error(data.error||'Error de importación');
    const errores=[...(data.errores||[]),...geofallidas].slice(0,15);
    mensajeExcelSGT(`Importación finalizada: ${data.juntas} junta(s), ${data.solicitudes} solicitud(es) nueva(s), ${data.omitidas} ya importada(s).`+
      (errores.length?'\nObservaciones:\n'+errores.join('\n'):''),errores.length>0);
    document.getElementById('excelResumen').textContent='Puedes volver a cargar el mismo archivo sin duplicar las filas ya importadas.';
  }catch(err){mensajeExcelSGT(err.message,true);}finally{btn.disabled=false;}
}


// Excel histórico: encabezados reales del libro SGT_MADRE, sin posiciones fijas.
function obtenerSolicitudesMadreSGT(wb){
  const sheet=wb.Sheets['Solicitudes']||wb.Sheets[wb.SheetNames[0]];
  if(!sheet)throw Error('El Excel madre no contiene la hoja Solicitudes.');
  const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});
  if(!rows.length)throw Error('El Excel madre está vacío.');
  const headers=rows[0].map(encabezadoFormsSGT);
  const idx=(...names)=>names.map(encabezadoFormsSGT).map(x=>headers.indexOf(x)).find(i=>i>=0);
  const columns={
    junta:idx('Folio Junta','Junta de Vecinos','Nombre Junta'),
    codigo:idx('Codigo Junta','Código Junta'),
    direccion:idx('Direccion','Dirección'),
    presidente:idx('Presidente'),
    lat:idx('Lat','Latitud'),lng:idx('Lng','Longitud'),
    categoria:idx('Categoria','Categoría'),prioridad:idx('Prioridad'),
    estado:idx('Estado','Estatus'),requerimiento:idx('Requerimiento','Solicitud'),
    gestion:idx('Gestion','Gestión'),departamento:idx('Departamento'),
    encargado:idx('Encargado'),confianza:idx('Confianza(1-10)','Confianza'),
    fecha:idx('Fecha','Fecha Ingreso','Fecha de ingreso'),
    direccionProblema:idx('Direccion Problema (Opcional)','Dirección Problema (Opcional)','Ubicacion del problema')
  };
  if(columns.junta===undefined||columns.requerimiento===undefined)
    throw Error('SGT_MADRE requiere las columnas Folio Junta y Requerimiento.');
  if(rows.length>10001)throw Error('El Excel madre supera 10.000 filas.');
  return rows.slice(1).map((r,i)=>{
    const obj={fila:i+2};
    for(const [k,col] of Object.entries(columns))obj[k]=col===undefined?'':textoSGT(r[col]);
    return obj;
  }).filter(r=>r.requerimiento);
}

let mapaPreviaSGT=null,marcadorPreviaSGT=null;
function mostrarPuntoExcelSGT(lat,lng,descripcion){
  const panel=document.getElementById('excelMapaPrevia');
  if(!Number.isFinite(Number(lat))||!Number.isFinite(Number(lng))||lat===''||lng===''){
    panel.classList.add('d-none');return;
  }
  panel.classList.remove('d-none');
  if(!mapaPreviaSGT){
    mapaPreviaSGT=L.map(panel).setView([Number(lat),Number(lng)],16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {attribution:'© OpenStreetMap',maxZoom:19}).addTo(mapaPreviaSGT);
  }
  if(marcadorPreviaSGT)mapaPreviaSGT.removeLayer(marcadorPreviaSGT);
  marcadorPreviaSGT=L.marker([Number(lat),Number(lng)]).addTo(mapaPreviaSGT);
  marcadorPreviaSGT.bindPopup(descripcion||'Ubicación registrada').openPopup();
  mapaPreviaSGT.setView([Number(lat),Number(lng)],16);
  setTimeout(()=>mapaPreviaSGT.invalidateSize(),60);
}
async function previsualizarExcelSGT(pendiente){
  const panel=document.getElementById('excelPrevisualizacion');
  const cuerpo=document.getElementById('excelFilasPrevia');
  cuerpo.replaceChildren();panel.classList.remove('d-none');
  const db=dbLoad(),juntas=Object.values(db.juntas||{});
  const porNombre=new Map(juntas.map(j=>[encabezadoFormsSGT(j.nombre),j]));
  const porCodigo=new Map(juntas.map(j=>[String(j.codigo||'').toUpperCase(),j]));
  const lista=[...(pendiente.juntas||[]).map(x=>({...x,tipoFila:'Junta'})),
    ...(pendiente.solicitudes||[]).map(x=>({...x,tipoFila:'Solicitud'}))];
  const geocache=new Map();
  // La vista previa siempre usa las juntas ya registradas cuando existan.
  for(const item of lista){
    let j=porNombre.get(encabezadoFormsSGT(item.junta||item.nombre))||
      porCodigo.get(String(item.codigo||'').toUpperCase());
    if(pendiente.tipo==='madre'){
      if(j){item.lat=j.lat;item.lng=j.lng;item.ubicacionJunta='Junta existente';}
      else {
        let lat=Number(item.lat),lng=Number(item.lng);
        if(item.lat!==''&&item.lng!==''&&Number.isFinite(lat)&&Number.isFinite(lng)){
          const valido=await SGTMaps.validarPuntoSanBernardo(lat,lng);
          if(!valido){item.lat='';item.lng='';}
        }
        if(!item.lat||!item.lng){
          const dir=item.direccion||'';
          if(dir){
            try{
              const clave=dir.toLowerCase();
              if(!geocache.has(clave))geocache.set(clave,await SGTMaps.geocode(dir));
              const punto=geocache.get(clave);
              if(punto&&await SGTMaps.validarPuntoSanBernardo(punto.lat,punto.lng)){
                item.lat=punto.lat;item.lng=punto.lng;
              }
            }catch(err){console.warn('Geocodificación junta:',err.message);}
          }
        }
        item.ubicacionJunta=item.lat&&item.lng?'Junta nueva · ubicada':'Junta nueva · falta ubicación';
      }
    }else if(j){item.lat=j.lat;item.lng=j.lng;item.ubicacionJunta='Junta existente';}
    else item.ubicacionJunta=item.tipoFila==='Junta'?'Junta por crear':'Junta no encontrada';
    const dir=item.direccionProblema||'';
    if(dir){
      try{
        const clave=dir.toLowerCase();
        if(!geocache.has(clave))geocache.set(clave,await SGTMaps.geocode(dir));
        const punto=geocache.get(clave);
        if(punto&&await SGTMaps.validarPuntoSanBernardo(punto.lat,punto.lng)){
          item.probLat=punto.lat;item.probLng=punto.lng;
        }
      }catch(err){console.warn('Geocodificación problema:',err.message);}
    }
    const tr=document.createElement('tr');
    const cols=[item.fila,item.tipoFila||'Solicitud',item.junta||item.nombre||'',
      item.requerimiento||'',item.ubicacionJunta||'',
      item.probLat&&item.probLng?'Problema ubicado':dir?'Sin punto verificado':'Sin ubicación del problema'];
    cols.forEach(v=>{const td=document.createElement('td');td.textContent=String(v);tr.appendChild(td);});
    const td=document.createElement('td'),btn=document.createElement('button');
    btn.className='btn btn-outline-primary btn-sm';btn.textContent='Ver mapa';
    btn.disabled=!(item.probLat&&item.probLng)&&!(item.lat&&item.lng);
    btn.addEventListener('click',()=>mostrarPuntoExcelSGT(
      item.probLat||item.lat,item.probLng||item.lng,
      item.probLat?'Ubicación del problema':'Ubicación de la junta'));
    td.appendChild(btn);tr.appendChild(td);cuerpo.appendChild(tr);
  }
  document.getElementById('excelPreviaResumen').textContent=
    `${lista.length} filas detectadas. La ubicación de la junta y la del problema se muestran por separado. Las ubicaciones no verificadas no generan pines.`;
}
