/**
 * db.js
 * -----------------------------------------------------------------------
 * Base de datos EN MEMORIA solo para fines didacticos.
 * En un proyecto real esto seria PostgreSQL, MySQL, MongoDB, etc.
 *
 * Concepto clave: NUNCA guardamos la contrasena en texto plano.
 * Guardamos un HASH (bcrypt) que es de un solo sentido: no se puede
 * "desencriptar", solo se puede comparar un intento contra el hash.
 * -----------------------------------------------------------------------
 */

/** @type {Map<string, {id: string, email: string, nombre: string, passwordHash: string, rol: string, creadoEn: Date}>} */
const usuarios = new Map();

let autoIncrementId = 1;

function generarId() {
  return String(autoIncrementId++);
}

function crearUsuario({ email, nombre, passwordHash, rol = "usuario" }) {
  const id = generarId();
  const usuario = {
    id,
    email: email.toLowerCase().trim(),
    nombre,
    passwordHash,
    rol, // usado para demostrar AUTORIZACION (ej: "usuario" vs "admin")
    creadoEn: new Date(),
  };
  usuarios.set(usuario.email, usuario);
  return usuario;
}

function buscarPorEmail(email) {
  return usuarios.get(String(email).toLowerCase().trim()) || null;
}

function buscarPorId(id) {
  for (const usuario of usuarios.values()) {
    if (usuario.id === id) return usuario;
  }
  return null;
}

function actualizarPerfil(usuarioId, { nombre }) {
  const usuario = buscarPorId(usuarioId);
  if (!usuario) return null;
  if (nombre && nombre.trim().length >= 2) usuario.nombre = nombre.trim();
  return { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol };
}

function actualizarPasswordHash(usuarioId, passwordHash) {
  const usuario = buscarPorId(usuarioId);
  if (!usuario) return false;
  usuario.passwordHash = passwordHash;
  return true;
}

function listarUsuarios() {
  return Array.from(usuarios.values()).map(({ passwordHash, ...resto }) => resto);
}

/* ------------------------------------------------------------------ */
/* Notas personales — cada usuario tiene sus propias notas             */
/* ------------------------------------------------------------------ */
const notas = new Map(); // Map<usuarioId, Array<{id, texto, creadoEn}>>
let notaAutoId = 1;

function crearNota(usuarioId, texto) {
  if (!notas.has(usuarioId)) notas.set(usuarioId, []);
  const nota = { id: String(notaAutoId++), texto, creadoEn: new Date().toISOString() };
  notas.get(usuarioId).push(nota);
  return nota;
}

function listarNotas(usuarioId) {
  return notas.get(usuarioId) || [];
}

function eliminarNota(usuarioId, notaId) {
  const lista = notas.get(usuarioId);
  if (!lista) return null;
  const idx = lista.findIndex((n) => n.id === String(notaId));
  if (idx === -1) return null;
  const [eliminada] = lista.splice(idx, 1);
  return eliminada;
}

/* ------------------------------------------------------------------ */
/* Historial de actividad (ultimas acciones por usuario)                */
/* ------------------------------------------------------------------ */
const actividad = new Map(); // Map<usuarioId, Array<{accion, fecha}>>

function registrarActividad(usuarioId, accion) {
  if (!actividad.has(usuarioId)) actividad.set(usuarioId, []);
  const entrada = { accion, fecha: new Date().toISOString() };
  actividad.get(usuarioId).unshift(entrada);
  if (actividad.get(usuarioId).length > 20) actividad.get(usuarioId).length = 20;
}

function obtenerActividad(usuarioId) {
  return actividad.get(usuarioId) || [];
}

module.exports = {
  crearUsuario,
  buscarPorEmail,
  buscarPorId,
  actualizarPerfil,
  actualizarPasswordHash,
  listarUsuarios,
  crearNota,
  listarNotas,
  eliminarNota,
  registrarActividad,
  obtenerActividad,
};
