# Backend API Documentation

## Overview

This fitness app backend is built on **Supabase** with **PostgreSQL** and **Edge Functions**. It provides automatic routine assignment, progress tracking, and comprehensive fitness data management.

## Database Schema

### Tables

#### 1. **profiles** (Extended)
User profile information with fitness goals and preferences.

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  gender TEXT,
  age INTEGER,
  weight NUMERIC,
  height NUMERIC,
  fitness_level TEXT (principiante, intermedio, avanzado),
  fitness_goal TEXT (perder_peso, ganar_musculo, mantener_peso, mejorar_resistencia),
  health_conditions TEXT[],
  current_medications TEXT,
  injuries_limitations TEXT,
  menstrual_tracking_enabled BOOLEAN DEFAULT false,
  available_days_per_week INTEGER,
  session_duration_minutes INTEGER,
  assigned_routine_id UUID REFERENCES workouts(id),
  daily_calorie_goal INTEGER,
  daily_protein_goal INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 2. **exercises**
Exercise library with detailed information.

```sql
CREATE TABLE public.exercises (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  grupo_muscular TEXT NOT NULL,
  nivel TEXT NOT NULL,
  lugar TEXT NOT NULL,
  objetivo TEXT NOT NULL,
  tipo_entrenamiento TEXT NOT NULL,
  equipamiento TEXT,
  descripcion TEXT NOT NULL,
  repeticiones_sugeridas INTEGER,
  series_sugeridas INTEGER,
  duracion_promedio_segundos INTEGER,
  calorias_por_repeticion NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### 3. **workouts** (Routines)
Workout routines/plans for users.

```sql
CREATE TABLE public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  scheduled_date DATE NOT NULL,
  duration_minutes INTEGER,
  location TEXT (casa, gimnasio, parque),
  estimated_calories INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### 4. **workout_exercises**
Exercises within a workout routine.

```sql
CREATE TABLE public.workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sets INTEGER,
  reps INTEGER,
  duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### 5. **progress_tracking** (NEW)
Track user progress over time.

```sql
CREATE TABLE public.progress_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES workouts(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight NUMERIC,
  body_measurements JSONB,
  energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 5),
  menstrual_phase TEXT,
  notes TEXT,
  exercises_completed JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## API Endpoints

All endpoints are implemented as Edge Functions and automatically deployed.

### Authentication

All endpoints (except `get-routines`) require authentication via JWT token in the `Authorization` header:

```typescript
Authorization: Bearer <your-jwt-token>
```

---

### 1. **POST /assign-routine**

Automatically assigns the most suitable routine to the current user based on their profile.

**Matching Algorithm:**
- Matches `session_duration_minutes` with workout duration
- Considers `fitness_level` (beginners prefer home workouts)
- Accounts for `health_conditions` (reduces intensity if needed)
- Considers `gender` and `menstrual_tracking_enabled`

**Request:**
```typescript
// No body required - uses authenticated user's profile
POST /functions/v1/assign-routine
```

**Response:**
```json
{
  "success": true,
  "routine": {
    "id": "uuid",
    "name": "Full Body Workout",
    "description": "Comprehensive workout for all muscle groups",
    "duration_minutes": 45,
    "location": "gimnasio",
    "workout_exercises": [...]
  },
  "message": "Routine assigned successfully"
}
```

**Usage Example:**
```typescript
import { assignRoutine } from "@/lib/api/backend";

const { routine } = await assignRoutine();
console.log(`Assigned routine: ${routine.name}`);
```

---

### 2. **GET /get-user-routine**

Get the currently assigned routine for the authenticated user.

**Request:**
```typescript
GET /functions/v1/get-user-routine
```

**Response:**
```json
{
  "routine": {
    "id": "uuid",
    "name": "Full Body Workout",
    "workout_exercises": [
      {
        "id": "uuid",
        "name": "Push-ups",
        "sets": 3,
        "reps": 15
      }
    ]
  },
  "profile": {
    "fitness_level": "intermedio",
    "fitness_goal": "ganar_musculo",
    "available_days_per_week": 4,
    "session_duration_minutes": 45
  }
}
```

