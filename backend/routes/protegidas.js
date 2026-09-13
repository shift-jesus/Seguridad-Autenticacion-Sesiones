/**
 * routes/protegidas.js
 * -----------------------------------------------------------------------
 * Rutas de ejemplo para demostrar la diferencia entre:
 *   - Un recurso que solo requiere estar AUTENTICADO (cualquier usuario)
 *   - Un recurso que ademas requiere estar AUTORIZADO (rol especifico)
 * -----------------------------------------------------------------------
 */
const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { listarUsuarios, obtenerActividad } = require("../utils/db");

const router = express.Router();

// Cualquier usuario autenticado puede ver el dashboard.
router.get("/dashboard", requireAuth, (req, res) => {
  res.json({
    mensaje: `Bienvenido al dashboard. Tu rol es "${req.session.rol}".`,
    datos: {
      visitas: Math.floor(Math.random() * 1000),
      notificaciones: Math.floor(Math.random() * 5),
    },
  });
});

// Historial de actividad del usuario autenticado.
router.get("/actividad", requireAuth, (req, res) => {
  res.json({ actividad: obtenerActividad(req.session.usuarioId) });
});

// Solo usuarios con rol "admin" pueden listar todos los usuarios.
router.get("/admin/usuarios", requireAuth, requireRole("admin"), (req, res) => {
  res.json({ usuarios: listarUsuarios() });
});

module.exports = router;
