"""Prueba el ejecutable instalado; no modifica fuentes ni sincroniza datos reales."""
import hashlib,json,os,pathlib,subprocess,time,urllib.request,urllib.error
from html.parser import HTMLParser
from playwright.sync_api import sync_playwright
out=pathlib.Path('evidencias');out.mkdir(exist_ok=True)
results=[]
def note(name,status,detail=''):
 results.append(dict(prueba=name,estado=status,detalle=detail))
 (out/'resultados.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
 print(name+': '+status,flush=True)
def api(path,body=None,token=None):
 h={'Content-Type':'application/json'}
 if token:h['Authorization']='Bearer '+token
 req=urllib.request.Request('http://127.0.0.1:8765'+path,data=None if body is None else json.dumps(body).encode(),headers=h)
 try:
  with urllib.request.urlopen(req,timeout=5) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,{}
exe=pathlib.Path(os.environ['SGT_INSTALL_DIR'])/'SGT.exe'
if not exe.exists():
 note('Instalación','FAIL','No se encontró SGT.exe');raise SystemExit(1)
note('Instalación','PASS',{'sha256':hashlib.sha256(exe.read_bytes()).hexdigest()})
# El instalador puede copiar configuración de producción: retirarla ANTES del arranque.
data=pathlib.Path(os.environ['LOCALAPPDATA'])/'SGT Municipal'
for p in [data/'cloud_config.json',exe.parent/'cloud_config.json']:
 if p.exists():p.unlink()
note('Aislamiento de nube','PASS','Configuración remota retirada antes del arranque')
proc=subprocess.Popen([str(exe)],cwd=exe.parent)
try:
 ready=False
 for _ in range(60):
  try:
   status,_=api('/api/session')
   if status in (200,401):ready=True;break
  except Exception:pass
  time.sleep(1)
 note('Servidor del ejecutable instalado','PASS' if ready else 'FAIL')
 # Recursos extraídos por PyInstaller en tiempo de ejecución. Solo se exportan metadatos.
 resources=[]
 for mei in pathlib.Path(os.environ['TEMP']).glob('_MEI*'):
  for p in mei.rglob('*'):
   if p.is_file() and p.suffix.lower() in ('.html','.js','.css'):
    resources.append({'archivo':str(p.relative_to(mei)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 (out/'inventario-recursos.json').write_text(json.dumps(resources,indent=2),encoding='utf-8')
 note('Recursos empaquetados','PASS' if resources else 'PENDIENTE',f'{len(resources)} archivos HTML/JS/CSS localizados')
 # Ventana nativa: detectar si realmente se creó, sin confundirlo con abrir Chromium.
 native=False
 try:
  import ctypes
  callback=ctypes.WINFUNCTYPE(ctypes.c_bool,ctypes.c_void_p,ctypes.c_void_p)
  titles=[]
  def visit(hwnd,_):
   if ctypes.windll.user32.IsWindowVisible(hwnd):
    b=ctypes.create_unicode_buffer(512);ctypes.windll.user32.GetWindowTextW(hwnd,b,512);titles.append(b.value)
   return True
  ctypes.windll.user32.EnumWindows(callback(visit),0)
  native=any('SGT Municipal' in t for t in titles)
 except Exception:pass
 note('Ventana nativa WebView','PASS' if native else 'PENDIENTE','Detectada por título de ventana' if native else 'No se confirmó una ventana visible')
 if not ready:raise RuntimeError('Servidor no disponible')
 note('API sin sesión','PASS' if api('/api/db')[0]==401 else 'FAIL')
 credentials=json.loads(os.environ['SGT_TEST_CREDENTIALS'])
 status,session=api('/api/login',credentials)
 note('Acceso administrador','PASS' if status==200 else 'FAIL')
 if status!=200:raise RuntimeError('Acceso no disponible')
 token=session['token']
 status,state=api('/api/db',token=token)
 note('SQLite inicial','PASS' if status==200 else 'FAIL',{'juntas':len(state.get('juntas',{})),'solicitudes':len(state.get('solicitudes',{}))})
 status,_=api('/api/excel-template',token=token)
 note('Generación de Excel','PASS' if status==200 else 'FAIL')
 with sync_playwright() as p:
  browser=p.chromium.launch()
  context=browser.new_context(viewport={'width':1440,'height':1000})
  context.add_init_script('sessionStorage.setItem("sgt_token",'+json.dumps(token)+');sessionStorage.setItem("sgt_user",'+json.dumps(json.dumps(session['user']))+');')
  page=context.new_page();errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  for name in ['inicio','juntas','solicitudes','mapa','cargar-excel','estadisticas','reportes','generador-documentos','historial','entrantes-web']:
   errors.clear()
   try:
    response=page.goto('http://127.0.0.1:8765/pages/'+name+'.html',wait_until='load',timeout=30000)
    page.wait_for_timeout(1000)
    note('Pantalla '+name,'PASS' if response.status==200 and not errors else 'FAIL',{'http':response.status,'errores_js':len(errors)})
    page.screenshot(path=str(out/(name+'.png')),full_page=True)
   except Exception as e:note('Pantalla '+name,'FAIL',type(e).__name__)
  browser.close()
except Exception as e:
 note('Ejecución de pruebas','FAIL',type(e).__name__)
finally:
 subprocess.run(['taskkill','/F','/T','/PID',str(proc.pid)],capture_output=True)
if any(x['estado']=='FAIL' for x in results):raise SystemExit(1)
