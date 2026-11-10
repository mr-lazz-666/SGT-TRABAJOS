"""Diagnóstico acotado de WebView y persistencia; no publica logs crudos."""
import ctypes,json,os,pathlib,subprocess,time,sqlite3,re

def diagnosticar(data,out,note,exe,proc,api,accounts):
 titles=[]
 callback=ctypes.WINFUNCTYPE(ctypes.c_bool,ctypes.c_void_p,ctypes.c_void_p)
 def visit(hwnd,_):
  if ctypes.windll.user32.IsWindowVisible(hwnd):
   b=ctypes.create_unicode_buffer(512);ctypes.windll.user32.GetWindowTextW(hwnd,b,512)
   if 'SGT' in b.value:titles.append(b.value)
  return True
 ctypes.windll.user32.EnumWindows(callback(visit),0)
 report={'ventanas_sgt':titles,'proceso_codigo':proc.poll(),'logs':[]}
 for p in data.glob('*.log'):
  text=p.read_text(encoding='utf-8',errors='replace')
  # Solo líneas relacionadas con dependencias, sin volcar mensajes completos.
  markers=[x for x in ['WebView2','webview','pythonnet','clr','tkinter','RuntimeError','ImportError','ModuleNotFoundError','EdgeChromium','MSHTML','display','Failed','Error'] if x in text]
  report['logs'].append({'archivo':p.name,'bytes':p.stat().st_size,'marcadores':markers})
  for line in text.splitlines():
   if re.match(r'^(?:RuntimeError|ImportError|ModuleNotFoundError|webview\.errors\.[A-Za-z]+):',line):
    report['logs'][-1].setdefault('errores',[]).append(line[:250])
 report['procesos_webview']=subprocess.run(['tasklist','/FI','IMAGENAME eq msedgewebview2.exe','/FO','CSV'],capture_output=True,text=True).stdout.count('msedgewebview2.exe')
 (out/'diagnostico-nativo.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 note('Diagnóstico ventana nativa','PASS' if titles else 'PENDIENTE',report)
 before={}
 with sqlite3.connect(data/'database.db') as con:
  for table in ['juntas','solicitudes']:before[table]=con.execute('SELECT COUNT(*) FROM '+table).fetchone()[0]
 subprocess.run(['taskkill','/F','/T','/PID',str(proc.pid)],capture_output=True)
 proc=subprocess.Popen([str(exe)],cwd=exe.parent)
 for _ in range(60):
  try:
   if api('/api/session')[0] in (200,401):break
  except Exception:pass
  time.sleep(1)
 code,s=api('/api/login',{'usuario':'ADMINISTRADOR','password':accounts['ADMINISTRADOR']})
 if code==200:
  code,db=api('/api/db',token=s['token'])
  after={'juntas':len(db.get('juntas',{})),'solicitudes':len(db.get('solicitudes',{}))}
  note('Persistencia tras cerrar y reabrir SGT.exe','PASS' if before==after else 'FAIL',{'antes':before,'despues':after})
 else:note('Persistencia tras cerrar y reabrir SGT.exe','FAIL',{'login_http':code})
 subprocess.run(['taskkill','/F','/T','/PID',str(proc.pid)],capture_output=True)
