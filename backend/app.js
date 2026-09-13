/**
 * app.js
 * -----------------------------------------------------------------------
 * Construye y exporta la aplicacion Express (sin arrancar el servidor),
 * para poder testearla con supertest.
 * -----------------------------------------------------------------------
 */
const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const rateLimit = require("express-rate-limit");

const env = require("./config/env");
const store = require("./database/sessionStore");

const { requestId } = require("./middleware/auditoria");
const csrf = require("./middleware/csrf");
const { notFound, errorHandler } = require("./middleware/errores");

const authRoutes = require("./routes/auth");
const notasRoutes = require("./routes/notas");
const sesionesRoutes = require("./routes/sesiones");
const mfaRoutes = require("./routes/mfa");
const adminRoutes = require("./routes/admin");
const cuentaRoutes = require("./routes/cuenta");
const protegidasRoutes = require("./routes/protegidas");

/** Limite global de peticiones por IP para toda la API (defensa base). */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones", mensaje: "Llegaste al limite de peticiones por minuto." },
});

function crearApp() {
  const app = express();
  app.disable("x-powered-by");
  if (env.trustProxy) app.set("trust proxy", 1);

  app.use(requestId);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          formAction: ["'self'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  app.use(morgan(env.isProd ? "combined" : "dev", { skip: (req) => req.path === "/api/salud" }));
  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());

  app.use(
    cors({
      origin: env.clientOrigin || true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    })
  );

  // Sesion persistente + cookie HTTP-Only (ver config/env.js).
  app.use(
    session({
      name: env.sessionCookieName,
      secret: env.sessionSecret,
      store,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: env.isProd,
        sameSite: "lax",
        maxAge: env.sessionMaxAgeMs,
        path: "/",
      },
    })
  );

  // CSRF (double-submit cookie) para todas las mutaciones.
  app.use(csrf());

  // API publica de salud.
  app.get("/api/salud", (req, res) => {
    res.json({ estado: "ok", entorno: env.nodeEnv, app: "auth-sesiones" });
  });

  app.use("/api", apiLimiter);
  app.use("/api/auth", authRoutes);
  app.use("/api/notas", notasRoutes);
  app.use("/api/sesiones", sesionesRoutes);
  app.use("/api/mfa", mfaRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/cuenta", cuentaRoutes);
  app.use("/api", protegidasRoutes);

  // Frontend estatico.
  app.use(express.static(path.join(__dirname, "..", "frontend")));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { crearApp };