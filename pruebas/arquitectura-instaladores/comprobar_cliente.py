"""Comprobar el escritorio Cliente en un Windows temporal con una organización ficticia."""
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import time
import urllib.request

from PyInstaller.archive.readers import CArchiveReader

temp = Path(os.environ["RUNNER_TEMP"])
cliente = temp / "SGT_Instalador_Cliente_CM.exe"
assert hashlib.sha256(cliente.read_bytes()).hexdigest() == "809b8295da48cfa30f6097088b4f3dc2fe1aed3b5a35401e99a2d4d83b3f5822"
archive = CArchiveReader(str(cliente))
key = next(key for key in archive.toc if key.replace("\\", "/").endswith("payload/SGT_Setup.exe"))
setup = temp / "SGT_Setup.exe"
setup.write_bytes(archive.extract(key))
dest = temp / "SGT-instalado"
subprocess.run([str(setup), "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/SP-", f"/DIR={dest}"], check=True, timeout=180)
folder = Path(os.environ["LOCALAPPDATA"]) / "SGT Municipal"
folder.mkdir(exist_ok=True)
profile = folder / "cloud_config.json"
assert not profile.exists(), "Se requiere un equipo de prueba limpio"
profile.write_text(json.dumps({"url": "https://sgt-prueba.invalid", "token": secrets.token_hex(24), "mode": "existing"}), encoding="utf-8")
app = subprocess.Popen([str(dest / "SGT.exe")])
root = "http://127.0.0.1:8765/"
def read(path):
    with urllib.request.urlopen(root + path, timeout=5) as response:
        return response.read().decode("utf-8-sig")
try:
    for attempt in range(90):
        try:
            login = read("index.html")
            break
        except OSError:
            time.sleep(1)
    else:
        raise RuntimeError("SGT.exe no inició el escritorio local")
    assert "usuarioInput" in login and "passwordInput" in login
    screens = {
        "inicio": ["Gestión Territorial"],
        "solicitudes": ["Nueva Solicitud"],
        "solicitud-form": ["Crear Solicitud"],
        "cargar-excel": ["SGTE_FORMS.xlsx", "SGT_MADRE.xlsx", "Previsualización"],
        "juntas": ["Nueva Junta"],
        "mapa": ["Mapa de Juntas de Vecinos"],
        "adjuntar-carpeta": ["Integrar fotos automáticamente"],
        "estadisticas": ["Matriz de riesgo"],
        "reportes": ["Seguimiento de acuerdos", "Informe ejecutivo"],
        "entrantes-web": ["DESARROLLADOR", "Bandeja municipal"],
    }
    for page, markers in screens.items():
        html = read(f"pages/{page}.html")
        for marker in markers:
            assert marker in html, (page, marker)
        print("Verificado en el servidor local del ejecutable:", page)
finally:
    if app.poll() is None:
        subprocess.run(["taskkill", "/PID", str(app.pid), "/T", "/F"], check=False)
