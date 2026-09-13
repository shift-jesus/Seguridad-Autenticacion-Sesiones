/**
 * database/repositories/contrasenasHistorial.js
 * -----------------------------------------------------------------------
 * Historial de hashes de contrasena por usuario para impedir reutilizar
 * las ultimas N contrasenas.
 * -----------------------------------------------------------------------
 */
const db = require("../db");

function agregar(usuarioId, passwordHash, max = 5) {
  db.prepare("INSERT INTO contrasenas_historial (usuario_id, hash, creado_en) VALUES (?, ?, ?)").run(
    usuarioId,
    passwordHash,
    new Date().toISOString()
  );
  db.prepare(
    `DELETE FROM contrasenas_historial WHERE usuario_id = ? AND id NOT IN
     (SELECT id FROM contrasenas_historial WHERE usuario_id = ? ORDER BY id DESC LIMIT ?)`
  ).run(usuarioId, usuarioId, max);
}

function listar(usuarioId) {
  return db.prepare("SELECT hash FROM contrasenas_historial WHERE usuario_id = ? ORDER BY id DESC").all(usuarioId);
}

module.exports = { agregar, listar };