# Estructura del Backend - Sistema de Entrenamientos AutomÃ¡ticos

## ðŸ“‹ Arquitectura General

Este documento describe la estructura completa del backend para el sistema de entrenamientos automÃ¡ticos y prediseÃ±ados de la aplicaciÃ³n de fitness.

### Stack TecnolÃ³gico Backend
- **Supabase** (basado en Supabase)
- **PostgreSQL** (base de datos)
- **Edge Functions** (TypeScript serverless)
- **Row Level Security (RLS)** para seguridad

---

## ðŸ—„ï¸ Estructura de Base de Datos

### Tablas Principales

#### `exercises`
Contiene informaciÃ³n de todos los ejercicios disponibles.
```sql
- id (text, PK)
- nombre (text)
- descripcion (text)
- grupo_muscular (text)
- nivel (text)
- tipo_entrenamiento (text)
- lugar (text)
- objetivo (text)
- series_sugeridas (int)
- repeticiones_sugeridas (int)
- duracion_promedio_segundos (int)
- calorias_por_repeticion (numeric)
- equipamiento (text)
- maquina_gym (text)
- video (text)
- imagen (text)
```

#### `predesigned_plans`
Planes de entrenamiento prediseÃ±ados por profesionales.
```sql
- id (text, PK)
- nombre_plan (text)
- descripcion_plan (text)
- objetivo (text) -- 'ganar_masa', 'perder_grasa', 'tonificar'
- nivel (text) -- 'principiante', 'intermedio', 'avanzado'
- lugar (text) -- 'casa', 'gimnasio', 'ambos'
- dias_semana (int) -- dÃ­as por semana del plan
- ejercicios_ids_ordenados (jsonb)
```

#### `plan_ejercicios`
RelaciÃ³n entre planes y ejercicios con detalles de ejecuciÃ³n.
```sql
- id (uuid, PK)
- plan_id (text, FK -> predesigned_plans)
- ejercicio_id (text, FK -> exercises)
- dia (int) -- dÃ­a de la semana (1-7)
- orden (int) -- orden del ejercicio en el dÃ­a
```

#### `workouts`
Entrenamientos asignados a usuarios.
```sql
- id (uuid, PK)
- user_id (uuid, FK -> profiles)
- name (text)
- description (text)
- scheduled_date (date)
- location (enum: 'casa', 'gimnasio')
- duration_minutes (int)
- estimated_calories (int)
- completed (boolean)
- completed_at (timestamp)
- tipo (enum: 'automatico', 'manual')
```

#### `workout_exercises`
Ejercicios especÃ­ficos de cada workout.
```sql
- id (uuid, PK)
- workout_id (uuid, FK -> workouts)
- name (text)
- sets (int)
- reps (int)
- notes (text)
- duration_minutes (int)
```

---

## ðŸ”Œ Endpoints (Edge Functions)

### 1. **POST /assign-routine**
**Archivo:** `supabase/functions/assign-routine/index.ts`

**DescripciÃ³n:** Asigna automÃ¡ticamente un plan prediseÃ±ado a un usuario y genera entrenamientos para la semana actual.

**Flujo:**
1. Obtiene el perfil del usuario (objetivo, nivel, dÃ­as disponibles)
2. Busca planes compatibles en `predesigned_plans`
3. Calcula un score para cada plan basado en:
   - Objetivo del usuario vs objetivo del plan
   - Nivel de fitness
   - DÃ­as disponibles por semana
   - Tipo de entrenamiento (casa/gimnasio)
4. Selecciona el plan con mejor score
5. Obtiene ejercicios del plan desde `plan_ejercicios`
6. Genera entrenamientos para la semana actual en `workouts`
7. Inserta ejercicios correspondientes en `workout_exercises`

**Input:** AutomÃ¡tico (usa datos del perfil del usuario autenticado)

**Output:**
```json
{
  "success": true,
  "routine": {
    "plan_id": "plan_001",
    "plan_name": "TonificaciÃ³n Casa - Principiante",
    "workouts_created": 3,
    "workouts": [
      {
        "id": "uuid",
        "name": "Plan - DÃ­a 1",
        "date": "2025-10-22"
      }
    ]
  }
}
```

**AutenticaciÃ³n:** Requerida (JWT)

---

### 2. **GET /get-todays-workouts**
**Archivo:** `supabase/functions/get-todays-workouts/index.ts`

**DescripciÃ³n:** Retorna todos los entrenamientos programados para el dÃ­a actual.

**Query Parameters:** Ninguno

**Output:**
```json
{
  "workouts": [
    {
      "id": "uuid",
      "name": "Entrenamiento de Hoy",
      "scheduled_date": "2025-10-22",
      "location": "casa",
      "duration_minutes": 45,
      "estimated_calories": 300,
      "completed": false,
      "tipo": "automatico",
      "workout_exercises": [
        {
          "id": "uuid",
          "name": "Sentadillas",
          "sets": 3,
          "reps": 12,
          "notes": "Piernas - principiante"
        }
      ]
    }
  ]
}
```

