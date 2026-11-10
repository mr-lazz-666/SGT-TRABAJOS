// ============================================================
// DETALLE DE JUNTA - SGT MUNICIPAL
// ============================================================

const db = dbLoad();
const id = new URLSearchParams(location.search).get('id');
const j = db.juntas[id];


let mapaEditar = null;
let marcadorEditar = null;

// ============================================================
// CARGAR INFORMACIÓN
// ============================================================

if(!j){
  document.querySelector('.page-body').innerHTML = `
    <div class="card-flat text-muted">Junta no encontrada.</div>
  `;
} else {
  document.getElementById('bcNombre').textContent = j.nombre;
  document.getElementById('dNombre').textContent = j.nombre;
  document.getElementById('dDireccion').textContent = j.direccion || 'Sin dirección registrada';
  document.getElementById('dPresidente').textContent = j.presidente || '-';
  document.getElementById('dTerrLabel').textContent = db.territoriales[j.territorial] || '-';

  const confianza = confianzaJunta(db, j.id);

  document.getElementById('dConfianza').style.width = confianza + '%';
  document.getElementById('dConfianzaPorcentaje').textContent = confianza + '%';
  
  document.getElementById('btnHistorial').href = 'historial-junta.html?junta=' + j.id;
  document.getElementById('btnNuevaSol').href = 'solicitud-form.html?junta=' + j.id;

  // TERRITORIALES
  document.getElementById('dTerritoriales').innerHTML = db.territoriales.map((t,i) => `
    <button type="button" class="territorial-btn ${i === j.territorial ? 'selected' : ''}" onclick="cambiarTerr(${i})">
      ${escapeHtml(t)}
    </button>
  `).join('');

  // SOLICITUDES
  document.getElementById('tbody').innerHTML = solicitudesDeJunta(db, j.id).filter(s => !esSolicitudResuelta(s)).map(s => {
    const info = normalizarEstado(s.estado);
    return `
      <tr>
        <td><a href="solicitud-detalle.html?folio=${encodeURIComponent(s.folio)}">${escapeHtml(s.folio)}</a></td>
        <td><span class="badge-categoria">${escapeHtml(s.categoria)}</span></td>
        <td>
          <span class="badge-pill badge-${
            s.prioridad === 'Alta' ? 'alta' : s.prioridad === 'Media' ? 'media' : 'baja'
          }">${escapeHtml(s.prioridad)}</span>
        </td>
        <td><span class="badge-pill ${info.cls}">${escapeHtml(s.estado)}</span></td>
        <td><a href="solicitud-form.html?folio=${encodeURIComponent(s.folio)}">Editar</a></td>
      </tr>
    `;
  }).join('') || `
    <tr><td colspan="5" class="text-muted text-center py-3">Sin solicitudes.</td></tr>
  `;
}

// ============================================================
// CAMBIAR TERRITORIAL
// ============================================================

function cambiarTerr(i){
  if(!exigirAdministrador()) return;
  if(!j) return;
  j.territorial = i;
  dbSave(db);
  location.reload();
}

// ============================================================
// MOSTRAR EDITOR
// ============================================================