**Usage Example:**
```typescript
import { getUserRoutine } from "@/lib/api/backend";

const { routine, profile } = await getUserRoutine();
if (routine) {
  console.log(`Your routine: ${routine.name}`);
}
```

---

### 3. **POST /record-progress**

Record progress for a workout session.

**Request Body:**
```typescript
{
  workout_id?: string;          // Optional: link to specific workout
  date?: string;                // Optional: defaults to today (YYYY-MM-DD)
  weight?: number;              // In kg
  body_measurements?: {         // Optional measurements
    chest?: number;
    waist?: number;
    hips?: number;
    arms?: number;
  };
  energy_level?: number;        // 1-5 scale
  menstrual_phase?: string;     // e.g., "follicular", "luteal"
  notes?: string;               // Free text notes
  exercises_completed?: [
    {
      exercise_id: string;
      sets?: number;
      reps?: number;
      duration_minutes?: number;
      weight_used?: number;     // In kg
    }
  ];
}
```

**Response:**
```json
{
  "success": true,
  "progress": {
    "id": "uuid",
    "date": "2025-10-22",
    "weight": 70.5,
    "energy_level": 4,
    "exercises_completed": [...]
  },
  "message": "Progress recorded successfully"
}
```

**Usage Example:**
```typescript
import { recordProgress } from "@/lib/api/backend";

await recordProgress({
  weight: 70.5,
  energy_level: 4,
  notes: "Great workout today!",
  exercises_completed: [
    { exercise_id: "bench_press", sets: 3, reps: 10, weight_used: 60 }
  ]
});
```

---

### 4. **GET /get-progress**

Get progress history for the authenticated user.

**Query Parameters:**
- `limit` (optional): Number of records to return (default: 30)
- `start_date` (optional): Filter from date (YYYY-MM-DD)
- `end_date` (optional): Filter to date (YYYY-MM-DD)

**Request:**
```typescript
GET /functions/v1/get-progress?limit=10&start_date=2025-10-01
```

**Response:**
```json
{
  "progress": [
    {
      "id": "uuid",
      "date": "2025-10-22",
      "weight": 70.5,
      "energy_level": 4,
      "exercises_completed": [...],
      "workout": {
        "name": "Full Body Workout",
        "description": "..."
      }
    }
  ],
  "count": 10
}
```

**Usage Example:**
```typescript
import { getProgress } from "@/lib/api/backend";

const { progress, count } = await getProgress({
  limit: 20,
  start_date: "2025-10-01"
});
```

---

### 5. **GET /get-progress-stats**

Get aggregated statistics about user progress.

**Query Parameters:**
- `days` (optional): Number of days to analyze (default: 30)

**Request:**
```typescript
GET /functions/v1/get-progress-stats?days=30
```

**Response:**
```json
{
  "stats": {
    "total_workouts": 15,
    "weight_change": -2.5,
    "average_energy_level": 3.8,
    "workout_streak": 5,
    "weight_trend": [
      { "date": "2025-10-01", "weight": 73 },
      { "date": "2025-10-22", "weight": 70.5 }
    ],
    "energy_trend": [
      { "date": "2025-10-01", "energy": 3 },
      { "date": "2025-10-22", "energy": 4 }
    ]
  },
  "period_days": 30,
  "calculated_at": "2025-10-22T10:00:00Z"
}
```

**Usage Example:**
```typescript
import { getProgressStats } from "@/lib/api/backend";

const { stats } = await getProgressStats(30);
console.log(`Total workouts: ${stats.total_workouts}`);
console.log(`Weight change: ${stats.weight_change} kg`);
console.log(`Current streak: ${stats.workout_streak} days`);
```

---

### 6. **GET /get-routines**

