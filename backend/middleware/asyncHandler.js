/**
 * middleware/asyncHandler.js
 * -----------------------------------------------------------------------
 * Envuelve controladores async para que los errores vayan al manejo
 * central (evita try/catch duplicados en cada ruta).
 * -----------------------------------------------------------------------
 */
module.exports = function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
};