# SendaFit - Aplicación Fitness con IA

SendaFit es una aplicación web de fitness personalizada que utiliza inteligencia artificial para crear planes de entrenamiento y nutrición adaptados a cada usuario.

## 📋 Tabla de Contenidos

- [Tecnologías Utilizadas](#tecnologías-utilizadas)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Funcionalidades](#funcionalidades)
- [Arquitectura](#arquitectura)
- [Base de Datos](#base-de-datos)
- [Edge Functions](#edge-functions)
- [Componentes Principales](#componentes-principales)
- [Desarrollo](#desarrollo)

## 🚀 Tecnologías Utilizadas

### Frontend
- **React 18** - Biblioteca principal de UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool y dev server
- **React Router DOM** - Navegación entre páginas
- **TanStack Query** - Manejo de estado del servidor
- **Tailwind CSS** - Framework de estilos
- **Shadcn/ui** - Componentes de UI
- **Radix UI** - Primitivos accesibles
- **Lucide React** - Iconos
- **React Hook Form** - Manejo de formularios
- **Zod** - Validación de esquemas
- **Recharts** - Gráficas y visualización de datos
- **Sonner** - Notificaciones toast

### Backend (Supabase)
- **PostgreSQL** - Base de datos relacional
- **Supabase Auth** - Autenticación
- **Supabase Storage** - Almacenamiento de archivos
- **Edge Functions** - Funciones serverless en Deno
- **Row Level Security (RLS)** - Seguridad a nivel de fila

### Pagos
- **Stripe** - Procesamiento de pagos con tarjeta
- **PayPal** - Procesamiento de pagos con PayPal

### Deployment
- **Lovable Cloud** - Hosting y despliegue automático

## 📁 Estructura del Proyecto

```
SendaFit/
├── src/
│   ├── assets/              # Imágenes y archivos estáticos
│   ├── components/          # Componentes React reutilizables
│   │   ├── onboarding/      # Pasos del formulario de registro (1-7)
│   │   ├── ui/              # Componentes de UI (Shadcn)
│   │   ├── AddExerciseDialog.tsx
│   │   ├── DashboardMobileCarousel.tsx
│   │   ├── ExerciseDetailModal.tsx
│   │   ├── Navbar.tsx
│   │   ├── PaymentModal.tsx
│   │   ├── ProButton.tsx
│   │   ├── RoutineManager.tsx
│   │   ├── SplashScreen.tsx
│   │   ├── StatCard.tsx
│   │   ├── TodaysWorkouts.tsx
│   │   └── UpgradeModal.tsx
│   ├── contexts/            # Contextos de React
│   │   ├── AuthContext.tsx  # Estado de autenticación
│   │   └── ThemeContext.tsx # Tema claro/oscuro
│   ├── hooks/               # Custom React hooks
│   │   ├── use-mobile.tsx   # Detección de móvil
│   │   ├── use-toast.ts     # Hook de notificaciones
│   │   └── useBackendApi.ts # Hooks para API backend
│   ├── integrations/        # Integraciones externas
│   │   └── supabase/
│   │       ├── client.ts    # Cliente de Supabase
│   │       └── types.ts     # Tipos generados de la DB
│   ├── lib/                 # Utilidades y helpers
│   │   ├── api/
│   │   │   └── backend.ts   # Funciones de API
│   │   ├── dayMapping.ts    # Mapeo de días de la semana
│   │   ├── macrosCalculator.ts  # Cálculo de macros
│   │   └── utils.ts         # Utilidades generales
│   ├── pages/               # Páginas de la aplicación
│   │   ├── Auth.tsx         # Login/Registro
│   │   ├── Calendar.tsx     # Calendario de entrenamientos
│   │   ├── Dashboard.tsx    # Panel principal
│   │   ├── Index.tsx        # Página de inicio
│   │   ├── Macros.tsx       # Seguimiento de macros
│   │   ├── NotFound.tsx     # Página 404
│   │   ├── Profile.tsx      # Perfil de usuario
│   │   └── Workouts.tsx     # Gestión de entrenamientos
│   ├── App.tsx              # Componente raíz de la app
│   ├── main.tsx             # Punto de entrada de React
│   └── index.css            # Estilos globales y variables CSS
├── supabase/
│   ├── functions/           # Edge Functions (Deno)
│   │   ├── assign-routine/  # Asignación de rutina IA
│   │   ├── complete-workout/ # Marcar entrenamiento completado
│   │   ├── generate-weekly-workouts/ # Generar entrenamientos semanales
│   │   ├── get-all-workouts/ # Obtener todos los entrenamientos
│   │   ├── get-predesigned-plans/ # Planes prediseñados
│   │   ├── get-progress-stats/ # Estadísticas de progreso
│   │   ├── get-progress/ # Progreso del usuario
│   │   ├── get-routines/ # Rutinas del usuario
│   │   ├── get-todays-workouts/ # Entrenamientos del día
│   │   ├── get-user-routine/ # Rutina asignada al usuario
│   │   ├── get-workouts-by-date/ # Entrenamientos por fecha
│   │   ├── payments/ # Procesamiento de pagos
│   │   ├── record-progress/ # Registrar progreso
│   │   ├── redistribute-workouts/ # Redistribuir entrenamientos
│   │   └── validate-plan-change/ # Validar cambio de plan
│   ├── migrations/          # Migraciones de base de datos
│   └── config.toml          # Configuración de Supabase
├── public/                  # Archivos públicos
├── index.html               # HTML principal
├── package.json             # Dependencias
├── tailwind.config.ts       # Configuración de Tailwind
└── vite.config.ts           # Configuración de Vite
```

## ⚙️ Instalación

### Requisitos Previos

- Node.js >= 18
- npm o bun
- Cuenta de Supabase (opcional si usas Lovable Cloud)

### Pasos de Instalación

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

## 🔧 Configuración

### Lovable Cloud

Este proyecto usa Lovable Cloud que incluye Supabase integrado automáticamente.
No necesitas configuración adicional para desarrollo.

### Stripe (Opcional)

Para habilitar pagos con Stripe, configura los secrets en Lovable Cloud:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PUBLIC_KEY`

### PayPal (Opcional)

Para habilitar pagos con PayPal, configura los secrets:
- `PAYPAL_CLIENT_ID`
- `PAYPAL_SECRET`
- `PAYPAL_MODE` (sandbox o live)

## 🎯 Funcionalidades

### Onboarding (7 pasos)
1. **Datos personales**: Nombre, edad, peso, altura, género
2. **Objetivos y nivel**: Objetivo principal, nivel de fitness, tipo de entrenamiento
3. **Historial de salud**: Condiciones médicas, medicamentos, lesiones
4. **Seguimiento menstrual**: Solo para usuarios femeninos [PRO]
5. **Nutrición y hábitos**: Preferencias alimenticias, alergias, sueño, estrés
6. **Motivación**: Frase motivacional personalizada
7. **Preferencias de app**: Tema, notificaciones, wearables [PRO]

### Dashboard
- **Estadísticas**: Peso actual, racha de entrenamientos, calorías quemadas
- **Entrenamientos del día**: Lista de workouts programados
- **Macros diarios**: Registro de macronutrientes (proteína, carbohidratos, grasas)
- **Gestor de rutina**: Visualización de la rutina asignada por la IA

### Entrenamientos
- Calendario semanal con entrenamientos automáticos
- Marcar entrenamientos como completados
- Crear entrenamientos personalizados
- Ver detalles de ejercicios (video, descripción, series, repeticiones)
- Agregar ejercicios custom a entrenamientos

### Nutrición (Macros)
- Calculadora automática de macros según objetivo
- Registro de comidas por tipo (desayuno, colación AM, comida, colación PM, cena)
- Búsqueda en base de datos de 200+ alimentos
- Reconocimiento de alimentos con IA [PRO]

### Perfil
- Editar información personal
- Cambiar foto de perfil
- Gestionar suscripción PRO (Stripe/PayPal)
- Ver estadísticas de progreso

## 🏗️ Arquitectura

### Flujo de Autenticación
```
Usuario → Formulario Auth → Supabase Auth → onboarding_completed?
                                                ├─ NO → OnboardingForm (7 pasos)
                                                └─ SÍ → Dashboard
```

### Flujo de Asignación de Rutina
```
Onboarding Complete → assign-routine Edge Function
    ↓
Scoring de planes prediseñados (objetivo, nivel, días disponibles)
    ↓
Selección del mejor plan
    ↓
Generación de workouts de la semana
    ↓
Asignación de ejercicios a cada workout
```

### Flujo de Generación Semanal
```
Inicio de semana → generate-weekly-workouts Edge Function
    ↓
Verificar plan asignado
    ↓
Eliminar workouts automáticos no completados de la semana
    ↓
Generar nuevos workouts según días seleccionados por usuario
    ↓
Distribuir ejercicios del plan en los días elegidos
```

## 🗄️ Base de Datos

### Tablas Principales

#### profiles
Información completa del usuario:
- Datos personales (edad, peso, altura, género)
- Objetivos fitness (goal, level, training types)
- Configuración (días disponibles, días específicos de la semana)
- Datos de salud (alergias, condiciones, lesiones) - encriptados
- Preferencias (tema, notificaciones, wearables)
- Macros objetivo (calorías, proteínas, carbohidratos, grasas)

#### workouts
Entrenamientos programados:
- Tipo: `automatico` (generado por IA) o `manual` (creado por usuario)
- Estado: `completed` (sí/no)
- Metadata: nombre, descripción, fecha, día de semana, duración, calorías

#### exercises
Catálogo de 500+ ejercicios:
- Información básica: nombre, descripción, grupo muscular
- Detalles técnicos: series/reps sugeridas, calorías por rep, duración
- Recursos: imagen, video
- Clasificación: nivel, tipo de entrenamiento, equipamiento, lugar

#### predesigned_plans
Planes prediseñados por expertos:
- Metadata: nombre, descripción, objetivo, nivel, lugar
- Configuración: días por semana
- Relación con ejercicios vía `plan_ejercicios`

### Row Level Security (RLS)

Todas las tablas de usuario tienen políticas RLS estrictas:
```sql
-- Solo el usuario autenticado puede ver/modificar sus propios datos
CREATE POLICY "Users can CRUD own data"
ON table_name
FOR ALL
USING (auth.uid() = user_id);
```

## 🔥 Edge Functions

### assign-routine
Asigna la rutina óptima al usuario basándose en su perfil.

**Algoritmo de scoring:**
- Coincidencia de objetivo: +70 puntos
- Coincidencia de nivel: +30 puntos
- Días disponibles adecuados: +20 puntos
- Tipo de entrenamiento preferido: +15 puntos
- Usuario con condiciones de salud + plan principiante: +10 puntos

### generate-weekly-workouts
Genera entrenamientos automáticos para la semana actual.

**Características:**
- Respeta los días específicos seleccionados por el usuario
- Distribuye ejercicios del plan de forma circular
- Evita duplicar ejercicios en un mismo workout
- Programa para la semana actual o siguiente si ya pasó el día

### complete-workout
Marca un entrenamiento como completado y registra timestamp.

### get-progress-stats
Calcula estadísticas de progreso:
- Total de entrenamientos completados
- Cambio de peso (primera vs última medición)
- Nivel de energía promedio
- Racha de entrenamientos (días consecutivos)

### payments
Maneja el flujo completo de pagos:
- **Stripe**: Crea sesión de checkout, procesa webhooks
- **PayPal**: Confirma suscripción, procesa webhooks
- **Eventos manejados:**
  - checkout.session.completed
  - invoice.payment_succeeded
  - customer.subscription.deleted

## 🧩 Componentes Principales

### OnboardingForm
Formulario de 7 pasos con validación de Zod:
- Navegación entre pasos
- Validación por paso antes de avanzar
- Guardado automático en backend al finalizar
- Llamada a `assign-routine` al completar

### Dashboard
Panel central con:
- StatCards: Métricas clave (peso, racha, calorías)
- TodaysWorkouts: Entrenamientos del día
- MacrosCard: Registro de comidas y macros del día
- RoutineManager: Visualización de rutina asignada

### TodaysWorkouts
- Lista de entrenamientos del día
- Botón para marcar como completado
- Indicador visual de completado
- Integración con `complete-workout` edge function

### RoutineManager
- Visualización de la rutina asignada
- Agrupación de ejercicios por día
- Expandible/colapsable por día
- Estadísticas de progreso de la rutina

### PaymentModal
- Selección de plan (mensual/anual)
- Selección de método de pago (Stripe/PayPal)
- Cálculo de precio con descuento
- Integración con `/payments/create-checkout-session`

## 💻 Desarrollo

### Comandos

```bash
# Desarrollo
npm run dev

# Build producción
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
 * ComponentName.tsx - Descripción breve
 * 
 * Este componente se encarga de [funcionalidad principal].
 * Se usa en [contexto de uso].
 */

import React from 'react';

interface ComponentProps {
  // Props del componente
}

export const ComponentName = ({ props }: ComponentProps) => {
  // Lógica del componente
  
  return (
    // JSX del componente
  );
};
```

### Agregar Edge Function

1. Crear carpeta: `supabase/functions/[nombre-funcion]/`
2. Crear `index.ts` con CORS headers
3. Implementar lógica con `createClient` de Supabase
4. La función se despliega automáticamente

```typescript
// Estructura básica de Edge Function
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
    // Tu lógica aquí
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

## 📝 Convenciones

- **Componentes**: PascalCase (`MyComponent.tsx`)
- **Hooks**: camelCase con prefijo `use` (`useMyHook.ts`)
- **Utilidades**: camelCase (`myUtility.ts`)
- **Constantes**: UPPER_SNAKE_CASE
- **Tipos**: PascalCase con sufijo `Type` o `Props`

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.

## 🔗 Enlaces

- **Lovable Project**: https://lovable.dev/projects/038a76a5-d0bf-4a39-8c3f-0aa769564603
- **Documentación de Lovable**: https://docs.lovable.dev
- **Supabase Docs**: https://supabase.com/docs
