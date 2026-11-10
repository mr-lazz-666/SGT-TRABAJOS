const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
for(const [pathname,signedIn,expected] of [['/',false,'UNCHANGED'],['/index.html',false,'UNCHANGED'],['/pages/inicio.html',false,'../index.html'],['/pages/inicio.html',true,'UNCHANGED']]){
 let callback;const location={pathname,href:'UNCHANGED'};
 const context={location,document:{addEventListener:(name,cb)=>{callback=cb},querySelectorAll:()=>[],getElementById:()=>null,body:{classList:{toggle:()=>{}}}},sessionStorage:{removeItem:()=>{}},localStorage:{removeItem:()=>{}},Date,usuarioSesion:()=>signedIn?{nombre:'Demo',rol:'administrador'}:null,authHeader:()=>{},XMLHttpRequest:class{open(){}send(){this.status=200}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/assets/js/main.js'),'utf8'),context);callback();assert.equal(location.href,expected);console.log('PASS',pathname,signedIn?'con sesión':'sin sesión');
}
