/* Diagnóstico SGT Municipal
 * Requiere: logger.js. Opcional: auditoria.js
 *
 * Cada batería es una lista de pruebas: [descripción, función, severidad]
 *  - función devuelve true  -> OK
 *  - función devuelve texto -> FALLA (el texto es el detalle)
 *  - función lanza error    -> FALLA
 *  - severidad: 'ERROR' (por defecto) o 'WARN'
 *
 * Uso:
 *  Diagnostico.esperar(['tbody','reporteArea']);   // ids que la página debe tener
 *  Diagnostico.bateria('Mi batería', [[ 'algo', () => true ]]);
 *  await Diagnostico.correr();                     // todas las baterías
 */
const Diagnostico = (() => {
  const KEY_VISTOS = 'sgt_diag_vistos';
  const ESTADOS_OK = ['critica', 'proceso', 'pendiente', 'resuelta'];
  const baterias = {};
  const config = { elementos: [] };
  const bateria = (nombre, pruebas) => { baterias[nombre] = pruebas; };
  const solicitudes = () => Object.values(dbLoad().solicitudes).filter(s => !s.eliminada);

  bateria('Dependencias', [
    ['Función dbLoad disponible', () => typeof dbLoad === 'function' || 'No existe dbLoad (¿falta data.js?)'],
    ['Función normalizarEstado disponible', () => typeof normalizarEstado === 'function' || 'No existe normalizarEstado (¿falta main.js?)'],
    ['Función handleLogout disponible', () => typeof handleLogout === 'function' || 'No existe handleLogout (¿falta main.js?)', 'WARN'],
    ['Librería jsPDF cargada (exportar PDF)', () => !!(window.jspdf && window.jspdf.jsPDF) || 'jsPDF no cargó (¿sin internet o CDN bloqueado?)', 'WARN'],
    ['Librería html2canvas cargada (exportar PDF)', () => typeof html2canvas === 'function' || 'html2canvas no cargó (¿sin internet o CDN bloqueado?)', 'WARN'],
    ['Hojas de estilo cargadas', () => {
      const m = [...document.querySelectorAll('link[rel=stylesheet]')].filter(l => !l.sheet).map(l => l.getAttribute('href'));
      return m.length ? 'No cargaron: ' + m.join(', ') : true;
    }]
  ]);

  bateria('Almacenamiento', [
    ['localStorage disponible', () => {
      const k = '__diag__'; localStorage.setItem(k, '1');
      const ok = localStorage.getItem(k) === '1'; localStorage.removeItem(k);
      return ok || 'No se puede leer/escribir en localStorage';
    }],
    ['dbLoad() devuelve solicitudes y juntas', () => {
      const db = dbLoad();
      if(!db || typeof db !== 'object') return 'dbLoad no devolvió un objeto';
      if(!db.solicitudes) return 'Falta db.solicitudes';
      if(!db.juntas) return 'Falta db.juntas';
      return true;
    }],
    ['Espacio de localStorage', () => {
      const kb = Object.keys(localStorage).reduce((n, k) => n + k.length + (localStorage.getItem(k) || '').length, 0) / 1024;
      return kb < 4000 || `Uso alto: ${Math.round(kb)} KB de unos 5000 KB`;
    }, 'WARN']
  ]);

  bateria('Datos', [
    ['Hay juntas cargadas', () => Object.keys(dbLoad().juntas).length > 0 || 'No hay juntas registradas'],
    ['Hay solicitudes cargadas', () => Object.keys(dbLoad().solicitudes).length > 0 || 'No hay solicitudes registradas', 'WARN'],
    ['Todas las juntas tienen nombre', () => {
      const m = Object.entries(dbLoad().juntas).filter(([, j]) => !j || !j.nombre).map(([id]) => id);
      return m.length ? 'Juntas sin nombre: ' + m.join(', ') : true;
    }],
    ['Todas las solicitudes tienen folio', () => {
      const n = solicitudes().filter(s => !s.folio).length;
      return n ? `${n} solicitud(es) sin folio` : true;
    }],
    ['normalizarEstado no falla con valores vacíos', () => { [undefined, null, ''].forEach(v => normalizarEstado(v)); return true; }],
    ['normalizarEstado reconoce todos los estados en uso', () => {
      const raros = [...new Set(solicitudes().map(s => s.estado).filter(e => !ESTADOS_OK.includes(normalizarEstado(e)?.key)))];
      return raros.length ? 'No reconoce: ' + raros.map(r => JSON.stringify(r)).join(', ') : true;
    }],
    ['Integridad de datos (auditoría)', () => {
      if(typeof Auditoria === 'undefined') return 'auditoria.js no cargó';
      const p = Auditoria.auditar(dbLoad(), { registrar: false });
      return p.length ? `${p.length} problema(s): ` + [...new Set(p.map(x => x.codigo))].join(', ') : true;
    }, 'WARN']
  ]);

  bateria('Interfaz', [
    ['Botones onclick apuntan a funciones existentes', () => {
      const m = [];
      document.querySelectorAll('[onclick]').forEach(el => {
        const f = (el.getAttribute('onclick').match(/^\s*([\w$]+)\s*\(/) || [])[1];
        if(f && new Function('return typeof ' + f)() !== 'function') m.push(f);
      });
      return m.length ? 'Funciones inexistentes: ' + [...new Set(m)].join(', ') : true;
    }],
    ['La página tiene los elementos esperados', () => {
      const m = config.elementos.filter(id => !document.getElementById(id));
      return m.length ? 'Faltan ids: ' + m.join(', ') : true;
    }],
    ['No hay ids duplicados', () => {
      const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
      const d = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
      return d.length ? 'Repetidos: ' + d.join(', ') : true;
    }, 'WARN']
  ]);

  bateria('Enlaces', [
    ['Los enlaces internos existen', async () => {
      if(location.protocol === 'file:') return 'No verificable abriendo el archivo directo (file://); usa un servidor local';
      const urls = [...new Set([...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href'))
        .filter(h => h && !h.startsWith('#') && !/^(https?:|mailto:|javascript:)/.test(h)).map(h => h.split('?')[0]))];
      const rotos = [];
      for(const u of urls){
        try { const r = await fetch(u, { method: 'HEAD' }); if(!r.ok) rotos.push(u); }
        catch { rotos.push(u); }
      }
      return rotos.length ? 'No responden: ' + rotos.join(', ') : true;
    }, 'WARN']
  ]);

  async function correr(filtro){
    const resultados = [];
    for(const [bat, pruebas] of Object.entries(baterias)){
      if(filtro && !filtro.includes(bat)) continue;
      for(const [prueba, fn, sev = 'ERROR'] of pruebas){
        let estado = 'OK', detalle = '';
        try {
          const r = await fn();
          if(r !== true && r !== undefined){ estado = sev; detalle = r === false ? '' : String(r); }
        } catch(e){ estado = sev; detalle = 'Excepción: ' + e.message; }
        resultados.push({ bateria: bat, prueba, estado, detalle });
      }
    }
    return resultados;
  }

  // Registra las fallas en el Logger; con dedupe no repite lo ya registrado en esta sesión
  function registrar(resultados, { dedupe = true } = {}){
    let vistos = [];
    try { vistos = JSON.parse(sessionStorage.getItem(KEY_VISTOS) || '[]'); } catch {}
    resultados.filter(r => r.estado !== 'OK').forEach(r => {
      const k = `${location.pathname}|${r.bateria}|${r.prueba}|${r.detalle}`;
      if(dedupe && vistos.includes(k)) return;
      vistos.push(k);
      Logger[r.estado === 'ERROR' ? 'error' : 'warn']('DIAGNOSTICO', `[${r.bateria}] ${r.prueba}`, { detalle: r.detalle });
    });
    try { sessionStorage.setItem(KEY_VISTOS, JSON.stringify(vistos)); } catch {}
  }

  // Al cargar cada página corre en silencio las baterías rápidas y registra solo las fallas
  async function auto(){
    const res = await correr(['Dependencias', 'Almacenamiento', 'Datos', 'Interfaz']);
    registrar(res);
    return res;
  }
  window.addEventListener('load', () => setTimeout(() => {
    auto().catch(e => Logger.error('SISTEMA', 'Falló el autodiagnóstico', { motivo: e.message }));
  }, 300));

  return { bateria, correr, registrar, auto, esperar: ids => { config.elementos = ids; } };
})();