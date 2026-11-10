@echo off
setlocal EnableExtensions
rem Lanzador opcional. No instala, publica ni modifica datos.
set "SGT_PORTAL_URL=https://sgt-portales.alvaroeyzaguirre3.workers.dev"
echo Abriendo la portada del portal SGT...
powershell -NoProfile -Command "Start-Process $env:SGT_PORTAL_URL"
if errorlevel 1 (
 echo No se pudo abrir el navegador. Abra manualmente la URL del portal.
 pause
 exit /b 1
)
exit /b 0
