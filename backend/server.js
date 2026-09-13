/**
 * server.js
 * -----------------------------------------------------------------------
 * Punto de entrada del backend.
 *
 * Aqui se configura lo mas importante del modulo de seguridad:
 * la cookie de sesion HTTP-Only.
 * -----------------------------------------------------------------------
 */
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const authRoutes = require("./routes/auth");
const protegidasRoutes = require("./routes/protegidas");
const notasRoutes = require("./routes/notas");
const { seed } = require("./utils/seed");

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

/* ------------------------------------------------------------------ */
/* Middlewares base                                                    */
/* ------------------------------------------------------------------ */
app.use(helmet()); // cabeceras HTTP de seguridad (X-Frame-Options, etc.)
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5500",
    credentials: true, // imprescindible para que el navegador envie cookies
  })
);

/* ------------------------------------------------------------------ */
/* Configuracion de la sesion (LO MAS IMPORTANTE DEL MODULO)          */
/* ------------------------------------------------------------------ */
app.use(
  session({
    name: process.env.SESSION_COOKIE_NAME || "sid", // no usar el nombre por defecto
    secret: process.env.SESSION_SECRET || "dev-secret-cambiar-en-produccion",
    resave: false, // no reescribir la sesion si no hubo cambios
    saveUninitialized: false, // no crear sesion hasta que se guarde algo (evita cookies vacias)
    rolling: true, // renueva el tiempo de expiracion en cada request (sesion "viva")
    cookie: {
      httpOnly: true, // <-- CLAVE: JavaScript del navegador NO puede leer esta cookie.
                       //     Esto mitiga robo de sesion via XSS.
      secure: isProd, // en produccion, la cookie solo viaja por HTTPS
      sameSite: "lax", // mitiga ataques CSRF cross-site basicos
      maxAge: Number(process.env.SESSION_MAX_AGE_MS) || 30 * 60 * 1000, // 30 min
    },
    // NOTA: aqui se usa el almacen en memoria por defecto de express-session,
    // valido SOLO para desarrollo/demo. En produccion se debe usar un store
    // persistente y compartido como connect-redis, connect-mongo, etc,
    // para que las sesiones sobrevivan reinicios y funcionen con varias
    // instancias del servidor.
  })
);

/* ------------------------------------------------------------------ */
/* Rutas                                                               */
/* ------------------------------------------------------------------ */
app.use("/api/auth", authRoutes);
app.use("/api", protegidasRoutes);
app.use("/api/notas", notasRoutes);

app.get("/api/salud", (req, res) => {
  res.json({ estado: "ok", entorno: process.env.NODE_ENV || "development" });
});

// Sirve el frontend estatico si se copia dentro de /frontend junto al backend
// (opcional; tambien se puede abrir el frontend con Live Server por separado).
app.use(express.static(path.join(__dirname, "..", "frontend")));

/* ------------------------------------------------------------------ */
/* Manejo de errores no controlados                                    */
/* ------------------------------------------------------------------ */
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

app.use((err, req, res, next) => {
  console.error("Error no controlado:", err);
  res.status(500).json({ error: "Error interno del servidor" });
});

/* ------------------------------------------------------------------ */
/* Arranque                                                            */
/* ------------------------------------------------------------------ */
seed().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`Entorno: ${process.env.NODE_ENV || "development"}`);
  });
});
