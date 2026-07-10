# WMS·IT Web

Sistema de inventario de TI para Hortifruti CD Santa Tecla (Walmart El
Salvador). Reemplaza el sistema anterior en Excel/VBA por una web
React + Supabase, con datos en tiempo real entre técnicos.

## Stack
- React + TypeScript + Vite
- Tailwind CSS
- Supabase (Postgres + Auth + Realtime)
- Chart.js, jsPDF, SheetJS (para exportar/importar Excel)

## Desarrollo en github.dev (sin terminal local)

Este proyecto está pensado para editarse desde **github.dev** y desplegarse
automáticamente en **Vercel** con cada push — no necesitas correr `npm run
dev` en tu máquina.

### Primer setup (una sola vez)

1. **Conectar Vercel a este repo:**
   - vercel.com → *Add New Project* → importa este repositorio de GitHub.
   - Framework preset: **Vite** (Vercel lo detecta solo).

2. **Configurar las variables de entorno en Vercel** (Project Settings →
   Environment Variables), NO en un archivo `.env` dentro del repo:
   - `VITE_SUPABASE_URL` → tu Project URL de Supabase
   - `VITE_SUPABASE_ANON_KEY` → tu Publishable/anon key de Supabase

   (Mira `.env.example` para el formato — ese archivo es solo referencia,
   no contiene datos reales que importen si es público.)

3. Cada `git push` a `main` dispara un deploy de producción. Cada push a
   otra rama o Pull Request genera una URL de preview aparte.

### Flujo de trabajo diario

1. Abrí el repo en github.dev (con solo poner `github.dev` en vez de
   `github.com` en la URL del repo, o presionando `.` en el repo).
2. Editá los archivos que necesites.
3. Panel de **Source Control** (ícono de rama) → escribí un mensaje de
   commit → **Commit & Push**.
4. Vercel construye solo. Revisá la URL que te da en el dashboard de
   Vercel o en el check del commit en GitHub.

## Estructura del proyecto

```
src/
  lib/supabase.ts       Cliente de Supabase (usa las env vars)
  types/database.ts     Tipos TypeScript del esquema (equipos, fallas...)
  hooks/useAuth.tsx      Contexto de sesión/login
  components/Layout.tsx  Navegación superior (10 módulos)
  pages/                 Una página por módulo (Dashboard, Inventario...)
```

## Base de datos

El esquema completo vive en `/sql` (fuera de este proyecto, en el paquete
que ya tenés): `01_schema.sql` + `02_seguridad_rls.sql`, para correr en el
SQL Editor de tu proyecto de Supabase.

## Módulos

| Módulo | Estado |
|---|---|
| Login / Auth | ✅ listo |
| Dashboard (KPIs + gráficos en vivo) | ✅ listo |
| Inventario | 🔜 próximo — tabla + CRUD + importador de Excel |
| Usuarios | 🔜 pendiente |
| Fallas | 🔜 pendiente |
| Consumibles | 🔜 pendiente |
| Transferencias | 🔜 pendiente |
| Historial | 🔜 pendiente |
| Configuración | 🔜 pendiente |