**AutenticaciÃ³n:** Requerida (JWT)

---

### 3. **GET /get-all-workouts**
**Archivo:** `supabase/functions/get-all-workouts/index.ts`

**DescripciÃ³n:** Retorna todos los entrenamientos del usuario (rutina completa).

**Query Parameters:**
- `include_completed` (boolean, default: true) - Incluir completados
- `tipo` (string, optional) - Filtrar por 'automatico' o 'manual'

**Output:**
```json
{
  "workouts": [...],
  "stats": {
    "total": 10,
    "completed": 5,
    "pending": 5,
    "automaticos": 8,
    "manuales": 2,
    "totalCalories": 3000,
    "totalMinutes": 450
  }
}
```

**AutenticaciÃ³n:** Requerida (JWT)

---

### 4. **GET /get-workouts-by-date**
**Archivo:** `supabase/functions/get-workouts-by-date/index.ts`

**DescripciÃ³n:** Retorna entrenamientos para una fecha especÃ­fica o rango de fechas.

**Query Parameters:**
- `date` (string, YYYY-MM-DD) - Fecha especÃ­fica
- `start_date` (string, YYYY-MM-DD) - Fecha inicio de rango
- `end_date` (string, YYYY-MM-DD) - Fecha fin de rango

**Output:**
```json
{
  "workouts": [...]
}
```

**AutenticaciÃ³n:** Requerida (JWT)

---

### 5. **POST /complete-workout**
**Archivo:** `supabase/functions/complete-workout/index.ts`

**DescripciÃ³n:** Marca un entrenamiento como completado o incompleto.

**Input:**
```json
{
  "workout_id": "uuid",
  "completed": true
}
```

**Output:**
```json
{
  "success": true,
  "workout": {
    "id": "uuid",
    "completed": true,
    "completed_at": "2025-10-22T10:30:00Z",
    ...
  }
}
```

**AutenticaciÃ³n:** Requerida (JWT)

---

### 6. **GET /get-predesigned-plans**
**Archivo:** `supabase/functions/get-predesigned-plans/index.ts`

**DescripciÃ³n:** Lista todos los planes prediseÃ±ados disponibles.

**Query Parameters:**
- `objetivo` (string) - Filtrar por objetivo
- `nivel` (string) - Filtrar por nivel
- `lugar` (string) - Filtrar por lugar
- `dias_semana` (int) - Filtrar por dÃ­as por semana

**Output:**
```json
{
  "plans": [
    {
      "id": "plan_001",
      "nombre_plan": "TonificaciÃ³n Casa",
      "descripcion_plan": "Plan de tonificaciÃ³n para hacer en casa",
      "objetivo": "tonificar",
      "nivel": "principiante",
      "lugar": "casa",
      "dias_semana": 3,
      "total_exercises": 15
    }
  ],
  "count": 1
}
```

**AutenticaciÃ³n:** No requerida

---

## ðŸ”’ Seguridad (RLS)

### PolÃ­ticas de Seguridad Implementadas

#### Tabla `workouts`
```sql
-- Los usuarios solo pueden ver sus propios workouts
CREATE POLICY "Users can view own workouts"
ON workouts FOR SELECT
USING (auth.uid() = user_id);

-- Los usuarios solo pueden insertar sus propios workouts
CREATE POLICY "Users can insert own workouts"
ON workouts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Los usuarios solo pueden actualizar sus propios workouts
CREATE POLICY "Users can update own workouts"
ON workouts FOR UPDATE
USING (auth.uid() = user_id);

-- Los usuarios solo pueden eliminar sus propios workouts
CREATE POLICY "Users can delete own workouts"
ON workouts FOR DELETE
USING (auth.uid() = user_id);
```

#### Tabla `workout_exercises`
Las polÃ­ticas verifican que el workout asociado pertenezca al usuario.

---

## ðŸ”„ Flujo Completo de AsignaciÃ³n AutomÃ¡tica

### 1. Usuario Completa Onboarding
Cuando `profiles.onboarding_completed` cambia a `true`, se dispara un trigger:

```sql
CREATE TRIGGER on_onboarding_completed
  AFTER UPDATE ON profiles
  FOR EACH ROW
  WHEN (NEW.onboarding_completed = true AND OLD.onboarding_completed = false)
  EXECUTE FUNCTION auto_assign_routine_on_onboarding();
```

### 2. LÃ³gica de SelecciÃ³n de Plan
El algoritmo de scoring en `assign-routine`:

```typescript
// Scoring de planes
let score = 0;

// 1. Objetivo (peso: 50 + 20 bonus)
if (userGoals.includes(plan.objetivo)) {
  score += 50;
  if (userGoals[0] === plan.objetivo) score += 20;
}

// 2. Nivel (peso: 30)
if (plan.nivel === profile.fitness_level) {
  score += 30;
}

// 3. DÃ­as disponibles (peso: 20)
if (profile.available_days_per_week >= plan.dias_semana) {
  score += Math.max(0, 20 - daysDiff * 3);
}

// 4. Lugar (peso: 15)
if (locationMatches) {
  score += 15;
}
```

