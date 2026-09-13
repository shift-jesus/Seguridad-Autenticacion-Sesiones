/**
 * routes/cuenta.js
 * -----------------------------------------------------------------------
 * Autogestion de la cuenta propia.
 *
 *   GET    /api/cuenta/exportar          -> exportar datos (GDPR)
 *   DELETE /api/cuenta                   -> borrar la cuenta (+datos)
 *   GET    /api/cuenta/notificaciones    -> notificaciones en-app
 *   POST   /api/cuenta/notificaciones/:id/leer -> marcar como leida
 * -----------------------------------------------------------------------
 */
const express = require("express");

const { requireAuth } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { HttpError } = require("../middleware/errores");
const usuariosRepo = require("../database/repositories/usuarios");
const notasRepo = require("../database/repositories/notas");
const actividadRepo = require("../database/repositories/actividad");
const sesionesMetadata = require("../database/repositories/sesionesMetadata");
const notifRepo = require("../database/repositories/notificaciones");
const store = require("../database/sessionStore");

const router = express.Router();
router.use(requireAuth);

router.get(
  "/exportar",
  asyncHandler(async (req, res) => {
    const us = usuariosRepo.buscarPorId(req.session.usuarioId);
    const exportado = {
      generado_en: new Date().toISOString(),
      usuario: us ? usuariosRepo.aPublico(us) : null,
      notas: notasRepo.listar(req.session.usuarioId, { incluirBorradas: true }),
      actividad: actividadRepo.obtener(req.session.usuarioId, { limite: 500 }),
      sesiones: sesionesMetadata.listar(req.session.usuarioId).map((s) => ({
        creadaEn: s.creada_en,
        ultimoAcceso: s.ultimo_acceso,
        ip: s.ip,
      })),
      notificaciones: notifRepo.listar(req.session.usuarioId),
    };
    return res.header("Content-Type", "application/json; charset=utf-8").json(exportado);
  })
);

router.delete(
  "/",
  asyncHandler(async (req, res) => {
    const sid = req.sessionID;
    const usuarioId = req.session.usuarioId;

    // Cierra todas las sesiones del usuario y borra todo (CASCADE en DB).
    const todas = await new Promise((resolve, reject) => store.all((e, list) => (e ? reject(e) : resolve(list))));
    await Promise.all(
      todas
        .filter((s) => s.sess?.usuarioId === usuarioId)
        .map((s) => new Promise((resolve) => store.destroy(s.sid, resolve)))
    );
    await new Promise((resolve) => req.session.destroy(resolve));
    res.clearCookie(require("../config/env").sessionCookieName);
    sesionesMetadata.eliminarTodas(usuarioId);
    usuariosRepo.eliminar(usuarioId);

    return res.json({ mensaje: "Cuenta y todos tus datos fueron eliminados." });
  })
);

router.get(
  "/notificaciones",
  asyncHandler(async (req, res) => {
    return res.json({ notificaciones: notifRepo.listar(req.session.usuarioId) });
  })
);

router.post(
  "/notificaciones/:id/leer",
  asyncHandler(async (req, res) => {
    const ok = notifRepo.marcarLeida(req.session.usuarioId, req.params.id);
    if (!ok) throw new HttpError(404, "Notificacion no encontrada");
    return res.json({ mensaje: "Marcada como leida." });
  })
);

module.exports = router;