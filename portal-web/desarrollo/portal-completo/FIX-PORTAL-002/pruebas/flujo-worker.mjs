import {readFile,mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),temp=await mkdtemp(join(tmpdir(),'sgt-fix002-')),database=join(temp,'test.db'),bridge=join(root,'pruebas/sqlite_bridge.py');
function execute(queries,schema){let r=spawnSync(process.env.PYTHON||'python',[bridge],{input:JSON.stringify({database,queries,schema}),encoding:'utf8'});if(r.status!==0)throw Error('SQLite adapter failed: '+r.stderr);return JSON.parse(r.stdout);}
class Query{constructor(sql,params=[]){this.sql=sql;this.params=params;}bind(...params){return new Query(this.sql,params);}async all(){return execute([this])[0];}async first(){return(await this.all()).results[0]||null;}async run(){return(await this.all());}}
execute([],await readFile(join(root,'pruebas/schema-referencia.sql'),'utf8'));
const env={SGT_SYNC_TOKEN:randomUUID(),DB:{prepare:sql=>new Query(sql),batch:async qs=>execute(qs)}};
const source=await readFile(join(root,'candidato/SERVIDOR_CLOUDFLARE/worker.js'),'utf8'),worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const call=async(path,body,token)=>{let headers={};if(token)headers.authorization='Bearer '+token;if(body)headers['content-type']='application/json';const r=await worker.fetch(new Request('https://ensayo.invalid'+path,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{})}),env);return{status:r.status,body:await r.json()};};
try{
 let r=await call('/api/sync/juntas',{juntas:[{id:'j_ensayo',nombre:'Junta de ensayo'}],reemplazar:true},env.SGT_SYNC_TOKEN);assert.equal(r.status,200);
 const password=randomUUID()+randomUUID();r=await call('/api/sync/presidentes',{id:'p_ensayo',junta_id:'j_ensayo',usuario:'Presidente de ensayo',password},env.SGT_SYNC_TOKEN);assert.equal(r.status,200);
 r=await call('/api/solicitudes',{junta_id:'j_ensayo',nombre:'Persona ficticia',direccion:'Domicilio ficticio',contacto:'Contacto ficticio',requerimiento:'Requerimiento ficticio'});assert.equal(r.status,201);const codigo=r.body.codigo;
 assert.equal((await call('/api/seguimiento/'+codigo)).body.estado,'pendiente_presidente');
 r=await call('/api/presidente/login',{usuario:'Presidente de ensayo',password});assert.equal(r.status,200);const token=r.body.token;
 assert.equal((await call('/api/presidente/solicitudes',null,token)).body.solicitudes.length,1);
 assert.equal((await call('/api/presidente/decision',{codigo,estado:'aceptada_presidente'},token)).status,200);
 assert.equal((await call('/api/sync/entrantes',null,env.SGT_SYNC_TOKEN)).body.solicitudes.length,1);
 assert.equal((await call('/api/sync/recibida',{codigo},env.SGT_SYNC_TOKEN)).body.estado,'en_revision_municipal');
 for(const estado of ['incorporada_sgt','en_gestion','resuelta'])assert.equal((await call('/api/sync/estado',{codigo,estado,folio_sgt:'WEB-ENSAYO'},env.SGT_SYNC_TOKEN)).status,200);
 r=await call('/api/seguimiento/'+codigo);assert.equal(r.body.estado,'resuelta');assert.equal(r.body.eventos.length,6);
 assert.equal((await call('/api/presidente/decision',{codigo,estado:'rechazada_presidente'},token)).status,409);
 console.log('PASS: envío, seguimiento, login, revisión presidencial, descarga municipal, recepción, incorporación, gestión y resolución sobre SQLite local. No se contactó producción.');
}finally{await rm(temp,{recursive:true,force:true});}
