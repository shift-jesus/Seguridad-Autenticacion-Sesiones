/**
 * routes/mfa.js
 * -----------------------------------------------------------------------
 * 2FA / TOTP (autenticacion de dos factores).
 *
 *   GET  /api/mfa/estado             -> estado del 2FA
 *   POST /api/mfa/totp/configurar    -> genera un secreto (requiere password)
 *   POST /api/mfa/totp/activar       -> confirma el secreto con un codigo
 *   POST /api/mfa/totp/desactivar    -> desactiva con un codigo
 *
 * Los codigos de respaldo se guardan hasheados y se muestran UNA sola vez
 * al activar (buena practica).
 * -----------------------------------------------------------------------
 */
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const express = require("express");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");

const env = require("../config/env");
const { requireAuth } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { HttpError } = require("../middleware/errores");
const mfaRepo = require("../database/repositories/mfa");
const usuariosRepo = require("../database/repositories/usuarios");
const actividadRepo = require("../database/repositories/actividad");

const router = express.Router();
router.use(requireAuth);

router.get(
  "/estado",
  asyncHandler(async (req, res) => {
    const mfa = mfaRepo.porUsuario(req.session.usuarioId);
    return res.json({ activo: Boolean(mfa?.activo) });
  })
);

router.post(
  "/totp/configurar",
  asyncHandler(async (req, res) => {
    const { password } = req.body;
    const usuario = usuariosRepo.buscarPorId(req.session.usuarioId);
    if (!usuario) throw new HttpError(401, "Sesion invalida");

    const coincide = await bcrypt.compare(password || "", usuario.password_hash);
    if (!coincide) throw new HttpError(400, "Contrasena incorrecta");

    const secreto = speakeasy.generateSecret({ name: `${env.mfaIssuer}:${usuario.email}` });
    mfaRepo.guardarSecreto(usuario.id, secreto.base32);
    actividadRepo.registrar(usuario.id, "Genero un secreto de 2FA");

    const otpauthUrl = speakeasy.otpauthURL({
      secret: secreto.base32,
      label: `${env.mfaIssuer}:${usuario.email}`,
      issuer: env.mfaIssuer,
      encoding: "base32",
    });
    const qrCodeUrl = await qrcode.toDataURL(otpauthUrl);

    return res.json({ mensaje: "Escanea el QR o copia el secreto", secreto: secreto.base32, qrCodeUrl });
  })
);

router.post(
  "/totp/activar",
  asyncHandler(async (req, res) => {
    const { codigo } = req.body;
    const mfaDatos = mfaRepo.porUsuario(req.session.usuarioId);
    if (!mfaDatos) throw new HttpError(400, "Primero genera un secreto");

    const correcto = speakeasy.totp.verify({
      secret: mfaDatos.secreto,
      encoding: "base32",
      token: String(codigo || "").trim(),
      window: 1,
    });
    if (!correcto) throw new HttpError(400, "El codigo no coincide");

    // Genera codigos de respaldo (guardados como hash, mostrados una vez).
    const planos = Array.from({ length: env.mfaBackupCodes }, () =>
      crypto.randomBytes(4).toString("hex").toUpperCase().match(/../g).join("-")
    );
    const hashes = planos.map((c) => crypto.createHash("sha256").update(c).digest("hex"));
    mfaRepo.activar(req.session.usuarioId, hashes);
    actividadRepo.registrar(req.session.usuarioId, "Activo el 2FA");

    return res.json({
      mensaje: "2FA activado. Guarda los codigos de respaldo en un lugar seguro; se muestran una sola vez.",
      backupCodes: planos,
    });
  })
);

router.post(
  "/totp/desactivar",
  asyncHandler(async (req, res) => {
    const { codigo } = req.body;
    const mfaDatos = mfaRepo.porUsuario(req.session.usuarioId);
    if (!mfaDatos || !mfaDatos.activo) throw new HttpError(400, "El 2FA no esta activado");

    const correcto = speakeasy.totp.verify({
      secret: mfaDatos.secreto,
      encoding: "base32",
      token: String(codigo || "").trim(),
      window: 1,
    });
    if (!correcto) throw new HttpError(400, "Codigo incorrecto");

    mfaRepo.desactivar(req.session.usuarioId);
    actividadRepo.registrar(req.session.usuarioId, "Desactivo el 2FA");
    return res.json({ mensaje: "2FA desactivado." });
  })
);

module.exports = router;