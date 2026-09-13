/**
 * routes/notas.js
 * -----------------------------------------------------------------------
 * NOTAS PERSONALES (CRUD + extras).
 *
 * Autorizacion a nivel de dueno: el usuario_id SIEMPRE sale de la sesion
 * (req.session.usuarioId), jamas de datos enviados por el cliente.
 *
 *   GET    /api/notas?q=&tag=&soloFijadas=1   -> mis notas (con filtros)
 *   POST   /api/notas                          -> crear
 *   PUT    /api/notas/:id                      -> editar texto/etiquetas/fijada
 *   DELETE /api/notas/:id                      -> borrado LOGICO (deshacible)
 *   POST   /api/notas/:id/restaurar            -> deshacer el borrado
 * -----------------------------------------------------------------------
 */
const express = require("express");
const { query } = require("express-validator");

const { requireAuth } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { HttpError, manejarValidaciones } = require("../middleware/errores");
const { validarNotaTexto, validarNotaEtiquetas } = require("../services/validadores");
const notasRepo = require("../database/repositories/notas");
const actividadRepo = require("../database/repositories/actividad");

const router = express.Router();
router.use(requireAuth);

const validarFiltros = [
  query("q").optional().trim().isLength({ max: 80 }).withMessage("Busqueda demasiado larga"),
  query("tag").optional().trim().isLength({ max: 30 }).withMessage("Etiqueta invalida"),
  query("soloFijadas").optional().isIn(["1", "true"]).withMessage("soloFijadas invalido"),
  query("incluirBorradas").optional().isIn(["1", "true"]).withMessage("incluirBorradas invalido"),
];

router.get(
  "/",
  validarFiltros,
  asyncHandler(async (req, res) => {
    const httpErr = manejarValidaciones(req);
    if (httpErr) throw httpErr;

    const borradasIncluidas = ["1", "true"].includes(req.query.incluirBorradas);
    const filtros = {
      q: req.query.q?.trim() || "",
      tag: req.query.tag?.trim() || "",
      soloFijadas: ["1", "true"].includes(req.query.soloFijadas),
      incluirBorradas: borradasIncluidas,
    };
    const notas = notasRepo.listar(req.session.usuarioId, filtros);
    return res.json({ notas });
  })
);

router.post(
  "/",
  validarNotaTexto,
  validarNotaEtiquetas,
  asyncHandler(async (req, res) => {
    const httpErr = manejarValidaciones(req);
    if (httpErr) throw httpErr;

    const { texto, etiquetas } = req.body;
    const nota = notasRepo.crear(req.session.usuarioId, texto.trim(), etiquetas || []);
    actividadRepo.registrar(req.session.usuarioId, `Creo una nota (#${nota.id})`);
    return res.status(201).json({ mensaje: "Nota creada", nota });
  })
);

router.put(
  "/:id",
  validarNotaTexto.optional(),
  validarNotaEtiquetas,
  asyncHandler(async (req, res) => {
    const httpErr = manejarValidaciones(req);
    if (httpErr) throw httpErr;

    const nota = notasRepo.actualizar(req.session.usuarioId, req.params.id, {
      texto: req.body.texto?.trim(),
      etiquetas: req.body.etiquetas,
      fijada: typeof req.body.fijada === "boolean" ? req.body.fijada : undefined,
    });
    if (!nota) throw new HttpError(404, "Nota no encontrada");
    actividadRepo.registrar(req.session.usuarioId, `Edito una nota (#${nota.id})`);
    return res.json({ mensaje: "Nota actualizada", nota });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const nota = notasRepo.eliminarSuave(req.session.usuarioId, req.params.id);
    if (!nota) throw new HttpError(404, "Nota no encontrada");
    actividadRepo.registrar(req.session.usuarioId, `Elimino una nota (#${nota.id})`);
    return res.json({ mensaje: "Nota eliminada (puedes deshacer)", nota });
  })
);

router.post(
  "/:id/restaurar",
  asyncHandler(async (req, res) => {
    const nota = notasRepo.restaurar(req.session.usuarioId, req.params.id);
    if (!nota) throw new HttpError(404, "Nota no encontrada");
    actividadRepo.registrar(req.session.usuarioId, `Restauro una nota (#${nota.id})`);
    return res.json({ mensaje: "Nota restaurada", nota });
  })
);

module.exports = router;