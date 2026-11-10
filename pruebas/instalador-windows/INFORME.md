# SGT — Informe de pruebas funcionales del instalador

Fecha: 10 de noviembre de 2026. Rama: `pruebas/instalador-windows`.

## Resultado y alcance

El instalador original se instaló en un ejecutor temporal de Windows Server 2022. Se inició el `SGT.exe` instalado y se utilizó su servidor local real. No se recompiló el ZIP ni se sustituyeron los HTML del producto. Las pruebas funcionales de interfaz se realizaron con Chromium sobre el servidor del ejecutable; esto se distingue de probar la ventana nativa de pywebview.

La configuración de Cloudflare copiada por el instalador se retiró antes del primer arranque. Se usaron juntas, solicitudes, fotografías y acuerdos ficticios. No se modificó main ni el proyecto original.

Ejecución final: https://github.com/mr-lazz-666/SGT-TRABAJOS/actions/runs/42893363211

Evidencias persistentes: [resultados](evidencias/resultados.json), [diagnóstico nativo](evidencias/diagnostico-nativo.json), [inventario](evidencias/inventario-recursos.json).

Capturas: [mapa de administrador](evidencias/administrador-mapa.png), [importación dinámica](evidencias/admin-importacion-dinamica.png), [detalle](evidencias/administrador-detalle.png), [minuta de funcionario](evidencias/funcionario-minuta.png), [estadísticas](evidencias/funcionario-estadisticas.png).

| Evidencia | Resultado |
|---|---|
| Identidad del instalador | SHA-256 comprobado contra el adjunto original antes de instalar |
| Instalación silenciosa | Correcta; SGT.exe encontrado |
| Servidor de SGT.exe | Respondió en 127.0.0.1:8765 |
| Inventario de recursos del ejecutable | 71 archivos HTML/JS/CSS localizados durante su extracción temporal |
| Comparación con el ZIP depurado | Los 65 recursos con equivalente local coinciden byte por byte; esto no demuestra que todo el código Python sea idéntico |
| Ejecución ampliada | 73 comprobaciones PASS, 2 observaciones pendientes de la detección inicial/CDP, 1 diferencia de usuario y 2 observaciones de fecha de cierre. El diagnóstico posterior sí confirmó ventana nativa y procesos WebView2 |

PASS describe exclusivamente la comprobación registrada. No certifica todo el módulo ni todos sus casos de borde.

| Comprobación final | Resultado |
|---|---|
| Ventana nativa al finalizar | Confirmada: SGT Municipal - San Bernardo; seis procesos msedgewebview2.exe. No se consiguió automatizar por CDP |
| Persistencia al cerrar y reabrir el ejecutable | Correcta: una junta y ocho solicitudes antes y después del reinicio |

Los dos registros PENDIENTE son observaciones anteriores al diagnóstico final; no significan que la aplicación no haya abierto su ventana. Los recorridos funcionales se hicieron en Chromium.

## Recorrido como administrador y funcionario

| Operación | Administrador | Funcionario | Evidencia y alcance |
|---|---|---|---|
| Acceso mediante formulario | Correcto | Correcto | Selección de perfil, contraseña y navegación al inicio |
| Acceso a datos sin sesión | Rechazado | Rechazado | HTTP 401 |
| Carga inicial con Excel madre | Correcta | Bloqueada | Alta inicial por API y posterior importación desde selector; fixture con ubicación conocida |
| Reimportación madre | No duplicó el registro | No permitido | Repetición del mismo registro por API |
| Generar planilla dinámica | Correcto | Bloqueado | Botón real de generación y comprobación del permiso |
| Completar e importar planilla dinámica | Correcto | No recorrido con este perfil | Se completó Nueva solicitud en la planilla generada y se importó desde el selector |
| Importar Forms | Correcto | Correcto | Selector de archivos y comprobación del registro persistido |
| Reimportar Forms | Comprobación por API | No duplicó el registro | Mismo requerimiento y asociación de junta |
| Modificar junta desde API | No cubierto como recorrido de edición | Bloqueado | Cambio efectivo de presidente rechazado con HTTP 403 |
| Crear solicitud manual | Correcto | Correcto | Formulario, folio generado y ficha de detalle |
| Editar a En proceso | Correcto | Correcto | Guardado desde formulario y relectura del estado |
| Cerrar como Resuelta | Correcto | Correcto | Cambio de estado; fechaCierre ausente, ver hallazgo |
| Eliminar solicitud | Borrado lógico correcto | Borrado lógico correcto | Persistió eliminada=true |
| Adjuntar fotografía por carpeta | Correcto | Correcto | Archivo ficticio reconocido por folio; fotosData persistido |
| Reporte: vista previa | Correcto | Correcto | Contenido esperado presente |
| Generar PDF desde botón | Correcto | Correcto | Nuevo archivo con firma PDF y tamaño mayor a 500 bytes; no se auditaron todas sus páginas |
| Minuta | Vista previa correcta | Vista previa correcta | Título y acuerdo ficticios visibles; no se verificó por separado el botón de exportación de minuta |
| Cerrar sesión | No comprobado por separado | Correcto | Token cerrado rechazado posteriormente |

