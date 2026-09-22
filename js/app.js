"use strict";

const CLAVE_USUARIOS = "usuarios";
const CLAVE_SESION = "app_sesion";
const DURACION_SESION = 30 * 60 * 1000;

function leerUsuarios() {
  try { return JSON.parse(localStorage.getItem(CLAVE_USUARIOS)) || []; }
  catch { return []; }
}

function guardarUsuarios(lista) {
  localStorage.setItem(CLAVE_USUARIOS, JSON.stringify(lista));
}

async function hashSHA256(texto) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function hexAleatorio(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2, "0")).join("");
}

const hashClave = (clave, salt) => hashSHA256(salt + ":" + clave);

const nombreValido = (n) => /^[A-Za-zÁÉÍÓÚáéíóúñÑ ]{2,50}$/.test(n);
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const claveValida = (p) => p.length >= 8 && p.length <= 64;

function error(id, mensaje) {
  const caja = document.getElementById(id);
  caja.textContent = mensaje;
  caja.hidden = false;
}

const buscar = (email) =>
  leerUsuarios().find(u => u.email.toLowerCase() === email.toLowerCase());

function iniciarSesion(usuario) {
  sessionStorage.setItem(CLAVE_SESION, JSON.stringify({
    token: hexAleatorio(32),
    email: usuario.email,
    expira: Date.now() + DURACION_SESION,
  }));
}

function sesionActiva() {
  try {
    const sesion = JSON.parse(sessionStorage.getItem(CLAVE_SESION));
    if (!sesion) return null;
    if (Date.now() > sesion.expira) {
      sessionStorage.removeItem(CLAVE_SESION);
      return null;
    }
    return buscar(sesion.email);
  } catch { return null; }
}

function cerrarSesion() {
  sessionStorage.removeItem(CLAVE_SESION);
}

function mostrar(vista) {
  document.getElementById("view-login").hidden = vista !== "login";
  document.getElementById("view-register").hidden = vista !== "register";
  document.getElementById("view-dashboard").hidden = vista !== "dashboard";
  if (vista === "dashboard") {
    document.getElementById("dashboard-welcome").textContent =
      "Bienvenido " + sesionActiva().nombre;
  }
}

function router() {
  const ruta = location.hash.replace("#", "") || "/login";
  if (ruta === "/dashboard") {
    if (sesionActiva()) mostrar("dashboard");
    else location.hash = "#/login";
  } else if (ruta === "/registro") {
    mostrar("register");
  } else {
    location.hash = "#/login";
    mostrar("login");
  }
}
window.addEventListener("hashchange", router);

document.getElementById("form-register").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombre = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const clave = document.getElementById("reg-password").value;

  if (!nombre || !email || !clave) return error("register-error", "Completa todos los campos.");
  if (!nombreValido(nombre)) return error("register-error", "Nombre: solo letras y espacios (2-50).");
  if (!emailValido(email)) return error("register-error", "Email no válido.");
  if (!claveValida(clave)) return error("register-error", "Clave: entre 8 y 64 caracteres.");
  if (buscar(email)) return error("register-error", "Ese email ya está registrado.");

  const salt = hexAleatorio(16);
  const lista = leerUsuarios();
  lista.push({ nombre, email: email.toLowerCase(), salt, hash: await hashClave(clave, salt) });
  guardarUsuarios(lista);

  iniciarSesion(buscar(email));
  location.hash = "#/dashboard";
});

document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("log-email").value.trim();
  const clave = document.getElementById("log-password").value;

  if (!email || !clave) return error("login-error", "Completa todos los campos.");

  const usuario = buscar(email);
  if (!usuario) return error("login-error", "Email o clave incorrectos.");
  if (await hashClave(clave, usuario.salt) !== usuario.hash)
    return error("login-error", "Email o clave incorrectos.");

  iniciarSesion(usuario);
  location.hash = "#/dashboard";
});

document.getElementById("btn-logout").addEventListener("click", () => {
  cerrarSesion();
  location.hash = "#/login";
});

router();