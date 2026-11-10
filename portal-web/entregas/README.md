# Entregas del portal SGT

## FIX-PORTAL-002 — Diseño aprobado

[Descargar ZIP de integración](FIX-PORTAL-002.zip?raw=true)

[Ver instrucciones manuales](FIX-PORTAL-002/01_INTEGRACION_MANUAL.txt) · [Prompt para su IA](FIX-PORTAL-002/02_PROMPT_PARA_IA.txt) · [Registro y validaciones](FIX-PORTAL-002/03_FIX_Y_VALIDACIONES.txt)

Reemplazo principal: `SERVIDOR_CLOUDFLARE/worker.js`. Incluye logo y selector opcional de tres temas en todas las pantallas. No hace falta pegar fragmentos ni reorganizar el proyecto existente.

Es necesario volver a publicar el Worker para actualizar el portal remoto. El paquete no se ha aplicado al Cloudflare real y no reemplaza configuración, D1, secretos, ejecutable ni instalador. El `.bat` nuevo es opcional y abre la portada.

Las fuentes editables y pruebas están en `../FIX-PORTAL-002/`. El ZIP solo incluye el Worker, el lanzador opcional y documentación TXT. Consulte el TXT de integración antes de reemplazar un archivo de una versión diferente.
