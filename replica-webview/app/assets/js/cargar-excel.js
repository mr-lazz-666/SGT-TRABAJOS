// ============================================================
// CARGAR EXCEL - SGT MUNICIPAL
// ============================================================
//
// Este archivo es responsable solo de:
//   - Leer y parsear el Excel
//   - Pintar la vista previa de la tabla
//   - Crear/actualizar juntas y solicitudes en la base de datos
//
// Toda la geocodificación, mapa manual y búsqueda de ubicaciones
// vive en georeferenciacion.js (objeto global `Geo`).
//
// IMPORTANTE: georeferenciacion.js debe cargarse ANTES que este
// archivo en el HTML.
// ============================================================

const db = dbLoad();
let filas = [];

// ============================================================
// CONFIGURAR Geo (una sola vez)
// ============================================================
//
// Se registra en DOMContentLoaded (no al ejecutarse este script)
// para que funcione sin importar el orden de los <script> en el
// HTML: al llegar DOMContentLoaded, TODOS los scripts ya se
// ejecutaron, así que `Geo` ya existe con toda seguridad.
// Aun así, lo ideal es cargar georeferenciacion.js antes que
// cargar-excel.js en el HTML.
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  if (typeof Geo === 'undefined') {
    console.error(
      'Geo no está definido. Verifica que georeferenciacion.js esté incluido en el HTML.'
    );
    return;
  }

  Geo.init({
    // Cada vez que Geo actualiza una fila, repintamos la tabla
    onUpdate: pintarPreview,

    // Cuando Geo termina de procesar todas las pendientes,
    // o cuando el usuario selecciona una ubicación manual,
    // revisamos si ya se puede habilitar el botón de carga
    onEstadoCambiado: actualizarEstadoCarga,

    // Geo no conoce la base de datos: le entregamos esta función
    // para que pueda reutilizar la ubicación de una junta ya guardada
    buscarUbicacionGuardada,
  });
});

// ============================================================
// PROCESAR EXCEL
// ============================================================

function procesar(input) {
  if (!input.files.length) return;

  const reader = new FileReader();

  reader.onload = (e) => {
    const wb = XLSX.read(new Uint8Array(e.target.result), {
      type: 'array',
      cellDates: true,
    });

    const hoja = wb.Sheets['Solicitudes'] || wb.Sheets[wb.SheetNames[0]];

    const todasLasFilas = XLSX.utils.sheet_to_json(hoja, { defval: '' });

    filas = todasLasFilas.filter(
      (f) =>
        String(f['Folio Junta'] || '').trim() !== '' &&
        String(f['Requerimiento'] || '').trim() !== ''
    );

    filas.forEach((f) => {
      const lat = parseFloat(f['Lat']);
      const lng = parseFloat(f['Lng']);

      // Si el Excel ya trae coordenadas válidas dentro del rango esperado
      if (!isNaN(lat) && !isNaN(lng) && lat >= -34 && lat <= -33 && lng >= -71 && lng <= -70) {
        f._lat = lat;
        f._lng = lng;
        f._geoEstado = 'excel';
        f._geoDireccion = 'Coordenadas proporcionadas por Excel';
      } else {
        f._lat = null;
        f._lng = null;
        f._geoEstado = 'pend';
        f._geoDireccion = '';
      }
    });

    document.getElementById('total').textContent = filas.length;
    document.getElementById('resultado').classList.remove('d-none');

    // Compartimos el arreglo con Geo (misma referencia en memoria,
    // así los índices calzan entre ambos archivos)
    Geo.setFilas(filas);

    pintarPreview();
    iniciarGeolocalizacion();
  };

  reader.readAsArrayBuffer(input.files[0]);
}

// ============================================================
// INICIAR GEOLOCALIZACIÓN DE LAS FILAS PENDIENTES
// ============================================================

function iniciarGeolocalizacion() {
  const pendientes = filas.filter((f) => f._geoEstado === 'pend');

  if (!pendientes.length) {
    actualizarEstadoCarga();
    return;
  }

  document.getElementById('geoPanel').classList.remove('d-none');
  document.getElementById('btnCargar').disabled = true;
  document.getElementById('btnCargarHint').textContent = 'Ubicando direcciones, por favor espera...';

  Geo.geolocalizarPendientes();
}

