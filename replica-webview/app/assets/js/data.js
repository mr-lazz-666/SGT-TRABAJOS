const DB_KEY = 'sgt_db';
const CATEGORIAS = [
  '1. Seguridad ciudadana y prevención','2. Iluminación y alumbrado público','3. Tránsito y seguridad vial',
  '4. Medioambiente, arbolado, residuos y saneamiento','5. Infraestructura y espacios públicos',
  '6. Sedes sociales, vivienda y regularización','7. Emergencias y prevención de riesgos',
  '8. Bienestar animal','9. Gestiones administrativas pendientes'
];
const DEPARTAMENTOS_DEFAULT = [
  'Tránsito y transporte público','Territorial','Seguridad ciudadana','Secretaría municipal','SECPLA','Rentas',
  'Operaciones','Obras','Juzgado de policía','Dideco','Control','Comunicaciones','Asesoría Jurídica',
  'Medioambiente, Aseo y Ornato','Administración y finanzas'
];
const TERRITORIALES = ['Territorial Norte','Territorial Centro','Territorial Sur'];

function authToken(){ return sessionStorage.getItem('sgt_token') || localStorage.getItem('sgt_token') || ''; }
function usuarioSesion(){ try{return JSON.parse(sessionStorage.getItem('sgt_user') || localStorage.getItem('sgt_user') || 'null');}catch{return null;} }
function usuarioActual(){ const u=usuarioSesion(); return u ? u.nombre : 'Invitado'; }
function rolActual(){ const u=usuarioSesion(); return u ? u.rol : ''; }
function esAdministrador(){ return rolActual()==='administrador'; }
function authHeader(xhr){ const t=authToken(); if(t) xhr.setRequestHeader('Authorization','Bearer '+t); }
function exigirAdministrador(){ if(!esAdministrador()){ alert('Esta función está reservada para administradores.'); return false; } return true; }

// La información operativa del SGT vive en SQLite (database.db), no en localStorage.
// Se usa una petición local síncrona para conservar la lógica existente del proyecto,
// donde dbLoad()/dbSave() son funciones síncronas utilizadas por todas las pantallas.
function dbLoad(){
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/db', false);
    xhr.setRequestHeader('Cache-Control', 'no-cache');
    authHeader(xhr);
    xhr.send(null);
    if(xhr.status >= 200 && xhr.status < 300){
      const db = JSON.parse(xhr.responseText || '{}');
      db.juntas = db.juntas || {};
      db.solicitudes = db.solicitudes || {};
      db.departamentos = db.departamentos || [...DEPARTAMENTOS_DEFAULT];
      db.territoriales = db.territoriales || [...TERRITORIALES];
      db.seq = db.seq || {};
      return db;
    }
    throw new Error('HTTP ' + xhr.status);
  } catch(err){
    console.error('No se pudo leer database.db:', err);
    return dbSeed();
  }
}

function dbSave(db){
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/db', false);
  xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
  authHeader(xhr);
  xhr.send(JSON.stringify(db));
  if(xhr.status < 200 || xhr.status >= 300){
    let detalle = xhr.responseText || ('HTTP ' + xhr.status);
    throw new Error('No se pudo guardar en database.db: ' + detalle);
  }
}


function sgtDescargarPDF(pdf, nombre){
  try{
    const dataUri = pdf.output('datauristring');
    const base64 = dataUri.substring(dataUri.indexOf(',') + 1);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/export-pdf', false);
    xhr.setRequestHeader('Content-Type','application/json; charset=UTF-8');
    authHeader(xhr);
    xhr.send(JSON.stringify({filename:nombre, base64}));
    if(xhr.status < 200 || xhr.status >= 300) throw new Error(xhr.responseText || ('HTTP '+xhr.status));
    alert('El reporte fue enviado a tu navegador predeterminado para descargarlo.');
  }catch(err){
    console.error('Error al exportar PDF:', err);
    alert('No se pudo descargar el PDF: ' + err.message);
  }
}
function esSolicitudResuelta(s){ return normalizarEstado(s && s.estado).key === 'resuelta'; }

function nuevoFolio(db, juntaId){
  const j = db.juntas[juntaId];
  db.seq[juntaId] = (db.seq[juntaId] || 0) + 1;
  return `SGT-${j.codigo}-${String(db.seq[juntaId]).padStart(4,'0')}`;
}
function crearJunta(db, data){
  // ID realmente único: evita colisiones cuando Excel crea varias juntas en el mismo milisegundo.
  let id;
  do {
    id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? 'j_' + crypto.randomUUID()
      : 'j_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  } while (db.juntas[id]);

  db.juntas[id] = { id, presidente:'', territorial:0, ...data };
  if (db.seq[id] === undefined) db.seq[id] = 0;
  return id;
}
function crearSolicitud(db, data){
  const folio = nuevoFolio(db, data.juntaId);
  db.solicitudes[folio] = {
    folio, eliminada:false,
    historial:[{fecha:new Date().toLocaleString('es-CL'), usuario:usuarioActual(), accion:'Creación', detalle:'Solicitud registrada'}],
    ...data
  };
  return folio;
}
function actualizarSolicitud(db, folio, cambios, accionLabel){
  const s = db.solicitudes[folio]; if(!s) return;
  Object.assign(s, cambios);
  s.historial.push({fecha:new Date().toLocaleString('es-CL'), usuario:usuarioActual(), accion: accionLabel || 'Edición', detalle:'Datos actualizados'});
}
function eliminarSolicitud(db, folio, motivo){
  actualizarSolicitud(db, folio, { eliminada:true }, 'Eliminada: ' + (motivo || 'sin motivo'));
}
function solicitudesDeJunta(db, juntaId, incluirEliminadas){
  return Object.values(db.solicitudes).filter(s => s.juntaId === juntaId && (incluirEliminadas || !s.eliminada));
}
function confianzaJunta(db, juntaId){
  const sols = solicitudesDeJunta(db, juntaId).filter(s => s.confianza);
  if(!sols.length) return 0;
  const suma = sols.reduce((a,s)=> a + (Number(s.confianza)/10*100), 0);
  return Math.round(suma / sols.length);
}
function addDepartamento(db, nombre){
  nombre = (nombre||'').trim();
  if(nombre && !db.departamentos.includes(nombre)) db.departamentos.push(nombre);
}
function normalizarEstado(estado){
  const e = (estado||'').toLowerCase();
  if(e.includes('proceso')) return {key:'proceso', cls:'badge-proceso'};
  if(e.includes('crít')||e.includes('crit')) return {key:'critica', cls:'badge-critica'};
  if(e.includes('resuel')) return {key:'resuelta', cls:'badge-resuelta'};
  return {key:'pendiente', cls:'badge-pendiente'};
}
function colorEstado(key){ return {critica:'#dc2626', proceso:'#7c3aed', pendiente:'#d97706', resuelta:'#16a34a'}[key] || '#6b7280'; }

function dbSeed(){
  // Sin juntas ni solicitudes predefinidas.
  // El sistema comienza limpio y persiste todo en database.db.
  return {
    juntas:{},
    solicitudes:{},
    departamentos:[...DEPARTAMENTOS_DEFAULT],
    territoriales:[...TERRITORIALES],
    seq:{}
  };
}
