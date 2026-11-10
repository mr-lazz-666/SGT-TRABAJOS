// Lógica de la página Juntas de Vecinos (juntas.html)
const db = dbLoad();
let terrSel = 0;
document.getElementById('nTerritoriales').innerHTML = db.territoriales.map((t,i)=>`<button type="button" class="territorial-btn ${i===0?'selected':''}" data-i="${i}" onclick="pickTerr(${i})">${t}</button>`).join('');
function pickTerr(i){ terrSel=i; document.querySelectorAll('#nTerritoriales button').forEach((b,idx)=>b.classList.toggle('selected', idx===i)); }

// ---------- Mini mapa del modal + geocodificación por dirección ----------
const CENTRO_DEFECTO = { lat:-33.5928, lng:-70.7053 }; // San Bernardo
let miniMapModal, marcadorModal, mapaInicializado = false;

function inicializarMiniMapaModal(){
  if (mapaInicializado) return;
  miniMapModal = L.map('miniMapModal').setView([CENTRO_DEFECTO.lat, CENTRO_DEFECTO.lng], 13);
  SGTMaps.addBaseLayer(miniMapModal);

  marcadorModal = L.marker([CENTRO_DEFECTO.lat, CENTRO_DEFECTO.lng], { draggable:true }).addTo(miniMapModal);
  marcadorModal.on('dragend', () => {
    const pos = marcadorModal.getLatLng();
    fijarCoordenadas(pos.lat, pos.lng, 'Ubicación ajustada manualmente.', 'ok');
  });
  miniMapModal.on('click', (e) => {
    marcadorModal.setLatLng(e.latlng);
    fijarCoordenadas(e.latlng.lat, e.latlng.lng, 'Ubicación ajustada manualmente.', 'ok');
  });

  mapaInicializado = true;
  setTimeout(() => miniMapModal.invalidateSize(), 200);
}
document.getElementById('modalNueva').addEventListener('shown.bs.modal', inicializarMiniMapaModal);

function fijarCoordenadas(lat, lng, mensaje, tipo){
  document.getElementById('nLat').value = lat;
  document.getElementById('nLng').value = lng;
  document.getElementById('coordsPreview').textContent = `Lat/Lng: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const el = document.getElementById('geoStatus');
  el.textContent = mensaje || '';
  el.className = 'geo-status ' + (tipo || '');
}

async function geocodificarDireccion(direccion){
  return await SGTMaps.geocode(direccion);
}

let debounceTimer = null;
document.getElementById('nDireccion').addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  const direccion = e.target.value.trim();
  const el = document.getElementById('geoStatus');
  if (direccion.length < 6){ el.textContent = ''; el.className='geo-status'; return; }

  el.textContent = 'Buscando ubicación...';
  el.className = 'geo-status loading';

  debounceTimer = setTimeout(async () => {
    try{
      const resultado = await geocodificarDireccion(direccion);
      if (resultado){
        if (!mapaInicializado) inicializarMiniMapaModal();
        marcadorModal.setLatLng([resultado.lat, resultado.lng]);
        miniMapModal.flyTo([resultado.lat, resultado.lng], 16, { duration:0.6 });
        fijarCoordenadas(resultado.lat, resultado.lng, '✓ Dirección encontrada.', 'ok');
      } else {
        fijarCoordenadas(CENTRO_DEFECTO.lat, CENTRO_DEFECTO.lng, '⚠ No se encontró la dirección en San Bernardo. Revisa calle y número antes de ajustar el pin.', 'warn');
      }
    } catch(err){
      console.error(err);
      fijarCoordenadas(CENTRO_DEFECTO.lat, CENTRO_DEFECTO.lng, '⚠ No se pudo geocodificar (revisa tu conexión). Ajusta el pin manualmente.', 'warn');
    }
  }, 800);
});

function crear(){
  if(!exigirAdministrador()) return;
  const codigo = (document.getElementById('nCodigo').value||'XXX').toUpperCase().slice(0,3);
  const lat = parseFloat(document.getElementById('nLat').value) || CENTRO_DEFECTO.lat;
  const lng = parseFloat(document.getElementById('nLng').value) || CENTRO_DEFECTO.lng;
  crearJunta(db, {
    nombre: document.getElementById('nNombre').value,
    codigo,
    direccion: document.getElementById('nDireccion').value,
    lat, lng,
    presidente: document.getElementById('nPresidente').value,
    territorial: terrSel
  });
  dbSave(db); location.reload();
}

function render(){
  document.getElementById('tbody').innerHTML = Object.values(db.juntas).map(j=>{
    const total = solicitudesDeJunta(db,j.id).length;
    const conf = confianzaJunta(db,j.id);
    return `<tr><td class="fw-semibold">${j.nombre}</td><td>${j.direccion}</td><td>${j.presidente||'-'}</td><td>${total}</td>
      <td><div class="confianza-bar"><div class="confianza-fill" style="width:${conf}%"></div></div> ${conf}%</td>
      <td><a href="junta-detalle.html?id=${j.id}">Ver detalle</a></td></tr>`;
  }).join('');
}
render();