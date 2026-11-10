/* Logger SGT Municipal
 * Niveles: DEBUG, INFO, WARN, ERROR
 * Categorías sugeridas: DATOS, ASIGNACION, IMPORTACION, UI, SISTEMA
 * Los logs se guardan en localStorage (clave sgt_logs, máx. 1000 entradas).
 */
const Logger = (() => {
  const KEY = 'sgt_logs';
  const MAX = 1000;

  function leer(){
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }
  function guardar(arr){
    try { localStorage.setItem(KEY, JSON.stringify(arr.slice(-MAX))); }
    catch(e){ console.warn('Logger: no se pudo guardar', e); }
  }

  function log(nivel, categoria, mensaje, contexto = {}){
    const entrada = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: new Date().toISOString(),
      nivel, categoria, mensaje, contexto,
      pagina: location.pathname.split('/').pop() || 'index'
    };
    const arr = leer();
    arr.push(entrada);
    guardar(arr);
    const fn = nivel === 'ERROR' ? 'error' : nivel === 'WARN' ? 'warn' : 'log';
    console[fn](`[${nivel}][${categoria}] ${mensaje}`, contexto);
    return entrada;
  }

  function descargar(nombre, texto, tipo){
    const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
    const a = document.createElement('a');
    a.href = url; a.download = nombre; a.click();
    URL.revokeObjectURL(url);
  }

  const fecha = () => new Date().toISOString().slice(0, 10);

  return {
    debug: (cat, msg, ctx) => log('DEBUG', cat, msg, ctx),
    info:  (cat, msg, ctx) => log('INFO',  cat, msg, ctx),
    warn:  (cat, msg, ctx) => log('WARN',  cat, msg, ctx),
    error: (cat, msg, ctx) => log('ERROR', cat, msg, ctx),
    todos: leer,
    limpiar: () => localStorage.removeItem(KEY),
    exportarLog(){
      const txt = leer().map(l =>
        `${l.ts} [${l.nivel}] [${l.categoria}] (${l.pagina}) ${l.mensaje} ${JSON.stringify(l.contexto)}`
      ).join('\n');
      descargar(`sgt-${fecha()}.log`, txt, 'text/plain');
    },
    exportarJson(){
      descargar(`sgt-logs-${fecha()}.json`, JSON.stringify(leer(), null, 2), 'application/json');
    }
  };
})();

// Captura automática de errores no controlados
window.addEventListener('error', e => {
  Logger.error('SISTEMA', e.message, { archivo: (e.filename || '').split('/').pop(), linea: e.lineno });
});
// Recursos que no cargaron (script, css, imagen): estos errores no burbujean, por eso capture=true
window.addEventListener('error', e => {
  const t = e.target;
  if(t && t !== window && (t.src || t.href)){
    Logger.error('SISTEMA', `No se pudo cargar <${t.tagName.toLowerCase()}>`, { url: t.getAttribute('src') || t.getAttribute('href') });
  }
}, true);
window.addEventListener('unhandledrejection', e => {
  Logger.error('SISTEMA', 'Promesa rechazada sin manejar', { motivo: String(e.reason) });
});