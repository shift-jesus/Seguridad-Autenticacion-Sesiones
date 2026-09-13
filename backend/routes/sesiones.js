/**
 * routes/sesiones.js
 * -----------------------------------------------------------------------
 * Gestion de "mis dispositivos" (sesiones activas).
 *
 *   GET    /api/sesiones          -> listar sesiones activas
 *   DELETE /api/sesiones/:sid     -> revocar una sesion ajena
 *   POST   /api/sesiones/cerrar-todas -> cerrar todo salvo la actual
 * -----------------------------------------------------------------------
 */
const express = require("express");

const { requireAuth } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { HttpError } = require("../middleware/errores");
const sesionesMetadata = require("../database/repositories/sesionesMetadata");
const actividadRepo = require("../database/repositories/actividad");
const store = require("../database/sessionStore");

const router = express.Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const sesiones = sesionesMetadata.listar(req.session.usuarioId).map((s) => ({
      sid: s.sid,
      ip: s.ip,
      userAgent: s.user_agent,
      creadaEn: s.creada_en,
      ultimoAcceso: s.ultimo_acceso,
      actual: s.sid === req.sessionID,
    }));
    return res.json({ sesiones });
  })
);

router.delete(
  "/:sid",
  asyncHandler(async (req, res) => {
    const { sid } = req.params;
    if (sid === req.sessionID) {
      throw new HttpError(400, "No puedes cerrar tu sesion actual desde aqui. Usa 'Cerrar sesion'.");
    }

    // Buscamos en el store para no revocar sesiones de otro usuario.
    const todas = await new Promise((resolve, reject) => store.all((e, list) => (e ? reject(e) : resolve(list))));
    const sesion = todas.find((s) => s.sid === sid && s.sess?.usuarioId === req.session.usuarioId);
    if (!sesion) throw new HttpError(404, "Sesion no encontrada");

    await new Promise((resolve) => store.destroy(sid, resolve));
    sesionesMetadata.eliminar(req.session.usuarioId, sid);
    actividadRepo.registrar(req.session.usuarioId, "Cerro una sesion remota");
    return res.json({ mensaje: "Sesion revocada." });
  })
);

router.post(
  "/cerrar-todas",
  asyncHandler(async (req, res) => {
    const todas = await new Promise((resolve, reject) => store.all((e, list) => (e ? reject(e) : resolve(list))));
    const otras = todas.filter((s) => s.sid !== req.sessionID && s.sess?.usuarioId === req.session.usuarioId);
    await Promise.all(otras.map((s) => new Promise((resolve) => store.destroy(s.sid, resolve))));
    sesionesMetadata.eliminarTodasExcepto(req.session.usuarioId, req.sessionID);
    actividadRepo.registrar(req.session.usuarioId, "Cerro sesion en todos los dispositivos");
    return res.json({ mensaje: `Se cerraron ${otras.length} sesion(es) en otros dispositivos.` });
  })
);

module.exports = router;