Get all available workout routines (public endpoint).

**Query Parameters:**
- `location` (optional): Filter by location (casa, gimnasio, parque)
- `limit` (optional): Number of routines to return (default: 50)

**Request:**
```typescript
GET /functions/v1/get-routines?location=gimnasio&limit=10
```

**Response:**
```json
{
  "routines": [
    {
      "id": "uuid",
      "name": "Strength Training",
      "location": "gimnasio",
      "duration_minutes": 60,
      "workout_exercises": [...]
    }
  ],
  "count": 10
}
```

**Usage Example:**
```typescript
import { getRoutines } from "@/lib/api/backend";

const { routines } = await getRoutines({
  location: "gimnasio",
  limit: 20
});
```

---

## React + TanStack Query Integration

### Example Hook

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserRoutine, recordProgress, getProgressStats } from '@/lib/api/backend';

// Get user routine
export const useUserRoutine = () => {
  return useQuery({
    queryKey: ['user-routine'],
    queryFn: getUserRoutine,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Record progress
export const useRecordProgress = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: recordProgress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['progress-stats'] });
    },
  });
};

// Get progress stats
export const useProgressStats = (days: number = 30) => {
  return useQuery({
    queryKey: ['progress-stats', days],
    queryFn: () => getProgressStats(days),
  });
};
```

### Component Example

```tsx
import { useUserRoutine, useRecordProgress } from '@/hooks/useBackendApi';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function RoutineDisplay() {
  const { data, isLoading } = useUserRoutine();
  const recordProgressMutation = useRecordProgress();

  const handleCompleteWorkout = async () => {
    try {
      await recordProgressMutation.mutateAsync({
        workout_id: data?.routine?.id,
        energy_level: 4,
        notes: 'Completed successfully'
      });
      toast.success('Progress recorded!');
    } catch (error) {
      toast.error('Failed to record progress');
    }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h2>{data?.routine?.name}</h2>
      <p>{data?.routine?.description}</p>
      <Button onClick={handleCompleteWorkout}>
        Complete Workout
      </Button>
    </div>
  );
}
```

---

## Security

### Row Level Security (RLS)

All tables have RLS enabled:

- **profiles**: Users can only view/update their own profile
- **workouts**: Users can only access their own workouts
- **progress_tracking**: Users can only access their own progress
- **exercises**: Public read-only access

### Authentication

- JWT-based authentication via Supabase Auth
- Passwords are automatically hashed
- Email auto-confirm enabled for development (disable in production)

### Input Validation

All edge functions validate:
- Authorization headers
- Request body structure
- Energy level ranges (1-5)
- Date formats

---

## Future Enhancements

- **AI-powered routine adaptation** based on progress
- **Real-time workout tracking** via WebSockets
- **Wearable device integration** (Apple Health, Google Fit)
- **Social features** (share progress, challenges)
- **Nutritional tracking** integration with meals table

---

## Testing

### Example Test Data

```sql
-- Create test user profile
INSERT INTO profiles (id, full_name, fitness_level, fitness_goal, available_days_per_week, session_duration_minutes)
VALUES ('user-uuid', 'Test User', 'intermedio', 'ganar_musculo', 4, 45);

-- Create test workout
INSERT INTO workouts (user_id, name, scheduled_date, duration_minutes, location)
VALUES ('user-uuid', 'Test Workout', CURRENT_DATE, 45, 'gimnasio');
```

---

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check that you're passing the JWT token correctly
2. **404 Not Found**: Ensure the user has a profile created
3. **500 Internal Server Error**: Check edge function logs in Supabase dashboard

### View Backend Logs



---

## Production Checklist

- [ ] Disable email auto-confirm
- [ ] Add rate limiting
- [ ] Set up monitoring and alerts
- [ ] Configure CORS for production domain
- [ ] Review and test all RLS policies
- [ ] Add comprehensive error logging
- [ ] Set up backup strategy
- [ ] Performance testing under load
