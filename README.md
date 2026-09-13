# 🔐 Mini App: Autenticación y Sesiones (v2)

Proyecto educativo para la clase **"Seguridad: Autenticación y Sesiones"**. Implementa un flujo completo de registro, verificación de email, login, logout y recuperación de contraseña usando **sesiones de servidor con cookies HTTP-Only**, más `2FA (TOTP)`, bloqueo por fuerza bruta, protección CSRF y auditoría de actividad.

---

## 📋 Temas cubiertos

- Autenticación vs Autorización
- Sesiones de servidor y cookies **HTTP-Only** (`secure`, `sameSite`, `rolling`)
- Hashing de contraseñas con `bcrypt` (+ política de contraseñas y **historial de contraseñas reutilizadas**)
- Verificación de email con **token firmado por tiempo (TTL)**
- Recuperación de contraseña ("olvidé mi contraseña") con token desechable
- **2FA / TOTP** (Google Authenticator) + códigos de respaldo
- **Anti fuerza bruta** por cuenta e IP con bloqueo temporal
- **Protección CSRF** (doble cookie + header `X-CSRF-Token`)
- **Gestión de sesiones activas**: listar, revocar de a una o cerrar todas
- **Registro de auditoría/actividad** de cada acción sensible
- Autorización por roles (`usuario` / `admin`) y paneles de administración
- Derechos del usuario (**GDPR**): exportar datos y eliminar cuenta definitivamente

📖 La explicación teórica detallada está en [`docs/conceptos.md`](docs/conceptos.md).

---

## 🗂️ Estructura del proyecto

```
proyecto-auth-sesiones/
├── backend/
│   ├── server.js                # Punto de entrada (arranca el app con seed automático)
│   ├── app.js                   # Fábrica crearApp() (permite testear sin levantar servidor)
│   ├── package.json
│   ├── .env.example             # Variables de entorno documentadas
│   ├── config/
│   │   └── env.js               # Carga y centraliza variables (.env / process.env)
│   ├── database/
│   │   ├── db.js                # SQLite real vía node:sqlite (WAL)
│   │   ├── seed.js              # Crea usuarios de prueba
│   │   ├── sessionStore.js      # Almacén de sesiones persistente (SQLite)
│   │   └── repositories/        # Capa de acceso a datos (SQL parametrizado "?")
│   │       ├── usuarios.js  ├── notas.js  ├── tokens.js  ├── mfa.js
│   │       ├── sesionesMetadata.js  ├── actividad.js
│   │       ├── contrasenasHistorial.js  └── notificaciones.js
│   ├── services/
│   │   ├── validadores.js       # Política de contraseñas y validación de entrada
│   │   ├── lockout.js           # Control de intentos fallidos
│   │   └── tokens.js            # Generación + hashing de tokens desechables
│   ├── middleware/
│   │   ├── auth.js              # requireAuth (autenticación) y requireRole (autorización)
│   │   ├── csrf.js                # Verificación de token CSRF
│   │   ├── auditoria.js           # Registro de actividad
│   │   ├── errores.js             # HttpError + manejador de errores (sin leaks en prod)
│   │   └── asyncHandler.js
│   ├── routes/
│   │   ├── auth.js               # registro/verificar/login/2fa/logout/me/perfil/cambiar-password/recuperar
│   │   ├── notas.js              # CRUD de notas + papelera (restaurar)
│   │   ├── sesiones.js           # sesiones activas (listar/revocar/cerrar todas)
│   │   ├── mfa.js                # estado / configuración de 2FA (TOTP + QR + respaldos)
│   │   ├── cuenta.js             # exportar datos / eliminar cuenta / notificaciones
│   │   ├── admin.js              # stats / usuarios / reset de contraseña (rol admin)
│   │   └── protegidas.js         # dashboard y actividad
│   └── test/
│       └── flujo.test.js        # 11 tests de integración (node:test + supertest)
├── frontend/
│   ├── index.html                # Login (con mostrar/ocultar contraseña y paso 2FA)
│   ├── registro.html             # Registro con medidor de fortaleza de contraseña
│   ├── verificar.html            # Confirma email con el token
│   ├── recuperar.html            # Restablece la contraseña ("olvidé mi contraseña")
│   ├── dashboard.html            # Notas (crear/editar/fijar/borrar/papelera) + actividad
│   ├── perfil.html               # Perfil, cambiar contraseña, 2FA, exportar/borrar datos
│   ├── sesiones.html             # Dispositivos activos (revocar)
│   ├── admin.html                # Panel admin (estadísticas + gestión de usuarios)
│   ├── css/style.css             # Tema claro/oscuro
│   └── js/                       # api.js, login.js, registro.js, dashboard.js, perfil.js,
│                                 # sesiones.js, admin.js, theme.js
└── docs/
    └── conceptos.md              # Teoría explicada con referencias al código
```

