/**
 * middleware/errores.js
 * -----------------------------------------------------------------------
 * Error "HTTP" tipado + manejadores de 404 y de errores no controlados.
 * En produccion JAMAS se expone el stack trace ni detalles internos.
 * -----------------------------------------------------------------------
 */
const env = require("../config/env");
const { validationResult } = require("express-validator");

class HttpError extends Error {
  constructor(status, error, mensaje) {
    super(mensaje || error);
    this.status = status;
    this.error = error;
    this.mensaje = mensaje || error;
  }
}

/** Centraliza los errores de express-validator a un formato unico. */
function manejarValidaciones(req) {
  const resultado = validationResult(req);
  if (resultado.isEmpty()) return null;
  const mensaje = resultado.errors.map((e) => e.msg).join(". ");
  return new HttpError(400, "Datos invalidos", mensaje);
}

function notFound(req, res) {
  res.status(404).json({ error: "Ruta no encontrada" });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.error, mensaje: err.mensaje });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Carga demasiado grande", mensaje: "El cuerpo de la peticion excede el limite permitido." });
  }

  // eslint-disable-next-line no-console
  console.error(`[${req.id || "-"}] Error no controlado:`, err);
  if (env.isProd) {
    return res.status(500).json({ error: "Error interno del servidor" });
  }
  return res.status(500).json({
    error: "Error interno del servidor",
    mensaje: err.message,
    stack: err.stack,
  });
}

module.exports = { HttpError, manejarValidaciones, notFound, errorHandler };