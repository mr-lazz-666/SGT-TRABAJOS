# FIX-PORTAL-002 — Portada y diseño por apartados

**Estado: diseño aprobado. Selector permanente de tres temas solicitado por el propietario. Entrega preparada; no publicada en el Cloudflare real.**

Preview: https://sgt-replica-navegable.warmcactus.chatgpt.site/?diseno=fix002

## Cómo recorrerla

1. Seleccionar Azul institucional, Claro o Grafito. El selector opcional se incluye en todas las pantallas del portal real; su preferencia se guarda en el navegador.
2. Pasar el mouse o enfocar una tarjeta para leer la explicación. En dispositivos táctiles la explicación permanece visible.
3. Entrar a Vecinos para crear una solicitud o abrir Seguimiento.
4. Entrar a Presidentes para iniciar sesión y revisar solicitudes. En la réplica: presidente / SGTdemo2026, asociado a la primera junta ficticia.

Enviar como vecino no requiere pedir al presidente que registre la solicitud. Esto no elimina su revisión: se conserva pendiente_presidente y su aceptación antes del flujo municipal. Esta propuesta no modifica esa regla del ZIP.

## Fuentes organizadas

```text
src/
  compartido/    portal.css, portal.js, encabezado.html, pie.html, selector-tema.html, logo-municipal.png
  inicio/        index.html, inicio.css, inicio.js
  vecinos/       index.html, vecinos.css, vecinos.js
  presidentes/   index.html, presidentes.css, presidentes.js
  seguimiento/   index.html, seguimiento.css, seguimiento.js
base/SERVIDOR_CLOUDFLARE/worker.js
construir.py
candidato/SERVIDOR_CLOUDFLARE/worker.js
pruebas/contratos.mjs
```

Las fuentes editables incluyen marcadores de ensamblaje. No son archivos para arrastrar directamente sobre el proyecto real. `construir.py` los reúne e incorpora el logo para producir un único Worker completo compatible con la arquitectura original. No necesita paquetes Python externos.

```text
python construir.py
node --check candidato/SERVIDOR_CLOUDFLARE/worker.js
node pruebas/contratos.mjs
```

La carpeta base conserva el Worker del ZIP usado como referencia. `--worker-base` permite indicar otro archivo; si cambia su versión, se deben revisar nuevamente compatibilidad y pruebas.

## Reemplazo del diseño aprobado

El único archivo previsto para reemplazar es `SERVIDOR_CLOUDFLARE/worker.js`, desde candidato. Conservar wrangler.toml, schema.sql, secretos y datos existentes. Publicar el Worker mediante el procedimiento del proyecto y verificar en un entorno de ensayo antes de aplicarlo a producción.

Rutas existentes: `/vecinos`, `/presidentes`, `/seguimiento` y endpoints API. La ruta `/` pasa de redirigir a Vecinos a mostrar la nueva portada. Los controladores usan los endpoints originales. La corrección de saltos literales en el JavaScript generado de Seguimiento se conserva para evitar un error de sintaxis.

La API de demostración y los datos ficticios de la preview no forman parte del reemplazo real. El selector de temas sí se incluye por pedido del propietario.

## Verificación y límites

Se comprobó sintaxis, generación de las cuatro páginas, conservación de IDs, igualdad del código API/SQL y contratos de rechazo básicos. Estas comprobaciones no equivalen a probar todos los recorridos ni el diseño visual en el navegador publicado. No se dispone de control del navegador compartido en esta sesión; la revisión visual con el propietario sigue pendiente. Tampoco se aplicó el candidato al Cloudflare real.

## Entrega simple

El paquete listo para descargar está en [FIX-PORTAL-002.zip](../../../entregas/FIX-PORTAL-002.zip?raw=true). Incluye instrucciones manuales TXT, un prompt TXT para la IA del destinatario, registro de validaciones y hashes. Las fuentes de esta carpeta son para mantenimiento; no hace falta editarlas para instalar.

Pruebas adicionales: `node pruebas/temas.cjs` y `node pruebas/flujo-worker.mjs` (esta última necesita Python disponible y usa solo SQLite temporal).