## Pantallas recorridas con datos

| Pantalla | Resultado | Lo que se comprobó |
|---|---|---|
| Inicio | Correcto con ambos perfiles | Apertura, ejecución sin error JavaScript y captura |
| Juntas | Correcto con ambos perfiles | Consulta de junta sintética |
| Solicitudes y detalle | Correcto con ambos perfiles | Navegación después de crear, editar y cerrar |
| Mapa | Correcto con ambos perfiles | Renderizado y captura de junta sintética; no validación exhaustiva de geocodificación |
| Cargar Excel | Correcto según permisos | Los tres caminos se distinguieron y recorrieron con fixtures |
| Estadísticas | Sin errores JavaScript | Apertura con datos; no se verificó matemáticamente cada indicador |
| Historial | Sin errores JavaScript | Apertura con datos |
| Solicitudes web | Sin errores JavaScript | Pantalla local sin conexión de producción; no prueba del flujo remoto |
| Logs | Sin errores JavaScript | Apertura con ambos perfiles |
| Reportes y generador | Correcto en el alcance descrito | Vista previa y creación de PDF |

## Hallazgos comprobados

| ID | Hallazgo | Evidencia | Impacto y decisión pendiente |
|---|---|---|---|
| H01 | admin no es el usuario admitido en este instalador | HTTP 401 con el usuario del secreto; ADMINISTRADOR permite iniciar sesión con la credencial documentada | Alinear instrucciones y denominación del perfil; no se modificó la autenticación |
| H02 | El cierre manual no registra fechaCierre | Reproducido al pasar una solicitud a Resuelta desde ambos perfiles | Puede afectar indicadores que necesitan fecha de resolución. Definir la regla para cierre y reapertura antes de cambiar código |
| H03 | La detección inicial de ventana fue demasiado temprana y CDP no estuvo disponible | El diagnóstico al finalizar sí encontró el título nativo y seis procesos WebView2 | Arranque gráfico confirmado; la interacción automatizada se realizó en Chromium, no directamente en la ventana nativa |

## Diferencia entre los tres Excel

| Formato | Rol en el sistema | Lo que se verificó |
|---|---|---|
| SGT_MADRE.xlsx | Poblar una instalación nueva | Alta inicial y solicitudes sobre junta existente; requiere administrador |
| SGT_SOLICITUDES_JUNTAS_identificador.xlsx | Trabajo posterior con plantilla emitida por SGT | Generar, completar e importar una solicitud conservando el nombre e identificador |
| SGTE_FORMS.xlsx | Solicitudes vinculadas a juntas existentes | Importación por ambos perfiles y control de duplicado |

Los fixtures fueron creados para la prueba. No se importaron los 35 registros municipales del Excel adjunto. No se concluye que un archivo sin coordenadas vaya a poblar correctamente juntas nuevas: ese caso depende de geocodificación y sigue pendiente.

## Límites y pruebas pendientes

| Pendiente | Motivo |
|---|---|
| Automatización directa dentro de pywebview/WebView2 | Ventana y procesos confirmados; no se logró conectar CDP. Chromium sobre localhost no sustituye todos los detalles de interacción nativa |
| Cloudflare y portales reales | Sincronización desactivada para evitar alterar producción |
| Geocodificar juntas nuevas sin coordenadas | Fixtures con coordenadas conocidas; no se probaron cuotas ni respuestas de Google |
| Crear, editar y eliminar juntas desde todos sus controles visuales | Alta inicial cubierta por importador; no todos los controles de juntas recorridos |
| Importación nativa con juntas nuevas | Se importó una solicitud, no una nueva junta |
| Rechazos y casos límite de Excel | No se probaron todas las combinaciones, 10.000 filas ni el límite de 250 juntas |
| Concurrencia y volumen | No se certifican ausencia de sobrescrituras, rendimiento ni capacidad multiusuario |
| Actualización y desinstalación | No incluidas en esta ejecución |
| Corrección numérica y diseño de todos los PDF/indicadores | Se verificaron generación y muestras visuales, no todas las variantes |

## Lectura arquitectónica para decisiones

| Decisión | Evidencia disponible | Criterio que falta definir |
|---|---|---|
| Responsabilidad de carga inicial | Administrador importa madre; funcionario recibe 403 | Confirmar que esta separación refleja la operación municipal |
| Trabajo diario del funcionario | Puede gestionar solicitudes, importar Forms, adjuntar evidencia y generar reportes | Definir responsabilidades individuales y reglas de eliminación |
| Medición de resolución | Se guarda el estado, pero no fechaCierre en edición manual | Qué fecha representa un cierre y qué ocurre al reabrir |
| Instalación en varios equipos | Persistencia local y sincronización externa separadas | Fuente municipal de verdad y reglas entre equipos |
| Uso de nube | No validado en esta prueba aislada | Entorno remoto de ensayo y cuentas ficticias autorizadas |

El laboratorio queda disponible para revisión. No se implementaron correcciones funcionales: cada mejora futura debe ser indicada por el propietario y mantenerse en su carpeta específica.
