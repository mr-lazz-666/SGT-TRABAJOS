// ============================================================
// GEOREFERENCIACION - SGT MUNICIPAL
// ============================================================
//
// Motor de geocodificación centralizado:
//
//   - Leaflet → mapa interactivo y selección manual
//   - CARTO → capa visual del mapa (datos/atribución OSM cuando corresponda)
//   - Google Geocoding API → dirección ↔ coordenadas
//
// Este archivo es el único responsable de todo lo relacionado
// con ubicar geográficamente las solicitudes:
//
//   - Geocodificación automática mediante Google Geocoding
//   - Distinción entre "nombre de lugar" (ej. Plaza de Armas) y
//     "dirección" (ej. Freire 450), para mayor precisión
//   - Caché de resultados de geocodificación
//   - Badge de estado de ubicación (para la vista previa)
//   - Selección manual en mapa (Leaflet + CARTO)
//   - Buscador dentro del mini-mapa mediante Google Geocoding
//
// Todos los errores de red/consulta se registran con Log.error()
// (assets/js/logger.js) bajo la categoría 'georreferenciacion', para
// mantener trazabilidad completa sin depender solo de la consola.
//
// No conoce nada sobre Excel ni sobre la base de datos (db).
// Cualquier dato externo que necesite (por ejemplo, reutilizar
// la ubicación ya guardada de una junta) se le entrega mediante
// callbacks configurados con Geo.init(...).
//
// IMPORTANTE: este script debe cargarse DESPUÉS de logger.js y
// ANTES que cargar-excel.js en el HTML, ya que expone el objeto
// global `Geo` y depende del objeto global `Log`.
// ============================================================

