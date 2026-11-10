// Servicio único de mapas/geocodificación del SGT.
// Leaflet renderiza el mapa; CARTO entrega tiles; Google Geocoding resuelve direcciones.
window.SGTMaps = (() => {
  const cfg = window.SGT_CONFIG || {};
  const cache = new Map();
  const reverseCache = new Map();
  const centro = {lat:-33.5928,lng:-70.7053};
  function normalizar(q){ return String(q||'').trim().replace(/\s+/g,' '); }
  function contextualizar(q){
    q=normalizar(q); if(!q) return '';
    return /san bernardo/i.test(q) ? q : `${q}, ${cfg.GEO_CONTEXT || 'San Bernardo, Región Metropolitana, Chile'}`;
  }
  // Límite comunal oficial de San Bernardo (CUT 13401).
  // Se consulta a la capa de Límites Comunales del IDE/SMA y se dibuja una máscara
  // opaca sobre todo lo que queda fuera de la comuna. El mapa además queda restringido
  // a sus límites para impedir desplazarse hacia otras comunas.
  const LIMITE_SB_URL =
    'https://ideserver.sma.gob.cl/arcgis/rest/services/IDE/Limites/MapServer/2/query' +
    '?where=' + encodeURIComponent("CUT_COM='13401'") +
    '&outFields=COMUNA,CUT_COM&returnGeometry=true&outSR=4326&f=geojson';
  let limitePromise = null;

  // FIX10O: unificar validación y dibujo con el cargador que usa caché
  // y varios servidores. No memorizar para siempre un fallo de red.
  async function cargarLimiteSanBernardo(){
    if(window.SGT_SAN_BERNARDO_FEATURE){
      return {type:'FeatureCollection',features:[window.SGT_SAN_BERNARDO_FEATURE]};
    }
    if(limitePromise) return limitePromise;
    limitePromise = (async()=>{
      if(typeof window.cargarLimiteSanBernardo === 'function'){
        const gj=await window.cargarLimiteSanBernardo();
        if(gj?.features?.length) return gj;
      }
      const r=await fetch(LIMITE_SB_URL);
      if(!r.ok)throw new Error(`Límite San Bernardo HTTP ${r.status}`);
      const gj=await r.json();
      if(!gj?.features?.length)throw new Error('No se recibió el límite comunal.');
      return gj;
    })();
    try{return await limitePromise;}
    catch(e){limitePromise=null;throw e;}
  }

  function anilloExterior(){
    return [[-90,-180],[-90,180],[90,180],[90,-180]];
  }

  async function limitarASanBernardo(map){
    if(!map || typeof L==='undefined') return null;
    try{
      const gj = await cargarLimiteSanBernardo();
      const capa = L.geoJSON(gj);
      const bounds = capa.getBounds();
      if(bounds.isValid()){
        // FIX10M: no cambiar la cámara al terminar una petición asíncrona.
        // Se valida la ubicación por separado, sin bloquear el renderizado.
      }

      // GeoJSON usa [lng,lat]. Leaflet Polygon usa [lat,lng].
      const huecos = [];
      for(const f of gj.features || []){
        const g=f.geometry || {};
        const polys = g.type==='Polygon' ? [g.coordinates] : (g.type==='MultiPolygon' ? g.coordinates : []);
        for(const poly of polys){
          if(!poly?.[0]) continue;
          huecos.push(poly[0].map(([lng,lat])=>[lat,lng]));
        }
      }
      if(!huecos.length) throw new Error('Geometría comunal vacía.');

      const mascara = L.polygon([anilloExterior(), ...huecos], {
        stroke:false, fill:true, fillColor:'#eef1ed', fillOpacity:1,
        interactive:false, fillRule:'evenodd', pane:'overlayPane'
      }).addTo(map);

      const borde = L.geoJSON(gj,{
        style:{color:'#1f5d42',weight:3,opacity:0.95,fill:false,interactive:false}
      }).addTo(map);

      // Mantener máscara/borde detrás de los marcadores, pero sobre los tiles.
      if(mascara.bringToBack) mascara.bringToBack();
      if(borde.bringToFront) borde.bringToFront();
      return {mascara,borde,bounds};
    }catch(err){
      console.error('[SGT] No fue posible cargar el límite comunal oficial:', err);
      return null;
    }
  }

  function addBaseLayer(map){
    if(!map || typeof L==='undefined') return null;
    const key=cfg.CARTO_API_KEY || '';
    const url=`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${key ? `?key=${encodeURIComponent(key)}` : ''}`;
    // FIX10M: un solo tile layer visible; fallback automático si CARTO falla.
    const carto=L.tileLayer(url,{
      subdomains:'abcd',maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; CARTO',
      updateWhenIdle:true,keepBuffer:6,updateWhenZooming:false
    }).addTo(map);
    let errores=0, respaldo=false;
    function activarRespaldo(){
      if(respaldo) return;
      respaldo=true;
      console.warn('[SGT] CARTO no está entregando los tiles. Cambiando a OpenStreetMap.');
      const osm=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
        maxZoom:19,attribution:'&copy; OpenStreetMap contributors',
        updateWhenIdle:true,keepBuffer:6,updateWhenZooming:false
      });
      osm.addTo(map);
      map.removeLayer(carto);
      // Mostrar una señal discreta en lugar de dejar un mapa inexplicablemente vacío.
      let aviso=document.getElementById('sgtAvisoMapa');
      if(!aviso){
        aviso=document.createElement('div'); aviso.id='sgtAvisoMapa';
        aviso.style.cssText='position:absolute;bottom:14px;left:14px;z-index:600;background:#fff9e6;color:#694c00;padding:8px 12px;border:1px solid #dfc47a;border-radius:8px;font:12px Arial;max-width:350px;box-shadow:0 2px 9px #0002';
        document.getElementById('map')?.parentElement?.appendChild(aviso);
      }
      aviso.textContent='Cartografía alternativa activada: CARTO no respondió correctamente.';
    }
    carto.on('tileerror',e=>{errores++; console.warn('[SGT] Error de tile CARTO:',e?.tile?.src); if(errores>=3) activarRespaldo();});
    carto.on('tileload',()=>{errores=0;});
    return carto;
  }
  // FIX10J: la comuna es una restricción obligatoria, no solo una sugerencia.
  // Un resultado aproximado a nivel de calle/comuna NO demuestra que exista
  // el número solicitado. No se devuelven coordenadas de otras comunas.
  function sinAcentos(t){return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
  function componente(r,tipo){return (r.address_components||[]).filter(c=>(c.types||[]).includes(tipo)).map(c=>c.long_name||'');}
  function comunaGoogle(r){
    const nombres=[...componente(r,'locality'),...componente(r,'administrative_area_level_3')];
    return nombres.some(n=>sinAcentos(n).trim()==='san bernardo');
  }
  function tieneNumero(query){
    // Solo un número al final de una dirección (antes de la coma/localidad).
    // No confundir nombres de calles como «4 de Junio» con números de casa.
    const base=String(query).split(',')[0].trim();
    return /(?:^|\s)(?:n[°ºo.]?\s*)?\d{1,6}[a-z]?$/i.test(base);
  }
  function puntoEnAnillo(lng,lat,anillo){
    let dentro=false;
    for(let i=0,j=anillo.length-1;i<anillo.length;j=i++){
      const a=anillo[i],b=anillo[j];
      if(((a[1]>lat)!==(b[1]>lat)) && lng<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0]) dentro=!dentro;
    }
    return dentro;
  }
  function puntoEnGeojson(lat,lng,gj){
    for(const f of gj.features||[]){
      const g=f.geometry||{},polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
      for(const rings of polys){
        if(rings.length && puntoEnAnillo(lng,lat,rings[0]) && !rings.slice(1).some(h=>puntoEnAnillo(lng,lat,h))) return true;
      }
    }
    return false;
  }
  let ultimoLimiteFallido=false;
  async function perteneceASanBernardo(r,lat,lng){
    // Preferir el límite administrativo real, no un radio arbitrario.
    if(!ultimoLimiteFallido){
      try{return puntoEnGeojson(lat,lng,await cargarLimiteSanBernardo());}
      catch(e){ultimoLimiteFallido=true;console.warn('[SGT] No se pudo verificar polígono comunal; se comprueba comuna de Google:',e);}
    }
    // Respaldo conservador: Google debe identificar explícitamente la comuna.
    return comunaGoogle(r);
  }
  async function geocode(query){
    const original=normalizar(query);if(!original)return null;
    // Siempre dirigir a San Bernardo, incluso si escriben «Freire 645».
    const q=contextualizar(original);
    const ck=q.toLowerCase();if(cache.has(ck))return cache.get(ck);
    if(!cfg.GOOGLE_GEOCODING_KEY)throw new Error('Google Geocoding API no está configurada.');
    const params=new URLSearchParams({address:q,region:'cl',components:'country:CL',language:'es',key:cfg.GOOGLE_GEOCODING_KEY});
    const res=await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    if(!res.ok)throw new Error(`Google Geocoding HTTP ${res.status}`);
    const data=await res.json();
    if(data.status==='ZERO_RESULTS'){cache.set(ck,null);return null;}
    if(data.status!=='OK'||!data.results?.length)throw new Error(`Google Geocoding: ${data.status||'respuesta inválida'}`);
    for(const r of data.results){
      const loc=r.geometry?.location,lat=Number(loc?.lat),lng=Number(loc?.lng);
      if(!Number.isFinite(lat)||!Number.isFinite(lng)||r.partial_match)continue;
      // Sin coincidencia de número NO se debe aceptar el centro de la calle.
      if(tieneNumero(original) && !componente(r,'street_number').length)continue;
      // Evitar resultados tipo «San Bernardo» sin calle específica.
      if(!r.types?.some(t=>['street_address','premise','subpremise','intersection','route','establishment','point_of_interest'].includes(t)))continue;
      if(!await perteneceASanBernardo(r,lat,lng))continue;
      const out={lat,lng,display_name:r.formatted_address||q,aproximado:r.geometry?.location_type!=='ROOFTOP',fuente:'google'};
      cache.set(ck,out);return out;
    }
    cache.set(ck,null);return null;
  }
  async function reverse(lat,lng){
    lat=Number(lat); lng=Number(lng); if(!Number.isFinite(lat)||!Number.isFinite(lng)) return null;
    const ck=`${lat.toFixed(6)},${lng.toFixed(6)}`; if(reverseCache.has(ck)) return reverseCache.get(ck);
    const url=`https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(lat+','+lng)}&region=cl&key=${encodeURIComponent(cfg.GOOGLE_GEOCODING_KEY)}`;
    const res=await fetch(url); if(!res.ok) return null; const data=await res.json();
    const out=data.status==='OK' && data.results?.length ? {display_name:data.results[0].formatted_address,lat,lng,fuente:'google'} : null;
    reverseCache.set(ck,out); return out;
  }
  // FIX10K: validar coordenadas YA IMPORTADAS contra el polígono comunal
  // real. Una caja rectangular de lat/lng no es suficiente.
  async function validarPuntoSanBernardo(lat,lng){
    lat=Number(lat); lng=Number(lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return false;
    try{
      const feature=window.SGT_SAN_BERNARDO_FEATURE;
      const gj=feature?{type:'FeatureCollection',features:[feature]}:await cargarLimiteSanBernardo();
      return puntoEnGeojson(lat,lng,gj);
    }catch(err){
      console.warn('[SGT] No se pudo comprobar límite comunal:',err);
      return null; // no afirmar falsamente que esté en San Bernardo
    }
  }
  return {centro,addBaseLayer,limitarASanBernardo,cargarLimiteSanBernardo,validarPuntoSanBernardo,geocode,reverse,contextualizar};
})();


