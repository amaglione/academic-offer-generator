# UI Redesign — Generador de Oferta Académica

**Fecha:** 2026-06-17
**Estado:** Aprobado por usuario

---

## Resumen

Reescritura completa del frontend para lograr una experiencia SaaS moderna y clara. Se reemplaza la UI actual (estilos inline, sin librería de componentes) por una nueva basada en Tailwind CSS + shadcn/ui, con sidebar fijo lateral, calendario drag & drop y cards de cursos enriquecidas. La lógica de API y autenticación existente se reutiliza sin cambios.

---

## Stack de UI

| Tecnología | Rol |
|---|---|
| Tailwind CSS | Utilidades de estilo |
| shadcn/ui | Componentes base (Button, Dialog, Card, Input, Select, Badge, Sonner) |
| @dnd-kit/core + @dnd-kit/sortable | Drag & drop del calendario |
| lucide-react | Íconos |

**Sin cambios:**
- `api/client.js` — axios con interceptor JWT
- `AuthContext.jsx` — lógica de autenticación y token
- Lógica de polling de jobs en `OffersPage`

---

## Layout general

- Fondo blanco (`#FFFFFF`), sidebar izquierdo fijo de 240px con fondo `#F9FAFB`
- Borde derecho del sidebar sutil (`border-r`)
- Contenido principal ocupa el ancho restante con padding generoso
- Rutas protegidas renderizan dentro del `AppShell` (sidebar + outlet)
- Login no usa `AppShell` — pantalla centrada standalone

---

## Sidebar

```
┌──────────────────┐
│  🎓 Oferta Acad. │  ← logo / nombre del sistema
│──────────────────│
│  📅 Calendario   │  ← ítem activo: fondo azul suave, texto azul
│  ⚙️  Parámetros  │  ← hover: gris claro
│──────────────────│
│  [espacio flex]  │
│  👤 admin@demo   │  ← email del usuario logueado
│  Cerrar sesión   │
└──────────────────┘
```

- Ítem activo: `bg-blue-50 text-blue-700 font-medium`
- Ítem hover: `hover:bg-gray-100`
- Ícono + label para cada sección
- Usuario y logout anclados al fondo del sidebar

---

## Login

- Fondo de página: `bg-gray-50`
- Card centrada: `bg-white rounded-2xl shadow-sm border p-8 w-96`
- Logo/ícono de la app arriba
- Título en `text-2xl font-bold`, subtítulo en `text-gray-500`
- Inputs shadcn/ui con label visible
- Input de contraseña con toggle mostrar/ocultar (ícono ojo)
- Button full-width con estado loading (spinner) durante la request
- Mensaje de error con ícono, animación fade-in, fondo `bg-red-50 text-red-700 rounded`
- El error no ocupa espacio cuando no hay error

---

## Página de Ofertas

### Header

```
[título: "Oferta 2026-2"]   [badge BORRADOR/PUBLICADA]   [btn Regenerar]  [btn ✓ Aprobar]
[dropdown Todas las carreras]
```

- Badge de estado: `BORRADOR` en amarillo (`bg-amber-100 text-amber-700`), `PUBLICADA` en verde
- Botón Aprobar solo visible en estado borrador
- Botón Regenerar dispara modal de confirmación antes de ejecutar
- Dropdown multi-select de carreras (CareerFilter)

### Calendario

- Grilla: franjas horarias (filas) × días de la semana (columnas)
- Header de días en `text-sm font-semibold text-gray-500`
- Franjas horarias como label en `text-xs text-gray-400`
- Cada celda es una drop zone de dnd-kit
- Al arrastrar un curso: card origen semitransparente, celda destino resaltada con borde azul punteado

### CourseCard (draggable)

- `rounded-lg border-l-4 bg-white shadow-sm p-2`
- Color del borde izquierdo por año de cursada:
  - 1° azul `#3b82f6`, 2° verde `#22c55e`, 3° violeta `#a855f7`, 4° naranja `#f97316`, 5° rojo `#ef4444`