// ============================================================
// BUSCAR UBICACIÓN YA GUARDADA EN LA BASE DE DATOS
// ============================================================
// Le permite a Geo reutilizar la ubicación de una junta que ya
// existe en la base de datos, sin que Geo tenga que conocer `db`.
// ============================================================

function buscarUbicacionGuardada(f) {
  const nombreJunta = String(f['Folio Junta'] || '').trim();
  const codigoJunta = String(f['Codigo Junta'] || '').trim().toLowerCase();

  // La identidad de una Junta en el Excel madre es compuesta:
  // Folio Junta + Codigo Junta. Ambos deben coincidir.
  const juntaExistente = Object.values(db.juntas).find((j) => {
    const codigo = String(j.codigo || '').trim().toLowerCase();
    const nombre = String(j.nombre || '').trim().toLowerCase();
    return !!codigoJunta && !!nombreJunta &&
      codigo === codigoJunta && nombre === nombreJunta.toLowerCase();
  });

  if (juntaExistente && typeof juntaExistente.lat === 'number' && typeof juntaExistente.lng === 'number') {
    return {
      lat: juntaExistente.lat,
      lng: juntaExistente.lng,
      origen: 'Ubicación guardada anteriormente',
    };
  }

  return null;
}

// ============================================================
// PINTAR PREVIEW
// ============================================================

function pintarPreview() {
  document.getElementById('preview').innerHTML = filas
    .map(
      (f, index) => `
      <tr>
        <td>${escapeHtml(f['Folio Junta'] || '-')}</td>
        <td class="small">${escapeHtml(f['Direccion'] || '-')}</td>
        <td>${Geo.badgeHtml(f, index)}</td>
        <td>${escapeHtml(f['Categoria'] || '-')}</td>
        <td>${escapeHtml(f['Departamento'] || '-')}</td>
        <td>${escapeHtml(f['Prioridad'] || '-')}</td>
        <td>${escapeHtml(f['Confianza(1-10)'] || '-')}</td>
      </tr>
    `
    )
    .join('');
}

// ============================================================
// BUSCAR / CREAR JUNTA
// ============================================================

function buscarOCrearJunta(nombre, f) {
  const codigo = String(f['Codigo Junta'] || '').trim().toUpperCase();
  const nombreLimpio = String(nombre || '').trim();
  const nombreNormalizado = nombreLimpio.toLowerCase();

  // Regla del Excel madre: SOLO es la misma Junta cuando coinciden
  // simultáneamente Folio Junta + Codigo Junta.
  let j = Object.values(db.juntas).find((x) =>
    codigo && nombreNormalizado &&
    String(x.codigo || '').trim().toUpperCase() === codigo &&
    String(x.nombre || '').trim().toLowerCase() === nombreNormalizado
  );

  if (j) {
    // Solo un administrador puede cambiar datos propios de la Junta.
    if (esAdministrador()) {
      if (typeof f._lat === 'number' && typeof f._lng === 'number') { j.lat=f._lat; j.lng=f._lng; }
      if (f['Direccion']) j.direccion=f['Direccion'];
      if (f['Presidente']) j.presidente=f['Presidente'];
    }
    return j.id;
  }
  if (!esAdministrador()) return null;
  return crearJunta(db, { nombre:nombreLimpio, codigo:codigo||'XXX', direccion:f['Direccion']||'', lat:f._lat, lng:f._lng, presidente:f['Presidente']||'' });
}