// FIX9G: mascara comunal separada del servicio base.
const SGT_LIMITE_CACHE = 'sgt_limite_san_bernardo_geojson_v1';
const SGT_LIMITE_SERVICIOS = [
  'https://services7.arcgis.com/5iGW3P98e6lmIEiE/ArcGIS/rest/services/Limites_Comunales/FeatureServer/0',
  'https://services3.arcgis.com/cTnMkBRk4HWkUCRo/ArcGIS/rest/services/COMUNAS_2023/FeatureServer/0'
];

function extraerAnillosGeoJSON(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return (geometry.coordinates || []).map(r=>r);
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).flatMap(poly=>poly);
  return [];
}

async function descargarLimiteRealSanBernardo(){
  let ultimoError = null;
  for(const base of SGT_LIMITE_SERVICIOS){
    try{
      const params = new URLSearchParams({
        where: "CUT_COM='13401'",
        outFields: '*',
        returnGeometry: 'true',
        outSR: '4326',
        f: 'geojson'
      });
      const r = await fetch(`${base}/query?${params.toString()}`, {cache:'no-store'});
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const gj = await r.json();
      if(!gj?.features?.length) throw new Error('sin features');
      const f = gj.features.find(x=>String(x?.properties?.CUT_COM||'')==='13401') || gj.features[0];
      if(!f?.geometry || !extraerAnillosGeoJSON(f.geometry).length) throw new Error('sin geometria');
      const limpio={type:'FeatureCollection',features:[f]};
      try{ localStorage.setItem(SGT_LIMITE_CACHE, JSON.stringify(limpio)); }catch(_){ }
      return limpio;
    }catch(e){ ultimoError=e; }
  }
  throw ultimoError || new Error('No se pudo obtener el limite comunal');
}