---

## 🚀 Cómo ejecutar el proyecto

### 1. Backend (requiere Node.js ≥ 22.5 para `node:sqlite`)

```bash
cd backend
npm install
copy .env.example .env        # Windows   (en Linux/mac: cp .env.example .env)
npm run dev                   # desarrollo (con auto-reinicio)
npm start                     # producción
```

El servidor queda en `http://localhost:3000`. Al iniciar, crea la base SQLite y sella dos usuarios de prueba:

| Rol | Email | Contraseña |
|---|---|---|
| usuario | `estudiante@demo.com` | `Aprender123!` |
| admin | `admin@demo.com` | `AdminSeguro123!` |

### 2. Frontend (HTML/CSS/JS puro, sin build)

**Opción A — servido por el propio backend (simple):** con el backend corriendo, abre `http://localhost:3000/index.html`.

**Opción B — con Live Server aparte:** abre la carpeta `frontend/` con Live Server (puerto `5500`, ya permitido por CORS). Si usas otro puerto, edita `CLIENT_ORIGIN` en tu `.env`.

---

## 🔍 Qué mirar en el código durante la clase

1. **`backend/server.js` / `backend/app.js`** → bloque `session({...})`: `name: "sid"`, `httpOnly: true`, `sameSite`, `maxAge` (30 min), `rolling: true`, expiración absoluta (12 h) y el **almacén persistente** `SQLiteStore`.
2. **`backend/routes/auth.js`** → `login`: `bcrypt.compare`, `req.session.regenerate`, **mensajes genéricos** ("Email o contraseña incorrectos"), `rate limiters`, conmutación a paso 2FA si el usuario lo tiene activo.
3. **`backend/middleware/csrf.js`** → doble cookie: el server setea `csrfToken` (no HttpOnly, para que el JS la lea) y exige el header `X-CSRF-Token` en todo POST/PUT/PATCH/DELETE. Compara cookie vs header.
4. **`backend/services/lockout.js`** → contador de intentos fallidos por email e IP; al superar `LOCKOUT_MAX_INTENTOS` bloquea la cuenta/IP durante `LOCKOUT_PENALIZACION_MS`.
5. **`backend/services/tokens.js`** → tokens desechables (verificación de email / reseteo): aleatorios, con hash (SHA-256) y `TOKEN_TTL_MS` (30 min). **Simulación:** el "email" sale por consola del backend.
6. **`backend/routes/mfa.js`** → 2FA/TOTP: `speakeasy` genera el secreto y la app muestra un **QR** (`qrcode`); activación validando **dos códigos consecutivos**; códigos de respaldo.
7. **`backend/middleware/auth.js`** → `requireAuth` (¿estás autenticado?) vs `requireRole("admin")` (¿puedes hacer esto?): dos controles distintos y en ese orden.
8. **`backend/database/repositories/notas.js`** → toda consulta con SQL **parametrizado** (`?`), protegiendo de inyección SQL.
9. **`frontend/js/api.js`** → `credentials: "include"` + cabecera `X-CSRF-Token` automática: por qué el navegador necesita esos dos para mandar/recibir la cookie y pasar el chequeo CSRF.
10. **DevTools → Application → Cookies**: la cookie `sid` existe pero `document.cookie` en consola **NO la muestra** (HttpOnly). La cookie `csrfToken` sí se ve (y es intencional para el JS).

---

## 🧪 Ejemplos prácticos paso a paso

