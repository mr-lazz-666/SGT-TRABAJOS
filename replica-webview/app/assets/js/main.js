document.addEventListener('DOMContentLoaded', () => {
  if(location.pathname.split('/').pop() !== 'index.html'){
    let u = (typeof usuarioSesion==='function') ? usuarioSesion() : null;
    if(u){
      try{ const x=new XMLHttpRequest(); x.open('GET','/api/session',false); authHeader(x); x.send(null); if(x.status!==200) u=null; }catch{ u=null; }
    }
    if(!u){ sessionStorage.removeItem('sgt_token'); sessionStorage.removeItem('sgt_user'); localStorage.removeItem('sgt_token'); localStorage.removeItem('sgt_user'); location.href='../index.html'; return; }
    document.querySelectorAll('.sidebar-user .user-name').forEach(el=>el.textContent=u.nombre);
    document.querySelectorAll('.sidebar-user .user-role').forEach(el=>el.textContent=u.rol==='administrador'?'Administrador':'Funcionario');
    document.body.classList.toggle('rol-funcionario', u.rol==='funcionario');
    document.querySelectorAll('[data-admin-only]').forEach(el=>{ if(u.rol!=='administrador') el.style.display='none'; });
  }
  const current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item').forEach(link => {
    if (link.getAttribute('href') === current) link.classList.add('active');
  });

  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const d = new Date();
    dateEl.textContent = `${String(d.getDate()).padStart(2,'0')} ${meses[d.getMonth()]} ${d.getFullYear()}`;
  }
});

// Se usa solo desde index.html (raíz), por eso sube hacia pages/ sin '../'
function handleLogin(e){
  e.preventDefault();
  window.location.href = 'pages/inicio.html';
  return false;
}

// Se usa desde páginas dentro de pages/, por eso necesita '../' para volver a la raíz
function handleLogout(e){
  e.preventDefault();
  try{ const x=new XMLHttpRequest(); x.open('POST','/api/logout',false); authHeader(x); x.setRequestHeader('Content-Type','application/json'); x.send('{}'); }catch{}
  sessionStorage.removeItem('sgt_token'); sessionStorage.removeItem('sgt_user');
  localStorage.removeItem('sgt_token'); localStorage.removeItem('sgt_user');
  window.location.href = '../index.html';
}

// -------- Manejo de solicitudes "eliminadas" (borrado lógico) --------
function marcarComoEliminada(folio, motivo){
  const eliminadas = JSON.parse(localStorage.getItem('sgt_eliminadas') || '{}');
  eliminadas[folio] = {
    fecha: new Date().toLocaleDateString('es-CL'),
    motivo: motivo || 'Sin motivo especificado'
  };
  localStorage.setItem('sgt_eliminadas', JSON.stringify(eliminadas));
}

function estaEliminada(folio){
  const eliminadas = JSON.parse(localStorage.getItem('sgt_eliminadas') || '{}');
  return Object.prototype.hasOwnProperty.call(eliminadas, folio);
}

function restaurarSolicitud(folio){
  const eliminadas = JSON.parse(localStorage.getItem('sgt_eliminadas') || '{}');
  delete eliminadas[folio];
  localStorage.setItem('sgt_eliminadas', JSON.stringify(eliminadas));
}



// Agregar en data.js (o main.js) para que esté disponible en todas las páginas
function pctConfianza(valor){
  const n = Number(valor) || 0;
  // Si viene en escala 1-10 (como tu columna "Confianza(1-10)") lo lleva a %
  // Si ya viene en 0-100, lo deja tal cual (con tope de seguridad)
  return n <= 10 ? Math.round(n * 10) : Math.round(Math.min(n, 100));
}