async function cargarLimiteSanBernardo(){
  try{
    const cache=localStorage.getItem(SGT_LIMITE_CACHE);
    if(cache){
      const gj=JSON.parse(cache);
      if(gj?.features?.length && extraerAnillosGeoJSON(gj.features[0].geometry).length) return gj;
    }
  }catch(_){ }
  return descargarLimiteRealSanBernardo();
}

// FIX10R: máscara SVG vectorial de recorte exacto, separada de los tiles Leaflet.
// El mismo GeoJSON que dibuja el borde verde produce el hueco transparente.
// No usar rectángulos del bounding box, ni polígonos gigantes dentro de Leaflet.
function crearSombraComunal(map, feature) {
  const host = map.getContainer();
  if (!host || !host.isConnected) return;
  if (typeof map._sgtLimpiarSombra === 'function') map._sgtLimpiarSombra();

  // Quitar cualquier sombreado heredado de versiones previas.
  host.querySelectorAll('.sgt-sombra-limite, .sgt-sombra-svg').forEach(el => el.remove());
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'sgt-sombra-svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:450;pointer-events:none;overflow:hidden;';
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('fill', '#0f172a');
  path.setAttribute('fill-opacity', '0.60');
  path.setAttribute('fill-rule', 'evenodd');
  path.setAttribute('clip-rule', 'evenodd');
  svg.appendChild(path);
  host.appendChild(svg);

  const geometry = feature.geometry || {};
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] :
    geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  let pendiente = 0;
  let destruido = false;

  function dibujar() {
    pendiente = 0;
    if (destruido || !host.isConnected || map.getContainer() !== host) return;
    const size = map.getSize();
    if (size.x <= 0 || size.y <= 0) return;
    svg.setAttribute('viewBox', `0 0 ${size.x} ${size.y}`);
    const segmentos = [`M0 0 H${size.x} V${size.y} H0 Z`];
    for (const poly of polygons) {
      for (const ring of poly || []) {
        if (!ring || ring.length < 3) continue;
        let d = '';
        let numero = 0;
        for (const coord of ring) {
          if (!Array.isArray(coord) || coord.length < 2) continue;
          const lng = Number(coord[0]), lat = Number(coord[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const point = map.latLngToContainerPoint([lat, lng]);
          if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
          d += `${numero++ === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)} `;
        }
        if (numero >= 3) segmentos.push(d + 'Z');
      }
    }
    // Even-odd deja completamente transparente el área comunal, incluso
    // si el contorno pasa por fuera de la zona visible en este zoom.
    path.setAttribute('d', segmentos.join(' '));
  }
  function programar() {
    if (destruido || pendiente) return;
    pendiente = requestAnimationFrame(dibujar);
  }
  map.on('move zoom moveend zoomend viewreset resize', programar);
  programar();
  map._sgtLimpiarSombra = function() {
    destruido = true;
    if (pendiente) cancelAnimationFrame(pendiente);
    map.off('move zoom moveend zoomend viewreset resize', programar);
    svg.remove();
    map._sgtLimpiarSombra = null;
  };
}

async function limitarASanBernardo(map) {
  try {
    const geojson = await cargarLimiteSanBernardo();
    const feature = geojson.features.find(f =>
      String(f?.properties?.CUT_COM || '') === '13401' ||
      String(f?.properties?.COMUNA || '').toLowerCase() === 'san bernardo'
    ) || geojson.features[0];
    const anillos = extraerAnillosGeoJSON(feature.geometry);
    if (!anillos.length) throw new Error('Geometría de San Bernardo inválida');
    if (!map.getContainer()?.isConnected) return null;

    // Limpiar las cuatro franjas rectangulares de FIX10P, si existieran.
    if (Array.isArray(map._sgtSanBernardoShadeLayers)) {
      map._sgtSanBernardoShadeLayers.forEach(layer => {
        try { map.removeLayer(layer); } catch (_) { }
      });
    }
    map._sgtSanBernardoShadeLayers = [];
    // El sombreado antiguo no debe sobrevivir dentro de la instancia actual.
    if (map._sgtSanBernardoMask) {
      try { map.removeLayer(map._sgtSanBernardoMask); } catch (_) { }
      map._sgtSanBernardoMask = null;
    }
    if (map._sgtSanBernardoBoundary) {
      try { map.removeLayer(map._sgtSanBernardoBoundary); } catch (_) { }
    }
    if (!map.getPane('sgtBoundaryPane')) {
      const pane = map.createPane('sgtBoundaryPane');
      pane.style.zIndex = '410';
      pane.style.pointerEvents = 'none';
    }

    const borde = L.geoJSON(feature, {
      pane: 'sgtBoundaryPane', interactive: false,
      style: {color:'#17633f',weight:4,opacity:0.98,fill:false,dashArray:'8,5'}
    }).addTo(map);
    crearSombraComunal(map, feature);
    map._sgtSanBernardoBoundary = borde;
    window.SGT_SAN_BERNARDO_FEATURE = feature;
    return feature;
  } catch (err) {
    console.error('[SGT] No se pudo mostrar el límite de San Bernardo:', err);
    return null;
  }
}

window.limitarASanBernardo = limitarASanBernardo;
