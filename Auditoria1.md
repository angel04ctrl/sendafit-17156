# Manual de Induccion Tecnica - SendaFit

Auditoria preparada para que puedas tomar control del proyecto con contexto real del codigo actual. La idea es que este documento funcione como mapa, manual de mantenimiento y lista de advertencias.

---

## 1. Arquitectura y Tecnologias

### Stack tecnologico exacto

**Frontend**

- React 18 con TypeScript: toda la interfaz vive en `src/`.
- Vite: servidor de desarrollo, build y configuracion PWA.
- React Router DOM: rutas de la app como `/auth`, `/dashboard`, `/workouts`, `/calendar`, `/profile`.
- TanStack Query: cache, carga y revalidacion de datos del backend.
- Tailwind CSS: estilos utilitarios.
- shadcn/ui + Radix UI: componentes base de interfaz (`Button`, `Card`, `Dialog`, `Select`, `Tabs`, etc.).
- Sonner y Toaster: notificaciones de usuario.
- date-fns: fechas y formato en espanol.
- lucide-react: iconos.
- Recharts: graficas.
- React Hook Form y Zod: disponibles para formularios/validacion, aunque algunas pantallas usan estado local.
- Vite PWA: manifiesto, iconos y soporte de instalacion tipo app.

**Backend**

- Supabase Auth: autenticacion y sesiones.
- Supabase PostgreSQL: base de datos principal.
- Supabase Row Level Security: reglas para que cada usuario vea/modifique solo lo suyo.
- Supabase Edge Functions: funciones serverless en `supabase/functions/`.
- Supabase Realtime: suscripciones a cambios en tablas como `workouts`, `profiles`, `user_roles`.

**Pagos e IA**

- Stripe/PayPal: variables configuradas para pagos PRO.
- Edge Functions de IA: `analyze-food`, `analyze-gym-machine`, `ai-trainer-chat`.
- Feature flags: `FeatureFlagsContext` combina flags globales, usuario PRO/dev y flags runtime.

**Configuracion sensible**

El archivo `.env` contiene claves de cliente para Supabase y PayPal:

- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PAYPAL_CLIENT_ID`
- `VITE_PAYPAL_PLAN_ID_MONTHLY`
- `VITE_PAYPAL_PLAN_ID_ANNUAL`

No subas secretos privados al frontend. Las variables que empiezan con `VITE_` quedan disponibles en el navegador.

### Patron de arquitectura

El proyecto sigue una **arquitectura por capas basada en componentes**:

```txt
UI / Paginas
  src/pages/*
  src/components/*

Estado y logica de frontend
  src/contexts/*
  src/hooks/*

Cliente de datos
  src/lib/api/backend.ts
  src/integrations/supabase/client.ts

Backend serverless
  supabase/functions/*

Base de datos
  supabase/migrations/*
  supabase/schema_export.sql
```

No es MVC puro. En React se trabaja mas naturalmente con componentes, hooks y contextos. La separacion elegida permite que una pagina como `Workouts.tsx` se concentre en UI, mientras `useBackendApi.ts` maneja React Query y `backend.ts` centraliza llamadas a Edge Functions.

La analogia util: las paginas son el mostrador, los hooks son los encargados que piden informacion, `backend.ts` es la recepcion telefonica, las Edge Functions son la oficina interna y PostgreSQL es el archivo maestro.

---

## 2. Mapa del Proyecto

### Arbol visual principal

```txt
sendafit-17156/
|-- .env
|-- .gitignore
|-- package.json
|-- package-lock.json
|-- bun.lockb
|-- vite.config.ts
|-- tsconfig.json
|-- tsconfig.app.json
|-- tsconfig.node.json
|-- tailwind.config.ts
|-- postcss.config.js
|-- eslint.config.js
|-- components.json
|-- index.html
|-- README.md
|-- BACKEND_API.md
|-- BACKEND_STRUCTURE.md
|-- Auditoria1.md
|-- DEBUG_QUERIES.sql
|-- public/
|-- src/
|   |-- main.tsx
|   |-- App.tsx
|   |-- index.css
|   |-- App.css
|   |-- setupTests.ts
|   |-- vite-env.d.ts
|   |-- assets/
|   |-- components/
|   |   |-- ui/
|   |   |-- ai/
|   |   |-- auth/
|   |   |-- onboarding/
|   |   |-- Navbar.tsx
|   |   |-- TodaysWorkouts.tsx
|   |   |-- RoutineManager.tsx
|   |   |-- FeatureGate.tsx
|   |   |-- ProButton.tsx
|   |   |-- PaymentModal.tsx
|   |   |-- PlanChangePreviewModal.tsx
|   |   |-- ErrorBoundary.tsx
|   |-- contexts/
|   |   |-- AuthContext.tsx
|   |   |-- FeatureFlagsContext.tsx
|   |   |-- ThemeContext.tsx
|   |-- hooks/
|   |   |-- useBackendApi.ts
|   |   |-- use-mobile.tsx
|   |   |-- use-toast.ts
|   |   |-- useDevOverride.ts
|   |   |-- useMenstrualTracking.ts
|   |-- integrations/
|   |   |-- supabase/
|   |       |-- client.ts
|   |       |-- types.ts
|   |-- lib/
|   |   |-- api/
|   |   |   |-- backend.ts
|   |   |-- dayMapping.ts
|   |   |-- devConfig.ts
|   |   |-- macrosCalculator.ts
|   |   |-- utils.ts
|   |-- pages/
|       |-- Auth.tsx
|       |-- Dashboard.tsx
|       |-- Workouts.tsx
|       |-- Calendar.tsx
|       |-- Macros.tsx
|       |-- Profile.tsx
|       |-- UpdatePassword.tsx
|       |-- NotFound.tsx
|-- supabase/
|   |-- config.toml
|   |-- migrations/
|   |-- functions/
|   |   |-- assign-routine/
|   |   |-- generate-weekly-workouts/
|   |   |-- get-todays-workouts/
|   |   |-- get-workouts-by-date/
|   |   |-- get-all-workouts/
|   |   |-- complete-workout/
|   |   |-- record-progress/
|   |   |-- get-progress/
|   |   |-- get-progress-stats/
|   |   |-- get-user-routine/
|   |   |-- get-routines/
|   |   |-- get-predesigned-plans/
|   |   |-- validate-plan-change/
|   |   |-- redistribute-workouts/
|   |   |-- payments/
|   |   |-- analyze-food/
|   |   |-- analyze-gym-machine/
|   |   |-- ai-trainer-chat/
|   |-- schema_export.sql
|   |-- migracion_completa.sql
|-- BD-sendaFit/
|-- dist/
|-- node_modules/
```

### Archivos y carpetas clave

**Raiz**

- `.env`: variables publicas de Vite. Importante para Supabase y PayPal. No pongas service role keys aqui.
- `package.json`: scripts (`dev`, `build`, `lint`, `test`) y dependencias.
- `package-lock.json` / `bun.lockb`: locks de dependencias. Actualmente conviven npm y bun; si trabajas con npm, conserva `package-lock.json`.
- `vite.config.ts`: configura Vite, puerto `8083`, alias `@` hacia `src/`, plugin React SWC y PWA.
- `tailwind.config.ts`: tema visual, colores, fuentes y extensiones de Tailwind.
- `components.json`: configuracion de shadcn/ui.
- `eslint.config.js`: reglas de lint.
- `tsconfig*.json`: configuracion de TypeScript para app, node y proyecto.
- `index.html`: HTML base donde React monta la app.
- `DEBUG_QUERIES.sql`: consultas de apoyo para revisar datos en Supabase. Util para desarrollo, no es parte de runtime.
- `README.md`, `BACKEND_API.md`, `BACKEND_STRUCTURE.md`: documentacion general y tecnica del backend.
- `Auditoria1.md`: este manual.

**public/**

- `favicon.ico`, `icon-192.png`, `icon-512.png`: assets PWA e iconos.
- `placeholder.svg`, `robots.txt`: recursos estaticos.

**src/main.tsx**

Punto de entrada React. Monta `<App />` en el DOM.

**src/App.tsx**

Componente raiz. Envuelve la app con:

- `ErrorBoundary`
- `BrowserRouter`
- `QueryClientProvider`
- `ThemeProvider`
- `AuthProvider`
- `FeatureFlagsProvider`
- `TooltipProvider`
- Toasters
- Rutas principales

Es uno de los archivos mas delicados porque define la estructura global.

**src/pages/**

- `Auth.tsx`: login/registro.
- `Dashboard.tsx`: pantalla principal.
- `Workouts.tsx`: entrenamientos de hoy, proximos entrenamientos, crear/eliminar/completar entrenamientos.
- `Calendar.tsx`: agenda semanal. Ya no muestra paneles internos de diagnostico; si falla la carga, muestra un aviso generico al usuario.
- `Macros.tsx`: nutricion/macros.
- `Profile.tsx`: datos personales, dias de entrenamiento, objetivo, macros, pagos PRO y redistribucion/generacion de entrenamientos.
- `UpdatePassword.tsx`: cambio de contrasena.
- `NotFound.tsx`: 404.

**src/components/**

- `ui/`: componentes base de shadcn. Normalmente no conviene reescribirlos salvo que entiendas el patron.
- `Navbar.tsx`: navegacion principal.
- `TodaysWorkouts.tsx`: resumen de entrenamientos del dia.
- `RoutineManager.tsx`: gestion/asignacion de rutina.
- `AddExerciseDialog.tsx`: selector/configurador de ejercicios.
- `ExerciseDetailModal.tsx`: detalle visual de ejercicio.
- `PlanChangePreviewModal.tsx`: confirmacion antes de cambiar plan/dias.
- `PaymentModal.tsx`, `PaymentSuccessModal.tsx`, `UpgradeModal.tsx`: pagos y conversion PRO.
- `FeatureGate.tsx`, `ProButton.tsx`: control de acceso a funcionalidades premium.
- `ErrorBoundary.tsx`: captura errores React y evita pantalla blanca total.
- `ai/`: componentes para IA de comida, maquinas y chat.
- `onboarding/`: formulario inicial por pasos.
- `auth/`: dialogos de autenticacion.

**src/contexts/**

- `AuthContext.tsx`: usuario, sesion, carga inicial y logout. Valida que el usuario exista en `profiles`.
- `FeatureFlagsContext.tsx`: combina flags globales (`app_config`), flags del usuario (`user_settings`) y estado de suscripcion.
- `ThemeContext.tsx`: tema visual.

**src/hooks/**

- `useBackendApi.ts`: centro de hooks de datos. Aqui viven los hooks React Query: `useTodaysWorkouts`, `useWeeklyCalendarWorkouts`, `useGenerateWeeklyWorkouts`, etc.
- `use-mobile.tsx`: deteccion responsive.
- `useMenstrualTracking.ts`: logica del seguimiento menstrual.
- `useDevOverride.ts`: soporte de desarrollo.
- `use-toast.ts`: wrapper de toast.

**src/lib/**

- `api/backend.ts`: cliente de Edge Functions. Si una pantalla llama al backend serverless, normalmente pasa por aqui.
- `macrosCalculator.ts`: calcula metas nutricionales y valida datos de perfil.
- `dayMapping.ts`: mapeo de dias.
- `devConfig.ts`: capa legacy; indica que ahora se debe usar `FeatureFlagsContext`.
- `utils.ts`: utilidades compartidas.

**src/integrations/supabase/**

- `client.ts`: crea el cliente Supabase con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- `types.ts`: tipos generados desde la base de datos. No conviene editar a mano.

**supabase/config.toml**

Configura el proyecto Supabase y si cada Edge Function requiere JWT. Algunas funciones como `get-routines` y `get-predesigned-plans` estan publicas; las funciones de usuario requieren token.

**supabase/functions/**

Funciones backend. Las mas importantes:

- `generate-weekly-workouts`: genera entrenamientos automaticos segun perfil/rutina.
- `assign-routine`: asigna rutina.
- `redistribute-workouts`: redistribuye entrenamientos al cambiar dias.
- `validate-plan-change`: calcula impacto antes de cambiar dias u objetivo.
- `get-todays-workouts`: trae entrenamientos de hoy con timezone.
- `get-workouts-by-date`: trae entrenamientos por fecha/rango.
- `get-all-workouts`: trae rutina completa/historial.
- `complete-workout`: marca entrenamiento como completado.
- `record-progress`: guarda progreso.
- `payments`: integra pagos/suscripciones.
- `analyze-food`, `analyze-gym-machine`, `ai-trainer-chat`: funciones IA.

**supabase/migrations/**

Historial SQL. Aqui se crean/modifican tablas, politicas RLS, triggers e integridad referencial. Es zona critica.

**BD-sendaFit/**

Exports CSV de tablas. Utiles para auditoria, backups o revisar datos historicos. No son runtime de la app.

**dist/** y **node_modules/**

Generados. No los edites manualmente.

---

## 3. Flujo de Datos

### Flujo A: el usuario abre Agenda/Calendario

1. El usuario entra a `/calendar`.
2. `App.tsx` renderiza `Calendar.tsx`.
3. `Calendar.tsx` obtiene el usuario desde `useAuth()`.
4. Calcula el inicio de semana y el rango de 14 dias.
5. Llama a `useWeeklyCalendarWorkouts(startDate, endDate, user.id)`.
6. Ese hook vive en `src/hooks/useBackendApi.ts`.
7. El hook consulta directamente Supabase:
   - tabla `workouts`
   - filtro `user_id`
   - rango `scheduled_date`
   - incluye `workout_exercises`
8. `Calendar.tsx` tambien consulta `profiles.available_weekdays` para saber que dias estan programados.
9. La UI pinta:
   - dias de la semana
   - entrenamientos pendientes
   - entrenamientos completados
10. Si falla Supabase, se muestra un aviso simple: "Estamos presentando problemas con tu agenda". No se muestran IDs, rutinas ni paneles tecnicos al usuario final.

### Flujo B: el usuario edita perfil y cambia dias/objetivo

1. El usuario entra a `/profile`.
2. `Profile.tsx` usa `AuthContext` para saber quien es.
3. `fetchProfile()` consulta:
   - `profiles`
   - `user_roles`
   - `user_subscriptions`
4. El usuario toca "Editar" y cambia dias, objetivo o datos fisicos.
5. Al guardar, `handleSubmit()` compara:
   - objetivo anterior vs objetivo nuevo
   - cantidad de dias anterior vs nueva
6. Si hay cambio relevante, llama a `useValidatePlanChange()`.
7. `useValidatePlanChange()` llama `validatePlanChange()` en `src/lib/api/backend.ts`.
8. `backend.ts` invoca la Edge Function `validate-plan-change`.
9. Si el cambio afecta entrenamientos, se abre `PlanChangePreviewModal`.
10. Si el usuario confirma:
    - `saveProfileChanges()` actualiza `profiles`
    - `useGenerateWeeklyWorkouts()` llama `generate-weekly-workouts`
    - React Query invalida caches: rutina, entrenamientos de hoy, por fecha y todos los entrenamientos
11. Al revalidar, `Workouts` y `Calendar` muestran los datos corregidos.

Esto explica lo que observaste: al editar perfil y volver a seleccionar dias, se forzo una actualizacion de `profiles` y regeneracion/relectura de entrenamientos; por eso se corrigieron Agenda y Entrenar.

### Flujo C: completar un entrenamiento

1. El usuario esta en `/workouts`.
2. `Workouts.tsx` pinta entrenamientos con `useTodaysWorkouts()` y `useWeeklyWorkouts()`.
3. El usuario marca un entrenamiento.
4. `handleCompleteWorkout()` ejecuta `useCompleteWorkout()`.
5. `useCompleteWorkout()` llama `completeWorkout()` en `backend.ts`.
6. `backend.ts` invoca Edge Function `complete-workout`.
7. La funcion actualiza `workouts.completed` y campos relacionados.
8. React Query invalida:
   - `all-workouts`
   - `todays-workouts`
   - `workouts-by-date`
9. La UI se refresca sin que el usuario recargue.

---

## 4. Zonas Seguras vs. Zonas de Peligro

### Zonas seguras

Puedes modificar con bajo riesgo si mantienes nombres de props y no cambias contratos:

- Textos visibles en `src/pages/*` y `src/components/*`.
- Estilos Tailwind dentro de `className`.
- Componentes visuales simples nuevos en `src/components/`.
- Nuevas paginas que solo muestran informacion.
- Assets en `src/assets/` o `public/`.
- Mensajes de error amigables para usuario.
- Layout de tarjetas, botones, badges, espaciados.

Ejemplos seguros:

- Cambiar "Entrenamientos de Hoy" por otro texto.
- Ajustar `p-4`, `gap-3`, colores o tamanos.
- Crear `src/components/InfoCard.tsx`.
- Agregar una seccion visual en `Dashboard.tsx` que no escriba en BD.

### Zonas de peligro

Estas partes son criticas porque conectan autenticacion, datos, pagos o generacion de entrenamientos:

- `src/App.tsx`: si rompes providers o rutas, toda la app falla.
- `src/contexts/AuthContext.tsx`: controla sesiones. Un cambio malo puede impedir login o sacar usuarios.
- `src/contexts/FeatureFlagsContext.tsx`: controla PRO/dev/IA. Un error puede desbloquear o bloquear funciones incorrectamente.
- `src/integrations/supabase/client.ts`: conexion a Supabase. No cambies URL/key sin razon.
- `src/hooks/useBackendApi.ts`: cache y mutaciones. Cambiar `queryKey` sin invalidaciones correctas deja UI desactualizada.
- `src/lib/api/backend.ts`: contratos con Edge Functions. Cambiar nombres de body/respuesta rompe llamadas.
- `src/pages/Profile.tsx`: toca perfil, macros, pagos, validacion de cambio de plan y regeneracion de entrenamientos.
- `src/pages/Workouts.tsx`: crea, elimina y completa entrenamientos.
- `supabase/functions/generate-weekly-workouts/index.ts`: logica central para crear entrenamientos automaticos.
- `supabase/functions/redistribute-workouts/index.ts`: reordena entrenamientos al cambiar dias.
- `supabase/functions/validate-plan-change/index.ts`: decide si se debe regenerar o redistribuir.
- `supabase/migrations/*`: estructura y seguridad de la base de datos.
- `supabase/config.toml`: seguridad JWT de funciones.
- `.env`: variables de conexion/pagos.

Regla practica:

- Si solo cambia color/texto: riesgo bajo.
- Si cambia datos del usuario: riesgo medio.
- Si cambia Auth, pagos, Edge Functions, migrations o RLS: riesgo alto.

Antes de tocar una zona de peligro:

1. Busca referencias con `rg "nombreFuncion" src supabase`.
2. Lee el flujo completo antes de editar.
3. Prueba con `npm run build`.
4. Prueba manualmente la pantalla afectada.
5. Revisa que no se muestren datos tecnicos al usuario final.

---

## 5. Guia Paso a Paso para Agregar Algo Nuevo

### Caso 1: agregar una pagina simple

Ejemplo: quieres crear `/habits` para habitos.

1. Crear archivo:

```txt
src/pages/Habits.tsx
```

2. Estructura base:

```tsx
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";

const Habits = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-14 sm:pt-16 pb-16 sm:pb-20 px-3 sm:px-4">
        <div className="max-w-4xl mx-auto space-y-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1">
              Habitos
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Registra tus habitos diarios.
            </p>
          </div>

          <Card className="p-4">
            Contenido inicial
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Habits;
```

3. Registrar ruta en `src/App.tsx`:

```tsx
const Habits = lazy(() => import("./pages/Habits"));
```

Dentro de `<Routes>`:

```tsx
<Route path="/habits" element={<Habits />} />
```

Siempre antes de:

```tsx
<Route path="*" element={<NotFound />} />
```

4. Agregar link en `src/components/Navbar.tsx` si debe aparecer en navegacion.

5. Probar:

```bash
npm run build
npm run dev
```

6. Abrir:

```txt
http://localhost:8083/habits
```

### Caso 2: agregar funcionalidad que lee datos existentes

1. Revisa si ya existe hook en `src/hooks/useBackendApi.ts`.
2. Si existe, usalo desde la pagina:

```tsx
const { data, isLoading, isError } = useProgressStats();
```

3. Maneja tres estados:

- cargando
- error amigable
- datos vacios

4. No muestres errores tecnicos, IDs internos o resultados de diagnostico en produccion.

### Caso 3: agregar funcionalidad que necesita backend nuevo

Checklist exacto:

1. Define que tabla o datos necesitas.
2. Si necesitas tabla nueva, crea migration SQL en `supabase/migrations/`.
3. Agrega RLS desde el inicio.
4. Crea Edge Function en `supabase/functions/nombre-funcion/index.ts`.
5. Agrega su configuracion JWT en `supabase/config.toml`.
6. Crea wrapper en `src/lib/api/backend.ts`.
7. Crea hook en `src/hooks/useBackendApi.ts`.
8. Consume el hook desde pagina/componente.
9. Agrega estados de carga/error/vacio.
10. Invalida queries relacionadas despues de mutaciones.
11. Prueba manualmente y con `npm run build`.

Ejemplo de wrapper:

```ts
export async function getMyNewData() {
  const { data, error } = await supabase.functions.invoke("my-new-function", {
    method: "POST",
    body: {},
  });

  if (error) throw error;
  return data;
}
```

Ejemplo de hook:

```ts
export const useMyNewData = () => {
  return useQuery({
    queryKey: ["my-new-data"],
    queryFn: getMyNewData,
    staleTime: 5 * 60 * 1000,
  });
};
```

### Checklist final antes de entregar cambios

```txt
[ ] npm run build pasa
[ ] La pagina afectada carga sin pantalla blanca
[ ] No hay paneles de diagnostico visibles al usuario
[ ] Los errores de BD/API son mensajes amigables
[ ] No subi secretos al frontend
[ ] Si cambie datos, invalide React Query correctamente
[ ] Si toque Edge Functions, revise JWT y RLS
[ ] Si agregue ruta, esta antes del wildcard 404
```

---

## Nota de mantenimiento reciente

Se elimino el helper `src/lib/diagnosis.ts`, que era una herramienta de diagnostico para consola. La pantalla de Agenda/Calendario no debe mostrar paneles como "Perfil encontrado", "Entrenamientos totales" o "Rutina asignada" al usuario final. En caso de error de datos, la UI debe mostrar un aviso generico y accionable, sin detalles internos de base de datos.

