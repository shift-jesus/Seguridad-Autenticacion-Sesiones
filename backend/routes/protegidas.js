/**
 * routes/protegidas.js
 * -----------------------------------------------------------------------
 * Rutas de ejemplo que demuestran los niveles de acceso:
 *   - AUTENTICADO (cualquier usuario): /dashboard, /actividad
 *   - AUTORIZADO (rol admin): /admin/* (en routes/admin.js)
 * -----------------------------------------------------------------------
 */
const express = require("express");
const { query } = require("express-validator");

const { requireAuth } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { manejarValidaciones } = require("../middleware/errores");
const actividadRepo = require("../database/repositories/actividad");
const notifRepo = require("../database/repositories/notificaciones");
const mfaRepo = require("../database/repositories/mfa");

const router = express.Router();

// Cualquier usuario autenticado puede ver el dashboard.
router.get(
  "/dashboard",
  requireAuth,
  asyncHandler(async (req, res) => {
    const usId = req.session.usuarioId;
    res.json({
      mensaje: `Bienvenido al dashboard. Tu rol es "${req.session.rol}".`,
      datos: {
        visitas: Math.floor(Math.random() * 1000),
        notificaciones: Math.floor(Math.random() * 5),
        notificacionesPendientes: notifRepo.pendientes(usId),
        mfaActivo: Boolean(mfaRepo.porUsuario(usId)?.activo),
        emailVerificado: req.usuarioAutenticado.email_verificado === 1,
      },
    });
  })
);

// Historial de actividad propio, paginado.
router.get(
  "/actividad",
  requireAuth,
  query("limite").optional().isInt({ min: 1, max: 100 }).withMessage("Limite invalido"),
  query("inicio").optional().isInt({ min: 0 }).withMessage("Inicio invalido"),
  asyncHandler(async (req, res) => {
    const httpErr = manejarValidaciones(req);
    if (httpErr) throw httpErr;

    const limite = Number.parseInt(req.query.limite, 10) || 50;
    const inicio = Number.parseInt(req.query.inicio, 10) || 0;
    const actividad = actividadRepo.obtener(req.session.usuarioId, { limite, inicio });
    const total = actividadRepo.contar(req.session.usuarioId);
    return res.json({ actividad, total, limite, inicio });
  })
);

module.exports = router;