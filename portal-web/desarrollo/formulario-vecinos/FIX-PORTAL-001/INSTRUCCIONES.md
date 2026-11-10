# FIX-PORTAL-001 — Propuesta visual de Vecinos

Estado: EN PREVIEW. Pendiente de revisión visual y aprobación del propietario. No aplicado al portal real.

## Revisar

https://sgt-replica-navegable.warmcactus.chatgpt.site/portales/vecinos.html?diseno=fix001

Conserva logo municipal, colores institucionales, campos e identificadores. Añade navegación con foco visible, guía de tres pasos, distribución adaptable a móvil, contador de caracteres y transiciones que respetan la preferencia de movimiento reducido.

## Archivos

| Archivo | Uso |
|---|---|
| `diseno/vecinos.css` | Fuente editable de los estilos de la propuesta |
| `diseno/vecinos-ui.js` | Fuente editable de las mejoras visuales: placeholders, contador y estado visual del mensaje |
| `candidato/SERVIDOR_CLOUDFLARE/worker.js` | Archivo completo preparado con los estilos, mejoras visuales y logo incorporados; todavía no aprobado para integración |

El candidato mantiene la arquitectura original: HTML, CSS y JavaScript dentro de worker.js. Los archivos de diseno sirven para editar; no deben copiarse por separado al proyecto real ni son dependencias adicionales de ejecución. El logo se incluye en el HTML para que no sea necesario crear una ruta o un servicio de archivos.

## Alcance de la comprobación

- Sintaxis de worker.js y del JavaScript visual comprobada con Node.
- Generación HTTP de Vecinos, Presidentes y Seguimiento comprobada desde el módulo candidato.
- La parte del archivo original ajena a la función generadora de páginas permanece idéntica, incluyendo endpoints, consultas SQL, autenticación y sincronización.
- El formulario y el script de envío de Vecinos se conservan; los estilos y mejoras visuales se añaden a su alrededor.
- Presidentes y Seguimiento usan la función original de renderizado.
- Preview: API de demostración en navegador. El adaptador no se incluye en el candidato real.
- Revisión visual en navegador y prueba de integración contra un entorno Cloudflare de ensayo: pendientes. No se declara validación completa por generar HTML correctamente.

## Integración posterior a aprobación

1. Confirmar que el proyecto destino corresponde al ZIP usado como base.
2. Respaldar su `SERVIDOR_CLOUDFLARE/worker.js` actual fuera de la carpeta de despliegue.
3. Reemplazar solo ese archivo por el candidato aprobado; conservar esquema, base, wrangler.toml y secretos.
4. Volver a publicar mediante el procedimiento Cloudflare del proyecto.
5. Comprobar formulario, envío, código de seguimiento y acceso a los otros portales en un entorno de ensayo.

Para revertir: restaurar el worker.js anterior y volver a publicarlo. No aplicar este candidato como entrega final hasta que el propietario apruebe el diseño y se completen las comprobaciones de integración acordadas.
