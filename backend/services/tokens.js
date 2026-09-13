/**
 * services/tokens.js
 * -----------------------------------------------------------------------
 * Generacion/validacion de tokens de un solo uso (verificar email y
 * reset de contrasena). El hash se guarda en la DB; el token en claro
 * solo viaja al usuario (en la demo se imprime en la consola del server).
 * -----------------------------------------------------------------------
 */
const crypto = require("node:crypto");
const env = require("../config/env");
const tokensRepo = require("../database/repositories/tokens");

function _hash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Crea un token, guarda su hash y devuelve el token en claro. */
function emitirToken(usuarioId, tipo) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiraEn = new Date(Date.now() + env.tokenTtlMs).toISOString();
  tokensRepo.crear(usuarioId, tipo, _hash(token), expiraEn);
  return { token, expiraEn };
}

/**
 * Valida un token: devuelve { valido, usuarioId } o { valido:false }.
 * Los tokens son de un solo uso.
 */
function validarToken(tipo, token) {
  if (!token || typeof token !== "string") return { valido: false };
  const entrada = tokensRepo.encontrarValido(tipo, _hash(token));
  if (!entrada) return { valido: false };
  tokensRepo.marcarUsado(entrada.id);
  return { valido: true, usuarioId: entrada.usuario_id };
}

/** Por simplicidad de la demo: el enlace se muestra en consola. */
function imprimirEnlace(ruta, token, email) {
  // eslint-disable-next-line no-console
  console.log(
    `\n[DEMO-AUTH] ${email}\n  → ${ruta}?token=${token}\n`
  );
}

module.exports = { emitirToken, validarToken, imprimirEnlace, hash: _hash };