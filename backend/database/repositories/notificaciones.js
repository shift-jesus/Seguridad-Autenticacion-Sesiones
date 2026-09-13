/**
 * database/repositories/notificaciones.js
 * -----------------------------------------------------------------------
 * Notificaciones simples en la app (ej: "verifica tu email").
 * -----------------------------------------------------------------------
 */
const db = require("../db");

function crear(usuarioId, texto) {
  db.prepare("INSERT INTO notificaciones (usuario_id, texto, leida, creado_en) VALUES (?, ?, 0, ?)").run(
    usuarioId,
    texto,
    new Date().toISOString()
  );
}

function listar(usuarioId) {
  return db
    .prepare("SELECT * FROM notificaciones WHERE usuario_id = ? ORDER BY id DESC LIMIT 20")
    .all(usuarioId)
    .map((n) => ({ id: n.id, texto: n.texto, leida: Boolean(n.leida), creadoEn: n.creado_en }));
}

function pendientes(usuarioId) {
  return db.prepare("SELECT COUNT(*) AS n FROM notificaciones WHERE usuario_id = ? AND leida = 0").get(usuarioId).n;
}

function marcarLeida(usuarioId, id) {
  return db.prepare("UPDATE notificaciones SET leida = 1 WHERE id = ? AND usuario_id = ?").run(id, usuarioId).changes > 0;
}

module.exports = { crear, listar, pendientes, marcarLeida };