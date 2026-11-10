/* Auditoría de datos SGT Municipal
 * Requiere: logger.js, main.js (normalizarEstado)
 *
 * Reglas:
 *  CONCENTRACION_JUNTA  >= 80% de las solicitudes están en una sola junta (mín. 5 solicitudes)
 *  SIN_JUNTA            solicitud sin juntaId
 *  JUNTA_INEXISTENTE    juntaId que no existe en db.juntas
 *  ESTADO_INVALIDO      estado que no es crítica / en proceso / pendiente / resuelta
 *  FOLIO_DUPLICADO      mismo folio en más de una solicitud
 *  CAMPOS_VACIOS        falta categoría, departamento o requerimiento
 */
const Auditoria = (() => {
  const KEY_VISTOS = 'sgt_audit_vistos';
  const ESTADOS_OK = ['critica', 'proceso', 'pendiente', 'resuelta'];

  function auditar(db, { registrar = true } = {}){
    const sols = Object.values(db.solicitudes).filter(s => !s.eliminada);
    const problemas = [];
    const add = (nivel, codigo, mensaje, contexto, clave) =>
      problemas.push({ nivel, codigo, mensaje, contexto, clave: `${codigo}:${clave}` });

    // 1. Concentración en una sola junta
    const porJunta = {};
    sols.forEach(s => { porJunta[s.juntaId] = (porJunta[s.juntaId] || 0) + 1; });
    const total = sols.length;
    if(total >= 5 && Object.keys(db.juntas).length > 1){
      const [top, n] = Object.entries(porJunta).sort((a, b) => b[1] - a[1])[0];
      if(n / total >= 0.8){
        add('ERROR', 'CONCENTRACION_JUNTA',
          `${n} de ${total} solicitudes (${Math.round(n / total * 100)}%) están en una sola junta`,
          { juntaId: top, junta: db.juntas[top]?.nombre || null, cantidad: n, total }, top);
      }
    }

    // 2. Junta, estado y campos por solicitud
    sols.forEach(s => {
      if(!s.juntaId){
        add('ERROR', 'SIN_JUNTA', 'Solicitud sin junta asignada', { folio: s.folio }, s.folio);
      } else if(!db.juntas[s.juntaId]){
        add('ERROR', 'JUNTA_INEXISTENTE', 'La junta asignada no existe', { folio: s.folio, juntaId: s.juntaId }, s.folio);
      }
      const key = normalizarEstado(s.estado)?.key;
      if(!ESTADOS_OK.includes(key)){
        add('WARN', 'ESTADO_INVALIDO', 'Estado no reconocido', { folio: s.folio, estado: s.estado }, s.folio);
      }
      const faltan = ['categoria', 'departamento', 'requerimiento'].filter(c => !s[c]);
      if(faltan.length){
        add('WARN', 'CAMPOS_VACIOS', 'Solicitud con campos vacíos', { folio: s.folio, campos: faltan }, s.folio);
      }
    });

    // 3. Folios duplicados
    const folios = {};
    sols.forEach(s => { folios[s.folio] = (folios[s.folio] || 0) + 1; });
    Object.entries(folios).filter(([, n]) => n > 1).forEach(([folio, n]) => {
      add('ERROR', 'FOLIO_DUPLICADO', `Folio repetido ${n} veces`, { folio, veces: n }, folio);
    });

    // Solo registra problemas nuevos para no llenar el log en cada carga
    if(registrar){
      let vistos = [];
      try { vistos = JSON.parse(localStorage.getItem(KEY_VISTOS)) || []; } catch {}
      problemas.filter(p => !vistos.includes(p.clave)).forEach(p => {
        Logger[p.nivel === 'ERROR' ? 'error' : 'warn']('DATOS', `[${p.codigo}] ${p.mensaje}`, p.contexto);
      });
      localStorage.setItem(KEY_VISTOS, JSON.stringify(problemas.map(p => p.clave)));
    }
    return problemas;
  }

  // Llamar cada vez que se crea o importa una solicitud y se le asigna junta
  function registrarAsignacion(s, db){
    const junta = db.juntas[s.juntaId];
    const ctx = { folio: s.folio, juntaId: s.juntaId, junta: junta ? junta.nombre : null, categoria: s.categoria };
    Logger.info('ASIGNACION', 'Asignación', ctx);
    if(!junta) Logger.error('ASIGNACION', 'Asignación a junta inexistente', ctx);

    // Alerta si las últimas 5 asignaciones fueron a la misma junta
    const ult = Logger.todos().filter(l => l.categoria === 'ASIGNACION' && l.mensaje === 'Asignación').slice(-5);
    if(ult.length === 5 && ult.every(l => l.contexto.juntaId === s.juntaId)){
      Logger.warn('ASIGNACION', 'Las últimas 5 solicitudes se asignaron a la misma junta', ctx);
    }
  }

  return { auditar, registrarAsignacion };
})();