# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescritura completa del frontend usando Tailwind CSS + shadcn/ui con sidebar fijo lateral, calendario drag & drop y experiencia SaaS moderna clara.

**Architecture:** AppShell con sidebar lateral fijo envuelve las rutas protegidas via `<Outlet />` de react-router. La lógica de API (axios) y auth (JWT) existente se reutiliza sin cambios. Los componentes de UI se reconstruyen con Tailwind CSS v3 + shadcn/ui. El drag & drop del calendario usa @dnd-kit/core con activationConstraint de distancia para preservar los clicks.

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, shadcn/ui, @dnd-kit/core, lucide-react, react-router-dom 6 (existente), axios (existente).

## Global Constraints

- Node.js v20.9 — no instalar paquetes que requieran Node >=22
- Tailwind CSS v3 (no v4) — shadcn/ui requiere v3
- `frontend/src/api/client.js` y `frontend/src/context/AuthContext.jsx` NO se modifican
- No modificar backend ni API
- Rutas existentes conservadas: `/login`, `/`, `/parameters`
- Todos los comandos se corren desde `frontend/`

---

## Mapa de archivos

| Acción | Archivo | Responsabilidad |
|---|---|---|
| Modificar | `package.json` | agregar tailwind, shadcn deps, dnd-kit |
| Crear | `tailwind.config.js` | configuración Tailwind v3 |
| Crear | `postcss.config.js` | postcss para Tailwind |
| Crear | `jsconfig.json` | alias `@/` para shadcn/ui |
| Modificar | `vite.config.js` | resolver alias `@/` → `./src` |
| Modificar | `src/index.css` | directivas `@tailwind` |
| Modificar | `src/App.jsx` | AppShell + Toaster |
| Crear | `src/components/ui/*` | shadcn/ui auto-generados |
| Crear | `src/components/layout/AppShell.jsx` | sidebar + Outlet |
| Crear | `src/components/layout/Sidebar.jsx` | nav lateral fija |
| Crear | `src/components/shared/StatusBadge.jsx` | badge BORRADOR/PUBLICADA |
| Crear | `src/components/shared/CareerFilter.jsx` | dropdown multi-select carreras |
| Crear | `src/components/calendar/CourseCard.jsx` | card draggable con dnd-kit |
| Crear | `src/components/calendar/SlotCell.jsx` | celda droppable |
| Crear | `src/components/calendar/CalendarGrid.jsx` | DndContext + tabla |
| Crear | `src/components/calendar/CourseEditModal.jsx` | dialog edición de curso |
| Crear | `src/hooks/useOffer.js` | lógica oferta + polling |
| Crear | `src/hooks/useParameters.js` | lógica parámetros |
| Reemplazar | `src/pages/LoginPage.jsx` | login con Card shadcn |
| Reemplazar | `src/pages/OffersPage.jsx` | calendario + header |
| Reemplazar | `src/pages/ParametersPage.jsx` | formulario parámetros |
| Eliminar | `src/components/CalendarGrid.jsx` | reemplazado por calendar/ |
| Eliminar | `src/components/CourseCard.jsx` | reemplazado por calendar/ |
| Eliminar | `src/components/CareerFilter.jsx` | reemplazado por shared/ |
| Eliminar | `src/components/CourseEditModal.jsx` | reemplazado por calendar/ |

---

## Task 1: Setup Tailwind CSS v3 + shadcn/ui + dnd-kit

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/jsconfig.json`
- Modify: `frontend/vite.config.js`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Produces: clases Tailwind disponibles en todos los componentes; componentes shadcn/ui en `src/components/ui/`; alias `@/` resuelve a `src/`

- [ ] **Step 1: Instalar dependencias**

```bash
cd frontend
npm install -D tailwindcss@3 postcss autoprefixer
npm install class-variance-authority clsx tailwind-merge lucide-react
npm install @dnd-kit/core @dnd-kit/utilities
npm install @radix-ui/react-dialog @radix-ui/react-alert-dialog @radix-ui/react-select @radix-ui/react-slot
npm install sonner
```

- [ ] **Step 2: Crear tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

- [ ] **Step 3: Crear postcss.config.js**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 4: Crear jsconfig.json** (necesario para el alias `@/` en shadcn)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 5: Actualizar vite.config.js con alias**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 6: Reemplazar src/index.css con directivas Tailwind**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
}
```

