// ============================================================
// LÓGICA DE LA PÁGINA MAPA - SGT MUNICIPAL
// ============================================================

const db = dbLoad();
let map = L.map('map').setView([-33.5928, -70.7053], 14);

SGTMaps.addBaseLayer(map);

let filtroCats = new Set();
let filtroEstado = null;
let markers = [];
let juntaActiva = null;
let solicitudesActivas = [];
let markerProblema = null;

const nombresEstado = {
  critica: 'Críticas',
  proceso: 'En proceso',
  pendiente: 'Pendientes',
  resuelta: 'Resueltas'
};

// ============================================================
// UTILIDADES
// ============================================================

function escapeHtmlMapa(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// FIX10I: proteger Leaflet contra geocodificaciones erróneas/fuera de San Bernardo.
// El filtro amplio evita desplazamientos a otras ciudades; no reemplaza la
// comprobación precisa de los límites municipales al validar un domicilio.
function coordenadaRazonableSanBernardo(lat, lng) {
  lat = Number(lat); lng = Number(lng);
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -33.78 && lat <= -33.48 && lng >= -70.89 && lng <= -70.55;
}

function advertirUbicacionProblema(s) {
  alert('La ubicación de este problema no tiene coordenadas válidas dentro del área de San Bernardo.\n\n' +
    'Solicitud: ' + (s.folio || '-') + '\n' +
    'Dirección: ' + (s.direccionProblema || 'Sin dirección') + '\n\n' +
    'Revisa la dirección o corrige la ubicación del problema en el SGT. La junta y sus solicitudes no se han modificado.');
}

function recuperarTamanoMapa() {
  requestAnimationFrame(() => {
    map.invalidateSize({pan:false});
    setTimeout(() => map.invalidateSize({pan:false}), 300);
  });
}

function tieneCoords(s) {
  if (!s || s.probLat === null || s.probLng === null ||
      s.probLat === undefined || s.probLng === undefined ||
      s.probLat === '' || s.probLng === '') return false;
  return coordenadaRazonableSanBernardo(Number(s.probLat), Number(s.probLng));
}

// El botón "Ver en mapa" solo corresponde cuando la solicitud
// tiene una ubicación propia del problema. Las coordenadas de la junta
// no deben hacer aparecer este botón si direccionProblema está vacía.
function direccionExactaMapaSGT(d) {
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
function tieneUbicacionProblema(s) {
  // Las coordenadas guardadas por un funcionario tienen prioridad.
  // Una referencia aproximada sin coordenadas sigue sin mostrar el botón.
  return tieneCoords(s) || direccionExactaMapaSGT(s?.direccionProblema);
}

function calcularColor(sols) {
  if (sols.some(s => normalizarEstado(s.estado).key === 'critica')) return '#dc2626';
  if (sols.some(s => normalizarEstado(s.estado).key === 'proceso')) return '#7c3aed';
  if (sols.some(s => normalizarEstado(s.estado).key === 'pendiente')) return '#d97706';
  return '#16a34a';
}

function calcularStats(sols) {
  const porEstado = key => sols.filter(s => normalizarEstado(s.estado).key === key).length;
  return {
    total: sols.length,
    proceso: porEstado('proceso'),
    criticas: porEstado('critica'),
    resueltas: porEstado('resuelta')
  };
}

function buildFotosHtml(s, cantidad = 2) {
  const fotos = (s.fotos || []).slice(0, cantidad);
  if (!fotos.length) return '';
  return `
    <div class="foto-mini-row">
      ${fotos.map(f => s.fotosData && s.fotosData[f]
        ? `<img src="${s.fotosData[f]}" class="foto-mini">`
        : ''
      ).join('')}
    </div>`;
}

// ============================================================
// ICONOS
// ============================================================

function crearPin(color) {
  return L.divIcon({
    className: '',
    html: `<div class="pin-icon" style="background:${color}"></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });
}

function crearPinProblema() {
  return L.divIcon({
    className: '',
    html: `<div class="pin-problema"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
}

// ============================================================
// FILTROS: CATEGORÍAS Y LEYENDA
// ============================================================

document.getElementById('catChips').innerHTML = CATEGORIAS
  .map((c, i) => `<div class="cat-chip" data-c="${i}">${c}</div>`)
  .join('');

document.querySelectorAll('.cat-chip').forEach(el => {
  el.addEventListener('click', () => {
    const i = el.dataset.c;
    el.classList.toggle('active');
    filtroCats.has(i) ? filtroCats.delete(i) : filtroCats.add(i);
    pintarPines();
  });
});

document.querySelectorAll('.legend-item').forEach(el => {
  el.addEventListener('click', () => {
    const est = el.dataset.estado;

    document.querySelectorAll('.legend-item').forEach(x => x.classList.remove('active'));

    if (filtroEstado === est) {
      filtroEstado = null;
    } else {
      filtroEstado = est;
      el.classList.add('active');
    }

    pintarPines();
    actualizarPanelLeyenda();
  });
});

// ============================================================
// PINTAR PINES
// ============================================================

function pintarPines() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  Object.values(db.juntas).forEach(j => {
    if (typeof j.lat !== 'number' || typeof j.lng !== 'number' || isNaN(j.lat) || isNaN(j.lng)) return;

    const todas = solicitudesDeJunta(db, j.id).filter(s => !esSolicitudResuelta(s));
    let visibles = todas;

    if (filtroCats.size) {
      visibles = visibles.filter(s => filtroCats.has(String(CATEGORIAS.indexOf(s.categoria))));
    }
    if (filtroEstado) {
      visibles = visibles.filter(s => normalizarEstado(s.estado).key === filtroEstado);
    }
    if ((filtroCats.size || filtroEstado) && !visibles.length) return;

    const hayFiltro = filtroCats.size || filtroEstado;
    const color = calcularColor(hayFiltro && visibles.length ? visibles : todas);

    const marker = L.marker([j.lat, j.lng], { icon: crearPin(color) }).addTo(map);

    marker.bindTooltip(j.nombre, {
      permanent: true,
      direction: 'top',
      offset: [0, -34],
      className: 'junta-label',
      interactive: true
    });

    marker.on('click', () => {
      juntaActiva = j;
      solicitudesActivas = hayFiltro ? visibles : todas;

      map.stop();
      map.setView([j.lat, j.lng], 17, {animate:false});
      mostrarPopup(j, solicitudesActivas);
      limpiarPinProblema();
    });

    markers.push(marker);
  });
}

// ============================================================
// POPUP DE JUNTA
// ============================================================

function posicionarPopup(j) {
  const punto = map.latLngToContainerPoint([j.lat, j.lng]);
  const card = document.getElementById('popupCard');
  card.style.left = punto.x + 'px';
  card.style.top = (punto.y - 28) + 'px';
}

function mostrarPopup(j, sols) {
  const stats = calcularStats(sols);
  const confianza = pctConfianza(confianzaJunta(db, j.id));

  document.getElementById('popupNombre').textContent = j.nombre;
  document.getElementById('popupDireccion').textContent = j.direccion || 'Sin dirección registrada';
  document.getElementById('popupPresidente').textContent = j.presidente || '-';
  document.getElementById('popupTerritorial').textContent = db.territoriales[j.territorial] || '-';
  document.getElementById('popupTotal').textContent = stats.total;
  document.getElementById('popupProceso').textContent = stats.proceso;
  document.getElementById('popupCriticas').textContent = stats.criticas;
  document.getElementById('popupResueltas').textContent = stats.resueltas;
  document.getElementById('popupConfianza').style.width = confianza + '%';
  document.getElementById('popupConfianzaTexto').textContent = confianza + '%';
  document.getElementById('popupVerJunta').href = 'junta-detalle.html?id=' + encodeURIComponent(j.id);

  const card = document.getElementById('popupCard');
  card.classList.remove('d-none');
  card.style.animation = 'none';
  card.offsetHeight;
  card.style.animation = '';

  posicionarPopup(j);
  renderOffcanvas(j, sols);
}

function cerrarPopup() {
  document.getElementById('popupCard').classList.add('d-none');
  juntaActiva = null;
  limpiarPinProblema();
}

function enlazarEventosMapa() {
  map.on('move zoom', () => { if (juntaActiva) posicionarPopup(juntaActiva); });
}
enlazarEventosMapa();

// ============================================================
// PIN DEL PROBLEMA
// ============================================================

async function mostrarPinProblema(folio) {
  limpiarPinProblema();

  const sol = db.solicitudes[folio];
  if (!sol) return;

  const lat = Number(sol.probLat);
  const lng = Number(sol.probLng);
  if (!coordenadaRazonableSanBernardo(lat, lng)) {
    advertirUbicacionProblema(sol);
    return;
  }

  const dentro = await SGTMaps.validarPuntoSanBernardo(lat,lng);
  if (dentro !== true) {
    alert(dentro === false
      ? 'No se puede ubicar esta solicitud: sus coordenadas guardadas están FUERA de la comuna de San Bernardo.\n\n' +
        'Solicitud: ' + (sol.folio || folio) + '\nDirección registrada: ' + (sol.direccionProblema || 'Sin dirección') + '\n' +
        'Coordenadas antiguas: ' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '\n\n' +
        'Debes corregir la ubicación de esta solicitud. No se modificó ningún registro.'
      : 'No se pudo verificar el límite oficial de San Bernardo. Para evitar dejar el mapa en blanco no se realizará el desplazamiento. Intenta nuevamente con conexión a internet.');
    return false;
  }

  markerProblema = L.marker([lat, lng], {
    icon: crearPinProblema(),
    zIndexOffset: 1000
  }).addTo(map);

  markerProblema.bindPopup(`
    <strong>${escapeHtmlMapa(sol.folio)}</strong><br>
    <span>Ubicación del problema</span><br>
    <small>${escapeHtmlMapa(sol.direccionProblema || 'Sin dirección registrada')}</small>
  `);

  markerProblema.openPopup();
  // Evitar animaciones largas que dejan mosaicos en blanco cuando el destino
  // estaba lejos de la vista anterior. Actualizar después de cerrar el panel.
  map.stop();
  map.setView([lat, lng], 17, {animate:false});
  return true;
}

function limpiarPinProblema() {
  if (markerProblema) {
    map.removeLayer(markerProblema);
    markerProblema = null;
  }
}

// ============================================================
// OFFCANVAS DE SOLICITUDES
// ============================================================

function renderOffcanvas(j, sols) {
  document.getElementById('offNombre').textContent = j.nombre;

  const texto = document.getElementById('offBuscador').value.toLowerCase().trim();

  const filtradas = sols.filter(s => !texto ||
    ((s.folio || '') + ' ' + (s.requerimiento || '') + ' ' + (s.direccionProblema || ''))
      .toLowerCase().includes(texto)
  );

  document.getElementById('offListado').innerHTML = filtradas.length
    ? filtradas.map(s => {
        const info = normalizarEstado(s.estado);
        const ubicacion = direccionExactaMapaSGT(s.direccionProblema) ? s.direccionProblema : (s.referenciaDireccionAproximada || s.direccionProblema || 'Sin dirección exacta');

        return `
          <div class="border-bottom py-2">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="mb-3">
                  <div class="d-flex align-items-center gap-2">
                    <a href="solicitud-detalle.html?folio=${encodeURIComponent(s.folio)}" class="fw-bold">
                      ${escapeHtmlMapa(s.folio)}
                    </a>
                    ${tieneUbicacionProblema(s) ? `
                      <button type="button" class="btn btn-sm btn-outline-primary"
                        onclick="verProblemaEnMapa('${escapeHtmlMapa(s.folio)}')">
                        📍 Ver en mapa
                      </button>` : ''}
                  </div>
                  <div class="small text-muted mt-1">Junta: ${escapeHtmlMapa(j.nombre || '')}</div>
                  <div class="small mt-1">Ubicación: ${escapeHtmlMapa(ubicacion)}</div>
                </div>
                <div class="text-muted mt-1" style="font-size:12px">
                  ${escapeHtmlMapa(s.requerimiento || s.categoria || '')}
                </div>
              </div>
              <span class="badge-pill ${info.cls}">${escapeHtmlMapa(s.estado)}</span>
            </div>
            ${buildFotosHtml(s)}
          </div>`;
      }).join('')
    : `<div class="text-muted small py-3">Sin solicitudes registradas todavía.</div>`;
}

document.getElementById('offBuscador').addEventListener('input', () => {
  if (juntaActiva) renderOffcanvas(juntaActiva, solicitudesActivas);
});

// FIX10N: reconstruir completamente Leaflet y sus mosaicos al buscar un problema.
// Conservar datos y filtros; nunca volver a geocodificar ni modificar SQLite.
let reconstruccionMapaEnCurso = false;
let ultimaBusquedaMapa = 0;
async function reconstruirMapaParaProblema(lat, lng, sol) {
  if (reconstruccionMapaEnCurso) return false;
  reconstruccionMapaEnCurso = true;
  const consecutivo = ++ultimaBusquedaMapa;
  try {
    // El offcanvas debe cerrar antes de calcular el tamaño final del contenedor.
    const panel = document.getElementById('detalleOffcanvas');
    if (panel && panel.classList.contains('show')) {
      const instancia = bootstrap.Offcanvas.getInstance(panel);
      if (instancia) instancia.hide();
      await new Promise(resolve => {
        let acabado = false;
        const terminar = () => { if (!acabado) { acabado = true; resolve(); } };
        panel.addEventListener('hidden.bs.offcanvas', terminar, {once:true});
        setTimeout(terminar, 650);
      });
    }
    // Borrar TODAS las capas, los listeners y el contenedor antiguo de Leaflet.
    map.stop();
    map.off();
    map.remove();
    const anterior = document.getElementById('map');
    if (!anterior) throw new Error('No existe el contenedor del mapa.');
    const nuevo = document.createElement('div');
    nuevo.id = 'map';
    nuevo.className = anterior.className;
    nuevo.style.cssText = anterior.style.cssText;
    anterior.replaceWith(nuevo);
    markers = [];
    markerProblema = null;
    // Reiniciar en la ubicación seleccionada con un único layer base nuevo.
    map = L.map(nuevo, { zoomAnimation:false, fadeAnimation:false,
      markerZoomAnimation:false, preferCanvas:false });
    map.setView([lat, lng], 17, {animate:false});
    SGTMaps.addBaseLayer(map);
    // FIX10O: Leaflet fue destruido; volver a dibujar el límite en la instancia nueva.
    // La capa del límite NO debe cambiar el zoom ni tapar los mosaicos.
    if(typeof window.limitarASanBernardo==='function'){
      window.limitarASanBernardo(map).catch(e=>console.warn('[SGT] Límite no disponible:',e));
    }
    enlazarEventosMapa();
    pintarPines();
    map.invalidateSize({pan:false, debounceMoveend:true});
    // Volver a crear el marcador sobre la nueva instancia de Leaflet.
    markerProblema = L.marker([lat, lng], {
      icon:crearPinProblema(), zIndexOffset:1000
    }).addTo(map);
    markerProblema.bindPopup(
      '<strong>'+escapeHtmlMapa(sol.folio)+'</strong><br>'+
      '<span>Ubicación del problema</span><br><small>'+
      escapeHtmlMapa(sol.direccionProblema || 'Sin dirección registrada')+'</small>'
    );
    markerProblema.openPopup();
    // Segundo cálculo cuando el navegador terminó de pintar el nuevo elemento.
    requestAnimationFrame(() => {
      if (consecutivo !== ultimaBusquedaMapa) return;
      map.invalidateSize({pan:false});
      map.setView([lat, lng], 17, {animate:false});
    });
    return true;
  } catch (err) {
    console.error('[SGT FIX10N] Error al reconstruir el mapa:', err);
    alert('No se pudo reiniciar el mapa. Reabre la sección Mapa para intentarlo nuevamente.');
    return false;
  } finally {
    reconstruccionMapaEnCurso = false;
  }
}

// ============================================================
// VER PROBLEMA EN MAPA
// ============================================================
// El folio siempre abre solicitud-detalle.html.
// El pin se muestra solo mediante el botón "📍 Ver en mapa".

async function verProblemaEnMapa(folio) {
  const sol = db.solicitudes[folio];
  if (!sol) return;

  // Si se escribió una dirección exacta sin coordenadas, resolverla
  // al primer clic, guardar la posición y mostrar el marcador.
  if (!tieneCoords(sol)) {
    if (!direccionExactaMapaSGT(sol.direccionProblema)) {
      advertirUbicacionProblema(sol);
      return;
    }
    try {
      const r = await SGTMaps.geocode(sol.direccionProblema);
      if (!r || !coordenadaRazonableSanBernardo(Number(r.lat), Number(r.lng))) {
        alert('No se pudo ubicar la dirección exacta: ' + sol.direccionProblema +
          '\\nComprueba el nombre, número y comuna, o define el punto manualmente.');
        return;
      }
      const verificado = await SGTMaps.validarPuntoSanBernardo(Number(r.lat), Number(r.lng));
      if (verificado !== true) {
        alert('La dirección encontrada está fuera de San Bernardo. Comprueba la dirección.');
        return;
      }
      sol.probLat = Number(r.lat);
      sol.probLng = Number(r.lng);
      // Mantener la dirección original ingresada por el funcionario.
      dbSave(db);
    } catch (err) {
      console.error('[SGT] Geocodificación de dirección exacta:', err);
      alert('No se pudo consultar la ubicación. Revisa tu conexión o marca el punto manualmente.');
      return;
    }
  }
  const lat = Number(sol.probLat);
  const lng = Number(sol.probLng);
  if (!coordenadaRazonableSanBernardo(lat, lng)) {
    advertirUbicacionProblema(sol);
    return;
  }

  // Verificar comuna antes de reiniciar; el reinicio no guarda coordenadas nuevas.
  const dentro = await SGTMaps.validarPuntoSanBernardo(lat, lng);
  if (dentro === false) {
    alert('La ubicación guardada para ' + folio + ' está fuera de San Bernardo. Corrígela antes de visualizarla.');
    return;
  }
  // Un fallo del servidor del límite no significa que la dirección sea inválida.
  // Permitir la visualización de coordenadas existentes (dentro del rango amplio)
  // y advertir que no se pudo verificar la comuna.
  if(dentro === null){
    console.warn('[SGT] Límite comunal temporalmente no disponible. Vista provisional:', folio);
  }
  await reconstruirMapaParaProblema(lat, lng, sol);
}

// ============================================================
// GEOLOCALIZAR DIRECCIÓN DE PROBLEMA (folios antiguos)
// ============================================================

async function geolocalizarDireccionProblema(folio, direccion) {
  try {
    const resultado=await SGTMaps.geocode(direccion);
    if(!resultado){ alert(`No se encontró la ubicación del problema:\n\n${direccion}`); return; }
    const lat=resultado.lat, lng=resultado.lng;
    const sol=db.solicitudes[folio]; if(!sol) return;
    sol.probLat=lat; sol.probLng=lng;
    if(resultado.display_name) sol.direccionProblema=resultado.display_name;
    dbSave(db);
    renderPins();
    await mostrarPinProblema(folio);
  } catch(error){ console.error('Error geolocalizando problema:',error); alert('No fue posible geolocalizar la dirección.'); }
}

// ============================================================
// CONTADOR DE LEYENDA
// ============================================================

function actualizarContadorLeyenda() {
  const todas = Object.values(db.solicitudes).filter(s => !s.eliminada && !esSolicitudResuelta(s));
  const porEstado = key => todas.filter(s => normalizarEstado(s.estado).key === key).length;

  document.getElementById('cntCritica').textContent = porEstado('critica');
  document.getElementById('cntProceso').textContent = porEstado('proceso');
  document.getElementById('cntPendiente').textContent = porEstado('pendiente');
  document.getElementById('cntResuelta').textContent = porEstado('resuelta');
}

actualizarContadorLeyenda();

// ============================================================
// PANEL DE SOLICITUDES POR ESTADO
// ============================================================

function actualizarPanelLeyenda() {
  if (!filtroEstado) {
    document.getElementById('panelSolicitudesLeyenda').classList.add('d-none');
    return;
  }

  const sols = Object.values(db.solicitudes)
    .filter(s => !s.eliminada && normalizarEstado(s.estado).key === filtroEstado);

  mostrarPanelSolicitudesLeyenda(filtroEstado, sols);
}

function mostrarPanelSolicitudesLeyenda(estado, sols) {
  document.getElementById('panelSolTitulo').textContent = `Solicitudes: ${nombresEstado[estado]}`;

  document.getElementById('panelSolListado').innerHTML = sols.map(s => {
    const j = db.juntas[s.juntaId];
    const ubicacion = direccionExactaMapaSGT(s.direccionProblema) ? s.direccionProblema : (s.referenciaDireccionAproximada || s.direccionProblema || 'Sin dirección exacta');
    const breve = (s.requerimiento || '').slice(0, 90) +
      (s.requerimiento && s.requerimiento.length > 90 ? '…' : '');

    return `
      <div class="sol-mini-card">
        <div class="d-flex justify-content-between">
          <strong>${escapeHtmlMapa(s.folio)}</strong>
          <a href="solicitud-detalle.html?folio=${encodeURIComponent(s.folio)}" class="small">
            Ver detalle →
          </a>
        </div>
        <div class="text-muted">Junta: ${escapeHtmlMapa(j ? j.nombre : '-')}</div>
        <div class="text-muted">
          Ubicación: ${escapeHtmlMapa(ubicacion)}
          ${tieneUbicacionProblema(s) ? `
            <button type="button" class="btn btn-link btn-sm p-0 ms-2"
              title="Ver ubicación del problema"
              onclick="verProblemaEnMapa('${escapeHtmlMapa(s.folio)}')">
              📍 Ver en mapa
            </button>` : ''}
        </div>
        <div>${escapeHtmlMapa(breve || 'Sin descripción.')}</div>
        ${buildFotosHtml(s)}
      </div>`;
  }).join('') || `<div class="text-muted small">Sin solicitudes en este estado.</div>`;

  const panel = document.getElementById('panelSolicitudesLeyenda');
  panel.classList.remove('d-none', 'panel-enter-active');
  panel.classList.add('panel-enter');

  requestAnimationFrame(() => {
    panel.classList.add('panel-enter-active');
    panel.classList.remove('panel-enter');
  });
}

function cerrarPanelSolicitudesLeyenda() {
  const panel = document.getElementById('panelSolicitudesLeyenda');
  panel.classList.remove('panel-enter-active');
  panel.classList.add('panel-enter');
  setTimeout(() => panel.classList.add('d-none'), 220);
}

// ============================================================
// GENERAR REPORTE PDF
// ============================================================

async function generarReporteLeyenda() {
  if (!filtroEstado) {
    alert('Selecciona un estado en la Leyenda primero.');
    return;
  }

  const sols = Object.values(db.solicitudes)
    .filter(s => !s.eliminada && normalizarEstado(s.estado).key === filtroEstado);

  if (!sols.length) {
    alert('No hay solicitudes para generar el reporte.');
    return;
  }

  let cuerpo = '';

  CATEGORIAS.forEach(cat => {
    const grupo = sols.filter(s => s.categoria === cat);
    if (!grupo.length) return;

    cuerpo += `<div class="minuta-cat-titulo">${escapeHtmlMapa(cat)}</div>`;

    grupo.forEach(s => {
      const j = db.juntas[s.juntaId];
      const fotosMostrar = (s.fotos || []).slice(0, 2);

      const fotosHtml = fotosMostrar.length ? `
        <div style="display:flex;gap:8px;margin:6px 0 12px;">
          ${fotosMostrar.map(f => s.fotosData && s.fotosData[f] ? `
            <img src="${s.fotosData[f]}"
                 style="width:140px;height:140px;object-fit:cover;border-radius:6px;border:1px solid #ddd;">
          ` : '').join('')}
        </div>` : '';

      cuerpo += `
        <div class="minuta-junta-nombre">
          ${escapeHtmlMapa(j ? j.nombre : '(Junta no identificada)')}
        </div>
        <p class="minuta-linea">
          <strong>Requerimiento:</strong>
          ${escapeHtmlMapa(s.requerimiento || 'Sin especificar.')}
        </p>
        ${fotosHtml}
        <p class="minuta-linea">
          <strong>Gestión acordada:</strong>
          ${escapeHtmlMapa(s.gestion || 'Sin gestión registrada.')}
        </p>
        <p class="minuta-linea">
          <strong>Estado:</strong> ${escapeHtmlMapa(s.estado)}
        </p>`;
    });
  });

  const temp = document.createElement('div');
  temp.style.cssText =
    'position:fixed;left:-9999px;top:0;width:800px;background:#fff;padding:24px;';

  temp.innerHTML = `
    <div class="minuta-header"><img src="../assets/branding/logo-municipal.png" alt="Ilustre Municipalidad de San Bernardo" style="width:210px;max-width:65%;height:auto;object-fit:contain"><div class="minuta-subtitulo">
          ${nombresEstado[filtroEstado].toUpperCase()}
        </div></div>
    ${cuerpo}
    <div class="minuta-footer">
      Reporte SGT Municipal — Solicitudes ${nombresEstado[filtroEstado]}
      | ${new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
    </div>`;

  document.body.appendChild(temp);

  const { jsPDF } = window.jspdf;
  const canvas = await html2canvas(temp, { scale: 2, backgroundColor: '#fff', useCORS: true });
  document.body.removeChild(temp);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const w = pdf.internal.pageSize.getWidth() - 16;
  const h = (canvas.height * w) / canvas.width;
  const pageHeight = pdf.internal.pageSize.getHeight() - 16;
  const imgData = canvas.toDataURL('image/jpeg', 0.92);

  if (h <= pageHeight) {
    pdf.addImage(imgData, 'JPEG', 8, 8, w, h);
  } else {
    let heightLeft = h;
    let position = 8;

    pdf.addImage(imgData, 'JPEG', 8, position, w, h);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      pdf.addPage();
      position = -(h - heightLeft) + 8;
      pdf.addImage(imgData, 'JPEG', 8, position, w, h);
      heightLeft -= pageHeight;
    }
  }

  sgtDescargarPDF(pdf, `minuta-${filtroEstado}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ============================================================
// PANELES PLEGABLES
// ============================================================

function togglePanel(panelId) {
  document.getElementById(panelId).classList.toggle('open');
}

// ============================================================
// MÁSCARA DE SAN BERNARDO
// ============================================================

async function enmascararFueraDeSanBernardo(map) {
  if (typeof window.limitarASanBernardo === 'function') {
    await window.limitarASanBernardo(map);
  }
  return map;
}

// FIX10N: capa legacy desactivada; podría pintar un overlay opaco tras cargar tiles.
// El límite sigue validándose con SGTMaps.validarPuntoSanBernardo().

// ============================================================
// INICIALIZACIÓN
// ============================================================

pintarPines();

// FIX12: recuperar pines de juntas que FIX11 ya importó sin coordenadas.
// Solo un administrador puede actualizar la ubicación persistida. La dirección
// se resuelve con Google y el punto se comprueba con el polígono comunal.
async function recuperarJuntasSinPinExcel(){
  if(!esAdministrador())return;
  const pendientes=Object.values(db.juntas).filter(j=>
    (j.lat===null || j.lat===undefined || j.lng===null || j.lng===undefined) &&
    typeof j.direccion==='string' && j.direccion.trim());
  if(!pendientes.length)return;
  for(const j of pendientes){
    try{
      const p=await SGTMaps.geocode(j.direccion);
      if(!p)continue;
      if(await SGTMaps.validarPuntoSanBernardo(p.lat,p.lng)!==true)continue;
      const resp=await fetch('/api/juntas/ubicacion',{
        method:'POST',headers:{'Content-Type':'application/json',
          Authorization:'Bearer '+authToken()},
        body:JSON.stringify({id:j.id,lat:p.lat,lng:p.lng})});
      if(!resp.ok)throw Error(`HTTP ${resp.status}`);
      const data=await resp.json();
      j.lat=Number(data.lat);j.lng=Number(data.lng);
      pintarPines();
    }catch(err){console.warn('[SGT] No se pudo recuperar pin de junta:',j.nombre,err);}
  }
}
recuperarJuntasSinPinExcel();

// FIX10O: mostrar el contorno desde la apertura inicial, incluso antes de buscar.
if(typeof window.limitarASanBernardo==='function'){
  window.limitarASanBernardo(map).catch(e=>console.warn('[SGT] Límite no disponible:',e));
}
