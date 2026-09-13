/**
 * routes/notas.js
 * -----------------------------------------------------------------------
 * NOTAS PERSONALES (CRUD).
 *
 * Demuestra AUTORIZACION a nivel de recurso/dueno de los datos:
 * aunque dos usuarios esten autenticados, el servidor solo devuelve
 * o modifica las notas del usuario que hace la peticion (se obtienen
 * a partir de req.session.usuarioId, NUNCA de un campo enviado por
 * el cliente que se pueda manipular).
 *
 *   GET    /api/notas          -> mis notas
 *   POST   /api/notas          -> crear una nota
 *   DELETE /api/notas/:id      -> eliminar SOLO una nota propia
 * -----------------------------------------------------------------------
 */
const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { crearNota, listarNotas, eliminarNota, registrarActividad } = require("../utils/db");

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  res.json({ notas: listarNotas(req.session.usuarioId) });
});

router.post("/", requireAuth, (req, res) => {
  const { texto } = req.body;

  if (!texto || texto.trim().length < 1) {
    return res.status(400).json({ error: "La nota no puede estar vacia" });
  }
  if (texto.length > 500) {
    return res.status(400).json({ error: "La nota no puede superar los 500 caracteres" });
  }

  const nota = crearNota(req.session.usuarioId, texto.trim());
  registrarActividad(req.session.usuarioId, `Creo una nota (#${nota.id})`);
  return res.status(201).json({ mensaje: "Nota creada", nota });
});

router.delete("/:id", requireAuth, (req, res) => {
  const eliminada = eliminarNota(req.session.usuarioId, req.params.id);
  if (!eliminada) {
    // Mismo mensaje sin importar si la nota no existe o es de otro usuario:
    // evita filtrar informacion de datos ajenos.
    return res.status(404).json({ error: "Nota no encontrada" });
  }
  registrarActividad(req.session.usuarioId, `Elimino una nota (#${eliminada.id})`);
  return res.json({ mensaje: "Nota eliminada", nota: eliminada });
});

module.exports = router;