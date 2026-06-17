# Login Persistente

**Goal:** Mantener la sesión del usuario activa entre reinicios del browser usando `localStorage`, sin cambios al backend.

**Tech Stack:** React 18 / Vite · axios · localStorage API

---

## Contexto

El `AuthContext` actual inicializa `user` con `useState(null)` y `client.js` guarda `_token` en una variable de módulo. Ambos se pierden al refrescar la página. `AppShell` chequea `if (!user) → <Navigate to="/login" />`, por lo que cada reload redirige al login.

---

## Solución

Persistir `{ token, username }` en `localStorage` bajo la clave `"auth"`. Dos archivos afectados:

### `frontend/src/api/client.js`

- Inicializar `_token` desde `localStorage` al cargar el módulo (IIFE con `try/catch`).
- `clearToken()` también borra `localStorage.removeItem('auth')`. Esto garantiza que el interceptor de 401 limpia el storage antes de redirigir, evitando un loop de redirect.
- `setToken()` no cambia — solo actualiza `_token` en memoria (el guardado en storage lo hace `login()` en `AuthContext`).

```js
const STORAGE_KEY = 'auth'

let _token = (() => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY))?.token ?? null }
  catch { return null }
})()

export function setToken(token) { _token = token }
export function clearToken() {
  _token = null
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}
```

### `frontend/src/context/AuthContext.jsx`

- `useState` usa lazy initializer para leer `username` de `localStorage` al montar.
- `login()` escribe `{ token, username }` en `localStorage` antes de setear el estado.
- `logout()` no cambia — ya llama `clearToken()` que ahora limpia storage.

```js
const [user, setUser] = useState(() => {
  try {
    const s = localStorage.getItem('auth')
    return s ? { username: JSON.parse(s).username } : null
  } catch { return null }
})

function login(token, username) {
  setToken(token)
  try { localStorage.setItem('auth', JSON.stringify({ token, username })) } catch {}
  setUser({ username })
}
```

---

## Edge Cases

| Caso | Comportamiento |
|---|---|
| Refresh con sesión válida | `_token` y `user` restaurados desde storage → app carga directamente |
| Token expirado (401 en cualquier request) | Interceptor llama `clearToken()` → borra storage → `window.location.href = '/login'` → próximo reload arranca limpio |
| Logout explícito | `logout()` → `clearToken()` borra storage → `user = null` → `AppShell` redirige a login |
| `localStorage` deshabilitado (private mode) | `try/catch` en todos los accesos → fallback silencioso a comportamiento in-memory actual |
| Storage con JSON corrupto | `try/catch` → retorna `null` → usuario no autenticado, debe loguearse |

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/api/client.js` | Inicializar `_token` desde storage; `clearToken()` limpia storage |
| `frontend/src/context/AuthContext.jsx` | Lazy initializer para `user`; `login()` persiste en storage |

No se agregan dependencias. No se modifica el backend.