- [ ] **Step 7: Crear src/lib/utils.js** (helper de shadcn/ui)

```js
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 8: Crear componentes shadcn/ui base**

Crear `src/components/ui/button.jsx`:
```jsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-blue-600 text-white shadow hover:bg-blue-700',
        destructive: 'bg-red-500 text-white shadow-sm hover:bg-red-600',
        outline: 'border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-gray-700',
        ghost: 'hover:bg-gray-100 text-gray-700',
        link: 'text-blue-600 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
})
Button.displayName = 'Button'

export { Button, buttonVariants }
```

Crear `src/components/ui/input.jsx`:
```jsx
import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
```

Crear `src/components/ui/label.jsx`:
```jsx
import * as React from 'react'
import { cn } from '@/lib/utils'

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn('text-sm font-medium leading-none text-gray-700 peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
    {...props}
  />
))
Label.displayName = 'Label'

export { Label }
```

Crear `src/components/ui/card.jsx`:
```jsx
import * as React from 'react'
import { cn } from '@/lib/utils'

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm', className)} {...props} />
))
Card.displayName = 'Card'

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
))
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('font-semibold leading-none tracking-tight', className)} {...props} />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-gray-500', className)} {...props} />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
))
CardContent.displayName = 'CardContent'

export { Card, CardHeader, CardTitle, CardDescription, CardContent }
```

Crear `src/components/ui/badge.jsx`:
```jsx
import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-blue-600 text-white',
        outline: 'text-gray-700',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
```

Crear `src/components/ui/dialog.jsx`:
```jsx
import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0', className)}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn('fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-lg p-6 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0', className)}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
)

const DialogFooter = ({ className, ...props }) => (
  <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />
)

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-gray-500', className)} {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export { Dialog, DialogTrigger, DialogPortal, DialogClose, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription }
```

Crear `src/components/ui/alert-dialog.jsx`:
```jsx
import * as React from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

const AlertDialog = AlertDialogPrimitive.Root
const AlertDialogTrigger = AlertDialogPrimitive.Trigger
const AlertDialogPortal = AlertDialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn('fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0', className)}
    {...props}
    ref={ref}
  />
))
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

const AlertDialogContent = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn('fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-md p-6 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0', className)}
      {...props}
    />
  </AlertDialogPortal>
))
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

const AlertDialogHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col space-y-2 text-center sm:text-left', className)} {...props} />
)

const AlertDialogFooter = ({ className, ...props }) => (
  <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4', className)} {...props} />
)

const AlertDialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold', className)} {...props} />
))
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

const AlertDialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description ref={ref} className={cn('text-sm text-gray-500', className)} {...props} />
))
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName

const AlertDialogAction = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
))
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName

const AlertDialogCancel = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel ref={ref} className={cn(buttonVariants({ variant: 'outline' }), 'mt-2 sm:mt-0', className)} {...props} />
))
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export { AlertDialog, AlertDialogTrigger, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel }
```

Crear `src/components/ui/sonner.jsx` (toast notifications):
```jsx
import { Toaster as Sonner } from 'sonner'

function Toaster(props) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: 'group toast group-[.toaster]:bg-white group-[.toaster]:text-gray-900 group-[.toaster]:border-gray-200 group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-gray-500',
          actionButton: 'group-[.toast]:bg-blue-600 group-[.toast]:text-white',
          cancelButton: 'group-[.toast]:bg-gray-100 group-[.toast]:text-gray-500',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
```

- [ ] **Step 9: Verificar que el build funciona**

```bash
npm run build
```

Resultado esperado: `✓ built in XXXms` sin errores. Si hay errores de import, verificar que todos los archivos de `src/components/ui/` fueron creados.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: setup Tailwind CSS v3 + shadcn/ui components + dnd-kit"
```

---

## Task 2: AppShell + Sidebar + App.jsx

