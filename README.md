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

## Importar datos desde tu Excel (WMS_IT_DISEÑO_Visual.xlsm)

Inventario, Usuarios y Consumibles tienen un botón **"Importar desde Excel"**.
Sube el mismo `.xlsm` que usas hoy y la web:

1. Busca la hoja correspondiente (`INVENTARIO`, `USUARIOS` o `CONSUMIBLES`).
2. Lee los encabezados de la fila 5 **por nombre de columna** (no por letra
   fija) -- si el día de mañana reordenas o agregas una columna en el Excel,
   el import sigue funcionando mientras el título de la columna no cambie.
3. Te muestra una vista previa antes de importar nada (no se sube a ningún
   servidor, todo el parseo ocurre en tu navegador).

Fallas y Transferencias no tienen importador masivo a propósito: son
registros que se cargan de a uno (reportar una falla puntual, mover un
equipo puntual), igual que en el Excel. Si eso cambia y necesitás cargar
muchas de una vez, se puede agregar el mismo patrón que usan los otros tres
módulos (ver `src/components/ExcelImportButton.tsx`).

## Módulos

| Módulo | Estado |
|---|---|
| Login / Auth | listo |
| Dashboard (KPIs + gráficos en vivo) | listo |
| Inventario (tabla + CRUD + importador de Excel) | listo |
| Usuarios (CRUD + perfil + importador de Excel) | listo |
| Fallas (CRUD + cierre + reporte PDF) | listo |
| Consumibles (stock + semáforo + importador de Excel) | listo |
| Transferencias (CRUD + confirmar/rechazar) | listo |
| Historial | listo |
| Configuración (catálogo de tipos + CDs) | listo |
| Documentos (memorandos + entradas) | listo |