- Badge del año arriba a la derecha (`1°`, `2°`, etc.)
- Nombre de materia: `text-sm font-semibold`
- Docente + alumnos: `text-xs text-gray-500`
- Ícono ✎ si `manually_modified === true`
- Hover: `shadow-md cursor-grab`
- Durante drag: `opacity-50 cursor-grabbing`

### Modal de edición de curso (shadcn Dialog)

- Se abre al hacer **click** en la card (no al arrastrar)
- Muestra: nombre de materia, franja horaria actual
- Selector de docente (shadcn Select)
- Botones Cancelar / Guardar
- Al guardar: llama `PATCH /offers/{id}/courses/{course_id}`, cierra modal, recarga oferta

### Drag & Drop

- Librería: `@dnd-kit/core`
- Al soltar una card en una nueva celda: llama `PATCH /offers/{id}/courses/{course_id}` con el nuevo `time_slot`
- Si la oferta está publicada (`status === "published"`): drag deshabilitado

### Estado "generando"

- Spinner centrado con texto "Ejecutando optimizador... puede tardar varios minutos"
- Polling cada 2 segundos a `GET /jobs/{job_id}`
- Al completar: carga y muestra la oferta generada

---

## Página de Parámetros

- Layout de dos columnas en desktop (`grid grid-cols-2 gap-6`), una columna en mobile
- Card 1 — Capacidad: alumnos por curso, aulas disponibles, horas semanales por docente
- Card 2 — Solver: timeout en segundos + texto explicativo del comportamiento al timeout
- Cards: `rounded-xl border shadow-sm p-6`
- Inputs numéricos shadcn/ui con unidad como suffix visible (ej: "alumnos", "segundos")
- Botón "Guardar cambios" alineado a la derecha debajo de las cards
- Estados del botón: normal → loading (spinner) → "✓ Guardado" (2 segundos) → normal
- Toast de confirmación (shadcn Sonner) al guardar exitosamente

---

## Arquitectura de componentes

```
frontend/src/
├── components/
│   ├── ui/                      ← shadcn/ui auto-generados (no editar)
│   ├── layout/
│   │   ├── AppShell.jsx         ← sidebar + <Outlet /> de react-router
│   │   └── Sidebar.jsx          ← navegación lateral fija
│   ├── calendar/
│   │   ├── CalendarGrid.jsx     ← DndContext, tabla de franjas × días
│   │   ├── CourseCard.jsx       ← card draggable con useDraggable
│   │   └── SlotCell.jsx         ← celda drop zone con useDroppable
│   └── shared/
│       ├── CareerFilter.jsx     ← dropdown multi-select
│       └── StatusBadge.jsx      ← badge BORRADOR / PUBLICADA
├── pages/
│   ├── LoginPage.jsx
│   ├── OffersPage.jsx
│   └── ParametersPage.jsx
├── hooks/
│   ├── useOffer.js              ← carga oferta, polling de job, approve, patch curso
│   └── useParameters.js         ← carga y guarda parámetros
├── api/
│   └── client.js                ← sin cambios
└── context/
    └── AuthContext.jsx          ← sin cambios
```

---

## Paleta de colores

| Token | Valor | Uso |
|---|---|---|
| Fondo app | `#FFFFFF` | Contenido principal |
| Fondo sidebar | `#F9FAFB` | Panel lateral |
| Fondo página | `#F3F4F6` | Login |
| Acento primario | `#3B82F6` (blue-500) | Botones, ítem activo sidebar |
| Texto principal | `#111827` | Títulos |
| Texto secundario | `#6B7280` | Subtítulos, labels |
| Borde | `#E5E7EB` | Cards, inputs |
| Error | `#EF4444` | Mensajes de error |
| Éxito | `#22C55E` | Estado publicada |

---

## Fuera de alcance

- Mobile / responsive más allá de un colapso básico de columnas en Parameters
- Dark mode
- Animaciones complejas de transición entre rutas
- Cambios al backend o API