**Files:**
- Create: `frontend/src/components/layout/Sidebar.jsx`
- Create: `frontend/src/components/layout/AppShell.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `useAuth()` de `AuthContext.jsx` — `{ user, logout }`; `NavLink` de react-router-dom; `Button` de `@/components/ui/button`; íconos de lucide-react
- Produces: `AppShell` como layout wrapper para rutas protegidas; `Sidebar` visible en todas las rutas autenticadas

- [ ] **Step 1: Crear Sidebar.jsx**

```jsx
// frontend/src/components/layout/Sidebar.jsx
import { NavLink } from 'react-router-dom'
import { Calendar, Settings, GraduationCap } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'

export default function Sidebar() {
  const { user, logout } = useAuth()

  const navItem = (to, Icon, label) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
        }`
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  )

  return (
    <div className="w-60 h-screen bg-gray-50 border-r border-gray-200 flex flex-col fixed left-0 top-0 z-40">
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">Oferta Académica</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItem('/', Calendar, 'Calendario')}
        {navItem('/parameters', Settings, 'Parámetros')}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-400 truncate mb-2">{user?.username}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="w-full justify-start text-gray-500 hover:text-gray-700 px-2"
        >
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Crear AppShell.jsx**

```jsx
// frontend/src/components/layout/AppShell.jsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Sidebar from './Sidebar'

export default function AppShell() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex bg-white min-h-screen">
      <Sidebar />
      <main className="ml-60 flex-1 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Reemplazar App.jsx**

```jsx
// frontend/src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { Toaster } from '@/components/ui/sonner'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import OffersPage from '@/pages/OffersPage'
import ParametersPage from '@/pages/ParametersPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppShell />}>
            <Route path="/" element={<OffersPage />} />
            <Route path="/parameters" element={<ParametersPage />} />
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  )
}
```

- [ ] **Step 4: Verificar build**

```bash
npm run build
```

Resultado esperado: `✓ built in XXXms` sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/ src/App.jsx
git commit -m "feat: AppShell con sidebar fijo lateral"
```

---

## Task 3: LoginPage rediseñada

**Files:**
- Modify: `frontend/src/pages/LoginPage.jsx`

**Interfaces:**
- Consumes: `useAuth()` → `{ login }`; `client` de `@/api/client`; `Button`, `Input`, `Label`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription` de `@/components/ui/`; íconos `GraduationCap`, `Eye`, `EyeOff`, `AlertCircle` de lucide-react
- Produces: ruta `/login` con card centrada en fondo gris, toggle password, estado loading, mensaje de error animado

- [ ] **Step 1: Reemplazar LoginPage.jsx**

```jsx
// frontend/src/pages/LoginPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import client from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await client.post('/auth/login', { username, password })
      login(r.data.access_token, username)
      navigate('/')
    } catch {
      setError('Usuario o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-4 pb-4">
          <div className="flex justify-center">
            <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl">Oferta Académica</CardTitle>
            <CardDescription className="mt-1">Ingresá con tu cuenta institucional</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin@demo.edu"
                required
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Ingresando...</>
              ) : 'Ingresar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Resultado esperado: `✓ built in XXXms` sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/pages/LoginPage.jsx
git commit -m "feat: login page con diseño SaaS moderno"
```

---

## Task 4: Componentes compartidos — StatusBadge + CareerFilter

**Files:**
- Create: `frontend/src/components/shared/StatusBadge.jsx`
- Create: `frontend/src/components/shared/CareerFilter.jsx`

**Interfaces:**
- `StatusBadge` consume: `Badge` de `@/components/ui/badge`; props: `{ status: 'draft' | 'published' }`
- `CareerFilter` consume: `Button` de `@/components/ui/button`; íconos `ChevronDown`, `Check` de lucide-react; props: `{ careers: [{id, name}], selected: number[], onChange: (ids) => void }`
- Produces: `StatusBadge` y `CareerFilter` usados en `OffersPage`

- [ ] **Step 1: Crear StatusBadge.jsx**

```jsx
// frontend/src/components/shared/StatusBadge.jsx
import { Badge } from '@/components/ui/badge'

export default function StatusBadge({ status }) {
  if (status === 'published') {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 font-medium">
        PUBLICADA
      </Badge>
    )
  }
  return (
    <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 font-medium">
      BORRADOR
    </Badge>
  )
}
```

