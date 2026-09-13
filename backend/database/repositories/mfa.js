/**
 * database/repositories/mfa.js
 * -----------------------------------------------------------------------
 * Almacen de datos 2FA/TOTP por usuario (secreto + codigos de respaldo
 * hasheados). No guardamos los codigos de respaldo en claro.
 * -----------------------------------------------------------------------
 */
const db = require("../db");

function porUsuario(usuarioId) {
  return db.prepare("SELECT * FROM mfa WHERE usuario_id = ?").get(usuarioId) || null;
}

function guardarSecreto(usuarioId, secreto) {
  db.prepare(
    `INSERT INTO mfa (usuario_id, secreto, backup_codes, activo, creado_en)
     VALUES (?, ?, '[]', 0, ?)
     ON CONFLICT(usuario_id) DO UPDATE SET secreto = excluded.secreto, activo = 0`
  ).run(usuarioId, secreto, new Date().toISOString());
}

function activar(usuarioId, backupHashes) {
  db.prepare("UPDATE mfa SET backup_codes = ?, activo = 1 WHERE usuario_id = ?").run(
    JSON.stringify(backupHashes),
    usuarioId
  );
  return porUsuario(usuarioId);
}

function desactivar(usuarioId) {
  db.prepare("DELETE FROM mfa WHERE usuario_id = ?").run(usuarioId);
}

function backupHashes(usuarioId) {
  const ent = porUsuario(usuarioId);
  if (!ent) return [];
  try {
    return JSON.parse(ent.backup_codes || "[]");
  } catch {
    return [];
  }
}

function marcarCodigoUsado(usuarioId, hash) {
  const restantes = backupHashes(usuarioId).filter((h) => h !== hash);
  db.prepare("UPDATE mfa SET backup_codes = ? WHERE usuario_id = ?").run(
    JSON.stringify(restantes),
    usuarioId
  );
}

module.exports = { porUsuario, guardarSecreto, activar, desactivar, backupHashes, marcarCodigoUsado };