/**
 * routes/auth.js
 * -----------------------------------------------------------------------
 * Endpoints de autenticacion y manejo de sesion.
 *
 *   POST /api/auth/registro            -> crea un usuario y token de verificacion
 *   GET  /api/auth/verificar/:token    -> confirma el email
 *   POST /api/auth/login               -> valida credenciales (+ 2FA pendiente)
 *   POST /api/auth/verificar-2fa       -> completa login con codigo TOTP/backup
 *   POST /api/auth/logout              -> destruye la sesion
 *   GET  /api/auth/me                  -> devuelve el usuario de la sesion activa
 *   PUT  /api/auth/perfil              -> actualiza el nombre
 *   PUT  /api/auth/cambiar-password    -> cambia la contrasena
 *   POST /api/auth/recuperar           -> solicita reset de contrasena (token en consola)
 *   POST /api/auth/recuperar-reset     -> aplica el reset con el token
 * -----------------------------------------------------------------------
 */
const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const speakeasy = require("speakeasy");
const { validationResult } = require("express-validator");

const env = require("../config/env");
const asyncHandler = require("../middleware/asyncHandler");
const { HttpError, manejarValidaciones } = require("../middleware/errores");
const { requireAuth } = require("../middleware/auth");
const { checkPassword, validarEmail, validarNombre, validarPasswordLogin, validarPasswordNueva } = require("../services/validadores");
const lockout = require("../services/lockout");
const { emitirToken, validarToken, imprimirEnlace } = require("../services/tokens");

const usuariosRepo = require("../database/repositories/usuarios");
const actividadRepo = require("../database/repositories/actividad");
const mfaRepo = require("../database/repositories/mfa");
const sesionesMetadata = require("../database/repositories/sesionesMetadata");
const historialRepo = require("../database/repositories/contrasenasHistorial");
const notifRepo = require("../database/repositories/notificaciones");
const store = require("../database/sessionStore");

const router = express.Router();

/* ----------------------------- rate limiters ------------------------ */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos", mensaje: "Has intentado iniciar sesion demasiadas veces. Espera unos minutos." },
});

const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados registros", mensaje: "Se alcanzo el limite de cuentas por IP. Intenta mas tarde." },
});

const recuperarLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones", mensaje: "Intenta mas tarde." },
});

/* ----------------------------- helpers ------------------------------ */
function ipDe(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || null;
}

function registroActividadYRiesgo(req, mensaje) {
  if (req.session?.usuarioId) actividadRepo.registrar(req.session.usuarioId, mensaje);
}

/** Establece la sesion completa (find login tras 2FA por regeneracion). */
function establecerSesion(req, res, usuario) {
  req.session.regenerate((err) => {
    if (err) throw err;
    req.session.usuarioId = usuario.id;
    req.session.rol = usuario.rol;
    req.session.creadaEn = new Date().toISOString();
    req.session.ultimoAcceso = new Date().toISOString();
    sesionesMetadata.registrar(req.sessionID, usuario.id, {
      ip: ipDe(req),
      userAgent: (req.headers["user-agent"] || "").slice(0, 400),
    });
    return res.json({
      mensaje: "Sesion iniciada correctamente",
      usuario: usuariosRepo.aPublico(usuario),
      mfaActivo: Boolean(mfaRepo.porUsuario(usuario.id)?.activo),
    });
  });
}

/* ----------------------------- REGISTRO ----------------------------- */
router.post(
  "/registro",
  registroLimiter,
  validarEmail,
  validarNombre,
  validarPasswordNueva("password"),
  asyncHandler(async (req, res) => {
    const httpErr = manejarValidaciones(req);
    if (httpErr) throw httpErr;

    const { email, nombre, password } = req.body;
    if (usuariosRepo.buscarPorEmail(email)) {
      // Respuesta generica: evita enumeracion de usuarios.
      throw new HttpError(409, "No fue posible registrar ese usuario");
    }

    const passwordHash = await bcrypt.hash(password, env.bcryptSaltRounds);
    const usuario = usuariosRepo.crear({ email, nombre, passwordHash });

    historialRepo.agregar(usuario.id, passwordHash);
    actividadRepo.registrar(usuario.id, "Se registro");

    // Verificacion de email con token simulado (consola del server).
    const { token } = emitirToken(usuario.id, "verificar_email");
    imprimirEnlace("/verificar.html", token, usuario.email);
    notifRepo.crear(usuario.id, "Bienvenido! Verifica tu email desde la consola del servidor.");

    const csrfToken = req.cookies?.[env.csrfCookieName];
    return res.status(201).json({
      mensaje: "Usuario registrado. Revisa la consola del servidor para el enlace de verificacion.",
      usuario: usuariosRepo.aPublico(usuario),
      csrfToken,
    });
  })
);

