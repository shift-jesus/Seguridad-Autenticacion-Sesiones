/**
 * database/repositories/actividad.js
 * -----------------------------------------------------------------------
 * Historial de auditoria por usuario (login, logout, notas, cambios).
 * -----------------------------------------------------------------------
 */
const db = require("../db");

function registrar(usuarioId, accion) {
  db.prepare("INSERT INTO actividad (usuario_id, accion, fecha) VALUES (?, ?, ?)").run(
    usuarioId,
    accion,
    new Date().toISOString()
  );
}

function obtener(usuarioId, { limite = 50, inicio = 0 } = {}) {
  return db
    .prepare("SELECT id, accion, fecha FROM actividad WHERE usuario_id = ? ORDER BY id DESC LIMIT ? OFFSET ?")
    .all(usuarioId, limite, inicio);
}

function contar(usuarioId) {
  return db.prepare("SELECT COUNT(*) AS n FROM actividad WHERE usuario_id = ?").get(usuarioId).n;
}

module.exports = { registrar, obtener, contar };