- [ ] **Step 2: Crear CareerFilter.jsx**

```jsx
// frontend/src/components/shared/CareerFilter.jsx
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CareerFilter({ careers, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  const label =
    selected.length === 0 || selected.length === careers.length
      ? 'Todas las carreras'
      : `${selected.length} carrera${selected.length > 1 ? 's' : ''}`

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(o => !o)}
        className="gap-2 min-w-44 justify-between"
      >
        <span>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </Button>

      {open && (
        <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-52 z-50">
          {careers.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">Sin carreras disponibles</p>
          )}
          {careers.map(career => (
            <button
              key={career.id}
              onClick={() => toggle(career.id)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 text-left transition-colors"
            >
              <div
                className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  selected.includes(career.id)
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {selected.includes(career.id) && <Check className="h-3 w-3 text-white" />}
              </div>
              <span className="text-gray-700">{career.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Resultado esperado: `✓ built in XXXms`.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/
git commit -m "feat: StatusBadge y CareerFilter con shadcn/ui"
```

---

## Task 5: Custom hooks — useOffer + useParameters

**Files:**
- Create: `frontend/src/hooks/useOffer.js`
- Create: `frontend/src/hooks/useParameters.js`

**Interfaces:**
- `useOffer()` retorna: `{ offer, offers, generating, jobError, generate(semester?), approve(), patchCourse(courseId, updates) }`
- `useParameters()` retorna: `{ params, setParams, saving, save(updates) }`
- Ambos consumen `client` de `@/api/client`

- [ ] **Step 1: Crear useOffer.js**

```js
// frontend/src/hooks/useOffer.js
import { useState, useEffect, useCallback } from 'react'
import client from '@/api/client'

export function useOffer() {
  const [offer, setOffer] = useState(null)
  const [offers, setOffers] = useState([])
  const [generating, setGenerating] = useState(false)
  const [jobId, setJobId] = useState(null)
  const [jobError, setJobError] = useState(null)

  const loadOffer = useCallback(async (id) => {
    const r = await client.get(`/offers/${id}`)
    setOffer(r.data)
  }, [])

  const loadOffers = useCallback(async () => {
    const r = await client.get('/offers')
    setOffers(r.data)
    if (r.data.length > 0) await loadOffer(r.data[0].id)
  }, [loadOffer])

  useEffect(() => {
    loadOffers()
  }, [loadOffers])

  useEffect(() => {
    if (!jobId) return
    const interval = setInterval(async () => {
      try {
        const r = await client.get(`/jobs/${jobId}`)
        if (r.data.status === 'done') {
          clearInterval(interval)
          setJobId(null)
          setGenerating(false)
          await loadOffers()
          if (r.data.offer_id) await loadOffer(r.data.offer_id)
        } else if (r.data.status === 'failed') {
          clearInterval(interval)
          setJobId(null)
          setGenerating(false)
          setJobError(r.data.error || 'Error desconocido al generar la oferta')
        }
      } catch (e) {
        clearInterval(interval)
        setJobId(null)
        setGenerating(false)
        setJobError('Error de conexión al verificar el estado del job')
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [jobId, loadOffers, loadOffer])

  async function generate(semester = '2026-2') {
    setJobError(null)
    setGenerating(true)
    const r = await client.post(`/generate?semester=${semester}`)
    setJobId(r.data.job_id)
  }

  async function approve() {
    if (!offer) return
    await client.post(`/offers/${offer.id}/approve`)
    await loadOffer(offer.id)
  }

  async function patchCourse(courseId, updates) {
    if (!offer) return
    await client.patch(`/offers/${offer.id}/courses/${courseId}`, updates)
    await loadOffer(offer.id)
  }

  return { offer, offers, generating, jobError, generate, approve, patchCourse }
}
```

- [ ] **Step 2: Crear useParameters.js**

```js
// frontend/src/hooks/useParameters.js
import { useState, useEffect } from 'react'
import client from '@/api/client'

export function useParameters() {
  const [params, setParams] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    client.get('/parameters').then(r => setParams(r.data))
  }, [])

  async function save(updates) {
    setSaving(true)
    try {
      const r = await client.put('/parameters', updates)
      setParams(r.data)
    } finally {
      setSaving(false)
    }
  }

  return { params, setParams, saving, save }
}
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Resultado esperado: `✓ built in XXXms`.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/
git commit -m "feat: hooks useOffer y useParameters extraen lógica de estado"
```

