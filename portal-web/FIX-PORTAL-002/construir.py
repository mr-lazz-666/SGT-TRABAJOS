"""Reúne las fuentes editables en el Worker candidato, sin paquetes externos."""
from pathlib import Path
import argparse,base64,json
root=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--worker-base',type=Path,default=root/'base/SERVIDOR_CLOUDFLARE/worker.js');args=parser.parse_args()
src=root/'src'
logo='data:image/png;base64,'+base64.b64encode((src/'compartido/logo-municipal.png').read_bytes()).decode()
header=(src/'compartido/encabezado.html').read_text();footer=(src/'compartido/pie.html').read_text()
paths={'INICIO':'/','VECINOS':'/vecinos','PRESIDENTES':'/presidentes','SEGUIMIENTO':'/seguimiento'}
def render(name):
 css=(src/'compartido/portal.css').read_text()+(src/name/(name+'.css')).read_text()
 js=(src/'compartido/portal.js').read_text()+('\n'+(src/name/(name+'.js')).read_text() if name!='inicio' else '')
 body=header+(src/name/'index.html').read_text()+footer
 for key,value in paths.items():body=body.replace('{{'+key+'}}',value)
 body=body.replace('{{LOGO}}',logo).replace('{{PICKER}}','')
 return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#081727"><title>'+({'inicio':'Portal SGT · Vecinos y Presidentes'}.get(name,name.capitalize()+' | SGT'))+'</title><style>'+css+'</style></head><body>'+body+'<script>'+js+'</script></body></html>'
original=args.worker_base.read_text();lines=original.splitlines(keepends=True)
i=next(i for i,l in enumerate(lines) if l.startswith('const page='));old=lines[i]
screens={title:render(name) for title,name in [('Portal','inicio'),('Vecinos','vecinos'),('Presidentes','presidentes'),('Seguimiento','seguimiento')]}
headers={'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; img-src 'self' data:; script-src 'unsafe-inline' 'self'; style-src 'unsafe-inline' 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"}
lines[i]=old.replace('const page=','const legacyPage=',1)+'const screens='+json.dumps(screens,ensure_ascii=False)+';\nconst page=(title,body)=>screens[title]?new Response(screens[title],{headers:'+json.dumps(headers)+'}):legacyPage(title,body);\n'
result=''.join(lines).replace("if(method==='GET'&&path==='/')return Response.redirect(url.origin+'/vecinos',302);","if(method==='GET'&&path==='/')return page('Portal','');")
target=root/'candidato/SERVIDOR_CLOUDFLARE/worker.js';target.parent.mkdir(parents=True,exist_ok=True);target.write_text(result)
print('Candidato generado:',target)
