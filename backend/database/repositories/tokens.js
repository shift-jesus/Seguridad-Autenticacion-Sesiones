/**
 * database/repositories/tokens.js
 * -----------------------------------------------------------------------
 * Tokens de un solo uso para verificar email y resetear contrasena.
 * Se guarda SOLO el hash del token (nunca el token tal cual).
 * -----------------------------------------------------------------------
 */
const db = require("../db");

function crear(usuarioId, tipo, tokenHash, expiraEn) {
  db.prepare("INSERT INTO tokens (usuario_id, tipo, token_hash, expira_en, creado_en) VALUES (?, ?, ?, ?, ?)").run(
    usuarioId,
    tipo,
    tokenHash,
    expiraEn,
    new Date().toISOString()
  );
}

function encontrarValido(tipo, tokenHash) {
  return (
    db
      .prepare(
        `SELECT * FROM tokens
         WHERE tipo = ? AND token_hash = ? AND usado = 0 AND expira_en > ?`
      )
      .get(tipo, tokenHash, new Date().toISOString()) || null
  );
}

function marcarUsado(id) {
  db.prepare("UPDATE tokens SET usado = 1 WHERE id = ?").run(id);
}

/** Invalida todos los tokens pendientes de un usuario/tipo. */
function invalidar(usuarioId, tipo) {
  db.prepare("UPDATE tokens SET usado = 1 WHERE usuario_id = ? AND tipo = ?").run(usuarioId, tipo);
}

module.exports = { crear, encontrarValido, marcarUsado, invalidar };