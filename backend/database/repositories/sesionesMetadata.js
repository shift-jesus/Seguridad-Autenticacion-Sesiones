/**
 * database/repositories/sesionesMetadata.js
 * -----------------------------------------------------------------------
 * Metadatos de las sesiones activas por usuario, para poder:
 *   - Listar "mis dispositivos"
 *   - Revocar una sesion concreta
 *   - Cerrar sesion en todos los dispositivos
 * -----------------------------------------------------------------------
 */
const db = require("../db");

function registrar(sid, usuarioId, { ip, userAgent } = {}) {
  const ahora = new Date().toISOString();
  db.prepare(
    `INSERT OR REPLACE INTO sesiones_metadata (sid, usuario_id, ip, user_agent, creada_en, ultimo_acceso)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(sid, usuarioId, ip || null, userAgent || null, ahora, ahora);
}

function tocar(sid, usuarioId) {
  db.prepare("UPDATE sesiones_metadata SET ultimo_acceso = ? WHERE sid = ? AND usuario_id = ?").run(
    new Date().toISOString(),
    sid,
    usuarioId
  );
}

function listar(usuarioId) {
  return db.prepare("SELECT * FROM sesiones_metadata WHERE usuario_id = ? ORDER BY creada_en DESC").all(usuarioId);
}

function buscar(usuarioId, sid) {
  return db.prepare("SELECT * FROM sesiones_metadata WHERE sid = ? AND usuario_id = ?").get(sid, usuarioId) || null;
}

function eliminar(usuarioId, sid) {
  return db.prepare("DELETE FROM sesiones_metadata WHERE sid = ? AND usuario_id = ?").run(sid, usuarioId).changes > 0;
}

function eliminarTodasExcepto(usuarioId, sidActual) {
  return db.prepare("DELETE FROM sesiones_metadata WHERE usuario_id = ? AND sid != ?").run(usuarioId, sidActual).changes;
}

function eliminarTodas(usuarioId) {
  return db.prepare("DELETE FROM sesiones_metadata WHERE usuario_id = ?").run(usuarioId).changes;
}

module.exports = { registrar, tocar, listar, buscar, eliminar, eliminarTodasExcepto, eliminarTodas };