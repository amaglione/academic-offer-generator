# Login Persistente

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mantener la sesión activa entre reinicios del browser guardando `{ token, username }` en `localStorage`.

**Architecture:** `client.js` inicializa `_token` desde `localStorage` al cargar el módulo y `clearToken()` limpia el storage. `AuthContext` inicializa `user` con un lazy initializer que lee el username desde `localStorage`, y `login()` persiste ambos valores. `logout()` no cambia — ya llama `clearToken()` que ahora borra el storage.

**Tech Stack:** React 18 / Vite · axios · localStorage API

## Global Constraints

- No agregar dependencias npm
- No modificar el backend
- Todos los accesos a `localStorage` deben estar envueltos en `try/catch` (falla silenciosamente en private mode)
- Clave de storage: `"auth"` (string literal, usada en ambos archivos)

---

## File Map

| Archivo | Cambio |
|---|---|
| `frontend/src/api/client.js` | Inicializar `_token` desde storage; `clearToken()` también limpia storage |
| `frontend/src/context/AuthContext.jsx` | Lazy initializer para `user`; `login()` persiste `{ token, username }` en storage |

---

### Task 1: Persistencia de sesión — `client.js` + `AuthContext.jsx`

Los dos archivos se modifican juntos porque comparten la misma clave de storage `"auth"` y deben quedar en sincronía para todos los casos (login, logout, 401, reload).

**Files:**
- Modify: `frontend/src/api/client.js`
- Modify: `frontend/src/context/AuthContext.jsx`

**Interfaces:**
- `clearToken()` en `client.js` → además de `_token = null`, ejecuta `localStorage.removeItem('auth')`
- `login(token, username)` en `AuthContext` → además de `setToken(token)` y `setUser(...)`, ejecuta `localStorage.setItem('auth', JSON.stringify({ token, username }))`
- `user` en `AuthContext` → lazy initializer lee `localStorage.getItem('auth')` y retorna `{ username }` o `null`

---

- [ ] **Step 1: Reemplazar `frontend/src/api/client.js`**

```js
import axios from 'axios'

const client = axios.create({ baseURL: 'http://localhost:8000/api' })

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

client.interceptors.request.use((config) => {
  if (_token) config.headers.Authorization = `Bearer ${_token}`
  return config
})

client.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      clearToken()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
```

- [ ] **Step 2: Reemplazar `frontend/src/context/AuthContext.jsx`**

```jsx
import { createContext, useContext, useState } from 'react'
import { setToken, clearToken } from '../api/client'

const AuthContext = createContext(null)

const STORAGE_KEY = 'auth'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      return s ? { username: JSON.parse(s).username } : null
    } catch { return null }
  })

  function login(token, username) {
    setToken(token)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, username })) } catch {}
    setUser({ username })
  }

  function logout() {
    clearToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
```

- [ ] **Step 3: Verificar build sin errores**

```bash
cd frontend && npm run build
```

Esperado: `✓ built in XXXms` sin errores.

- [ ] **Step 4: Verificación manual — flujo completo**

Levantar backend y frontend:
```bash
# Terminal 1
cd backend && PYTHONPATH=. .venv/bin/uvicorn app.main:app --reload

# Terminal 2
cd frontend && npm run dev
```

Verificar los siguientes casos en `http://localhost:5173`:

1. **Login y refresh**: Loguearse → refrescar la página (F5) → debe cargar la app directamente sin redirigir a `/login`
2. **Persistencia entre reinicios**: Loguearse → cerrar el tab/browser → volver a abrir `http://localhost:5173` → debe cargar la app directamente
3. **Logout limpia storage**: Loguearse → cerrar sesión → abrir DevTools → Application → Local Storage → verificar que `auth` no existe
4. **Token inválido**: En DevTools → Application → Local Storage → editar el valor de `auth` para que el token sea inválido → refrescar → debe redirigir a `/login` (el primer request da 401, el interceptor limpia storage y redirige)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.js frontend/src/context/AuthContext.jsx
git commit -m "feat: sesión persistente entre reinicios del browser con localStorage"
```
