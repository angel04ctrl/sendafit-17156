# SendaFit - AplicaciÃ³n Fitness con IA

SendaFit es una aplicaciÃ³n web de fitness personalizada que utiliza inteligencia artificial para crear planes de entrenamiento y nutriciÃ³n adaptados a cada usuario.

## ðŸ“‹ Tabla de Contenidos

- [TecnologÃ­as Utilizadas](#tecnologÃ­as-utilizadas)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [InstalaciÃ³n](#instalaciÃ³n)
- [ConfiguraciÃ³n](#configuraciÃ³n)
- [Funcionalidades](#funcionalidades)
- [Arquitectura](#arquitectura)
- [Base de Datos](#base-de-datos)
- [Edge Functions](#edge-functions)
- [Componentes Principales](#componentes-principales)
- [Desarrollo](#desarrollo)

## ðŸš€ TecnologÃ­as Utilizadas

### Frontend
- **React 18** - Biblioteca principal de UI
- **TypeScript** - Tipado estÃ¡tico
- **Vite** - Build tool y dev server
- **React Router DOM** - NavegaciÃ³n entre pÃ¡ginas
- **TanStack Query** - Manejo de estado del servidor
- **Tailwind CSS** - Framework de estilos
- **Shadcn/ui** - Componentes de UI
- **Radix UI** - Primitivos accesibles
- **Lucide React** - Iconos
- **React Hook Form** - Manejo de formularios
- **Zod** - ValidaciÃ³n de esquemas
- **Recharts** - GrÃ¡ficas y visualizaciÃ³n de datos
- **Sonner** - Notificaciones toast

### Backend (Supabase)
- **PostgreSQL** - Base de datos relacional
- **Supabase Auth** - AutenticaciÃ³n
- **Supabase Storage** - Almacenamiento de archivos
- **Edge Functions** - Funciones serverless en Deno
- **Row Level Security (RLS)** - Seguridad a nivel de fila

### Pagos
- **Stripe** - Procesamiento de pagos con tarjeta
- **PayPal** - Procesamiento de pagos con PayPal

### Deployment
- **Supabase** - Hosting y despliegue automÃ¡tico

## ðŸ“ Estructura del Proyecto

```
SendaFit/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ assets/              # ImÃ¡genes y archivos estÃ¡ticos
â”‚   â”œâ”€â”€ components/          # Componentes React reutilizables
â”‚   â”‚   â”œâ”€â”€ onboarding/      # Pasos del formulario de registro (1-7)
â”‚   â”‚   â”œâ”€â”€ ui/              # Componentes de UI (Shadcn)
â”‚   â”‚   â”œâ”€â”€ AddExerciseDialog.tsx
â”‚   â”‚   â”œâ”€â”€ DashboardMobileCarousel.tsx
â”‚   â”‚   â”œâ”€â”€ ExerciseDetailModal.tsx
â”‚   â”‚   â”œâ”€â”€ Navbar.tsx
â”‚   â”‚   â”œâ”€â”€ PaymentModal.tsx
â”‚   â”‚   â”œâ”€â”€ ProButton.tsx
â”‚   â”‚   â”œâ”€â”€ RoutineManager.tsx
â”‚   â”‚   â”œâ”€â”€ SplashScreen.tsx
â”‚   â”‚   â”œâ”€â”€ StatCard.tsx
â”‚   â”‚   â”œâ”€â”€ TodaysWorkouts.tsx
â”‚   â”‚   â””â”€â”€ UpgradeModal.tsx
â”‚   â”œâ”€â”€ contexts/            # Contextos de React
â”‚   â”‚   â”œâ”€â”€ AuthContext.tsx  # Estado de autenticaciÃ³n
â”‚   â”‚   â””â”€â”€ ThemeContext.tsx # Tema claro/oscuro
â”‚   â”œâ”€â”€ hooks/               # Custom React hooks
â”‚   â”‚   â”œâ”€â”€ use-mobile.tsx   # DetecciÃ³n de mÃ³vil
â”‚   â”‚   â”œâ”€â”€ use-toast.ts     # Hook de notificaciones
â”‚   â”‚   â””â”€â”€ useBackendApi.ts # Hooks para API backend
â”‚   â”œâ”€â”€ integrations/        # Integraciones externas
â”‚   â”‚   â””â”€â”€ supabase/
â”‚   â”‚       â”œâ”€â”€ client.ts    # Cliente de Supabase
â”‚   â”‚       â””â”€â”€ types.ts     # Tipos generados de la DB
â”‚   â”œâ”€â”€ lib/                 # Utilidades y helpers
â”‚   â”‚   â”œâ”€â”€ api/
â”‚   â”‚   â”‚   â””â”€â”€ backend.ts   # Funciones de API
â”‚   â”‚   â”œâ”€â”€ dayMapping.ts    # Mapeo de dÃ­as de la semana
â”‚   â”‚   â”œâ”€â”€ macrosCalculator.ts  # CÃ¡lculo de macros
â”‚   â”‚   â””â”€â”€ utils.ts         # Utilidades generales
â”‚   â”œâ”€â”€ pages/               # PÃ¡ginas de la aplicaciÃ³n
â”‚   â”‚   â”œâ”€â”€ Auth.tsx         # Login/Registro
â”‚   â”‚   â”œâ”€â”€ Calendar.tsx     # Calendario de entrenamientos
â”‚   â”‚   â”œâ”€â”€ Dashboard.tsx    # Panel principal
â”‚   â”‚   â”œâ”€â”€ Index.tsx        # PÃ¡gina de inicio
â”‚   â”‚   â”œâ”€â”€ Macros.tsx       # Seguimiento de macros
â”‚   â”‚   â”œâ”€â”€ NotFound.tsx     # PÃ¡gina 404
â”‚   â”‚   â”œâ”€â”€ Profile.tsx      # Perfil de usuario
â”‚   â”‚   â””â”€â”€ Workouts.tsx     # GestiÃ³n de entrenamientos
â”‚   â”œâ”€â”€ App.tsx              # Componente raÃ­z de la app
â”‚   â”œâ”€â”€ main.tsx             # Punto de entrada de React
â”‚   â””â”€â”€ index.css            # Estilos globales y variables CSS
â”œâ”€â”€ supabase/
â”‚   â”œâ”€â”€ functions/           # Edge Functions (Deno)
â”‚   â”‚   â”œâ”€â”€ assign-routine/  # AsignaciÃ³n de rutina IA
â”‚   â”‚   â”œâ”€â”€ complete-workout/ # Marcar entrenamiento completado
â”‚   â”‚   â”œâ”€â”€ generate-weekly-workouts/ # Generar entrenamientos semanales
â”‚   â”‚   â”œâ”€â”€ get-all-workouts/ # Obtener todos los entrenamientos
â”‚   â”‚   â”œâ”€â”€ get-predesigned-plans/ # Planes prediseÃ±ados
â”‚   â”‚   â”œâ”€â”€ get-progress-stats/ # EstadÃ­sticas de progreso
â”‚   â”‚   â”œâ”€â”€ get-progress/ # Progreso del usuario
â”‚   â”‚   â”œâ”€â”€ get-routines/ # Rutinas del usuario
â”‚   â”‚   â”œâ”€â”€ get-todays-workouts/ # Entrenamientos del dÃ­a
â”‚   â”‚   â”œâ”€â”€ get-user-routine/ # Rutina asignada al usuario
â”‚   â”‚   â”œâ”€â”€ get-workouts-by-date/ # Entrenamientos por fecha
â”‚   â”‚   â”œâ”€â”€ payments/ # Procesamiento de pagos
â”‚   â”‚   â”œâ”€â”€ record-progress/ # Registrar progreso
â”‚   â”‚   â”œâ”€â”€ redistribute-workouts/ # Redistribuir entrenamientos
â”‚   â”‚   â””â”€â”€ validate-plan-change/ # Validar cambio de plan
â”‚   â”œâ”€â”€ migrations/          # Migraciones de base de datos
â”‚   â””â”€â”€ config.toml          # ConfiguraciÃ³n de Supabase
â”œâ”€â”€ public/                  # Archivos pÃºblicos
â”œâ”€â”€ index.html               # HTML principal
â”œâ”€â”€ package.json             # Dependencias
â”œâ”€â”€ tailwind.config.ts       # ConfiguraciÃ³n de Tailwind
â””â”€â”€ vite.config.ts           # ConfiguraciÃ³n de Vite
```

## âš™ï¸ InstalaciÃ³n

### Requisitos Previos

- Node.js >= 18
- npm o bun
- Cuenta de Supabase (opcional si usas Supabase)

### Pasos de InstalaciÃ³n

1. Clonar el repositorio:
```bash
git clone https://github.com/tu-usuario/sendafit.git
cd sendafit
```

2. Instalar dependencias:
```bash
npm install
# o
bun install
```

3. Ejecutar en modo desarrollo:
```bash
npm run dev
# o
bun dev
```

4. Abrir en navegador:
```
http://localhost:5173
```

## ðŸ”§ ConfiguraciÃ³n

### Supabase

Este proyecto usa Supabase que incluye Supabase integrado automÃ¡ticamente.
No necesitas configuraciÃ³n adicional para desarrollo.

### Stripe (Opcional)

Para habilitar pagos con Stripe, configura los secrets en Supabase:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PUBLIC_KEY`

### PayPal (Opcional)

Para habilitar pagos con PayPal, configura los secrets:
- `PAYPAL_CLIENT_ID`
- `PAYPAL_SECRET`
- `PAYPAL_MODE` (sandbox o live)

## ðŸŽ¯ Funcionalidades

### Onboarding (7 pasos)
1. **Datos personales**: Nombre, edad, peso, altura, gÃ©nero
2. **Objetivos y nivel**: Objetivo principal, nivel de fitness, tipo de entrenamiento
3. **Historial de salud**: Condiciones mÃ©dicas, medicamentos, lesiones
4. **Seguimiento menstrual**: Solo para usuarios femeninos [PRO]
5. **NutriciÃ³n y hÃ¡bitos**: Preferencias alimenticias, alergias, sueÃ±o, estrÃ©s
6. **MotivaciÃ³n**: Frase motivacional personalizada
7. **Preferencias de app**: Tema, notificaciones, wearables [PRO]

### Dashboard
- **EstadÃ­sticas**: Peso actual, racha de entrenamientos, calorÃ­as quemadas
- **Entrenamientos del dÃ­a**: Lista de workouts programados
- **Macros diarios**: Registro de macronutrientes (proteÃ­na, carbohidratos, grasas)
- **Gestor de rutina**: VisualizaciÃ³n de la rutina asignada por la IA

### Entrenamientos
- Calendario semanal con entrenamientos automÃ¡ticos
- Marcar entrenamientos como completados
- Crear entrenamientos personalizados
- Ver detalles de ejercicios (video, descripciÃ³n, series, repeticiones)
- Agregar ejercicios custom a entrenamientos

### NutriciÃ³n (Macros)
- Calculadora automÃ¡tica de macros segÃºn objetivo
- Registro de comidas por tipo (desayuno, colaciÃ³n AM, comida, colaciÃ³n PM, cena)
- BÃºsqueda en base de datos de 200+ alimentos
- Reconocimiento de alimentos con IA [PRO]

### Perfil
- Editar informaciÃ³n personal
- Cambiar foto de perfil
- Gestionar suscripciÃ³n PRO (Stripe/PayPal)
- Ver estadÃ­sticas de progreso

## ðŸ—ï¸ Arquitectura

### Flujo de AutenticaciÃ³n
```
Usuario â†’ Formulario Auth â†’ Supabase Auth â†’ onboarding_completed?
                                                â”œâ”€ NO â†’ OnboardingForm (7 pasos)
                                                â””â”€ SÃ â†’ Dashboard
```

### Flujo de AsignaciÃ³n de Rutina
```
Onboarding Complete â†’ assign-routine Edge Function
    â†“
Scoring de planes prediseÃ±ados (objetivo, nivel, dÃ­as disponibles)
    â†“
SelecciÃ³n del mejor plan
    â†“
GeneraciÃ³n de workouts de la semana
    â†“
AsignaciÃ³n de ejercicios a cada workout
```

### Flujo de GeneraciÃ³n Semanal
```
Inicio de semana â†’ generate-weekly-workouts Edge Function
    â†“
Verificar plan asignado
    â†“
Eliminar workouts automÃ¡ticos no completados de la semana
    â†“
Generar nuevos workouts segÃºn dÃ­as seleccionados por usuario
    â†“
Distribuir ejercicios del plan en los dÃ­as elegidos
```

## ðŸ—„ï¸ Base de Datos

### Tablas Principales

#### profiles
InformaciÃ³n completa del usuario:
- Datos personales (edad, peso, altura, gÃ©nero)
- Objetivos fitness (goal, level, training types)
- ConfiguraciÃ³n (dÃ­as disponibles, dÃ­as especÃ­ficos de la semana)
- Datos de salud (alergias, condiciones, lesiones) - encriptados
- Preferencias (tema, notificaciones, wearables)
- Macros objetivo (calorÃ­as, proteÃ­nas, carbohidratos, grasas)

#### workouts
Entrenamientos programados:
- Tipo: `automatico` (generado por IA) o `manual` (creado por usuario)
- Estado: `completed` (sÃ­/no)
- Metadata: nombre, descripciÃ³n, fecha, dÃ­a de semana, duraciÃ³n, calorÃ­as

#### exercises
CatÃ¡logo de 500+ ejercicios:
- InformaciÃ³n bÃ¡sica: nombre, descripciÃ³n, grupo muscular
- Detalles tÃ©cnicos: series/reps sugeridas, calorÃ­as por rep, duraciÃ³n
- Recursos: imagen, video
- ClasificaciÃ³n: nivel, tipo de entrenamiento, equipamiento, lugar

#### predesigned_plans
Planes prediseÃ±ados por expertos:
- Metadata: nombre, descripciÃ³n, objetivo, nivel, lugar
- ConfiguraciÃ³n: dÃ­as por semana
- RelaciÃ³n con ejercicios vÃ­a `plan_ejercicios`

### Row Level Security (RLS)

Todas las tablas de usuario tienen polÃ­ticas RLS estrictas:
```sql
-- Solo el usuario autenticado puede ver/modificar sus propios datos
CREATE POLICY "Users can CRUD own data"
ON table_name
FOR ALL
USING (auth.uid() = user_id);
```

## ðŸ”¥ Edge Functions

### assign-routine
Asigna la rutina Ã³ptima al usuario basÃ¡ndose en su perfil.

**Algoritmo de scoring:**
- Coincidencia de objetivo: +70 puntos
- Coincidencia de nivel: +30 puntos
- DÃ­as disponibles adecuados: +20 puntos
- Tipo de entrenamiento preferido: +15 puntos
- Usuario con condiciones de salud + plan principiante: +10 puntos

### generate-weekly-workouts
Genera entrenamientos automÃ¡ticos para la semana actual.

**CaracterÃ­sticas:**
- Respeta los dÃ­as especÃ­ficos seleccionados por el usuario
- Distribuye ejercicios del plan de forma circular
- Evita duplicar ejercicios en un mismo workout
- Programa para la semana actual o siguiente si ya pasÃ³ el dÃ­a

### complete-workout
Marca un entrenamiento como completado y registra timestamp.

### get-progress-stats
Calcula estadÃ­sticas de progreso:
- Total de entrenamientos completados
- Cambio de peso (primera vs Ãºltima mediciÃ³n)
- Nivel de energÃ­a promedio
- Racha de entrenamientos (dÃ­as consecutivos)

### payments
Maneja el flujo completo de pagos:
- **Stripe**: Crea sesiÃ³n de checkout, procesa webhooks
- **PayPal**: Confirma suscripciÃ³n, procesa webhooks
- **Eventos manejados:**
  - checkout.session.completed
  - invoice.payment_succeeded
  - customer.subscription.deleted

## ðŸ§© Componentes Principales

### OnboardingForm
Formulario de 7 pasos con validaciÃ³n de Zod:
- NavegaciÃ³n entre pasos
- ValidaciÃ³n por paso antes de avanzar
- Guardado automÃ¡tico en backend al finalizar
- Llamada a `assign-routine` al completar

### Dashboard
Panel central con:
- StatCards: MÃ©tricas clave (peso, racha, calorÃ­as)
- TodaysWorkouts: Entrenamientos del dÃ­a
- MacrosCard: Registro de comidas y macros del dÃ­a
- RoutineManager: VisualizaciÃ³n de rutina asignada

### TodaysWorkouts
- Lista de entrenamientos del dÃ­a
- BotÃ³n para marcar como completado
- Indicador visual de completado
- IntegraciÃ³n con `complete-workout` edge function

### RoutineManager
- VisualizaciÃ³n de la rutina asignada
- AgrupaciÃ³n de ejercicios por dÃ­a
- Expandible/colapsable por dÃ­a
- EstadÃ­sticas de progreso de la rutina

### PaymentModal
- SelecciÃ³n de plan (mensual/anual)
- SelecciÃ³n de mÃ©todo de pago (Stripe/PayPal)
- CÃ¡lculo de precio con descuento
- IntegraciÃ³n con `/payments/create-checkout-session`

## ðŸ’» Desarrollo

### Comandos

```bash
# Desarrollo
npm run dev

# Build producciÃ³n
npm run build

# Preview build
npm run preview

# Type checking
npm run typecheck
```

### Estructura de Componentes

```tsx
// Ejemplo de componente con comentarios
/**
 * ComponentName.tsx - DescripciÃ³n breve
 * 
 * Este componente se encarga de [funcionalidad principal].
 * Se usa en [contexto de uso].
 */

import React from 'react';

interface ComponentProps {
  // Props del componente
}

export const ComponentName = ({ props }: ComponentProps) => {
  // LÃ³gica del componente
  
  return (
    // JSX del componente
  );
};
```

### Agregar Edge Function

1. Crear carpeta: `supabase/functions/[nombre-funcion]/`
2. Crear `index.ts` con CORS headers
3. Implementar lÃ³gica con `createClient` de Supabase
4. La funciÃ³n se despliega automÃ¡ticamente

```typescript
// Estructura bÃ¡sica de Edge Function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Tu lÃ³gica aquÃ­
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

## ðŸ“ Convenciones

- **Componentes**: PascalCase (`MyComponent.tsx`)
- **Hooks**: camelCase con prefijo `use` (`useMyHook.ts`)
- **Utilidades**: camelCase (`myUtility.ts`)
- **Constantes**: UPPER_SNAKE_CASE
- **Tipos**: PascalCase con sufijo `Type` o `Props`

## ðŸ“„ Licencia

Este proyecto estÃ¡ bajo la Licencia MIT.

## ðŸ”— Enlaces

- **Supabase Docs**: https://supabase.com/docs