### 3. GeneraciÃ³n de Entrenamientos Semanales
Para cada dÃ­a del plan:
1. Calcula fecha correspondiente (inicio de semana = lunes)
2. Obtiene ejercicios del plan para ese dÃ­a
3. Crea workout en tabla `workouts`
4. Inserta ejercicios en `workout_exercises`
5. Calcula calorÃ­as estimadas basado en ejercicios

---

## ðŸ“± IntegraciÃ³n con Frontend

### React Query Hooks Disponibles

```typescript
// Hook para asignar rutina automÃ¡tica
const { mutate: assignRoutine } = useAssignRoutine();

// Hook para obtener entrenamientos de hoy
const { data: todaysWorkouts } = useTodaysWorkouts();

// Hook para obtener todos los entrenamientos
const { data: allWorkouts } = useAllWorkouts({
  include_completed: false,
  tipo: 'automatico'
});

// Hook para obtener entrenamientos por fecha
const { data: workoutsByDate } = useWorkoutsByDate({
  date: '2025-10-22'
});

// Hook para marcar completado
const { mutate: completeWorkout } = useCompleteWorkout();

// Hook para obtener planes prediseÃ±ados
const { data: plans } = usePredesignedPlans({
  nivel: 'principiante',
  objetivo: 'tonificar'
});
```

### Ejemplo de Uso en Componente

```typescript
// Componente de entrenamientos del dÃ­a
const TodaysWorkouts = () => {
  const { data, isLoading } = useTodaysWorkouts();
  const { mutate: complete } = useCompleteWorkout();

  const handleComplete = (workoutId: string) => {
    complete({ workoutId, completed: true });
  };

  if (isLoading) return <div>Cargando...</div>;

  return (
    <div>
      {data?.workouts.map(workout => (
        <WorkoutCard 
          key={workout.id}
          workout={workout}
          onComplete={() => handleComplete(workout.id)}
        />
      ))}
    </div>
  );
};
```

---

## ðŸ§ª Testing y ValidaciÃ³n

### Casos de Prueba Clave

1. **Usuario nuevo completa onboarding**
   - âœ… Se asigna plan automÃ¡ticamente
   - âœ… Se generan workouts para la semana
   - âœ… Los workouts tienen tipo='automatico'

2. **Usuario consulta entrenamientos de hoy**
   - âœ… Solo ve workouts de la fecha actual
   - âœ… Incluye ejercicios con series y reps

3. **Usuario marca workout completado**
   - âœ… Campo completed se actualiza a true
   - âœ… Se registra completed_at timestamp
   - âœ… Se invalidan queries en cache

4. **Filtrado de planes**
   - âœ… Planes se filtran por objetivo
   - âœ… Planes se filtran por nivel
   - âœ… Planes se filtran por lugar

---

## ðŸ“Š Monitoreo y Logs

Todos los edge functions incluyen logging detallado:

```typescript
console.log(`Assigning routine for user ${user.id}`);
console.log('User profile:', { 
  fitness_goal: profile.fitness_goal, 
  fitness_level: profile.fitness_level 
});
console.log(`Best match: ${selectedPlan.id} (score: ${score})`);
```

Los logs estÃ¡n disponibles en la secciÃ³n de Edge Functions del dashboard de Supabase.

---

## ðŸš€ Despliegue

Las Edge Functions se despliegan automÃ¡ticamente con el cÃ³digo del proyecto. No requieren configuraciÃ³n manual adicional.

### ConfiguraciÃ³n en `supabase/config.toml`

```toml
[functions.assign-routine]
verify_jwt = true

[functions.get-todays-workouts]
verify_jwt = true

[functions.get-all-workouts]
verify_jwt = true

[functions.complete-workout]
verify_jwt = true

[functions.get-workouts-by-date]
verify_jwt = true

[functions.get-predesigned-plans]
verify_jwt = false
```

---

## ðŸ“ Notas Importantes

1. **Idempotencia:** La funciÃ³n `assign-routine` verifica que no existan workouts automÃ¡ticos para la semana actual antes de crear nuevos.

2. **Performance:** Las queries incluyen Ã­ndices en columnas frecuentemente consultadas (`user_id`, `scheduled_date`, `tipo`).

3. **Escalabilidad:** El sistema soporta mÃºltiples planes y puede adaptarse a diferentes perfiles de usuario mediante el algoritmo de scoring.

4. **Mantenibilidad:** CÃ³digo modular y bien documentado facilita futuras extensiones.

---

## ðŸ”® PrÃ³ximas Mejoras

- [ ] Sistema de notificaciones para recordar entrenamientos
- [ ] Ajuste dinÃ¡mico de planes basado en progreso
- [ ] Recomendaciones de ejercicios alternativos
- [ ] IntegraciÃ³n con wearables para tracking automÃ¡tico
- [ ] Analytics de rendimiento por plan