### Ejemplo 1 — Registro → verificar email → login
```bash
curl -i -c c.txt -X POST http://localhost:3000/api/auth/registro \
  -H "Content-Type: application/json" \
  -d '{"email":"alumno@demo.com","nombre":"Alumno","password":"ClaveSegura123!"}'
# ✓ 201. Revisa la consola del backend: imprime el enlace con el token:
#   [DEMO-AUTH] alumno@demo.com -> /verificar.html?token=abcd123...
curl -i -c c.txt http://localhost:3000/api/auth/verificar/abcd123...   # confirma el email
```

### Ejemplo 2 — Login y sesión
```bash
curl -i -c c.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"estudiante@demo.com","password":"Aprender123!"}'
curl -b c.txt http://localhost:3000/api/auth/me            # usuario + sesión + 2FA estado
curl -i -b c.txt -X POST http://localhost:3000/api/auth/logout
curl -b c.txt http://localhost:3000/api/auth/me            # → 401 sesión destruida
```

### Ejemplo 3 — Falta el token CSRF (mutación) → 403
```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"estudiante@demo.com","password":"Aprender123!"}'
# ✓ 403 FORBIDDEN: sin cookie+header CSRF coherentes la mutación se rechaza.
```

### Ejemplo 4 — Anti fuerza bruta
Intenta login 5 veces con clave incorrecta → la cuenta queda **bloqueada 15 min** para ese email e IP (respuesta 429 con tiempo restante).

### Ejemplo 5 — 2FA (TOTP)
1. Login normal y `GET /api/mfa/estado` (mfaActivo).
2. `POST /api/mfa/totp/configurar` → devuelve `secreto` + `qrUrl` (muestra el QR con cualquier lector).
3. Escanea con Google Authenticator; `POST /api/mfa/totp/activar` con **dos códigos seguidos** (actual + siguiente) → activa 2FA y entrega códigos de respaldo.
4. A partir de ahí, login devuelve `{ "seRequiere2fa": true }` → `POST /api/auth/verificar-2fa` con el código.

### Ejemplo 6 — Recuperación de contraseña
```bash
curl -i -X POST http://localhost:3000/api/auth/recuperar \
  -H "Content-Type: application/json" -d '{"email":"estudiante@demo.com"}'
# Consola del backend: /recuperar.html?token=...
curl -i -X POST http://localhost:3000/api/auth/recuperar-reset \
  -H "Content-Type: application/json" \
  -d '{"token":"...","password":"NuevaClave456!"}'
```

### Ejemplo 7 — Sesiones activas
`GET /api/sesiones` (dispositivos), `DELETE /api/sesiones/<sid>` (una), `POST /api/sesiones/cerrar-todas`. Cambiar la contraseña **invalida todas las sesiones y mueve la anterior a historial**.

### Ejemplo 8 — Roles: admin
Con `admin@demo.com`: `GET /api/admin/stats`, `GET /api/admin/usuarios?pagina=1&porPagina=5`, `PATCH /api/admin/usuarios/:id` (activar/rol), `POST /api/admin/usuarios/:id/reset-password`. Con un usuario normal → 403.

### Ejemplo 9 — Derechos del usuario (GDPR)
`GET /api/cuenta/exportar` (JSON con todos tus datos) y `DELETE /api/cuenta` (borra cuenta, notas, sesiones y actividad).

---

## 🧪 Tests e integridad

```bash
cd backend
npm run test                # 11 tests de integración (node:test + supertest, DB temporal)
npm run lint                # eslint v10
npm run format              # prettier --write
npm run db:reset            # recrea la base con los usuarios de prueba
```

---

## ⚖️ Notas para producción (mencionar en clase)

- El "envío" de email es **simulado** (el enlace se imprime en consola). En producción se usará SMTP/SES/Resend y el token viaja por enlace HTTPS.
- Las cookies educativas usan `LAX`/`STRICT` en un entorno local **HTTP**. En producción: HTTPS + `secure: true` obligatorio.
- La base SQLite sirve para el proyecto; en producción multi-instancia se escala el almacén de sesiones a Redis.
- Ya **implementado** frente a la v1: persistencia real, verificación de email, "olvidé mi contraseña", 2FA, CSRF, lockout, historial de contraseñas, auditoría y panel admin.

## 📄 Licencia

Uso libre con fines educativos.