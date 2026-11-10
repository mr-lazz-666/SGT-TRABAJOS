/* Portal de demostración: todos los envíos se quedan en este navegador. */
(()=>{'use strict';
const KEY='sgt_replica_portal_v1',baseFetch=window.fetch.bind(window);
const now=()=>new Date().toISOString(),clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
function juntas(){try{const db=JSON.parse(localStorage.getItem('sgt_replica_db_v1')||'null');if(db?.juntas)return Object.values(db.juntas).map(j=>({id:j.id,nombre:j.nombre}));}catch{}return[{id:'j_demo_0',nombre:'Junta de Vecinos Demostración Centro'},{id:'j_demo_1',nombre:'Junta de Vecinos Demostración Norte'},{id:'j_demo_2',nombre:'Junta de Vecinos Demostración Sur'}];}
function load(){try{return JSON.parse(localStorage.getItem(KEY))||{solicitudes:[],eventos:[]};}catch{return{solicitudes:[],eventos:[]};}}
const save=s=>localStorage.setItem(KEY,JSON.stringify(s));
function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
function fail(error,status=400){return response({error},status);}
function event(db,codigo,estado,actor){db.eventos.push({codigo,estado,actor,fecha:now()});}
function route(url,options={}){let path=url.pathname,method=options.method||'GET',body;try{body=JSON.parse(options.body||'{}');}catch{return fail('JSON inválido');}
let db=load();
if(method==='GET'&&path==='/api/juntas')return response({juntas:juntas()});
if(method==='POST'&&path==='/api/solicitudes'){
 let item={junta_id:clean(body.junta_id,80),nombre:clean(body.nombre,120),direccion:clean(body.direccion,240),contacto:clean(body.contacto,120),requerimiento:clean(body.requerimiento,2500)};
 if(Object.values(item).some(v=>!v))return fail('Completa todos los campos');if(!juntas().some(j=>j.id===item.junta_id))return fail('Junta no válida');
 let codigo='SGT-'+crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase()+'-'+crypto.randomUUID().replaceAll('-','').slice(0,4).toUpperCase();
 item={...item,codigo,estado:'pendiente_presidente',creada:now(),actualizada:now()};db.solicitudes.push(item);event(db,codigo,item.estado,'vecino');save(db);return response({codigo,estado:item.estado},201);
}
if(method==='GET'&&path.startsWith('/api/seguimiento/')){
 const codigo=decodeURIComponent(path.split('/').pop()).toUpperCase();if(!/^SGT-[A-F0-9]{8}-[A-F0-9]{4}$/.test(codigo))return fail('Código no válido',404);
 const s=db.solicitudes.find(s=>s.codigo===codigo);if(!s)return fail('Solicitud no encontrada',404);return response({codigo:s.codigo,estado:s.estado,actualizada:s.actualizada,eventos:db.eventos.filter(e=>e.codigo===codigo).map(e=>({estado:e.estado,fecha:e.fecha}))});
}
if(method==='POST'&&path==='/api/presidente/login'){
 const u=clean(body.usuario,120).toLowerCase(),i=u==='presidente'?0:parseInt(u.replace(/^presidente/,''),10)-1,items=juntas();
 if(!/^presidente(?:[1-9][0-9]*)?$/.test(u)||!items[i]||body.password!=='SGTdemo2026')return fail('Credenciales incorrectas',401);
 const token='demo_presidente_'+crypto.randomUUID();sessionStorage.setItem('sgt_replica_presidente_'+token,JSON.stringify({junta_id:items[i].id}));return response({token});
}
if(path.startsWith('/api/presidente/')){
 const h=new Headers(options.headers||{}),token=(h.get('authorization')||'').replace(/^Bearer /i,'');let p;try{p=JSON.parse(sessionStorage.getItem('sgt_replica_presidente_'+token)||'null');}catch{}
 if(!p)return fail('No autorizado',401);
 if(method==='GET'&&path==='/api/presidente/solicitudes')return response({solicitudes:db.solicitudes.filter(s=>s.junta_id===p.junta_id).slice(-150).reverse()});
 if(method==='POST'&&path==='/api/presidente/decision'){
  if(!['aceptada_presidente','rechazada_presidente'].includes(body.estado))return fail('Estado no válido');const s=db.solicitudes.find(s=>s.codigo===body.codigo&&s.junta_id===p.junta_id&&s.estado==='pendiente_presidente');if(!s)return fail('Solicitud no encontrada o ya revisada',409);
  s.estado=body.estado;s.actualizada=now();event(db,s.codigo,s.estado,'presidente de demostración');save(db);return response({ok:true});
 }
}
return fail('Ruta no disponible en el portal de demostración',404);
}
window.fetch=async(input,options={})=>{const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin===location.origin&&url.pathname.startsWith('/api/')){try{return route(url,options);}catch{return fail('No se pudo guardar en este navegador',500);}}return baseFetch(input,options);};
})();