const Geo = (function () {
  'use strict';

  // ==========================================================
  // CONFIGURACIÓN DE GEOCODIFICACIÓN — SAN BERNARDO
  // ==========================================================

  const SB_CENTRO = { lat: -33.5928, lng: -70.7053 };

  const SB_BBOX = {
    minLon: -70.82,
    minLat: -33.67,
    maxLon: -70.60,
    maxLat: -33.50,
  };

  // Fallback opcional con Google Geocoding API. Déjalo en null para
  // desactivarlo y usar solo Photon/Overpass (gratis, sin key).
  // Cuando tengan su propia key (con facturación habilitada en Google
  // Cloud, cubierta por el crédito gratuito mensual), pégala aquí:
  const GOOGLE_API_KEY = window.SGT_CONFIG?.GOOGLE_GEOCODING_KEY || null;

  // Log seguro: si logger.js no llegó a cargarse por algún motivo,
  // no se rompe la georreferenciación, solo cae a console.*
  const _log = (typeof Log !== 'undefined')
    ? Log
    : { error: (_, m, d) => console.error('[georreferenciacion]', m, d), warn: (_, m, d) => console.warn('[georreferenciacion]', m, d), info: () => {} };

  // ==========================================================
  // ESTADO INTERNO
  // ==========================================================

  const cacheGeo = {};
  const mapasManuales = {};
  const marcadoresManuales = {};

  const resultadosBusquedaMapa = {};
  const indiceResultadoMapa = {};

  let filasRef = [];

  let onUpdate = () => {};
  let onEstadoCambiado = () => {};
  let buscarUbicacionGuardada = () => null;

  // ==========================================================
  // INICIALIZACIÓN / CONFIGURACIÓN
  // ==========================================================

  function init(opciones = {}) {
    if (typeof opciones.onUpdate === 'function') onUpdate = opciones.onUpdate;
    if (typeof opciones.onEstadoCambiado === 'function') onEstadoCambiado = opciones.onEstadoCambiado;
    if (typeof opciones.buscarUbicacionGuardada === 'function') buscarUbicacionGuardada = opciones.buscarUbicacionGuardada;
  }

  function setFilas(filas) {
    filasRef = filas;
    Object.keys(mapasManuales).forEach((k) => delete mapasManuales[k]);
    Object.keys(marcadoresManuales).forEach((k) => delete marcadoresManuales[k]);
    Object.keys(resultadosBusquedaMapa).forEach((k) => delete resultadosBusquedaMapa[k]);
    Object.keys(indiceResultadoMapa).forEach((k) => delete indiceResultadoMapa[k]);
  }

  // ==========================================================
  // UTILIDADES
  // ==========================================================

  function esperar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function escapeHtml(valor) {
    return String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function limpiarDireccion(direccion) {
    return String(direccion || '')
      .replace(/\(.*?\)/g, ' ')
      .replace(/\bs\/n\b/gi, ' ')
      .replace(/\bdepto\.?\s*\d*/gi, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\bN[°º]?\s*/gi, ' ')
      .trim();
  }

  function ordenarPorCercania(lista) {
    return lista
      .map((item) => ({
        ...item,
        _dist: Math.hypot(item.lat - SB_CENTRO.lat, item.lng - SB_CENTRO.lng),
      }))
      .sort((a, b) => a._dist - b._dist);
  }

  function quitarDuplicadosCercanos(lista) {
    const unicos = [];
    lista.forEach((c) => {
      const yaExiste = unicos.some(
        (x) => Math.abs(x.lat - c.lat) < 0.0002 && Math.abs(x.lng - c.lng) < 0.0002
      );
      if (!yaExiste) unicos.push(c);
    });
    return unicos;
  }

  function extraerNumero(direccion) {
    const match = String(direccion || '').match(/\d+/);
    return match ? match[0] : null;
  }

  function extraerCalle(direccion) {
    const texto = String(direccion || '');
    const idx = texto.search(/\d/);
    if (idx === -1) return texto.trim();
    return texto.slice(0, idx).trim();
  }

  // ==========================================================
  // GEOCODIFICAR UBICACIÓN (uso automático, un solo resultado)
  // ==========================================================
  //
  // Acepta dos formas de llamada, para no romper compatibilidad
  // con código existente que solo pasa un string:
  //
  //   Geo.geocodificarDireccion("Freire 450")
  //   Geo.geocodificarDireccion({ nombre:"Plaza de Armas", direccion:"" })
  //
  // Si se entrega { nombre, direccion } y ambos existen, se prioriza
  // la dirección exacta (más precisa por tener número de calle), y
  // solo si esa búsqueda falla se reintenta con el nombre del lugar
  // (útil para sedes sociales, plazas, edificios sin número claro).
  //
  // Estrategia general:
  // 1) Photon, acotado a la caja de San Bernardo (SB_BBOX)
  // 2) Si hay nombre de lugar distinto y (1) falló, Photon con el nombre
  // 3) Photon, sin acotar (todo Chile), por si el lugar cae fuera del bbox
  // 4) Si se pidió un número y el resultado quedó aproximado, se intenta
  //    afinar con Overpass (OpenStreetMap)
  // 5) Si todo lo anterior falló y hay API Key de Google, se usa como
  //    último recurso
  // ==========================================================

  async function geocodificarDireccion(ubicacion) {
    const esObjeto = ubicacion && typeof ubicacion === 'object';
    const nombreLugar = esObjeto ? String(ubicacion.nombre || '').trim() : '';
    const direccion = esObjeto ? String(ubicacion.direccion || '').trim() : String(ubicacion || '').trim();
    const consulta = limpiarDireccion(direccion || nombreLugar);
    if (!consulta) return null;
    // Política SGT aprobada: una sola consulta externa para una dirección nueva.
    // SGTMaps mantiene caché en memoria; el flujo Excel reutiliza además coordenadas guardadas.
    return await SGTMaps.geocode(consulta);
  }

  // ==========================================================
  // GEOCODIFICAR FILAS PENDIENTES (proceso automático masivo)
  // ==========================================================

  async function geolocalizarPendientes() {
    const pendientes = filasRef.filter((f) => f._geoEstado === 'pend');

    if (!pendientes.length) {
      onEstadoCambiado();
      return;
    }

    let hechas = 0;
    const total = pendientes.length;

    for (const f of pendientes) {
      const nombreJunta = String(f['Folio Junta'] || '').trim();
      const codigoJunta = String(f['Codigo Junta'] || '').trim().toLowerCase();
      // Distinción entre nombre de lugar y dirección concreta, si el Excel las trae separadas
      const nombreLugar = String(f['Nombre Lugar'] || f['NombreLugar'] || '').trim();
      const direccion = String(f['Direccion'] || '').trim();
      const ubicacionBusqueda = direccion || nombreLugar || nombreJunta;

      // 1) Reutilizar una ubicación ya guardada
      const guardada = buscarUbicacionGuardada(f);

      if (guardada && typeof guardada.lat === 'number' && typeof guardada.lng === 'number') {
        f._lat = guardada.lat;
        f._lng = guardada.lng;
        f._geoEstado = 'excel';
        f._geoDireccion = guardada.origen || 'Ubicación guardada anteriormente';

        hechas++; actualizarProgreso(hechas, total); onUpdate();
        continue;
      }

      // 2) Caché de geocodificación de esta sesión
      const claveCache = (codigoJunta || nombreJunta.toLowerCase()) + '|' + ubicacionBusqueda.toLowerCase();

      if (cacheGeo[claveCache]) {
        const resultado = cacheGeo[claveCache];

        f._lat = resultado.lat;
        f._lng = resultado.lng;
        f._geoEstado = 'ok';
        f._geoDireccion = resultado.display_name;
        f._geoAproximado = !!resultado.aproximado;

        hechas++; actualizarProgreso(hechas, total); onUpdate();
        continue;
      }

      // 3) Sin ubicación disponible para buscar
      if (!ubicacionBusqueda) {
        f._geoEstado = 'manual';
        f._lat = null;
        f._lng = null;

        _log.warn('georreferenciacion', 'Fila sin nombre ni dirección utilizables para geocodificar', { folioJunta: nombreJunta });

        hechas++; actualizarProgreso(hechas, total); onUpdate();
        continue;
      }

      // 4) Buscar ubicación con Photon (+ Overpass/Google como afinadores)
      try {
        const resultado = await geocodificarDireccion({ nombre: nombreLugar, direccion });

        if (resultado) {
          f._lat = resultado.lat;
          f._lng = resultado.lng;
          f._geoEstado = 'ok';
          f._geoDireccion = resultado.display_name;
          f._geoAproximado = !!resultado.aproximado;

          cacheGeo[claveCache] = resultado;
        } else {
          f._geoEstado = 'manual';
          f._lat = null;
          f._lng = null;
          f._geoDireccion = 'No encontrada automáticamente';

          _log.warn('georreferenciacion', 'No se encontró ubicación automática', { ubicacionBusqueda });
        }
      } catch (error) {
        _log.error('georreferenciacion', 'Error inesperado geocodificando fila', { error: error.message, ubicacionBusqueda });
        f._geoEstado = 'manual';
        f._lat = null;
        f._lng = null;
      }

      hechas++; actualizarProgreso(hechas, total); onUpdate();

      // Pausa breve para no disparar solicitudes simultáneas durante una importación masiva.
      await esperar(80);
    }

    onEstadoCambiado();
  }

  // ==========================================================
  // PROGRESO
  // ==========================================================

  function actualizarProgreso(hechas, total) {
    const pct = total > 0 ? Math.round((hechas / total) * 100) : 100;
    const bar = document.getElementById('progresoBar');
    const texto = document.getElementById('progresoTexto');
    if (bar) bar.style.width = pct + '%';
    if (texto) texto.textContent = `${hechas} de ${total} direcciones procesadas...`;
  }

  // ==========================================================
  // BADGE DE UBICACIÓN (para la vista previa)
  // ==========================================================

  function badgeHtml(f, index) {
    if (f._geoEstado === 'excel') {
      return `<span class="geo-badge excel">✓ Coordenadas del Excel</span>`;
    }

    if (f._geoEstado === 'ok') {
      if (f._geoAproximado) {
        return `
          <span class="geo-badge manual">⚠ Ubicación exacta no encontrada, aproximada (nivel de calle)</span>
          ${f._geoDireccion ? `<div class="geo-direccion">${escapeHtml(f._geoDireccion)}</div>` : ''}
          <br>
          <button type="button" class="btn btn-warning btn-sm btn-mapa-manual" onclick="Geo.ajustarUbicacion(${index})">📍 Ajustar en mapa</button>
        `;
      }

      return `
        <span class="geo-badge ok">✓ Ubicada automáticamente</span>
        ${f._geoDireccion ? `<div class="geo-direccion">${escapeHtml(f._geoDireccion)}</div>` : ''}
      `;
    }

    if (f._geoEstado === 'manual') {
      return `
        <span class="geo-badge manual">⚠ Ubicación exacta no encontrada</span>
        <br>
        <button type="button" class="btn btn-warning btn-sm btn-mapa-manual" onclick="Geo.abrirMapaManual(${index})">📍 Seleccionar en mapa</button>
        ${typeof f._lat === 'number' && typeof f._lng === 'number' ? `<div class="ubicacion-seleccionada">✓ Ubicación seleccionada</div>` : ''}
        <div id="miniMapa-${index}" class="mini-map-container">
          <div class="mini-map-info">
            <strong>Selecciona la ubicación de la junta</strong><br>
            Puedes buscar el <strong>nombre del lugar o dirección</strong> o hacer clic directamente sobre el mapa.
          </div>
          <div class="mini-map-search">
            <input type="text" id="buscadorMapa-${index}" placeholder="Buscar nombre o dirección..." onkeydown="Geo.enterBuscarMapa(event, ${index})">
            <button type="button" id="btnBuscarMapa-${index}" onclick="Geo.buscarEnMapa(${index})">Buscar</button>
          </div>
          <div id="resultadoMapa-${index}" class="mini-map-result"></div>
          <div id="mapaManual-${index}" class="mini-map"></div>
          <div id="coordsMapa-${index}" class="mini-map-coords"></div>
        </div>
      `;
    }

    return `<span class="geo-badge pend">Buscando...</span>`;
  }

  // ==========================================================
  // AJUSTAR UBICACIÓN APROXIMADA
  // ==========================================================

  function ajustarUbicacion(index) {
    const f = filasRef[index];
    if (!f) return;

    f._geoEstado = 'manual';
    f._geoDireccion = 'Ubicación aproximada — ajustar manualmente';

    delete mapasManuales[index];
    delete marcadoresManuales[index];
    delete resultadosBusquedaMapa[index];
    delete indiceResultadoMapa[index];

    onUpdate();
    abrirMapaManual(index);
  }

  // ==========================================================
  // ABRIR MAPA MANUAL (Leaflet + tiles de OpenStreetMap)
  // ==========================================================

  function abrirMapaManual(index) {
    const f = filasRef[index];
    if (!f) return;

    const contenedor = document.getElementById(`miniMapa-${index}`);
    if (!contenedor) return;

    contenedor.style.display = 'block';

    if (mapasManuales[index]) {
      setTimeout(() => mapasManuales[index].invalidateSize(), 100);
      return;
    }

    let latInicial = SB_CENTRO.lat;
    let lngInicial = SB_CENTRO.lng;

    if (typeof f._lat === 'number' && typeof f._lng === 'number') {
      latInicial = f._lat;
      lngInicial = f._lng;
    }

    let mapa;
    try {
      mapa = L.map(`mapaManual-${index}`).setView([latInicial, lngInicial], 14);
      SGTMaps.addBaseLayer(mapa);
    } catch (error) {
      _log.error('georreferenciacion', 'Error inicializando el mini-mapa manual (Leaflet)', { error: error.message, index });
      return;
    }

    mapasManuales[index] = mapa;

    if (typeof f._lat === 'number' && typeof f._lng === 'number') {
      const marcador = L.marker([f._lat, f._lng]).addTo(mapa);
      marcadoresManuales[index] = marcador;
      actualizarTextoCoordenadas(index, f._lat, f._lng);
    }

    mapa.on('click', (e) => {
      seleccionarUbicacionManual(index, e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => mapa.invalidateSize(), 150);
  }

  // ==========================================================
  // BUSCAR CON ENTER
  // ==========================================================

  function enterBuscarMapa(event, index) {
    if (event.key === 'Enter') {
      event.preventDefault();
      buscarEnMapa(index);
    }
  }

  // ==========================================================
  // BUSCAR EN MAPA MANUAL (usa Photon)
  // ==========================================================

  async function buscarEnMapa(index) {
    const input = document.getElementById(`buscadorMapa-${index}`);
    const boton = document.getElementById(`btnBuscarMapa-${index}`);
    const resultadoBox = document.getElementById(`resultadoMapa-${index}`);

    if (!input) return;

    const texto = input.value.trim();

    if (!texto) {
      resultadoBox.style.display = 'block';
      resultadoBox.textContent = 'Escribe el nombre de una ubicación o una dirección.';
      return;
    }

    boton.disabled = true;
    boton.textContent = 'Buscando...';
    resultadoBox.style.display = 'none';

    try {
      const lista = await buscarDireccionMapa(texto);

      if (!lista || !lista.length) {
        resultadosBusquedaMapa[index] = null;
        indiceResultadoMapa[index] = 0;

        resultadoBox.style.display = 'block';
        resultadoBox.textContent = 'No se encontró esa dirección dentro de San Bernardo. Revisa calle y número.';
        return;
      }

      resultadosBusquedaMapa[index] = lista;
      indiceResultadoMapa[index] = 0;

      mostrarResultadoBusqueda(index);
    } catch (error) {
      _log.error('georreferenciacion', 'Error al buscar en el mini-mapa manual', { error: error.message, texto });
      resultadoBox.style.display = 'block';
      resultadoBox.textContent = 'Ocurrió un error al buscar la ubicación.';
    } finally {
      boton.disabled = false;
      boton.textContent = 'Buscar';
    }
  }

  // ==========================================================
  // MOSTRAR RESULTADO ACTUAL DE LA BÚSQUEDA (CON NAVEGACIÓN)
  // ==========================================================

  function mostrarResultadoBusqueda(index) {
    const lista = resultadosBusquedaMapa[index];
    const i = indiceResultadoMapa[index] || 0;

    if (!lista || !lista.length || !lista[i]) return;

    const resultado = lista[i];
    const mapa = mapasManuales[index];
    const resultadoBox = document.getElementById(`resultadoMapa-${index}`);

    if (!mapa || !resultadoBox) return;

    mapa.setView([resultado.lat, resultado.lng], 18, { animate: true });
    colocarMarcadorBusqueda(index, resultado.lat, resultado.lng);

    const hayVarios = lista.length > 1;

    resultadoBox.style.display = 'block';
    resultadoBox.innerHTML = `
      <strong>${hayVarios ? `Resultado ${i + 1} de ${lista.length}:` : 'Resultado encontrado:'}</strong>
      <br>
      ${escapeHtml(resultado.display_name)}
      <div class="mini-map-resultado-botones">
        ${hayVarios ? `<button type="button" class="btn btn-outline-secondary btn-sm" onclick="Geo.siguienteResultadoBusqueda(${index})">↻ Siguiente ubicación</button>` : ''}
        <button type="button" class="btn btn-success btn-sm" onclick="Geo.usarResultadoBusqueda(${index})">✓ Usar esta ubicación</button>
      </div>
      <small>También puedes hacer clic directamente sobre el mapa si ninguna coincide.</small>
    `;
  }

  function siguienteResultadoBusqueda(index) {
    const lista = resultadosBusquedaMapa[index];
    if (!lista || !lista.length) return;

    const actual = indiceResultadoMapa[index] || 0;
    indiceResultadoMapa[index] = (actual + 1) % lista.length;

    mostrarResultadoBusqueda(index);
  }

  function usarResultadoBusqueda(index) {
    const lista = resultadosBusquedaMapa[index];
    const i = indiceResultadoMapa[index] || 0;

    if (!lista || !lista.length || !lista[i]) return;

    const resultado = lista[i];
    seleccionarUbicacionManual(index, resultado.lat, resultado.lng);

    const resultadoBox = document.getElementById(`resultadoMapa-${index}`);
    if (resultadoBox) {
      resultadoBox.innerHTML = `<strong>✓ Ubicación confirmada:</strong><br>${escapeHtml(resultado.display_name)}`;
    }
  }

  // ==========================================================
  // BUSCAR NOMBRE / DIRECCIÓN CON PHOTON (para el mapa manual)
  // ==========================================================

  async function buscarDireccionMapa(ubicacion) {
    const limpia = limpiarDireccion(ubicacion);
    if (!limpia) return [];
    const resultado = await SGTMaps.geocode(limpia);
    return resultado ? [resultado] : [];
  }

  // ==========================================================
  // COLOCAR MARCADOR DE BÚSQUEDA
  // ==========================================================

  function colocarMarcadorBusqueda(index, lat, lng) {
    const mapa = mapasManuales[index];
    if (!mapa) return;

    if (marcadoresManuales[index]) mapa.removeLayer(marcadoresManuales[index]);

    const marcador = L.marker([lat, lng]).addTo(mapa);
    marcador.bindPopup(`<strong>Resultado de búsqueda</strong><br>Haz clic en este punto para usarlo.`).openPopup();

    marcadoresManuales[index] = marcador;
  }

  // ==========================================================
  // SELECCIONAR UBICACIÓN MANUAL
  // ==========================================================

  function seleccionarUbicacionManual(index, lat, lng) {
    const f = filasRef[index];
    if (!f) return;

    f._lat = lat;
    f._lng = lng;
    f._geoEstado = 'manual';
    f._geoDireccion = 'Ubicación seleccionada manualmente';

    if (marcadoresManuales[index]) {
      mapasManuales[index].removeLayer(marcadoresManuales[index]);
    }

    const marcador = L.marker([lat, lng]).addTo(mapasManuales[index]);
    marcador.bindPopup(`<strong>Ubicación seleccionada</strong><br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}`).openPopup();

    marcadoresManuales[index] = marcador;

    actualizarTextoCoordenadas(index, lat, lng);

    // No se dispara onUpdate() (pintarPreview) aquí porque destruiría el mapa.
    // Solo se avisa que el estado cambió, para que cargar-excel.js revise
    // si ya se puede confirmar la carga.
    onEstadoCambiado();
  }

  // ==========================================================
  // MOSTRAR COORDENADAS
  // ==========================================================

  function actualizarTextoCoordenadas(index, lat, lng) {
    const elemento = document.getElementById(`coordsMapa-${index}`);
    if (!elemento) return;

    elemento.innerHTML = `✓ Ubicación seleccionada<br>Lat: ${lat.toFixed(6)} | Lng: ${lng.toFixed(6)}`;
  }

  // ==========================================================
  // API PÚBLICA
  // ==========================================================

  return {
    SB_CENTRO,
    SB_BBOX,
    init,
    setFilas,
    badgeHtml,
    geolocalizarPendientes,
    geocodificarDireccion,
    ajustarUbicacion,
    abrirMapaManual,
    enterBuscarMapa,
    buscarEnMapa,
    siguienteResultadoBusqueda,
    usarResultadoBusqueda,
  };
})();