function mostrarEditor(){
  if(!exigirAdministrador()) return;
  if(!j) return;

  const panel = document.getElementById('panelEditar');
  panel.classList.add('active');

  // CARGAR DATOS
  document.getElementById('editNombre').value = j.nombre || '';
  document.getElementById('editPresidente').value = j.presidente || '';
  document.getElementById('editDireccion').value = j.direccion || '';

  // TERRITORIALES
  const select = document.getElementById('editTerritorial');
  select.innerHTML = db.territoriales.map((t, i) => `
    <option value="${i}" ${Number(j.territorial) === i ? 'selected' : ''}>${escapeHtml(t)}</option>
  `).join('');

  // CREAR MAPA
  setTimeout(() => { crearMapaEditar(); }, 100);

  // SCROLL
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================
// CANCELAR EDICIÓN
// ============================================================

function cancelarEdicion(){
  const panel = document.getElementById('panelEditar');
  panel.classList.remove('active');
}

// ============================================================
// CREAR MAPA DE EDICIÓN
// ============================================================

function crearMapaEditar(){
  if(!j) return;

  // SI YA EXISTE
  if(mapaEditar){
    setTimeout(() => { mapaEditar.invalidateSize(); }, 100);
    return;
  }

  // POSICIÓN INICIAL
  let lat = -33.5928;
  let lng = -70.7053;
  let zoom = 14;

  if(typeof j.lat === 'number' && typeof j.lng === 'number'){
    lat = j.lat; lng = j.lng; zoom = 17;
  }

  // CREAR MAPA
  mapaEditar = L.map('mapaEditarJunta').setView([lat, lng], zoom);

  // OPENSTREETMAP
  SGTMaps.addBaseLayer(mapaEditar);

  // MARCADOR EXISTENTE
  if(typeof j.lat === 'number' && typeof j.lng === 'number'){
    colocarMarcadorEditar(j.lat, j.lng);
    actualizarInfoUbicacion(j.lat, j.lng);
  }

  // CLICK MAPA
  mapaEditar.on('click', function(e){
    seleccionarUbicacionEditar(e.latlng.lat, e.latlng.lng);
  });

  setTimeout(() => { mapaEditar.invalidateSize(); }, 200);
}

// ============================================================
// COLOCAR MARCADOR
// ============================================================

function colocarMarcadorEditar(lat, lng){
  if(!mapaEditar) return;

  if(marcadorEditar){ mapaEditar.removeLayer(marcadorEditar); }

  marcadorEditar = L.marker([lat, lng]).addTo(mapaEditar);

  marcadorEditar.bindPopup(`
    <strong>Ubicación de la junta</strong><br>
    Lat: ${lat.toFixed(6)}<br>
    Lng: ${lng.toFixed(6)}
  `);

  marcadorEditar.openPopup();
}

// ============================================================
// SELECCIONAR UBICACIÓN
// ============================================================

function seleccionarUbicacionEditar(lat, lng){
  if(!j) return;

  // GUARDAR TEMPORALMENTE
  j.lat = lat;
  j.lng = lng;

  colocarMarcadorEditar(lat, lng);
  actualizarInfoUbicacion(lat, lng);
}

// ============================================================
// MOSTRAR INFO DE COORDENADAS
// ============================================================

function actualizarInfoUbicacion(lat, lng){
  const elemento = document.getElementById('ubicacionEditarInfo');
  if(!elemento) return;

  elemento.innerHTML = `
    <strong>✓ Ubicación seleccionada</strong><br>
    Latitud: ${lat.toFixed(6)} | Longitud: ${lng.toFixed(6)}
  `;
}

// ============================================================
// ENTER BUSCADOR
// ============================================================

function enterBuscarEditarMapa(event){
  if(event.key === 'Enter'){
    event.preventDefault();
    buscarEditarMapa();
  }
}

// ============================================================
// BUSCAR DIRECCIÓN
// ============================================================

async function buscarEditarMapa(){
  const input = document.getElementById('buscadorEditarMapa');
  const boton = document.getElementById('btnBuscarEditarMapa');
  const resultadoBox = document.getElementById('resultadoEditarMapa');

  const texto = input.value.trim();

  if(!texto){
    resultadoBox.style.display = 'block';
    resultadoBox.textContent = 'Escribe una dirección para buscar.';
    return;
  }

  boton.disabled = true;
  boton.textContent = 'Buscando...';
  resultadoBox.style.display = 'none';

  try{
    const resultado = await buscarDireccionEditar(texto);

    if(!resultado){
      resultadoBox.style.display = 'block';
      resultadoBox.textContent = 'No se encontró esa dirección. Intenta escribir la calle y número de otra forma.';
      return;
    }

    // MOVER MAPA
    mapaEditar.setView([resultado.lat, resultado.lng], 18, { animate: true });

    // COLOCAR MARCADOR
    seleccionarUbicacionEditar(resultado.lat, resultado.lng);

    // MOSTRAR RESULTADO
    resultadoBox.style.display = 'block';
    resultadoBox.innerHTML = `
      <strong>Resultado encontrado:</strong><br>
      ${escapeHtml(resultado.display_name)}<br>
      <small>Puedes hacer clic en otro punto del mapa si quieres modificar la ubicación.</small>
    `;
  } catch(error){
    console.error(error);
    resultadoBox.style.display = 'block';
    resultadoBox.textContent = 'Ocurrió un error al buscar la dirección.';
  } finally {
    boton.disabled = false;
    boton.textContent = 'Buscar';
  }
}

// ============================================================
// NOMINATIM
// ============================================================

async function buscarDireccionEditar(direccion){
  return await SGTMaps.geocode(direccion);
}

// ============================================================
// GUARDAR CAMBIOS
// ============================================================

function guardarCambiosJunta(){
  if(!exigirAdministrador()) return;
  if(!j) return;

  const nombre = document.getElementById('editNombre').value.trim();
  const presidente = document.getElementById('editPresidente').value.trim();
  const territorial = document.getElementById('editTerritorial').value;
  const direccion = document.getElementById('editDireccion').value.trim();

  // VALIDAR NOMBRE
  if(!nombre){
    alert('Debes ingresar el nombre de la junta.');
    return;
  }

  // VALIDAR UBICACIÓN
  if(typeof j.lat !== 'number' || typeof j.lng !== 'number'){
    const continuar = confirm('La junta no tiene una ubicación seleccionada en el mapa. ¿Deseas guardar de todas formas?');
    if(!continuar) return;
  }

  // GUARDAR
  j.nombre = nombre;
  j.presidente = presidente;
  j.territorial = Number(territorial);
  j.direccion = direccion;

  // PERSISTIR
  dbSave(db);
  alert('Los datos de la junta fueron actualizados correctamente.');
  location.reload();
}

// ============================================================
// ELIMINAR JUNTA
// ============================================================

function eliminarJunta(){
  if(!exigirAdministrador()) return;
  if(!j) return;

  // CONFIRMACIÓN 1
  const confirmar1 = confirm(`¿Estás seguro de que deseas eliminar la junta "${j.nombre}"?`);
  if(!confirmar1) return;

  // CONFIRMACIÓN 2
  const confirmar2 = confirm('ADVERTENCIA: esta acción eliminará la junta de vecinos del sistema. ¿Deseas continuar?');
  if(!confirmar2) return;

  // CONFIRMACIÓN 3
  const confirmar3 = confirm('ÚLTIMA CONFIRMACIÓN: la eliminación será permanente. ¿REALMENTE deseas eliminar esta junta?');
  if(!confirmar3) return;

  // ELIMINAR SOLICITUDES DE LA JUNTA
  if(Array.isArray(db.solicitudes)){
    db.solicitudes = db.solicitudes.filter(s => s.juntaId !== j.id);
  }

  // ELIMINAR JUNTA
  delete db.juntas[j.id];

  // GUARDAR
  dbSave(db);
  alert('La junta de vecinos fue eliminada correctamente.');

  // VOLVER A JUNTAS
  location.href = 'juntas.html';
}

// ============================================================
// UTILIDADES
// ============================================================

function esperar(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(valor){
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}