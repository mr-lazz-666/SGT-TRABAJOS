# Prueba del instalador en Windows

Esta rama es un laboratorio independiente de main. No se fusiona automáticamente.

El flujo instala el instalador original en Windows 2022 y arranca el SGT.exe instalado. No recompila el ZIP. El instalador está cifrado porque puede contener configuración privada; la clave y las credenciales de prueba se guardan en GitHub Secrets.

Antes del primer arranque se elimina la configuración de sincronización de la instalación temporal. No se usan datos municipales reales ni se publica la base de datos. Las capturas y resultados tienen retención de tres días.

`probar.py` verifica instalación, arranque, ventana nativa, inventario de HTML/JS/CSS extraídos por PyInstaller, acceso, SQLite, generación de Excel y diez pantallas. Chromium verifica la interfaz servida por el ejecutable; se informa por separado si se detectó la ventana nativa. Esto no equivale a probar todos los flujos funcionales ni una PC Windows de escritorio.

No se modifican los HTML: primero se verifica el comportamiento original. Cualquier adaptación posterior debe identificarse en el informe.

El workflow se ejecuta cuando se incorpora o actualiza el instalador cifrado en esta rama. Primero deben estar configurados los secretos. Se consulta en Actions. Revisar `resultados.json`, `inventario-recursos.json` y las capturas del artefacto. Los recursos originales no se publican porque pueden contener claves.

## Resultados

Consulta el [informe funcional](INFORME.md). Las evidencias seleccionadas en `evidencias/` usan datos ficticios y permanecen disponibles aunque expire el artefacto de Actions.
