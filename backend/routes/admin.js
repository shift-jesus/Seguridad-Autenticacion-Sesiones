/**
 * routes/admin.js
 * -----------------------------------------------------------------------
 * Panel de administrador: gestion de usuarios y estadisticas.
 * TODAS las rutas exigen requireAuth + requireRole("admin") (AUTORIZACION).
 *
 *   GET    /api/admin/usuarios                -> listar (q, rol, paginado)
 *   PATCH  /api/admin/usuarios/:id            -> activar/desactivar
 *   POST   /api/admin/usuarios/:id/reset-password -> genera una clave temporal
 *   DELETE /api/admin/usuarios/:id            -> eliminar usuario
 *   GET    /api/admin/stats                   -> estadisticas globales
 * -----------------------------------------------------------------------
 */
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const express = require("express");
const { query, param } = require("express-validator");

const env = require("../config/env");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { HttpError, manejarValidaciones } = require("../middleware/errores");
const usuariosRepo = require("../database/repositories/usuarios");
const actividadRepo = require("../database/repositories/actividad");
const historialRepo = require("../database/repositories/contrasenasHistorial");
const notifRepo = require("../database/repositories/notificaciones");
const sesionesMetadata = require("../database/repositories/sesionesMetadata");
const store = require("../database/sessionStore");

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

const validarListado = [
  query("q").optional().trim().isLength({ max: 80 }).withMessage("Busqueda demasiado larga"),
  query("rol").optional().isIn(["usuario", "admin"]).withMessage("Rol invalido"),
  query("pagina").optional().isInt({ min: 1 }).withMessage("Pagina invalida"),
  query("porPagina").optional().isInt({ min: 5, max: 100 }).withMessage("Tamano de pagina invalido"),
];

router.get(
  "/usuarios",
  validarListado,
  asyncHandler(async (req, res) => {
    const httpErr = manejarValidaciones(req);
    if (httpErr) throw httpErr;

    const pagina = Number.parseInt(req.query.pagina, 10) || 1;
    const porPagina = Number.parseInt(req.query.porPagina, 10) || 25;
    const resultado = usuariosRepo.listar({
      q: req.query.q?.trim() || "",
      rol: req.query.rol || "",
      pagina,
      porPagina,
    });
    return res.json(resultado);
  })
);

router.patch(
  "/usuarios/:id",
  param("id").isInt().withMessage("ID invalido"),
  asyncHandler(async (req, res) => {
    const httpErr = manejarValidaciones(req);
    if (httpErr) throw httpErr;

    const id = Number(req.params.id);
    if (id === req.session.usuarioId) {
      throw new HttpError(400, "No puedes activar/desactivar tu propia cuenta");
    }
    const activo = Boolean(req.body.activo);
    if (!usuariosRepo.setActivo(id, activo)) throw new HttpError(404, "Usuario no encontrado");

    // Si se desactiva, se cierran sus sesiones.
    if (!activo) {
      const todas = await new Promise((resolve, reject) => store.all((e, list) => (e ? reject(e) : resolve(list))));
      await Promise.all(
        todas
          .filter((s) => s.sess?.usuarioId === id)
          .map((s) => new Promise((resolve) => store.destroy(s.sid, resolve)))
      );
      sesionesMetadata.eliminarTodas(id);
    }

    actividadRepo.registrar(req.session.usuarioId, `Admin ${activo ? "activo" : "desactivo"} al usuario #${id}`);
    return res.json({ mensaje: activo ? "Usuario activado" : "Usuario desactivado" });
  })
);

router.post(
  "/usuarios/:id/reset-password",
  param("id").isInt().withMessage("ID invalido"),
  asyncHandler(async (req, res) => {
    const httpErr = manejarValidaciones(req);
    if (httpErr) throw httpErr;

    const id = Number(req.params.id);
    const usuario = usuariosRepo.buscarPorId(id);
    if (!usuario) throw new HttpError(404, "Usuario no encontrado");

    const temporal = crypto.randomBytes(6).toString("hex").toUpperCase(); // 12 hex chars
    const hash = await bcrypt.hash(`${temporal}!Ab`, env.bcryptSaltRounds);
    usuariosRepo.setPasswordHash(id, hash);
    historialRepo.agregar(id, hash);
    notifRepo.crear(id, "Un administrador restablecio tu contrasena.");
    actividadRepo.registrar(req.session.usuarioId, `Admin reseteo la contrasena del usuario #${id}`);

    // Cerrar sus sesiones activas.
    const todas = await new Promise((resolve, reject) => store.all((e, list) => (e ? reject(e) : resolve(list))));
    await Promise.all(
      todas
        .filter((s) => s.sess?.usuarioId === id)
        .map((s) => new Promise((resolve) => store.destroy(s.sid, resolve)))
    );
    sesionesMetadata.eliminarTodas(id);

    return res.json({ mensaje: "Contrasena restablecida", nuevaContrasena: `${temporal}!Ab` });
  })
);

router.delete(
  "/usuarios/:id",
  param("id").isInt().withMessage("ID invalido"),
  asyncHandler(async (req, res) => {
    const httpErr = manejarValidaciones(req);
    if (httpErr) throw httpErr;

    const id = Number(req.params.id);
    if (id === req.session.usuarioId) throw new HttpError(400, "No puedes eliminar tu propia cuenta aqui");

    const todas = await new Promise((resolve, reject) => store.all((e, list) => (e ? reject(e) : resolve(list))));
    await Promise.all(
      todas
        .filter((s) => s.sess?.usuarioId === id)
        .map((s) => new Promise((resolve) => store.destroy(s.sid, resolve)))
    );
    if (!usuariosRepo.eliminar(id)) throw new HttpError(404, "Usuario no encontrado");
    actividadRepo.registrar(req.session.usuarioId, `Admin elimino al usuario #${id}`);
    return res.json({ mensaje: "Usuario eliminado" });
  })
);

router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    return res.json(usuariosRepo.stats());
  })
);

module.exports = router;