// ============================================================
// FORMULARIO DE SOLICITUD - SGT MUNICIPAL
// ============================================================

const db = dbLoad();
const params = new URLSearchParams(location.search);
const folioEdit = params.get('folio');
const juntaPre = params.get('junta');

// ============================================================
// VARIABLES
// ============================================================

let mapaProblema = null;
let marcadorProblema = null;
let probLat = null;
let probLng = null;
let actualizandoDireccion = false;
let deptSel = '';

// ============================================================
// UTILIDADES
// ============================================================

function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(v) {
  return escapeHtml(v);
}

function escapeJs(v) {
  return String(v ?? '').replace(/'/g, "\\'");
}

function tieneCoords(lat, lng) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

// ============================================================
// RELLENAR SELECTS
// ============================================================

document.getElementById('fJunta').innerHTML = Object.values(db.juntas || {})
  .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')))
  .map(j => `<option value="${escapeAttr(j.id)}">${escapeHtml(j.nombre || '(sin nombre)')}</option>`)
  .join('');

document.getElementById('fCategoria').innerHTML =
  '<option value="">Seleccionar...</option>' +
  (typeof CATEGORIAS !== 'undefined' ? CATEGORIAS : [])
    .map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`)
    .join('');

// ============================================================
// DEPARTAMENTOS
// ============================================================

function pintarDept() {
  const cont = document.getElementById('deptChips');
  const lista = db.departamentos || [];

  cont.innerHTML = lista.map(d => `
    <span class="dept-chip ${d === deptSel ? 'selected' : ''}" onclick="pickDept('${escapeJs(d)}')">
      ${escapeHtml(d)}
    </span>
  `).join('') || '<span class="text-muted small">Sin departamentos registrados.</span>';

  document.getElementById('fDepartamento').value = deptSel;
}

function pickDept(d) {
  deptSel = d;
  pintarDept();
}

function agregarDept() {
  const input = document.getElementById('nuevoDept');
  const v = input.value.trim();
  if (!v) return;

  if ((db.departamentos || []).includes(v)) {
    alert('Ese departamento ya existe.');
    return;
  }

  addDepartamento(db, v);
  dbSave(db);
  input.value = '';
  deptSel = v;
  pintarDept();
}

pintarDept();

// ============================================================
// MINI MAPA DEL PROBLEMA
// ============================================================

function inicializarMapaProblema() {
  const contenedor = document.getElementById('mapProblema');
  if (!contenedor) return;

    // Forzar altura mínima si el CSS no la define
  if (contenedor.offsetHeight < 100) {
    contenedor.style.height = '420px';
  }

  if (typeof L === 'undefined') {
    console.error('Leaflet no está cargado.');
    return;
  }

  mapaProblema = L.map('mapProblema').setView([-33.5928, -70.7053], 14);

  SGTMaps.addBaseLayer(mapaProblema);

  mapaProblema.on('click', e => colocarUbicacionProblema(e.latlng.lat, e.latlng.lng, true));

  forzarRedibujadoMapa();
}

// Reintenta invalidateSize() varias veces, ya que en la carga inicial
// (sobre todo sin ubicación previa) el contenedor puede no tener aún
// su tamaño final cuando Leaflet se inicializa, dejando el mapa en blanco.
function forzarRedibujadoMapa() {
  if (!mapaProblema) return;

  const intentos = [50, 200, 500, 1000];
  intentos.forEach(ms => {
    setTimeout(() => {
      if (mapaProblema) mapaProblema.invalidateSize();
    }, ms);
  });

  if (document.readyState !== 'complete') {
    window.addEventListener('load', () => {
      if (mapaProblema) mapaProblema.invalidateSize();
    }, { once: true });
  }
}

// ============================================================
// COLOCAR UBICACIÓN DEL PROBLEMA
// ============================================================

function colocarUbicacionProblema(lat, lng, obtenerDireccion = false) {
  lat = Number(lat);
  lng = Number(lng);

  if (!tieneCoords(lat, lng) || !mapaProblema) return;

  probLat = lat;
  probLng = lng;

  if (marcadorProblema) {
    mapaProblema.removeLayer(marcadorProblema);
    marcadorProblema = null;
  }

  marcadorProblema = L.marker([lat, lng], { draggable: true }).addTo(mapaProblema);
  marcadorProblema.bindPopup('<strong>Ubicación del problema</strong>');
  marcadorProblema.openPopup();

  marcadorProblema.on('dragend', () => {
    const pos = marcadorProblema.getLatLng();
    probLat = pos.lat;
    probLng = pos.lng;
    actualizarEstadoUbicacion('Ubicación modificada manualmente.');
    actualizarCoordenadasTexto(probLat, probLng);
    obtenerDireccionProblema(probLat, probLng);
  });

  mapaProblema.setView([lat, lng], 17);
  actualizarEstadoUbicacion('Ubicación seleccionada correctamente.');
  actualizarCoordenadasTexto(lat, lng);

  if (obtenerDireccion) obtenerDireccionProblema(lat, lng);
}

// ============================================================
// BUSCAR DIRECCIÓN
// ============================================================

async function buscarDireccionProblema() {
  const input=document.getElementById('buscadorProblema'); if(!input) return;
  const direccion=input.value.trim(); if(!direccion){ alert('Ingresa una dirección para buscar.'); return; }
  actualizarEstadoUbicacion('Buscando dirección...');
  try {
    const resultado=await SGTMaps.geocode(direccion);
    if(!resultado){ actualizarEstadoUbicacion('No existe una coincidencia verificable para esta dirección en San Bernardo. Revisa calle y número.',true); return; }
    colocarUbicacionProblema(resultado.lat,resultado.lng,false);
    actualizandoDireccion=true;
    document.getElementById('fDireccionProblema').value=resultado.display_name||direccion;
    document.getElementById('buscadorProblema').value=resultado.display_name||direccion;
    actualizandoDireccion=false;
    actualizarEstadoUbicacion('Dirección encontrada y ubicada en el mapa.');
  } catch(error){ console.error('Error buscando dirección:',error); actualizarEstadoUbicacion('No fue posible buscar la dirección.',true); }
}

// ============================================================
// OBTENER DIRECCIÓN DESDE COORDENADAS
// ============================================================

async function obtenerDireccionProblema(lat, lng) {
  try {
    const resultado=await SGTMaps.reverse(lat,lng);
    if(resultado?.display_name){
      actualizandoDireccion=true;
      document.getElementById('fDireccionProblema').value=resultado.display_name;
      document.getElementById('buscadorProblema').value=resultado.display_name;
      actualizandoDireccion=false;
    }
  } catch(error){ console.error('Error obteniendo dirección:',error); }
}

// ============================================================
// USAR UBICACIÓN DE LA JUNTA
// ============================================================

function usarUbicacionJunta() {
  const juntaId = document.getElementById('fJunta').value;
  if (!juntaId) {
    alert('Primero debes seleccionar una Junta de Vecinos.');
    return;
  }

  const junta = db.juntas?.[juntaId];
  if (!junta) {
    alert('No se encontró la Junta seleccionada.');
    return;
  }

  if (!tieneCoords(junta.lat, junta.lng)) {
    alert('La Junta seleccionada no tiene coordenadas registradas.');
    return;
  }

  colocarUbicacionProblema(Number(junta.lat), Number(junta.lng), true);
  actualizarEstadoUbicacion('Se utilizó la ubicación de la Junta.');
}

// ============================================================
// LIMPIAR Y ESTADO DE UBICACIÓN
// ============================================================

function limpiarUbicacionProblema() {
  probLat = null;
  probLng = null;

  if (marcadorProblema && mapaProblema) {
    mapaProblema.removeLayer(marcadorProblema);
    marcadorProblema = null;
  }

  actualizarEstadoUbicacion('No hay una ubicación del problema seleccionada.');
  actualizarCoordenadasTexto(null, null);
}

function actualizarEstadoUbicacion(mensaje, error = false) {
  const cont = document.getElementById('estadoUbicacionProblema');
  if (!cont) return;

  cont.textContent = mensaje;
  cont.className = 'ubicacion-estado ' + (error ? 'text-danger' : 'text-muted');
}

function actualizarCoordenadasTexto(lat, lng) {
  const coordEl = document.getElementById('coordenadasProblema');
  if (!coordEl) return;

  if (tieneCoords(lat, lng)) {
    coordEl.textContent = `Lat: ${Number(lat).toFixed(5)}, Lng: ${Number(lng).toFixed(5)}`;
  } else {
    coordEl.textContent = 'Sin coordenadas';
  }
}

// ============================================================
// CAMBIO DE JUNTA
// ============================================================

document.getElementById('fJunta').addEventListener('change', function() {
  if (tieneCoords(probLat, probLng)) return;

  const junta = db.juntas?.[this.value];
  if (!junta || !mapaProblema) return;

  if (tieneCoords(junta.lat, junta.lng)) {
    mapaProblema.setView([Number(junta.lat), Number(junta.lng)], 16);
  }
});

// ============================================================
// CARGAR DATOS SI ES EDICIÓN
// ============================================================

if (folioEdit && db.solicitudes[folioEdit]) {
  const s = db.solicitudes[folioEdit];

  document.getElementById('tituloForm').textContent = 'Editar Solicitud — ' + s.folio;
  document.getElementById('fJunta').value = s.juntaId || '';
  document.getElementById('fFecha').value = s.fecha || '';
  document.getElementById('fCategoria').value = s.categoria || '';
  document.getElementById('fPrioridad').value = s.prioridad || '';
  document.getElementById('fEstado').value = s.estado || 'Pendiente';
  document.getElementById('fConfianza').value = s.confianza || '';
  document.getElementById('fRequerimiento').value = s.requerimiento || '';
  document.getElementById('fGestion').value = s.gestion || '';
  document.getElementById('fEncargado').value = s.encargado || '';
  document.getElementById('fDireccionProblema').value = s.direccionProblema || '';
  document.getElementById('fReferenciaDireccion').value = s.referenciaDireccionAproximada || '';
  document.getElementById('fFotos').value = (s.fotos || []).join('; ');

  if (tieneCoords(s.probLat, s.probLng)) {
    probLat = Number(s.probLat);
    probLng = Number(s.probLng);

    setTimeout(() => {
      colocarUbicacionProblema(probLat, probLng, false);
      const buscador = document.getElementById('buscadorProblema');
      if (buscador) buscador.value = s.direccionProblema || '';
    }, 300);
  } else if (s.direccionProblema && s.direccionProblema.trim() !== '') {
    const buscador = document.getElementById('buscadorProblema');
    if (buscador) buscador.value = s.direccionProblema;
  }

  actualizarConfianzaPct();

  deptSel = s.departamento || '';
  pintarDept();

  document.getElementById('btnEliminar').classList.remove('d-none');
} else if (juntaPre) {
  document.getElementById('fJunta').value = juntaPre;
}

// ============================================================
// INICIALIZAR MINI MAPA
// ============================================================

inicializarMapaProblema();

// ============================================================
// HISTORIAL DE CAMBIO DE ESTADO
// ============================================================

function registrarCambioEstado(s, estadoAnterior, estadoNuevo) {
  if (estadoAnterior === estadoNuevo) return;

  if (!s.historial) s.historial = [];

  s.historial.push({
    accion: estadoNuevo,
    usuario: 'Administrador',
    fecha: new Date().toLocaleDateString('es-CL'),
    detalle: `El estado cambió de "${estadoAnterior}" a "${estadoNuevo}" mediante edición manual.`
  });
}

// ============================================================
// PORCENTAJE DE CONFIANZA
// ============================================================

function actualizarConfianzaPct() {
  const v = Number(document.getElementById('fConfianza').value) || 0;
  document.getElementById('confianzaPctTxt').textContent = v ? Math.round(v * 10) + '%' : '—';
}

actualizarConfianzaPct();

// ============================================================
// GUARDAR
// ============================================================

function guardar(e) {
  if (e) e.preventDefault();

  const juntaId = document.getElementById('fJunta').value;
  const categoria = document.getElementById('fCategoria').value;
  const prioridad = document.getElementById('fPrioridad').value;
  const requerimiento = document.getElementById('fRequerimiento').value.trim();

  if (!juntaId) { alert('Debes seleccionar una junta.'); return false; }
  if (!categoria) { alert('Debes seleccionar una categoría.'); return false; }
  if (!prioridad) { alert('Debes seleccionar una prioridad.'); return false; }
  if (!requerimiento) { alert('El requerimiento no puede estar vacío.'); return false; }

  const estadoNuevo = document.getElementById('fEstado').value;
  const tieneUbicacion = tieneCoords(probLat, probLng);

  const data = {
    juntaId,
    fecha: document.getElementById('fFecha').value,
    categoria,
    prioridad,
    estado: estadoNuevo,
    confianza: Number(document.getElementById('fConfianza').value) || 0,
    departamento: deptSel,
    encargado: document.getElementById('fEncargado').value.trim(),
    requerimiento,
    gestion: document.getElementById('fGestion').value.trim(),
    direccionProblema: document.getElementById('fDireccionProblema').value.trim(),
    referenciaDireccionAproximada: document.getElementById('fReferenciaDireccion').value.trim(),
    probLat: tieneUbicacion ? Number(probLat) : null,
    probLng: tieneUbicacion ? Number(probLng) : null,
    fotos: document.getElementById('fFotos').value
      .split(';').map(x => x.trim()).filter(Boolean)
  };

  if (folioEdit && db.solicitudes[folioEdit]) {
    const estadoAnterior = db.solicitudes[folioEdit].estado;
    actualizarSolicitud(db, folioEdit, data, 'Edición manual');
    registrarCambioEstado(db.solicitudes[folioEdit], estadoAnterior, estadoNuevo);
    dbSave(db);
    location.href = 'solicitud-detalle.html?folio=' + encodeURIComponent(folioEdit);
  } else {
    const folio = crearSolicitud(db, data);
    dbSave(db);
    alert('Solicitud creada: ' + folio);
    location.href = 'solicitud-detalle.html?folio=' + encodeURIComponent(folio);
  }

  return false;
}

// ============================================================
// ELIMINAR
// ============================================================

function eliminar() {
  if (!folioEdit) return;

  const motivo = prompt('Motivo de eliminación (opcional):') || '';
  const ok = confirm('¿Seguro que deseas eliminar esta solicitud?');
  if (!ok) return;

  eliminarSolicitud(db, folioEdit, motivo);
  dbSave(db);
  location.href = 'solicitudes.html';
}

// ============================================================
// GESTIÓN DE DEPARTAMENTOS
// ============================================================

function abrirGestionDeptos() {
  const dbLocal = dbLoad();
  const cont = document.getElementById('listaDeptosModal');
  const deptos = dbLocal.departamentos || [];

  cont.innerHTML = deptos.length
    ? deptos.map(d => `
        <div class="dept-item">
          <span>${escapeHtml(d)}</span>
          <button type="button" class="btn btn-sm btn-outline-danger"
            onclick="eliminarDeptoDesdeModal('${escapeJs(d)}')">
            Eliminar
          </button>
        </div>
      `).join('')
    : `<div class="text-muted small py-2">No hay departamentos registrados.</div>`;

  new bootstrap.Modal(document.getElementById('modalGestionDeptos')).show();
}

function eliminarDeptoDesdeModal(nombre) {
  const confirmar = confirm(
    `¿Eliminar el departamento "${nombre}"? Las solicitudes que lo tengan asignado quedarán sin departamento.`
  );
  if (!confirmar) return;

  const dbLocal = dbLoad();
  eliminarDepartamento(dbLocal, nombre);
  dbSave(dbLocal);
  location.reload();
}

// ============================================================
// EXPONER FUNCIONES PARA HTML
// ============================================================

Object.assign(window, {
  guardar,
  eliminar,
  pickDept,
  agregarDept,
  abrirGestionDeptos,
  eliminarDeptoDesdeModal,
  actualizarConfianzaPct,
  buscarDireccionProblema,
  usarUbicacionJunta,
  limpiarUbicacionProblema,
  colocarUbicacionProblema
});