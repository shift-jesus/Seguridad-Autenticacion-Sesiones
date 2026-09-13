/**
 * server.js
 * -----------------------------------------------------------------------
 * Punto de arranque: construye la app y escucha. La app (sin listen) vive
 * en app.js para poder testearla.
 * -----------------------------------------------------------------------
 */
const { crearApp } = require("./app");
const { seed } = require("./database/seed");
const env = require("./config/env");

const app = crearApp();

seed().then(() => {
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Servidor corriendo en http://localhost:${env.port}`);
    // eslint-disable-next-line no-console
    console.log(`Entorno: ${env.nodeEnv} | Sesion ${env.sessionCookieName} | DB: ${env.dbPath}`);
  });
});