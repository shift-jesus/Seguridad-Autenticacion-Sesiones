# 🔐 Mini App Segura — Login y Registro (HTML puro)

Proyecto educativo mínimo para ver **autenticación y sesiones** en el navegador, sin frameworks ni backend.

## Cómo ejecutar

```bash
# Abre la carpeta con un servidor local (IMPORTANTE: no usar file://)
python -m http.server
# o con VS Code: extensión "Live Server"
# luego abre http://localhost:8000
```

> Necesita servidor local porque el hasheo usa Web Crypto API (`crypto.subtle`), que el navegador solo habilita en `localhost`/HTTPS, no en `file://`.

## Estructura

```
├── index.html      # Página (vistas registro, login, dashboard)
├── css/style.css   # Estilos
└── js/app.js       # Lógica y seguridad
```

## Qué hace

- **Registro**: guarda usuarios en `localStorage` (simula la BD).
- **Login**: valida credenciales y crea una sesión.
- **Dashboard**: protegido; sin sesión activa redirige a Login.
- **Cerrar sesión**: destruye el token de la sesión.

## Controles de seguridad incluidos

| Control | Dónde |
|---|---|
| Contraseña **hasheada** con SHA-256 + salt (nunca en texto plano) | `hashPassword()` |
| Token de sesión aleatorio (criptográfico) en `sessionStorage` | `randomHex()`, `crearSesion()` |
| Expiración de sesión (30 min) | `getSesionActiva()` |
| Protección de rutas (dashboard exige sesión) | `router()` |
| Validación de inputs (vacíos, formato, longitud) | `validarNombre/Email/Clave()` |
| Anti-XSS: salidas con `textContent`, no `innerHTML` | `mostrarVista()` |
| Mensaje de login genérico (no revela si existe el email) | `form-login` |

> ⚠️ Didáctico: en producción el hasheo y las sesiones se hacen en el **servidor** (bcrypt/argon2), porque todo lo que corre en el navegador es inspeccionable.