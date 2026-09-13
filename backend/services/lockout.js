/**
 * services/lockout.js
 * -----------------------------------------------------------------------
 * Bloqueo de cuentas ante fuerza bruta.
 *
 * A diferencia de un rate-limit por IP (que un atacante puede sortear
 * rotando IPs), aqui tambien se cuenta por CUENTA. Tras N intentos
 * fallidos la cuenta queda bloqueada durante una penalizacion.
 * -----------------------------------------------------------------------
 */
const env = require("../config/env");

/** key -> { fallos: number, primerFallo: Date, bloqueadoHasta: Date|null } */
const intentos = new Map();

function _clave(ip, email) {
  return `${String(ip || "?").toLowerCase()}|${String(email || "").trim().toLowerCase()}`;
}

function _limpiarExpirados() {
  const ahora = Date.now();
  for (const [k, v] of intentos) {
    if (v.bloqueadoHasta && v.bloqueadoHasta.getTime() < ahora && ahora - v.primerFallo.getTime() > env.lockoutVentanaMs) {
      intentos.delete(k);
    } else if (!v.bloqueadoHasta && ahora - v.primerFallo.getTime() > env.lockoutVentanaMs) {
      intentos.delete(k);
    }
  }
}

/** Registra un fracaso; devuelve true si la cuenta quedo bloqueada. */
function registrarFallido(ip, email) {
  _limpiarExpirados();
  const clave = _clave(ip, email);
  const actual = intentos.get(clave) || { fallos: 0, primerFallo: new Date(), bloqueadoHasta: null };
  actual.fallos += 1;
  if (!actual.primerFallo) actual.primerFallo = new Date();
  if (actual.fallos >= env.lockoutMaxIntentos) {
    actual.bloqueadoHasta = new Date(Date.now() + env.lockoutPenalizacionMs);
  }
  intentos.set(clave, actual);
  return Boolean(actual.bloqueadoHasta);
}

/** Devuelve el estado actual (para poder devolver mensaje generico). */
function estado(ip, email) {
  _limpiarExpirados();
  const clave = _clave(ip, email);
  const actual = intentos.get(clave);
  if (!actual) return { bloqueado: false, restantes: env.lockoutMaxIntentos };
  if (actual.bloqueadoHasta && actual.bloqueadoHasta.getTime() > Date.now()) {
    return { bloqueado: true, hasta: actual.bloqueadoHasta };
  }
  return { bloqueado: false, restantes: Math.max(0, env.lockoutMaxIntentos - actual.fallos) };
}

/** Limpia tras un login correcto o cambio de contrasena. */
function limpiar(ip, email) {
  intentos.delete(_clave(ip, email));
}

module.exports = { registrarFallido, estado, limpiar };