# Control Tower · Proyectos estratégicos multi-planta

Sistema web para gestionar el portafolio de proyectos estratégicos, Kaizen e iniciativas de reducción de costo de varias plantas, con distintos líderes. Sirve para medir **avance**, **beneficios vs línea base**, **ROI / payback**, **KPIs operativos**, **desviaciones de costo** (real vs presupuesto vs estándar) y **planes de acción**.

- **Demo en vivo:** `dashboard/` en el GitHub Pages del portafolio. Usa datos ficticios guardados en el navegador.
- **Uso real:** la misma app conectada a Supabase (PostgreSQL + login + permisos por rol).

## Módulos

| Módulo | Qué responde |
|---|---|
| Resumen ejecutivo | Ahorro real vs plan, comprometido vs meta, curva acumulada, embudo por etapa, proyectos en riesgo, próximos hitos, acciones vencidas |
| Proyectos | Portafolio en tabla o kanban (arrastrar entre etapas), filtros por planta, líder, etapa, tipo y salud |
| Ficha de proyecto | Hitos (cronograma), beneficios mensuales y ROI, KPIs operativos, check-ins del líder, acciones, replicabilidad entre plantas, aprobación |
| Plantas y líderes | Scorecard por planta y por líder (cumplimiento, atrasos, check-ins al día) |
| Beneficios y ROI | Detalle financiero de todo el portafolio, por clase de costo y tipo de beneficio; KPIs no financieros |
| Árbol de oportunidades | Clase de costo → oportunidad → proyectos: potencial vs identificado vs realizado y brecha sin cubrir |
| Desviaciones de costo | Real vs presupuesto vs estándar (mes / acumulado), mapa de calor por planta, causas raíz cuantificadas, presupuesto editable y proyección de cierre |
| Planes de acción | Acciones de proyectos y de causas raíz, con vencimientos |
| Datos y administración | Plantas y metas, usuarios y roles, clases de costo, exportación CSV para Power BI, respaldo JSON |

## Reglas de medición

- **Avance real** = % ponderado (por peso) de hitos completados. **Avance plan** = % ponderado de hitos cuya fecha plan ya pasó.
- **Semáforo del proyecto**: el peor de tres criterios.
  - **Plazo**: sin hitos vencidos = en plan; atraso de hasta 30 días = en riesgo; más de 30 días = crítico.
  - **Beneficio**: real / plan acumulado al último mes cerrado. ≥ 95 % en plan; ≥ 80 % en riesgo; menos de 80 % crítico.
  - **Reporte del líder**: lo que declaró en su último check-in.
- **Beneficio mensual** = ahorro vs la línea base declarada en la ficha. Se registra plan y real por mes. "Generar curva plan" reparte el ahorro anual comprometido con una rampa de 40 % → 70 % → 100 %.
- **ROI esperado** = ahorro anual comprometido / inversión (CAPEX + OPEX). **Payback plan** = inversión / ahorro mensual comprometido.
- **ROI realizado** = (ahorro real acumulado − inversión) / inversión. **Payback real** = meses de ahorro real hasta recuperar la inversión.
- **KPI operativo**: progreso = avance desde la línea base hacia la meta (sirve con "menor es mejor" y con "mayor es mejor").
- **Desviación de costo**: rojo si es ≥ 3 % sobre presupuesto, ámbar si es > 0,5 %, verde en otro caso. Solo se comparan meses con costo real.
- **Aprobación**: un proyecto no puede pasar a *En ejecución*, *Implementado* o *Cerrado* sin aprobación del jefe de su planta o de Control de Gestión. Lo exige la UI, un `CHECK` y un trigger en la base de datos.

Las reglas están en `src/lib/calc.ts`, con tests en `src/lib/calc.test.ts`.

## Roles y permisos

| Rol | Puede |
|---|---|
| Control de Gestión (admin) | Todo: plantas, metas, usuarios, presupuesto, todos los proyectos |
| Gerencia | Solo lectura de todo |
| Jefe de planta | Aprobar, editar y eliminar proyectos de su planta; editar presupuesto/real y causas raíz de su planta; gestionar el árbol de oportunidades |
| Líder de proyecto | Crear proyectos propios y actualizar los suyos: ficha, hitos, beneficios, KPIs, check-ins, acciones y réplicas. Ve el resto en solo lectura |

En Supabase estos permisos se aplican con RLS (`supabase/migrations/001_schema.sql`). La UI los replica en `src/lib/permissions.ts`. En el demo puedes probar cada rol con el selector **«Ver como»**.

## Desarrollo

```bash
cd app
npm install
npm run dev        # http://localhost:5173 (modo demo)
npm test           # tests de reglas de negocio
npm run build      # typecheck + build a ../dashboard (lo que publica GitHub Pages)
```

Después de cambiar el código, ejecuta `npm run build` y commitea `dashboard/` para actualizar el sitio.

## Pasar a producción con Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecuta `supabase/migrations/001_schema.sql`. Luego ejecuta `supabase/seed_base.sql`, con tus plantas y tu email de administrador.
3. En **Authentication → URL Configuration**, agrega la URL donde publicarás la app (por ejemplo `https://<usuario>.github.io/<repo>/dashboard/`).
4. Crea `app/.env` a partir de `.env.example` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Ejecuta `npm run build` y publica `dashboard/`.
   - Mantén el demo público aparte: compílalo sin `.env` en otra carpeta o en otro sitio.
5. Entra con tu email (enlace mágico). Luego, en **Datos y administración → Usuarios y roles**, agrega a jefes de planta y líderes. Cada uno queda vinculado a su perfil al entrar con su correo.

La `anon key` es pública por diseño. La seguridad de los datos depende de las políticas RLS: un usuario sin perfil asignado no ve nada.

## Power BI

**Opción A, CSV (sirve también en el demo):** en *Datos y administración → Exportar para Power BI*, descarga un CSV por tabla. Las columnas son las mismas de la base de datos.

**Opción B, conexión directa (producción):** crea un usuario de solo lectura para las vistas.

```sql
create role powerbi_lector login password 'cambia-esta-clave';
grant usage on schema public to powerbi_lector;
grant select on vw_proyectos, vw_beneficios_mensuales, vw_desviacion_costos, vw_cobertura_oportunidades to powerbi_lector;
```

En Power BI, ve a *Obtener datos → Base de datos PostgreSQL* y usa el host y puerto del *Session pooler* de Supabase (Project Settings → Database).

| Vista | Uso |
|---|---|
| `vw_proyectos` | Una fila por proyecto: avance, hitos atrasados, ahorro plan/real acumulado, ROI, payback, último check-in |
| `vw_beneficios_mensuales` | Serie mensual plan vs real por proyecto y planta |
| `vw_desviacion_costos` | Real vs presupuesto vs estándar por planta, clase y mes |
| `vw_cobertura_oportunidades` | Potencial vs identificado por oportunidad |

## Stack

React 19 + TypeScript + Vite, sin librerías de UI ni de gráficos (SVG/CSS propios, con modo claro y oscuro). React Router (hash) para funcionar en GitHub Pages. Supabase JS se carga solo en modo producción.

```
app/src/
  lib/        tipos, reglas de negocio (calc), permisos, formato, CSV
  data/       repositorio demo/Supabase, store (estado + mutaciones), seed demo, métricas
  components/ layout, UI, gráficos, íconos
  pages/      una página por módulo
supabase/
  migrations/001_schema.sql   tablas, RLS, trigger de aprobación, vistas Power BI
  seed_base.sql               clases de costo, plantas y primer admin
```
