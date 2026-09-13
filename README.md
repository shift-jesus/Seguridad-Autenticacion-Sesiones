# 🔐 Mini App: Autenticación y Sesiones

Proyecto educativo para la clase **"Seguridad: Autenticación y Sesiones"**. Implementa un flujo completo de registro, login y logout usando **sesiones de servidor con cookies HTTP-Only**, además de manejo seguro de credenciales con `bcrypt`.

## 📋 Temas cubiertos

- Diferencia entre Autenticación y Autorización
- Control de sesiones tradicionales y Cookies HTTP-Only
- Manejo seguro de credenciales del usuario
- Ejemplos prácticos (código comentado paso a paso)
- Mini app: Login básico con persistencia de sesión
- Buenas prácticas y problemas comunes

📖 La explicación teórica de cada tema está en [`docs/conceptos.md`](docs/conceptos.md).

## 🗂️ Estructura del proyecto

```
proyecto-auth-sesiones/
├── backend/
│   ├── server.js                # Punto de entrada, config de sesión y cookies
│   ├── package.json
│   ├── .env.example              # Variables de entorno de ejemplo
│   ├── routes/
│   │   ├── auth.js               # /registro /login /logout /me
│   │   └── protegidas.js         # /dashboard /admin/usuarios
│   ├── middleware/
│   │   └── auth.js               # requireAuth (autenticación) y requireRole (autorización)
│   └── utils/
│       ├── db.js                 # "Base de datos" en memoria
│       └── seed.js               # Crea usuarios de prueba con contraseña hasheada
│
├── frontend/
│   ├── index.html                # Página de login
│   ├── registro.html             # Página de registro
│   ├── dashboard.html            # Página protegida
│   ├── css/style.css
│   └── js/
│       ├── api.js                # Wrapper de fetch con credentials: "include"
│       ├── login.js
│       ├── registro.js
│       └── dashboard.js
│
└── docs/
    └── conceptos.md              # Teoría explicada con referencias al código
```

## 🚀 Cómo ejecutar el proyecto

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

El servidor queda escuchando en `http://localhost:3000`. Al iniciar, crea automáticamente dos usuarios de prueba (ver `utils/seed.js`):

| Rol | Email | Contraseña |
|---|---|---|
| usuario | `estudiante@demo.com` | `Aprender123!` |
| admin | `admin@demo.com` | `AdminSeguro123!` |

### 2. Frontend

El frontend es HTML/CSS/JS puro, sin build. Dos formas de verlo:

**Opción A — servido por el propio backend (más simple):**
Con el backend corriendo, abre directamente `http://localhost:3000/index.html`.

**Opción B — con Live Server / servidor estático aparte:**
Abre la carpeta `frontend/` con la extensión Live Server de VS Code (o `npx serve frontend`). Si usas un puerto distinto a `5500`, actualiza `CLIENT_ORIGIN` en el `.env` del backend para que CORS lo permita.

## 🔍 Qué mirar en el código durante la clase

1. **`backend/server.js`** → bloque `session({...})`: aquí se configuran `httpOnly`, `secure`, `sameSite` y `maxAge` de la cookie.
2. **`backend/routes/auth.js`** → función `login`: hashing con `bcrypt.compare`, `req.session.regenerate`, mensajes de error genéricos, rate limiting.
3. **`backend/middleware/auth.js`** → `requireAuth` (autenticación) vs `requireRole` (autorización): son dos checks distintos y en ese orden.
4. **`frontend/js/api.js`** → `credentials: "include"`: por qué el navegador necesita ese flag para mandar/recibir la cookie.
5. **DevTools del navegador → pestaña Application/Storage → Cookies**: mostrar en vivo que la cookie de sesión existe pero que `document.cookie` en la consola NO la muestra (por ser `HttpOnly`).

## 🧪 Prueba rápida con curl (para mostrar el flujo sin frontend)

```bash
# 1. Login (guarda la cookie en cookies.txt)
curl -i -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"estudiante@demo.com","password":"Aprender123!"}'

# 2. Usar la cookie guardada para acceder a una ruta protegida
curl -i -b cookies.txt http://localhost:3000/api/auth/me

# 3. Cerrar sesión
curl -i -b cookies.txt -X POST http://localhost:3000/api/auth/logout
```

## ⚠️ Notas para producción (mencionar en clase)

Este proyecto está simplificado para fines didácticos. Antes de llevarlo a producción habría que:

- Reemplazar la base de datos en memoria (`utils/db.js`) por una real (PostgreSQL, MongoDB, etc.).
- Reemplazar el almacén de sesiones en memoria por uno persistente compartido (Redis con `connect-redis`, por ejemplo), especialmente si hay más de una instancia del servidor.
- Servir todo por HTTPS y activar `secure: true` en la cookie.
- Añadir verificación de email y flujo de "olvidé mi contraseña".
- Añadir protección CSRF adicional si se usan formularios tradicionales sin JSON/fetch.

## 📄 Licencia

Uso libre con fines educativos.