/* ---------------------- VERIFICAR EMAIL ----------------------------- */
router.get(
  "/verificar/:token",
  asyncHandler(async (req, res) => {
    const { valido, usuarioId } = validarToken("verificar_email", req.params.token);
    if (!valido) throw new HttpError(400, "Token invalido o expirado");
    usuariosRepo.setEmailVerificado(usuarioId, true);
    actividadRepo.registrar(usuarioId, "Verifico su email");
    notifRepo.crear(usuarioId, "Email verificado correctamente.");
    return res.json({ mensaje: "Email verificado correctamente." });
  })
);

/* ------------------------------ LOGIN ------------------------------- */
router.post(
  "/login",
  loginLimiter,
  validarEmail,
  validarPasswordLogin,
  asyncHandler(async (req, res) => {
    const httpErr = manejarValidaciones(req);
    if (httpErr) throw httpErr;

    const { email, password } = req.body;

    // Bloqueo de cuenta por fuerza bruta.
    const estadoBloqueo = lockout.estado(ipDe(req), email);
    if (estadoBloqueo.bloqueado) {
      throw new HttpError(429, "Cuenta bloqueada temporalmente", "Demasiados intentos fallidos. Espera unos minutos.");
    }

    const usuario = usuariosRepo.buscarPorEmail(email);
    const credencialesInvalidas = () => new HttpError(401, "Email o contrasena incorrectos");

    if (!usuario) {
      // Aun registro el fallo (mismo mensaje generico para ambos casos).
      lockout.registrarFallido(ipDe(req), email);
      throw credencialesInvalidas();
    }

    const passwordCorrecto = await bcrypt.compare(password || "", usuario.password_hash);
    if (!passwordCorrecto) {
      lockout.registrarFallido(ipDe(req), email);
      // Esfuerzo simulado: comparacion contra un hash dummy cuando el email
      // no existe iguala tiempos (evita timing-attacks por usuario).
      throw credencialesInvalidas();
    }

    if (!usuario.activo) {
      throw new HttpError(403, "Cuenta desactivada", "Esta cuenta fue desactivada. Contacta al administrador.");
    }

    lockout.limpiar(ipDe(req), email);
    actividadRepo.registrar(usuario.id, "Inicio de sesion");

    // 2FA activado: solo guardamos "pendiente" en la sesion hasta validar.
    const mfaActivo = Boolean(mfaRepo.porUsuario(usuario.id)?.activo);
    if (mfaActivo) {
      req.session.pendienteMFA = usuario.id;
      return res.json({ requiere2FA: true, mensaje: "Ingresa tu codigo de autenticacion." });
    }

    return establecerSesion(req, res, usuario);
  })
);

/* ---------------------- VERIFICAR 2FA ------------------------------- */
router.post(
  "/verificar-2fa",
  asyncHandler(async (req, res) => {
    const us = usuariosRepo.buscarPorId(req.session?.pendienteMFA);
    if (!us) throw new HttpError(401, "Debes iniciar sesion primero");

    const { codigo, backup } = req.body;
    const mfa = mfaRepo.porUsuario(us.id);
    if (!mfa?.activo) throw new HttpError(400, "El 2FA no esta activado");

    let correcto = false;
    if (backup) {
      const hash = require("node:crypto").createHash("sha256").update(String(backup).trim()).digest("hex");
      correcto = mfaRepo.backupHashes(us.id).some((h) => h === hash);
      if (correcto) mfaRepo.marcarCodigoUsado(us.id, hash);
    } else {
      correcto = speakeasy.totp.verify({
        secret: mfa.secreto,
        encoding: "base32",
        token: String(codigo || "").trim(),
        window: 1,
      });
    }

    if (!correcto) throw new HttpError(401, "Codigo incorrecto");

    delete req.session.pendienteMFA;
    actividadRepo.registrar(us.id, `Verifico 2FA (${backup ? "codigo de respaldo" : "TOTP"})`);
    return establecerSesion(req, res, us);
  })
);

/* ------------------------------ LOGOUT ------------------------------ */
router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    actividadRepo.registrar(req.session.usuarioId, "Cierre de sesion");
    const sid = req.sessionID;
    const usuarioId = req.session.usuarioId;
    await new Promise((resolve) => req.session.destroy(resolve));
    sesionesMetadata.eliminar(usuarioId, sid);
    res.clearCookie(env.sessionCookieName);
    return res.json({ mensaje: "Sesion cerrada correctamente" });
  })
);

/* ------------------------- SESION ACTUAL ---------------------------- */
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const us = usuariosRepo.buscarPorId(req.session.usuarioId);
    if (!us) throw new HttpError(401, "Sesion invalida");
    return res.json({
      usuario: usuariosRepo.aPublico(us),
      sesion: {
        creadaEn: req.session.creadaEn,
        expiraEn: req.session.cookie.expires,
        ultimoAcceso: req.session.ultimoAcceso,
      },
      mfaActivo: Boolean(mfaRepo.porUsuario(us.id)?.activo),
      notificacionesPendientes: notifRepo.pendientes(us.id),
    });
  })
);

