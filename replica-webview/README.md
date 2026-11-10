# SGT — Réplica navegable

HTML, CSS y navegación derivados de FIX23. Originales conservados en el ZIP.

Adaptaciones: API local simulada en replica-runtime.js, datos ficticios guardados en este navegador, acceso de demostración, bibliotecas locales y mapa OpenStreetMap. SQLite, Windows, Google y Cloudflare de producción no se conectan. Las reglas de importación de esta réplica no sustituyen las del servidor Python.

Perfiles ADMINISTRADOR y FUNCIONARIO. Contraseña de demostración: SGTdemo2026.

## Abrir la réplica

https://sgt-replica-navegable.warmcactus.chatgpt.site

Acceso privado del propietario. No modifica main ni la aplicación Windows. Los recursos de interfaz originales se mantienen; se añade un adaptador de demostración, bibliotecas locales y configuración de mapas sin claves privadas.

Los cambios se guardan únicamente en el navegador utilizado. Las operaciones de nube y geocodificación con Google no están conectadas. Las reglas de Excel del adaptador son de demostración y no reemplazan las validaciones del servidor Python.

Verificación: comprobación sintáctica JavaScript y prueba del adaptador con Node. No se realizó QA visual de esta réplica publicada por falta de herramientas de navegador compartido.

## Portales de demostración

- Vecinos: https://sgt-replica-navegable.warmcactus.chatgpt.site/portales/vecinos.html
- Presidentes: /portales/presidentes.html
- Seguimiento: /portales/seguimiento.html

Usuario de prueba: presidente; contraseña SGTdemo2026. Los envíos y decisiones se almacenan únicamente en el navegador y no se sincronizan con producción ni con el registro municipal. Los tres portales conservan el CSS original leído del sitio público. Se corrigieron saltos de línea que invalidaban el JavaScript de seguimiento en el HTML generado.

Verificación: node replica-webview/tests/portal.cjs. Prueba el envío, código, consulta, permisos y decisión sin hacer peticiones al portal real. Revisión visual publicada aún pendiente.
