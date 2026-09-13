/**
 * config/env.js
 * -----------------------------------------------------------------------
 * Centraliza las variables de entorno con valores por defecto seguros.
 * Todo el codigo debe leer la configuracion desde aqui, nunca process.env
 * directamente.
 * -----------------------------------------------------------------------
 */
const path = require("path");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
}

function toPositiveInt(valor, porDefecto) {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: toPositiveInt(process.env.PORT, 3000),
  isProd: process.env.NODE_ENV === "production",

  sessionSecret: process.env.SESSION_SECRET || "dev-secret-cambiar-en-produccion",
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "sid",
  sessionMaxAgeMs: toPositiveInt(process.env.SESSION_MAX_AGE_MS, 30 * 60 * 1000),
  sessionAbsoluteMaxAgeMs: toPositiveInt(
    process.env.SESSION_ABSOLUTE_MAX_AGE_MS,
    12 * 60 * 60 * 1000 // 12 horas: la sesion expira aunque se renueve
  ),

  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5500",
  bcryptSaltRounds: toPositiveInt(process.env.BCRYPT_SALT_ROUNDS, 12),

  // Flujo de verificacion de email / recuperacion (duracion del token)
  tokenTtlMs: toPositiveInt(process.env.TOKEN_TTL_MS, 30 * 60 * 1000),

  // Politica de contrasenas
  passwordMinLength: toPositiveInt(process.env.PASSWORD_MIN_LENGTH, 8),
  passwordMaxLength: toPositiveInt(process.env.PASSWORD_MAX_LENGTH, 128),

  // Cuentas: cantidad de intentos fallidos antes de bloquear
  lockoutMaxIntentos: toPositiveInt(process.env.LOCKOUT_MAX_INTENTOS, 5),
  lockoutVentanaMs: toPositiveInt(process.env.LOCKOUT_VENTANA_MS, 15 * 60 * 1000),
  lockoutPenalizacionMs: toPositiveInt(process.env.LOCKOUT_PENALIZACION_MS, 15 * 60 * 1000),

  // 2FA
  mfaIssuer: process.env.MFA_ISSUER || "DemoAuth",
  mfaBackupCodes: toPositiveInt(process.env.MFA_BACKUP_CODES, 8),

  dbPath: process.env.DB_PATH || path.join(__dirname, "..", "database", "app.db"),

  trustProxy: process.env.TRUST_PROXY === "true",
  csrfCookieName: process.env.CSRF_COOKIE_NAME || "csrfToken",
};

module.exports = env;