/* ----------------------- ACTUALIZAR PERFIL -------------------------- */
router.put(
  "/perfil",
  requireAuth,
  validarNombre,
  asyncHandler(async (req, res) => {
    const httpErr = manejarValidaciones(req);
    if (httpErr) throw httpErr;

    const usuario = usuariosRepo.actualizarPerfil(req.session.usuarioId, { nombre: req.body.nombre });
    if (!usuario) throw new HttpError(401, "Sesion invalida");
    actividadRepo.registrar(usuario.id, "Actualizo su perfil");
    return res.json({ mensaje: "Perfil actualizado correctamente", usuario });
  })
);

/* ---------------------- CAMBIAR CONTRASENA -------------------------- */
router.put(
  "/cambiar-password",
  requireAuth,
  validarPasswordNueva("passwordNueva").bail(),
  asyncHandler(async (req, res) => {
    const httpErr = manejarValidaciones(req);
    if (httpErr) throw httpErr;

    const { passwordActual, passwordNueva } = req.body;
    const usuario = usuariosRepo.buscarPorId(req.session.usuarioId);
    if (!usuario) throw new HttpError(401, "Sesion invalida");

    const coincide = await bcrypt.compare(passwordActual || "", usuario.password_hash);
    if (!coincide) throw new HttpError(400, "La contrasena actual es incorrecta");

    // No reutilizar una contrasena reciente.
    const historial = historialRepo.listar(usuario.id);
    for (const h of historial) {
      if (await bcrypt.compare(passwordNueva, h.hash)) {
        throw new HttpError(400, "La contrasena ya fue usada antes. Elige otra diferente.");
      }
    }

    const nuevoHash = await bcrypt.hash(passwordNueva, env.bcryptSaltRounds);
    usuariosRepo.setPasswordHash(usuario.id, nuevoHash);
    historialRepo.agregar(usuario.id, nuevoHash);
    actividadRepo.registrar(usuario.id, "Cambio de contrasena");

    // Buena practica: invalidar TODAS las sesiones salvo esta, y luego esta.
    const sidActual = req.sessionID;
    const todas = await new Promise((resolve, reject) => store.all((e, list) => (e ? reject(e) : resolve(list))));
    await Promise.all(
      todas
        .filter((s) => s.sid !== sidActual && s.sess?.usuarioId === usuario.id)
        .map((s) => new Promise((resolve) => store.destroy(s.sid, resolve)))
    );
    await new Promise((resolve) => req.session.destroy(resolve));
    res.clearCookie(env.sessionCookieName);
    return res.json({ mensaje: "Contrasena actualizada. Todas tus otras sesiones fueron cerradas. Vuelve a iniciar sesion." });
  })
);

/* --------------------------- RECUPERAR ------------------------------ */
router.post(
  "/recuperar",
  recuperarLimiter,
  validarEmail,
  asyncHandler(async (req, res) => {
    manejarValidaciones(req);
    const { email } = req.body;
    const usuario = usuariosRepo.buscarPorEmail(email);
    if (usuario) {
      const { token } = emitirToken(usuario.id, "reset_password");
      imprimirEnlace("/recuperar.html", token, usuario.email);
      actividadRepo.registrar(usuario.id, "Solicito reset de contrasena");
    }
    // Respuesta identica exista o no el email (anti-enumeracion).
    return res.json({ mensaje: "Si el email existe, recibiras un enlace para restablecer la contrasena (revisa la consola del servidor)." });
  })
);

router.post(
  "/recuperar-reset",
  recuperarLimiter,
  validarPasswordNueva("password"),
  asyncHandler(async (req, res) => {
    const httpErr = manejarValidaciones(req);
    if (httpErr) throw httpErr;

    const { token, password } = req.body;
    const { valido, usuarioId } = validarToken("reset_password", token);
    if (!valido) throw new HttpError(400, "Token invalido o expirado");

    const usuario = usuariosRepo.buscarPorId(usuarioId);
    if (!usuario) throw new HttpError(404, "Usuario no encontrado");

    const nuevoHash = await bcrypt.hash(password, env.bcryptSaltRounds);
    usuariosRepo.setPasswordHash(usuario.id, nuevoHash);
    historialRepo.agregar(usuario.id, nuevoHash);
    actividadRepo.registrar(usuario.id, "Restablecio su contrasena (recuperacion)");

    // Cerrar todas las sesiones del usuario.
    const todas = await new Promise((resolve, reject) => store.all((e, list) => (e ? reject(e) : resolve(list))));
    await Promise.all(
      todas
        .filter((s) => s.sess?.usuarioId === usuario.id)
        .map((s) => new Promise((resolve) => store.destroy(s.sid, resolve)))
    );
    sesionesMetadata.eliminarTodas(usuario.id);

    return res.json({ mensaje: "Contrasena restablecida correctamente. Ya puedes iniciar sesion." });
  })
);

module.exports = router;