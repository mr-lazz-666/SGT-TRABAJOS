# Portal SGT — Registro de FIX y horas

Rama de trabajo: `trabajo/portal-web`.

Este registro documenta los cambios de interfaz del portal y permite distribuir el tiempo por actividad. El código de referencia es `SERVIDOR_CLOUDFLARE/worker.js` del ZIP vigente. La réplica se utiliza para revisión; publicar una preview no significa aprobar su integración al sistema real.

## Criterios del registro

- Fecha y hora en `America/Santiago`, indicando el desfase UTC de cada entrada.
- Cada FIX conserva un identificador y describe el pedido, lo realizado, los archivos, las comprobaciones y el resultado.
- Los intervalos se registran por actividad. Se excluyen las pausas entre mensajes y se separa la espera de procesos automáticos.
- Las estimaciones se identifican expresamente; las horas sin evidencia quedan pendientes de validación. No se atribuyen horas retrospectivas a tareas anteriores.
- La aprobación visual y la autorización para integrar se registran por separado.
- Las entradas existentes se conservan; las correcciones se anotan con su motivo.
- No se registran contraseñas, tokens, claves ni datos personales de vecinos.

## Distribución de tiempo por actividad

| Actividad | Qué comprende |
|---|---|
| Análisis | Lectura del pedido, revisión de código y dependencias |
| HTML | Estructura, contenido, formularios y accesibilidad |
| CSS | Estilos, distribución, adaptación de pantalla y estados visuales |
| JavaScript de interfaz | Interacciones y validaciones de presentación, conservando contratos funcionales |
| Validación | Comprobaciones técnicas y revisión de la preview |
| Documentación y entrega | Bitácora, instrucciones, archivos y commits |
| Espera automática | Instalación, compilación o despliegue; se informa aparte |

## Resumen de FIX

| ID | Fecha y hora local | Solicitud | Resultado | Preview | Integración real | Tiempo |
|---|---|---|---|---|---|---|
| FIX-PORTAL-000 | 2026-11-10 19:11:14 UTC-0300 | Crear bitácora de FIX y distribución de horas | Registro creado en rama independiente | No aplica: documentación | No se modificó el portal real | Ver detalle |

## FIX-PORTAL-000 — Apertura de la bitácora

| Campo | Registro |
|---|---|
| Fecha y hora de apertura | 2026-11-10 19:11:14 UTC-0300 |
| Pedido | Documentar qué se modifica, cuándo se realiza y cómo se distribuye el tiempo |
| Trabajo realizado | Crear esta bitácora y definir el formato para las siguientes intervenciones |
| Archivo creado | `portal-web/REGISTRO_FIX_Y_HORAS.md` |
| Archivos funcionales modificados | Ninguno |
| Validación | Revisión del contenido, la zona horaria y la separación entre preview e integración |
| Estado de entrega | Documento preparado para GitHub |
| Aprobación visual | No aplica |
| Autorización de integración al portal real | No aplica |
| Tiempo anterior a esta entrada | No imputado: no existe registro suficiente para distribuirlo |
| Tiempo de esta entrada | Pendiente de validar para imputación de horas; no se asigna una duración estimada |
| Evidencia | Commit de creación de este archivo en la rama `trabajo/portal-web` |

## Plantilla para cada próximo FIX

Copiar esta ficha al final del documento y añadir su fila al resumen.

### FIX-PORTAL-XXX — Título del cambio

| Campo | Registro |
|---|---|
| Pedido | Descripción concreta del cambio solicitado |
| Fecha | AAAA-MM-DD |
| Zona horaria y desfase | America/Santiago, UTC±HH:MM |
| Inicio | HH:MM:SS |
| Fin | HH:MM:SS |
| Cambio HTML | Qué estructura o contenido cambió |
| Cambio CSS | Qué estilos o distribución cambiaron |
| Cambio JavaScript | Qué interacción cambió; contratos funcionales preservados |
| Archivos afectados | Rutas exactas y finalidad de cada archivo |
| Validación | Procedimiento y resultado; indicar lo que no se verificó |
| Preview | Enlace y versión publicada |
| Revisión del propietario | Pendiente / cambios solicitados / aprobada, con fecha y hora |
| Integración real | Pendiente / autorizada / aplicada, con fecha y evidencia |
| Entrega | Commit, rama y archivos completos para reemplazar |
| Observaciones | Limitaciones o dependencias comprobadas |

#### Intervalos y reparto de horas

| Actividad | Inicio | Fin | Minutos | Horas | Tipo de registro | Evidencia |
|---|---|---|---:|---:|---|---|
| Análisis | — | — | — | — | Pendiente | — |
| HTML | — | — | — | — | Pendiente | — |
| CSS | — | — | — | — | Pendiente | — |
| JavaScript de interfaz | — | — | — | — | Pendiente | — |
| Validación | — | — | — | — | Pendiente | — |
| Documentación y entrega | — | — | — | — | Pendiente | — |
| Espera automática, separada del trabajo activo | — | — | — | — | Pendiente | — |

Horas por actividad = minutos acumulados / 60. El total activo excluye las esperas automáticas y las pausas. Si varias actividades se realizan simultáneamente, no sumar dos veces el mismo intervalo. Mantener la precisión del intervalo y redondear únicamente el total que se presente para validación.

| Total | Minutos | Horas |
|---|---:|---:|
| Trabajo activo registrado | — | — |
| Espera automática registrada | — | — |
| Horas aprobadas para imputación | — | — |
