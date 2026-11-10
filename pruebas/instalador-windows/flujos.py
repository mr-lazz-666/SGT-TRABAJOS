"""Recorridos con datos ficticios; no modifica los recursos del ejecutable."""
import copy,json,pathlib,time,base64,zipfile
from playwright.sync_api import sync_playwright
from openpyxl import load_workbook,Workbook

def probar_flujos(api,note,admin,accounts,out,data):
 a=admin['token']
 def check(name,ok,detail=''):note(name,'PASS' if ok else 'FAIL',detail)
 status,func=api('/api/login',{'usuario':'funcionario','password':accounts['FUNCIONARIO']})
 check('Acceso funcionario',status==200,{'http':status})
 if status!=200:return
 f=func['token']
 mother={'filename':'SGT_MADRE.xlsx','solicitudes':[{'fila':2,'junta':'Junta de Vecinos Demostracion Municipal','codigo':'DEM','direccion':'Domicilio ficticio de ensayo','presidente':'Representante Ficticio','lat':-33.5928,'lng':-70.7053,'requerimiento':'Luminaria apagada de ensayo','fecha':'10/11/2026','estado':'Pendiente','prioridad':'Media','categoria':'2. Iluminación y alumbrado público','departamento':'Operaciones'}]}
 status,_=api('/api/excel/madre-import',mother,f);check('Funcionario no importa madre',status==403,status)
 status,r=api('/api/excel/madre-import',mother,a);check('Administrador pobla con madre por API',status==200 and r.get('juntas')==1 and r.get('solicitudes')==1,{'http':status,'juntas':r.get('juntas'),'solicitudes':r.get('solicitudes')})
 status,r=api('/api/excel/madre-import',mother,a);check('Reimportación madre sin duplicados',status==200 and r.get('omitidas')==1)
 _,state=api('/api/db',token=a)
 if not state.get('juntas'):return
 jid=next(iter(state['juntas']));j=state['juntas'][jid]
 changed=copy.deepcopy(state);changed['juntas'][jid]['presidente']='Cambio no autorizado de ensayo'
 check('Funcionario no modifica juntas',api('/api/db',changed,f)[0]==403)
 check('Funcionario no genera plantilla',api('/api/excel-template',token=f)[0]==403)
 forms={'filename':'SGTE_FORMS.xlsx','solicitudes':[{'fila':2,'junta':j['nombre'],'codigo':j['codigo'],'requerimiento':'Solicitud ficticia desde Forms','direccionProblema':'','fecha':'01/01/2025'}]}
 status,r=api('/api/excel/forms-import',forms,f);check('Funcionario importa Forms por API',status==200 and r.get('solicitudes')==1)
 status,r=api('/api/excel/forms-import',forms,f);check('Forms evita duplicado',status==200 and r.get('omitidas')==1)
 # Crear y editar realmente en la pantalla del ejecutable instalado.
 with sync_playwright() as p:
  browser=p.chromium.launch()
  for role,session in [('administrador',admin),('funcionario',func)]:
   context=browser.new_context(viewport={'width':1440,'height':1000})
   context.add_init_script('sessionStorage.setItem("sgt_token",'+json.dumps(session['token'])+');sessionStorage.setItem("sgt_user",'+json.dumps(json.dumps(session['user']))+');')
   page=context.new_page();dialogs=[]
   page.on('dialog',lambda d:(dialogs.append(d.message),d.accept()))
   def goto(name):page.goto('http://127.0.0.1:8765/pages/'+name,wait_until='load',timeout=30000)
   try:
    goto('solicitud-form.html')
    page.locator('#fJunta').select_option(jid)
    page.locator('#fCategoria').select_option(index=1)
    page.locator('#fPrioridad').select_option(label='Media')
    page.locator('#fFecha').fill('10/11/2026')
    req='Solicitud manual ficticia '+role
    page.locator('#fRequerimiento').fill(req)
    page.get_by_role('button',name='Guardar',exact=True).click()
    page.wait_for_timeout(1200)
    _,st=api('/api/db',token=a);found=[(k,v) for k,v in st['solicitudes'].items() if v.get('requerimiento')==req]
    check('Creación manual por interfaz '+role,bool(found),{'ruta':page.url.split('/')[-1]})
    if found:
     folio=found[0][0]
     page.screenshot(path=str(out/(role+'-detalle.png')),full_page=True)
     goto('solicitud-form.html?folio='+folio)
     page.locator('#fEstado').select_option(label='En proceso')
     page.locator('#fGestion').fill('Gestión ficticia de seguimiento')
     page.get_by_role('button',name='Guardar',exact=True).click();page.wait_for_timeout(700)
     _,st=api('/api/db',token=a);check('Edición a En proceso '+role,st['solicitudes'][folio].get('estado')=='En proceso')
     goto('solicitud-form.html?folio='+folio);page.locator('#fEstado').select_option(label='Resuelta');page.get_by_role('button',name='Guardar',exact=True).click();page.wait_for_timeout(700)
     _,st=api('/api/db',token=a);sol=st['solicitudes'][folio]
     check('Cierre manual '+role,sol.get('estado')=='Resuelta')
     note('Fecha de cierre '+role,'PASS' if sol.get('fechaCierre') else 'HALLAZGO','Presente' if sol.get('fechaCierre') else 'El cierre manual no dejó fechaCierre')
     goto('solicitud-form.html?folio='+folio);page.locator('#btnEliminar').click();page.wait_for_timeout(700)
     _,st=api('/api/db',token=a);check('Eliminación lógica '+role,bool(st['solicitudes'][folio].get('eliminada')))
   except Exception as e:note('Recorrido manual '+role,'FAIL',type(e).__name__)
   # Recorrido de apertura con datos por cada perfil.
   for name in ['inicio','juntas','solicitudes','mapa','cargar-excel','estadisticas','historial','entrantes-web','logs']:
    errors=[]
    def on_error(e):errors.append(str(e))
    page.on('pageerror',on_error)
    try:
     goto(name+'.html');page.wait_for_timeout(500)
     check('Pantalla con datos '+role+' '+name,not errors,{'errores_js':len(errors)})
     if name in ['inicio','mapa','estadisticas']:page.screenshot(path=str(out/(role+'-'+name+'.png')),full_page=True)
    except Exception as e:note('Pantalla con datos '+role+' '+name,'FAIL',type(e).__name__)
    page.remove_listener('pageerror',on_error)
   # UI real del archivo dinámico: generar, completar y reimportar.
   if role=='administrador':
    try:
     goto('cargar-excel.html');page.locator('#btnPlantillaSGT').click();page.wait_for_timeout(800)
     generated=max((data/'excel_temporales').glob('*.xlsx'),key=lambda p:p.stat().st_mtime)
     # El nombre original se obtiene de SQLite, sin exportar la BD.
     import sqlite3
     with sqlite3.connect(data/'database.db') as con:filename=con.execute('SELECT nombre FROM excel_plantillas ORDER BY fecha DESC,rowid DESC LIMIT 1').fetchone()[0]
     wb=load_workbook(generated);sheet=wb['Nueva solicitud'];sheet['B25']=j['nombre'];sheet['C25']='Solicitud ficticia planilla dinamica'
     target=pathlib.Path(filename);wb.save(target)
     page.locator('#excelInput').set_input_files(str(target))
     page.wait_for_function('!document.getElementById("btnImportarSGT").disabled',timeout=45000)
     page.locator('#btnImportarSGT').click();page.wait_for_timeout(1500)
     _,st=api('/api/db',token=a)
     check('Ciclo dinámico generar-completar-importar por UI',any(s.get('requerimiento')=='Solicitud ficticia planilla dinamica' for s in st['solicitudes'].values()))
     page.screenshot(path=str(out/'admin-importacion-dinamica.png'),full_page=True)
    except Exception as e:note('Ciclo dinámico por UI','FAIL',type(e).__name__)
   context.close()
  browser.close()
 # Comprobar contenido generado de PDF mediante API; no afirma validación del generador visual.
 pdf=b'%PDF-1.4\n%%EOF\n'
 status,_=api('/api/export-pdf',{'filename':'ensayo.pdf','base64':base64.b64encode(pdf).decode()},f)
 check('Permiso de descarga PDF funcionario',status==200,status)
 check('Funcionario cierra sesión',api('/api/logout',{},f)[0]==200)
 check('Token cerrado ya no accede',api('/api/db',token=f)[0]==401)