---

## Task 6: Componentes del calendario — CourseCard + SlotCell + CalendarGrid + CourseEditModal

**Files:**
- Create: `frontend/src/components/calendar/CourseCard.jsx`
- Create: `frontend/src/components/calendar/SlotCell.jsx`
- Create: `frontend/src/components/calendar/CalendarGrid.jsx`
- Create: `frontend/src/components/calendar/CourseEditModal.jsx`

**Interfaces:**
- `CourseCard` props: `{ course: {id, subject_name, professor_name, expected_students, year, manually_modified, time_slot}, onClick: (course) => void, draggable?: boolean }`
- `SlotCell` props: `{ day: number, startHour: number, children }`
- `CalendarGrid` props: `{ courses, timeSlots, selectedCareerIds, onCourseClick, onCourseDrop, draggable }`
- `CourseEditModal` props: `{ course, onClose: () => void, onSave: (updates) => Promise<void> }`
- Consumen `useDraggable`, `useDroppable` de `@dnd-kit/core`; `DndContext`, `DragOverlay`, `PointerSensor`, `useSensor`, `useSensors` de `@dnd-kit/core`; `CSS` de `@dnd-kit/utilities`

- [ ] **Step 1: Crear CourseCard.jsx**

```jsx
// frontend/src/components/calendar/CourseCard.jsx
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

const YEAR_BORDER = {
  1: 'border-l-blue-500',
  2: 'border-l-green-500',
  3: 'border-l-purple-500',
  4: 'border-l-orange-500',
  5: 'border-l-red-500',
}

const YEAR_BADGE = {
  1: 'bg-blue-50 text-blue-700',
  2: 'bg-green-50 text-green-700',
  3: 'bg-purple-50 text-purple-700',
  4: 'bg-orange-50 text-orange-700',
  5: 'bg-red-50 text-red-700',
}

export default function CourseCard({ course, onClick, draggable = true }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(course.id),
    data: course,
    disabled: !draggable,
  })

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  const year = course.year || 1

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(draggable ? { ...listeners, ...attributes } : {})}
      onClick={e => { e.stopPropagation(); onClick(course) }}
      className={[
        'border-l-4',
        YEAR_BORDER[year] || YEAR_BORDER[1],
        'bg-white rounded-lg p-2 mb-1 shadow-sm transition-shadow',
        isDragging ? 'opacity-50 cursor-grabbing shadow-md' : draggable ? 'cursor-grab hover:shadow-md' : 'cursor-default',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">
          {course.subject_name}
        </span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${YEAR_BADGE[year] || YEAR_BADGE[1]}`}>
          {year}°
        </span>
      </div>
      <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1 leading-tight">
        <span className="truncate">{course.professor_name}</span>
        <span>·</span>
        <span className="shrink-0">{course.expected_students} al.</span>
        {course.manually_modified && <span className="text-amber-500 ml-0.5">✎</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Crear SlotCell.jsx**

```jsx
// frontend/src/components/calendar/SlotCell.jsx
import { useDroppable } from '@dnd-kit/core'

export default function SlotCell({ day, startHour, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${day}-${startHour}` })

  return (
    <td
      ref={setNodeRef}
      className={[
        'align-top p-1.5 border-r border-gray-100 min-w-[130px] transition-colors',
        isOver ? 'bg-blue-50 ring-2 ring-blue-300 ring-inset rounded' : '',
      ].join(' ')}
    >
      {children}
    </td>
  )
}
```

- [ ] **Step 3: Crear CalendarGrid.jsx**

```jsx
// frontend/src/components/calendar/CalendarGrid.jsx
import { useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import CourseCard from './CourseCard'
import SlotCell from './SlotCell'

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

export default function CalendarGrid({ courses, timeSlots, selectedCareerIds, onCourseClick, onCourseDrop, draggable }) {
  const [activeCourse, setActiveCourse] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const filtered = selectedCareerIds.length === 0
    ? courses
    : courses.filter(c => selectedCareerIds.includes(c.career_id))

  const bySlot = {}
  for (const c of filtered) {
    const key = `${c.time_slot?.day}-${c.time_slot?.start_hour}`
    if (!bySlot[key]) bySlot[key] = []
    bySlot[key].push(c)
  }

  const uniqueHours = [...new Set(timeSlots.map(s => s.start_hour))].sort((a, b) => a - b)

  function handleDragStart(e) {
    setActiveCourse(e.active.data.current)
  }

  function handleDragEnd(e) {
    setActiveCourse(null)
    const { active, over } = e
    if (!over) return
    const [dayStr, hourStr] = over.id.split('-')
    const day = parseInt(dayStr)
    const startHour = parseInt(hourStr)
    const course = active.data.current
    if (day === course.time_slot?.day && startHour === course.time_slot?.start_hour) return
    const slot = timeSlots.find(s => s.day === day && s.start_hour === startHour)
    if (slot) onCourseDrop(course.id, slot)
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-16 p-3 border-r border-gray-200" />
              {DAY_NAMES.map(d => (
                <th key={d} className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uniqueHours.map(startHour => (
              <tr key={startHour} className="border-t border-gray-100">
                <td className="p-2 text-right text-xs font-medium text-gray-400 border-r border-gray-200 align-top whitespace-nowrap">
                  {startHour}:00
                </td>
                {[0, 1, 2, 3, 4].map(day => (
                  <SlotCell key={day} day={day} startHour={startHour}>
                    {(bySlot[`${day}-${startHour}`] || []).map(course => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        onClick={onCourseClick}
                        draggable={draggable}
                      />
                    ))}
                  </SlotCell>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DragOverlay>
        {activeCourse && (
          <CourseCard course={activeCourse} onClick={() => {}} draggable={false} />
        )}
      </DragOverlay>
    </DndContext>
  )
}
```

- [ ] **Step 4: Crear CourseEditModal.jsx**

```jsx
// frontend/src/components/calendar/CourseEditModal.jsx
import { useState } from 'react'
import { Clock, User } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default function CourseEditModal({ course, onClose, onSave }) {
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave({ professor_id: course.professor_id })
    setSaving(false)
    onClose()
  }

  const slot = course.time_slot
  const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6">{course.subject_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {slot && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4 text-gray-400 shrink-0" />
              {dayNames[slot.day] || slot.day_name} · {slot.start_hour}:00 – {slot.end_hour || slot.start_hour + 1}:00
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="h-4 w-4 text-gray-400 shrink-0" />
            {course.professor_name}
          </div>
          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
            Para cambiar el docente arrastrá el curso a la franja deseada o usá la API.
            Guardar aquí marca el curso como modificado manualmente.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Marcar editado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 5: Verificar build**

```bash
npm run build
```

Resultado esperado: `✓ built in XXXms`.

- [ ] **Step 6: Commit**

```bash
git add src/components/calendar/
git commit -m "feat: CourseCard draggable, SlotCell droppable, CalendarGrid con dnd-kit"
```

---

## Task 7: OffersPage rediseñada

**Files:**
- Modify: `frontend/src/pages/OffersPage.jsx`
- Delete: `frontend/src/components/CalendarGrid.jsx`
- Delete: `frontend/src/components/CourseCard.jsx`
- Delete: `frontend/src/components/CareerFilter.jsx`
- Delete: `frontend/src/components/CourseEditModal.jsx`

**Interfaces:**
- Consumes: `useOffer()` de `@/hooks/useOffer`; `useParameters()` de `@/hooks/useParameters`; `CalendarGrid` de `@/components/calendar/CalendarGrid`; `CareerFilter` de `@/components/shared/CareerFilter`; `StatusBadge` de `@/components/shared/StatusBadge`; `CourseEditModal` de `@/components/calendar/CourseEditModal`; `AlertDialog` family de `@/components/ui/alert-dialog`; `Button` de `@/components/ui/button`; íconos `RefreshCw`, `Check`, `Loader2`, `AlertCircle` de lucide-react
- Produces: ruta `/` con header + calendario + dialogs

- [ ] **Step 1: Reemplazar OffersPage.jsx**

```jsx
// frontend/src/pages/OffersPage.jsx
import { useState } from 'react'
import { RefreshCw, Check, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useOffer } from '@/hooks/useOffer'
import { useParameters } from '@/hooks/useParameters'
import CalendarGrid from '@/components/calendar/CalendarGrid'
import CareerFilter from '@/components/shared/CareerFilter'
import StatusBadge from '@/components/shared/StatusBadge'
import CourseEditModal from '@/components/calendar/CourseEditModal'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function OffersPage() {
  const { offer, offers, generating, jobError, generate, approve, patchCourse } = useOffer()
  const { params } = useParameters()
  const [selectedCareerIds, setSelectedCareerIds] = useState([])
  const [editingCourse, setEditingCourse] = useState(null)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)

  const careers = [
    ...new Map(
      (offer?.courses || [])
        .filter(c => c.career_id)
        .map(c => [c.career_id, { id: c.career_id, name: c.career_name || `Carrera ${c.career_id}` }])
    ).values(),
  ]

  const coursesWithYear = (offer?.courses || []).map(c => ({ ...c, year: c.year || 1 }))
  const timeSlots = params?.time_slots || []
  const isDraft = offer?.status === 'draft'
  const noOffer = !offer && !generating

  async function handleCourseDrop(courseId, newSlot) {
    await patchCourse(courseId, { time_slot: newSlot })
    toast.success('Curso movido')
  }

  async function handleApprove() {
    await approve()
    toast.success('Oferta aprobada y publicada')
  }

  async function handleGenerate() {
    setConfirmRegenerate(false)
    await generate()
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-gray-900">
            {offer ? `Oferta ${offer.semester}` : 'Calendario'}
          </h1>
          {offer && <StatusBadge status={offer.status} />}
          {offer && (
            <span className="text-sm text-gray-400">
              {offer.courses?.length || 0} cursos
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <CareerFilter
            careers={careers}
            selected={selectedCareerIds}
            onChange={setSelectedCareerIds}
          />

          {noOffer && (
            <Button size="sm" onClick={handleGenerate} disabled={generating}>
              Generar oferta
            </Button>
          )}

          {offer && isDraft && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmRegenerate(true)}
              disabled={generating}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Regenerar
            </Button>
          )}

          {isDraft && (
            <Button
              size="sm"
              onClick={handleApprove}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Aprobar oferta
            </Button>
          )}
        </div>
      </div>

      {/* Error del job */}
      {jobError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Error al generar: {jobError}
        </div>
      )}

      {/* Estado generando */}
      {generating && (
        <div className="flex flex-col items-center justify-center py-28 text-gray-400">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400 mb-4" />
          <p className="font-medium text-gray-600">Ejecutando optimizador...</p>
          <p className="text-sm mt-1">Esto puede tardar varios minutos.</p>
        </div>
      )}

      {/* Sin oferta */}
      {noOffer && (
        <div className="flex flex-col items-center justify-center py-28 text-gray-400">
          <p className="text-lg font-medium text-gray-500">No hay oferta generada</p>
          <p className="text-sm mt-1">Hacé clic en "Generar oferta" para comenzar.</p>
        </div>
      )}

      {/* Calendario */}
      {!generating && offer && timeSlots.length > 0 && (
        <CalendarGrid
          courses={coursesWithYear}
          timeSlots={timeSlots}
          selectedCareerIds={selectedCareerIds}
          onCourseClick={isDraft ? setEditingCourse : () => {}}
          onCourseDrop={handleCourseDrop}
          draggable={isDraft}
        />
      )}

      {/* Confirm regenerar */}
      <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Regenerar oferta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto descartará el borrador actual y todos los ajustes manuales. La acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGenerate}
              className="bg-red-600 hover:bg-red-700"
            >
              Regenerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal edición */}
      {editingCourse && (
        <CourseEditModal
          course={editingCourse}
          onClose={() => setEditingCourse(null)}
          onSave={updates => patchCourse(editingCourse.id, updates)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Eliminar componentes reemplazados**

```bash
rm src/components/CalendarGrid.jsx
rm src/components/CourseCard.jsx
rm src/components/CareerFilter.jsx
rm src/components/CourseEditModal.jsx
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Resultado esperado: `✓ built in XXXms` sin errores.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: OffersPage rediseñada con calendario dnd, filtro por carrera y dialogs"
```

---

## Task 8: ParametersPage rediseñada

**Files:**
- Modify: `frontend/src/pages/ParametersPage.jsx`

**Interfaces:**
- Consumes: `useParameters()` de `@/hooks/useParameters`; `Button`, `Input`, `Label`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription` de `@/components/ui/`; íconos `Loader2`, `Check`, `Info` de lucide-react; `toast` de sonner

- [ ] **Step 1: Reemplazar ParametersPage.jsx**

```jsx
// frontend/src/pages/ParametersPage.jsx
import { useState } from 'react'
import { Loader2, Check, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useParameters } from '@/hooks/useParameters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function ParamField({ label, id, value, onChange, unit }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          value={value}
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          className="w-28"
          min={1}
        />
        <span className="text-sm text-gray-400">{unit}</span>
      </div>
    </div>
  )
}

export default function ParametersPage() {
  const { params, setParams, saving, save } = useParameters()
  const [saved, setSaved] = useState(false)

  if (!params) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    )
  }

  function update(key, value) {
    setParams(p => ({ ...p, [key]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    const { max_students_per_course, max_weekly_hours_per_professor, available_classrooms, solver_timeout_seconds } = params
    await save({ max_students_per_course, max_weekly_hours_per_professor, available_classrooms, solver_timeout_seconds })
    setSaved(true)
    toast.success('Parámetros guardados correctamente')
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Parámetros del optimizador</h1>

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Capacidad</CardTitle>
              <CardDescription>Límites de alumnos, aulas y carga docente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ParamField
                label="Alumnos por curso"
                id="max_students_per_course"
                value={params.max_students_per_course}
                onChange={v => update('max_students_per_course', v)}
                unit="alumnos"
              />
              <ParamField
                label="Aulas disponibles"
                id="available_classrooms"
                value={params.available_classrooms}
                onChange={v => update('available_classrooms', v)}
                unit="aulas"
              />
              <ParamField
                label="Hs. semanales por docente"
                id="max_weekly_hours_per_professor"
                value={params.max_weekly_hours_per_professor}
                onChange={v => update('max_weekly_hours_per_professor', v)}
                unit="horas"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Solver</CardTitle>
              <CardDescription>Configuración del optimizador CP-SAT</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ParamField
                label="Timeout"
                id="solver_timeout_seconds"
                value={params.solver_timeout_seconds}
                onChange={v => update('solver_timeout_seconds', v)}
                unit="segundos"
              />
              <div className="flex gap-2 rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <p>Si se alcanza el timeout, el solver devuelve la mejor solución encontrada hasta ese momento en lugar de fallar.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="min-w-36">
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
            ) : saved ? (
              <><Check className="h-4 w-4 mr-2" />Guardado</>
            ) : (
              'Guardar cambios'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build completo**

```bash
npm run build
```

Resultado esperado: `✓ built in XXXms` sin errores ni warnings críticos.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ParametersPage.jsx
git commit -m "feat: ParametersPage con cards shadcn/ui y toast de confirmación"
```

---

## Verificación final

Antes de hacer merge, verificar manualmente el flujo completo:

1. Levantar backend: `cd backend && PYTHONPATH=. .venv/bin/uvicorn app.main:app --reload`
2. Levantar frontend: `cd frontend && npm run dev`
3. Ir a `http://localhost:5173` — debe redirigir a `/login`
4. Login con `admin@demo.edu` / `admin123` — debe mostrar sidebar + calendario vacío
5. Ir a Parámetros — debe mostrar las dos cards con los valores actuales y guardar correctamente
6. Volver a Calendario → "Generar oferta" → spinner + polling → oferta cargada en el calendario
7. Arrastrar una card a otra celda → debe moverse (PATCH al backend)
8. Hacer click en una card → modal de edición → cerrar
9. "Aprobar oferta" → badge cambia a PUBLICADA → drag deshabilitado
10. Cerrar sesión → redirige a `/login`
