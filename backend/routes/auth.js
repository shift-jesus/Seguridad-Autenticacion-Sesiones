/**
 * routes/auth.js
 * -----------------------------------------------------------------------
 * Endpoints de autenticacion y manejo de sesion.
 *
 *   POST /api/auth/registro   -> crea un usuario nuevo
 *   POST /api/auth/login      -> valida credenciales y crea sesion
 *   POST /api/auth/logout     -> destruye la sesion
 *   GET  /api/auth/me         -> devuelve el usuario de la sesion activa
 * -----------------------------------------------------------------------
 */
const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const {
  crearUsuario,
  buscarPorEmail,
  buscarPorId,
  actualizarPerfil,
  actualizarPasswordHash,
  registrarActividad,
} = require("../utils/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

/**
 * Limita intentos de login para mitigar ataques de fuerza bruta.
 * Buena practica: nunca dejar el endpoint de login sin proteccion de tasa.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 intentos por IP en esa ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos",
    mensaje: "Has intentado iniciar sesion demasiadas veces. Espera unos minutos.",
  },
});

function validarEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarPassword(password) {
  // Regla simple para la demo: minimo 8 caracteres.
  // En produccion se puede exigir mayusculas, numeros, simbolos, etc.
  return typeof password === "string" && password.length >= 8;
}

/* ------------------------------------------------------------------ */
/* REGISTRO                                                           */
/* ------------------------------------------------------------------ */
router.post("/registro", async (req, res) => {
  try {
    const { email, nombre, password } = req.body;

    if (!validarEmail(email)) {
      return res.status(400).json({ error: "Email invalido" });
    }
    if (!nombre || nombre.trim().length < 2) {
      return res.status(400).json({ error: "Nombre invalido" });
    }
    if (!validarPassword(password)) {
      return res.status(400).json({ error: "La contrasena debe tener al menos 8 caracteres" });
    }
    if (buscarPorEmail(email)) {
      // Respuesta generica: evita confirmar que un email ya esta registrado
      // (mitiga enumeracion de usuarios).
      return res.status(409).json({ error: "No fue posible registrar ese usuario" });
    }

    // MANEJO SEGURO DE CREDENCIALES:
    // Nunca se guarda "password" tal cual. Se genera un hash con bcrypt,
    // que incluye un salt aleatorio y es computacionalmente costoso de
    // romper por fuerza bruta.
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const usuario = crearUsuario({ email, nombre, passwordHash });

    return res.status(201).json({
      mensaje: "Usuario registrado correctamente",
      usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre },
    });
  } catch (err) {
    console.error("Error en /registro:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

/* ------------------------------------------------------------------ */
/* LOGIN                                                               */
/* ------------------------------------------------------------------ */
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!validarEmail(email) || !password) {
      return res.status(400).json({ error: "Credenciales invalidas" });
    }

    const usuario = buscarPorEmail(email);

    // Mensaje de error IDENTICO tanto si el email no existe como si la
    // contrasena es incorrecta. Esto evita que un atacante pueda deducir
    // que emails estan registrados ("enumeracion de usuarios").
    const credencialesInvalidas = () =>
      res.status(401).json({ error: "Email o contrasena incorrectos" });

    if (!usuario) return credencialesInvalidas();

    const passwordCorrecto = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordCorrecto) return credencialesInvalidas();

    registrarActividad(usuario.id, `Inicio de sesion`);

    // ---- Creacion de la sesion ----
    // express-session:
    //  1. Genera un ID de sesion aleatorio y firmado.
    //  2. Guarda los datos (usuarioId, rol) en el almacen de sesiones
    //     del SERVIDOR (aqui en memoria; en produccion Redis/DB).
    //  3. Envia al navegador SOLO el ID de sesion dentro de una cookie
    //     HTTP-Only (ver server.js para la configuracion de la cookie).
    //
    // Buena practica: regenerar el ID de sesion al iniciar sesion,
    // para prevenir ataques de "session fixation".
    req.session.regenerate((err) => {
      if (err) {
        console.error("Error regenerando sesion:", err);
        return res.status(500).json({ error: "Error interno del servidor" });
      }

      req.session.usuarioId = usuario.id;
      req.session.rol = usuario.rol;
      req.session.creadaEn = new Date().toISOString();
      req.session.ultimoAcceso = new Date().toISOString();

      return res.json({
        mensaje: "Sesion iniciada correctamente",
        usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
      });
    });
  } catch (err) {
    console.error("Error en /login:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

/* ------------------------------------------------------------------ */
/* LOGOUT                                                              */
/* ------------------------------------------------------------------ */
router.post("/logout", requireAuth, (req, res) => {
  const cookieName = process.env.SESSION_COOKIE_NAME || "sid";
  registrarActividad(req.session.usuarioId, "Cierre de sesion");

  req.session.destroy((err) => {
    if (err) {
      console.error("Error destruyendo sesion:", err);
      return res.status(500).json({ error: "No se pudo cerrar la sesion" });
    }
    // Limpia la cookie en el navegador tambien.
    res.clearCookie(cookieName);
    return res.json({ mensaje: "Sesion cerrada correctamente" });
  });
});

/* ------------------------------------------------------------------ */
/* SESION ACTUAL ("quien soy")                                        */
/* ------------------------------------------------------------------ */
router.get("/me", requireAuth, (req, res) => {
  const usuario = buscarPorId(req.session.usuarioId);
  if (!usuario) {
    return res.status(401).json({ error: "Sesion invalida" });
  }
  return res.json({
    usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
    sesion: {
      creadaEn: req.session.creadaEn,
      expiraEn: req.session.cookie.expires,
      ultimoAcceso: req.session.ultimoAcceso,
    },
  });
});

/* ------------------------------------------------------------------ */
/* ACTUALIZAR PERFIL (nombre)                                         */
/* ------------------------------------------------------------------ */
router.put("/perfil", requireAuth, (req, res) => {
  const { nombre } = req.body;

  if (!nombre || nombre.trim().length < 2) {
    return res.status(400).json({ error: "Nombre invalido" });
  }

  const usuario = actualizarPerfil(req.session.usuarioId, { nombre });
  if (!usuario) {
    return res.status(401).json({ error: "Sesion invalida" });
  }

  registrarActividad(req.session.usuarioId, "Actualizo su perfil");
  return res.json({
    mensaje: "Perfil actualizado correctamente",
    usuario,
  });
});

/* ------------------------------------------------------------------ */
/* CAMBIAR CONTRASENA                                                 */
/* ------------------------------------------------------------------ */
router.put("/cambiar-password", requireAuth, async (req, res) => {
  try {
    const { passwordActual, passwordNueva } = req.body;

    if (!validarPassword(passwordNueva)) {
      return res
        .status(400)
        .json({ error: "La contrasena nueva debe tener al menos 8 caracteres" });
    }

    const usuario = buscarPorId(req.session.usuarioId);
    if (!usuario) return res.status(401).json({ error: "Sesion invalida" });

    const coincide = await bcrypt.compare(passwordActual || "", usuario.passwordHash);
    if (!coincide) {
      return res.status(400).json({ error: "La contrasena actual es incorrecta" });
    }

    const passwordHash = await bcrypt.hash(passwordNueva, SALT_ROUNDS);
    actualizarPasswordHash(usuario.id, passwordHash);

    // Invalida la sesion anterior para que el usuario tenga que volver a entrar.
    registrarActividad(usuario.id, "Cambio de contrasena");
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destruyendo sesion tras cambio de password:", err);
        return res.status(500).json({ error: "Error interno del servidor" });
      }
      const cookieName = process.env.SESSION_COOKIE_NAME || "sid";
      res.clearCookie(cookieName);
      return res.json({ mensaje: "Contrasena actualizada. Vuelve a iniciar sesion." });
    });
  } catch (err) {
    console.error("Error en /cambiar-password:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