// Campos opcionales del Excel madre. Se aceptan variantes de encabezado para
// no rechazar archivos por tildes o por usar "Dirección/Ubicación del problema".
// Normaliza encabezados para que el importador reconozca exactamente el Excel madre
// aunque el título lleve tildes, mayúsculas o el sufijo "(Opcional)".
function normalizarEncabezadoExcel(nombre) {
  return String(nombre ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\(\s*opcional\s*\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function valorOpcionalExcel(f, nombres) {
  const buscados = new Set(nombres.map(normalizarEncabezadoExcel));
  for (const [encabezado, valor] of Object.entries(f || {})) {
    if (buscados.has(normalizarEncabezadoExcel(encabezado))) {
      const v = String(valor ?? '').trim();
      if (v !== '') return v;
    }
  }
  return null;
}

function direccionProblemaExcel(f) {
  return valorOpcionalExcel(f, [
    // Encabezado EXACTO de plantilla_sgt_v5_MADRE_CON_DIRECCIONES_PROBLEMA.xlsx
    'Direccion Problema (Opcional)',
    'Dirección Problema (Opcional)',
    'Direccion del Problema (Opcional)',
    'Dirección del Problema (Opcional)',
    'Ubicacion del Problema (Opcional)',
    'Ubicación del Problema (Opcional)',
    // Compatibilidad con plantillas anteriores
    'Ubicacion del problema','Ubicación del problema','Ubicacion Problema','Ubicación Problema',
    'Direccion del problema','Dirección del problema','Direccion Problema','Dirección Problema'
  ]);
}

// Referencias imprecisas nunca deben enviarse a Google Geocoding.
// Solo una calle con numeración única puede utilizarse como dirección
// de problema. Intersecciones, tramos, listas de calles, sectores y
// lugares sin número se conservan como referencia aproximada.
function esDireccionExactaSGT(d) {
  const t=String(d||'').trim().replace(/\s+/g,' ');
  if(!t)return false;
  const sinComuna=t.replace(/,\s*(?:san bernardo(?:,?\s*(?:regi[oó]n metropolitana|chile))?|chile)\s*$/i,'').trim();
  if(/[,;\/]|\s+(?:y|con|e|entre|desde|hasta)\s+/i.test(sinComuna))return false;
  if(/\b(detr[aá]s|cerca de|al lado de|frente a|sitio eriazo|a la altura|esquina|intersecci[oó]n|sector|villa|plaza|consultorio|colegio|eje|caletera|cruce|costado|distintos puntos|varias calles)\b/i.test(sinComuna))return false;
  // Se admite Calle 255, 255 Calle, Calle N°255 y Calle #255.
  const limpia=sinComuna.replace(/\b(?:n[°ºo.]?\s*|#)(?=\d)/gi,'');
  const numeros=[...limpia.matchAll(/\b\d{1,6}[a-zA-Z]?\b/g)];
  if(numeros.length!==1)return false;
  const nombre=limpia.replace(numeros[0][0],'').trim().replace(/^calle\s+/i,'');
  return /^[a-záéíóúñ][a-záéíóúñ .'-]{2,}$/i.test(nombre);
}
function esReferenciaAproximadaSGT(d) {
  return !!String(d||'').trim() && !esDireccionExactaSGT(d);
}
function referenciaDireccionExcel(f) {
  return valorOpcionalExcel(f,['Referencias de direccion aproximada','Referencias de dirección aproximada','Referencia aproximada','Referencia de dirección aproximada']);
}
function estatusExcel(f) {
  return valorOpcionalExcel(f, ['Estatus','Estatus (Opcional)']);
}

async function geocodificarProblemasOpcionales() {
  for (const f of filas) {
    const direccion = direccionProblemaExcel(f);
    f._referenciaDireccionAproximada = referenciaDireccionExcel(f) || (esReferenciaAproximadaSGT(direccion) ? direccion : null);
    f._direccionProblema = esReferenciaAproximadaSGT(direccion) ? null : direccion;
    f._probLat = null;
    f._probLng = null;
    if (!f._direccionProblema) continue;
    try {
      const r = await SGTMaps.geocode(f._direccionProblema);
      if (r && Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng)) &&
          await SGTMaps.validarPuntoSanBernardo(Number(r.lat),Number(r.lng)) === true) {
        f._probLat = Number(r.lat);
        f._probLng = Number(r.lng);
        // Conservamos la ubicación escrita en el Excel como dato original.
        // Las coordenadas resueltas se guardan para no volver a geocodificarla.
      }
    } catch (err) {
      console.warn('[SGT] No se pudo geocodificar ubicación opcional del problema:', direccion, err);
      // Es opcional: una falla de geocodificación NO impide importar la solicitud.
    }
  }
}

// ============================================================
// CONFIRMAR CARGA
// ============================================================

async function confirmarCarga() {
  const sinUbicacion = filas.filter((f) => typeof f._lat !== 'number' || typeof f._lng !== 'number');

  if (sinUbicacion.length) {
    alert(`Todavía hay ${sinUbicacion.length} junta(s) sin ubicación.`);
    return;
  }

  if(!esAdministrador()){
    const faltantes = filas.filter(f => !buscarOCrearJunta(f['Folio Junta'], f));
    if(faltantes.length){
      const ids=[...new Set(faltantes.map(f=>`${f['Folio Junta']} / ${f['Codigo Junta']}`))];
      alert('El Excel contiene Juntas que aún no existen. Un administrador debe crearlas primero:\n\n'+ids.join('\n'));
      return;
    }
  }
  const confirmar = confirm(`¿Deseas cargar las ${filas.length} solicitudes?`);
  if (!confirmar) return;

  // La ubicación del problema es opcional. Si existe, Google se consulta una sola
  // vez durante la importación y sus coordenadas quedan persistidas en SQLite.
  // Si no existe (o Google no logra resolverla), la importación continúa normalmente.
  await geocodificarProblemasOpcionales();

  filas.forEach((f) => {
    const juntaId = buscarOCrearJunta(f['Folio Junta'], f);
    if(!juntaId) return;

    if (f['Departamento']) {
      addDepartamento(db, f['Departamento']);
    }

    crearSolicitud(db, {
      juntaId,
      categoria: f['Categoria'] || CATEGORIAS[0],
      prioridad: f['Prioridad'] || 'Media',
      estado: f['Estado'] || 'Pendiente',
      // ESTATUS es un campo independiente de ESTADO y puede ser NULL.
      estatus: estatusExcel(f),
      requerimiento: f['Requerimiento'] || '',
      gestion: f['Gestion'] || '',
      departamento: f['Departamento'] || '',
      encargado: f['Encargado'] || '',
      confianza: Number(f['Confianza(1-10)']) || 0,
      fecha: formatearFecha(f['Fecha']),
      // Ubicación del problema opcional. Nunca se rellena con la dirección de la Junta.
      direccionProblema: f._direccionProblema || null,
      referenciaDireccionAproximada: f._referenciaDireccionAproximada || null,
      probLat: Number.isFinite(f._probLat) ? f._probLat : null,
      probLng: Number.isFinite(f._probLng) ? f._probLng : null,
      fotos: String(f['Fotos (nombres separados por ;)'] || '')
        .split(';')
        .map((x) => x.trim())
        .filter(Boolean),
    });
  });

        // Detecta si demasiadas solicitudes distintas quedaron en la misma Junta (posible error de mapeo)
    const conteoPorJunta = {};
    filas.forEach(f => { const k = String(f['Folio Junta']||'').trim().toLowerCase(); conteoPorJunta[k] = (conteoPorJunta[k]||0)+1; });
    const nombresDistintos = Object.keys(conteoPorJunta).length;
    const maxEnUnaJunta = Math.max(...Object.values(conteoPorJunta));

    if(nombresDistintos > 1 && maxEnUnaJunta / filas.length > 0.7){
      Log.warn('datos', 'Posible error de mapeo: la mayoría de las filas cayeron en una sola Junta', {
        totalFilas: filas.length, maxEnUnaJunta, nombresDistintos
      });
    }


  dbSave(db);

  alert(`${filas.length} solicitudes cargadas correctamente.`);

  location.href = 'mapa.html';
}

// ============================================================
// FORMATEAR FECHA
// ============================================================

function formatearFecha(valor) {
  if (valor === null || valor === undefined || valor === '') return '';

  // Objeto Date
  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return '';

    const dia = String(valor.getDate()).padStart(2, '0');
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const anio = valor.getFullYear();

    return `${dia}/${mes}/${anio}`;
  }

  // Serial de Excel
  if (typeof valor === 'number') {
    const d = XLSX.SSF.parse_date_code(valor);
    if (!d) return '';

    const dia = String(d.d).padStart(2, '0');
    const mes = String(d.m).padStart(2, '0');

    return `${dia}/${mes}/${d.y}`;
  }

  // Texto
  return String(valor).trim();
}

// ============================================================
// ACTUALIZAR ESTADO DEL BOTÓN DE CARGA
// ============================================================

function actualizarEstadoCarga() {
  const sinUbicacion = filas.filter((f) => typeof f._lat !== 'number' || typeof f._lng !== 'number');

  const btn = document.getElementById('btnCargar');
  const hint = document.getElementById('btnCargarHint');

  if (sinUbicacion.length) {
    btn.disabled = true;
    hint.textContent =
      `${sinUbicacion.length} junta(s) necesitan una ubicación. ` +
      `Selecciona su ubicación en el mapa.`;
    return;
  }

  btn.disabled = false;
  hint.textContent = 'Todas las juntas tienen una ubicación válida.';
}

// ============================================================
// ESCAPAR HTML
// ============================================================

function escapeHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}