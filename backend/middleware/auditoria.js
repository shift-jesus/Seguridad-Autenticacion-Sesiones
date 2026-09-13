/**
 * middleware/auditoria.js
 * -----------------------------------------------------------------------
 * Asigna un request-id a cada peticion y registra acceso/error con morgan.
 * El request-id permite correlacionar logs y errores.
 * -----------------------------------------------------------------------
 */
const crypto = require("node:crypto");

function requestId(req, res, next) {
  req.id = req.headers["x-request-id"] || crypto.randomBytes(8).toString("hex");
  res.setHeader("X-Request-Id", req.id);
  next();
}

module.exports = { requestId };