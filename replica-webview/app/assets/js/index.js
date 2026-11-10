const usuarioInput = document.getElementById('usuarioInput');

function handleLogin(e){
  e.preventDefault();
  const errorEl = document.getElementById('rutError');
  errorEl.classList.remove('show');
  const usuario = usuarioInput.value;
  const password = document.getElementById('passwordInput').value;
  const xhr = new XMLHttpRequest();
  xhr.open('POST','/api/login',false);
  xhr.setRequestHeader('Content-Type','application/json; charset=UTF-8');
  xhr.send(JSON.stringify({usuario,password}));
  if(xhr.status!==200){
    errorEl.textContent='Usuario o contraseña incorrectos.';
    errorEl.classList.add('show');
    return false;
  }
  const r=JSON.parse(xhr.responseText);
  const store=document.getElementById('recordar').checked ? localStorage : sessionStorage;
  localStorage.removeItem('sgt_token'); localStorage.removeItem('sgt_user');
  sessionStorage.removeItem('sgt_token'); sessionStorage.removeItem('sgt_user');
  store.setItem('sgt_token',r.token); store.setItem('sgt_user',JSON.stringify(r.user));
  window.location.href='pages/inicio.html';
  return false;
}
