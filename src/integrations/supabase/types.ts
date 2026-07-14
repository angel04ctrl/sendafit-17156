export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_trainer_conversations: {
        Row: {
          assistant_message: string | null
          conversation_type: string
          context_used: Json
          created_at: string
          generated_content: Json | null
          id: string
          intent_type: string | null
          messages: Json | null
          model_used: string | null
          saved_to_app: boolean | null
          safety_flags: string[]
          title: string | null
          updated_at: string
          user_message: string | null
          user_id: string
        }
        Insert: {
          assistant_message?: string | null
          conversation_type: string
          context_used?: Json
          created_at?: string
          generated_content?: Json | null
          id?: string
          intent_type?: string | null
          messages?: Json | null
          model_used?: string | null
          saved_to_app?: boolean | null
          safety_flags?: string[]
          title?: string | null
          updated_at?: string
          user_message?: string | null
          user_id: string
        }
        Update: {
          assistant_message?: string | null
          conversation_type?: string
          context_used?: Json
          created_at?: string
          generated_content?: Json | null
          id?: string
          intent_type?: string | null
          messages?: Json | null
          model_used?: string | null
          saved_to_app?: boolean | null
          safety_flags?: string[]
          title?: string | null
          updated_at?: string
          user_message?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_trainer_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: boolean
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: boolean
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: boolean
        }
        Relationships: []
      }
      coach_actions: {
        Row: {
          action_type: string
          applied_at: string | null
          confirmed_at: string | null
          conversation_id: string | null
          created_at: string
          id: string
          payload: Json
          preview: Json
          rejected_at: string | null
          status: string
          title: string
          user_id: string
          validation_result: Json
        }
        Insert: {
          action_type: string
          applied_at?: string | null
          confirmed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          preview?: Json
          rejected_at?: string | null
          status?: string
          title: string
          user_id: string
          validation_result?: Json
        }
        Update: {
          action_type?: string
          applied_at?: string | null
          confirmed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          preview?: Json
          rejected_at?: string | null
          status?: string
          title?: string
          user_id?: string
          validation_result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "coach_actions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_trainer_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          aliases: string[]
          calorias_por_repeticion: number | null
          contraindicaciones: string[]
          created_at: string
          descripcion: string
          duracion_promedio_segundos: number | null
          equipo_requerido: string[]
          errores_comunes: string[]
          estado_calidad: string
          equipamiento: string | null
          grupo_muscular: string
          id: string
          imagen: string | null
          instrucciones: string[]
          lugar: string | null
          maquina_gym: string | null
          musculo_principal: string | null
          musculos_secundarios: string[]
          nivel: string
          nivel_minimo: string | null
          nombre: string
          objetivo: string | null
          patron_movimiento: string | null
          progresiones: string[]
          repeticiones_sugeridas: number | null
          descanso_segundos_max: number | null
          descanso_segundos_min: number | null
          rango_reps_max: number | null
          rango_reps_min: number | null
          regresiones: string[]
          rir_recomendado: number | null
          series_sugeridas: number | null
          sustituciones: string[]
          tipo_entrenamiento: string
          video: string | null
        }
        Insert: {
          aliases?: string[]
          calorias_por_repeticion?: number | null
          contraindicaciones?: string[]
          created_at?: string
          descripcion: string
          duracion_promedio_segundos?: number | null
          equipo_requerido?: string[]
          errores_comunes?: string[]
          estado_calidad?: string
          equipamiento?: string | null
          grupo_muscular: string
          id: string
          imagen?: string | null
          instrucciones?: string[]
          lugar?: string | null
          maquina_gym?: string | null
          musculo_principal?: string | null
          musculos_secundarios?: string[]
          nivel: string
          nivel_minimo?: string | null
          nombre: string
          objetivo?: string | null
          patron_movimiento?: string | null
          progresiones?: string[]
          repeticiones_sugeridas?: number | null
          descanso_segundos_max?: number | null
          descanso_segundos_min?: number | null
          rango_reps_max?: number | null
          rango_reps_min?: number | null
          regresiones?: string[]
          rir_recomendado?: number | null
          series_sugeridas?: number | null
          sustituciones?: string[]
          tipo_entrenamiento: string
          video?: string | null
        }
        Update: {
          aliases?: string[]
          calorias_por_repeticion?: number | null
          contraindicaciones?: string[]
          created_at?: string
          descripcion?: string
          duracion_promedio_segundos?: number | null
          equipo_requerido?: string[]
          errores_comunes?: string[]
          estado_calidad?: string
          equipamiento?: string | null
          grupo_muscular?: string
          id?: string
          imagen?: string | null
          instrucciones?: string[]
          lugar?: string | null
          maquina_gym?: string | null
          musculo_principal?: string | null
          musculos_secundarios?: string[]
          nivel?: string
          nivel_minimo?: string | null
          nombre?: string
          objetivo?: string | null
          patron_movimiento?: string | null
          progresiones?: string[]
          repeticiones_sugeridas?: number | null
          descanso_segundos_max?: number | null
          descanso_segundos_min?: number | null
          rango_reps_max?: number | null
          rango_reps_min?: number | null
          regresiones?: string[]
          rir_recomendado?: number | null
          series_sugeridas?: number | null
          sustituciones?: string[]
          tipo_entrenamiento?: string
          video?: string | null
        }
        Relationships: []
      }
      exercise_progression_suggestions: {
        Row: {
          based_on_session_id: string | null
          confidence: string
          created_at: string
          exercise_id: string | null
          exercise_key: string | null
          exercise_name_snapshot: string
          id: string
          previous_reps: number[] | null
          previous_weight: number | null
          reason: string
          source: string
          suggested_action: string
          suggested_reps: number | null
          suggested_weight: number | null
          user_id: string
          workout_session_id: string | null
        }
        Insert: {
          based_on_session_id?: string | null
          confidence?: string
          created_at?: string
          exercise_id?: string | null
          exercise_key?: never
          exercise_name_snapshot: string
          id?: string
          previous_reps?: number[] | null
          previous_weight?: number | null
          reason: string
          source?: string
          suggested_action: string
          suggested_reps?: number | null
          suggested_weight?: number | null
          user_id: string
          workout_session_id?: string | null
        }
        Update: {
          based_on_session_id?: string | null
          confidence?: string
          created_at?: string
          exercise_id?: string | null
          exercise_key?: never
          exercise_name_snapshot?: string
          id?: string
          previous_reps?: number[] | null
          previous_weight?: number | null
          reason?: string
          source?: string
          suggested_action?: string
          suggested_reps?: number | null
          suggested_weight?: number | null
          user_id?: string
          workout_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_progression_suggestions_based_on_session_id_fkey"
            columns: ["based_on_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_progression_suggestions_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_progression_suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_analysis_logs: {
        Row: {
          adjusted_macros: Json | null
          analysis_date: string
          created_at: string
          detected_foods: Json | null
          estimated_macros: Json | null
          id: string
          image_url: string
          saved_to_daily: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adjusted_macros?: Json | null
          analysis_date?: string
          created_at?: string
          detected_foods?: Json | null
          estimated_macros?: Json | null
          id?: string
          image_url: string
          saved_to_daily?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adjusted_macros?: Json | null
          analysis_date?: string
          created_at?: string
          detected_foods?: Json | null
          estimated_macros?: Json | null
          id?: string
          image_url?: string
          saved_to_daily?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_analysis_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          calorias: number
          carbohidratos: number
          created_at: string
          grasas: number
          id: number
          nombre: string
          proteinas: number
          racion: number
          unidad: string
        }
        Insert: {
          calorias: number
          carbohidratos: number
          created_at?: string
          grasas: number
          id?: number
          nombre: string
          proteinas: number
          racion: number
          unidad: string
        }
        Update: {
          calorias?: number
          carbohidratos?: number
          created_at?: string
          grasas?: number
          id?: number
          nombre?: string
          proteinas?: number
          racion?: number
          unidad?: string
        }
        Relationships: []
      }
      health_data: {
        Row: {
          created_at: string
          data_type: string
          data_value: Json
          id: string
          recorded_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_type: string
          data_value: Json
          id?: string
          recorded_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_type?: string
          data_value?: Json
          id?: string
          recorded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_data_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_scan_history: {
        Row: {
          created_at: string
          id: string
          image_url: string
          machine_name: string | null
          machine_type: string | null
          posture_tips: string | null
          primary_muscles: string[] | null
          related_exercises: Json | null
          secondary_muscles: string[] | null
          usage_instructions: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          machine_name?: string | null
          machine_type?: string | null
          posture_tips?: string | null
          primary_muscles?: string[] | null
          related_exercises?: Json | null
          secondary_muscles?: string[] | null
          usage_instructions?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          machine_name?: string | null
          machine_type?: string | null
          posture_tips?: string | null
          primary_muscles?: string[] | null
          related_exercises?: Json | null
          secondary_muscles?: string[] | null
          usage_instructions?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_scan_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          calories: number
          carbs: number
          created_at: string
          date: string
          fat: number
          id: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          name: string
          protein: number
          user_id: string
        }
        Insert: {
          calories: number
          carbs?: number
          created_at?: string
          date?: string
          fat?: number
          id?: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          name: string
          protein?: number
          user_id: string
        }
        Update: {
          calories?: number
          carbs?: number
          created_at?: string
          date?: string
          fat?: number
          id?: string
          meal_type?: Database["public"]["Enums"]["meal_type"]
          name?: string
          protein?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      menstrual_logs: {
        Row: {
          created_at: string
          cycle_length: number | null
          id: string
          notes: string | null
          period_end_date: string | null
          period_length: number | null
          period_start_date: string
          symptoms: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cycle_length?: number | null
          id?: string
          notes?: string | null
          period_end_date?: string | null
          period_length?: number | null
          period_start_date: string
          symptoms?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cycle_length?: number | null
          id?: string
          notes?: string | null
          period_end_date?: string | null
          period_length?: number | null
          period_start_date?: string
          symptoms?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_ejercicios: {
        Row: {
          created_at: string
          dia: number
          ejercicio_id: string
          id: string
          orden: number
          plan_id: string
        }
        Insert: {
          created_at?: string
          dia: number
          ejercicio_id: string
          id?: string
          orden: number
          plan_id: string
        }
        Update: {
          created_at?: string
          dia?: number
          ejercicio_id?: string
          id?: string
          orden?: number
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_ejercicios_ejercicio_id_fkey"
            columns: ["ejercicio_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_ejercicios_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "predesigned_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      predesigned_plans: {
        Row: {
          created_at: string
          descripcion_plan: string
          dias_semana: number
          ejercicios_ids_ordenados: Json | null
          id: string
          lugar: string
          nivel: string
          nombre_plan: string
          objetivo: string
        }
        Insert: {
          created_at?: string
          descripcion_plan: string
          dias_semana: number
          ejercicios_ids_ordenados?: Json | null
          id: string
          lugar: string
          nivel: string
          nombre_plan: string
          objetivo: string
        }
        Update: {
          created_at?: string
          descripcion_plan?: string
          dias_semana?: number
          ejercicios_ids_ordenados?: Json | null
          id?: string
          lugar?: string
          nivel?: string
          nombre_plan?: string
          objetivo?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          allergies_restrictions: string | null
          allergies_restrictions_encrypted: string | null
          assigned_routine_id: string | null
          available_days_per_week: number | null
          available_weekdays: string[] | null
          average_sleep_hours: number | null
          created_at: string
          current_calorie_intake: number | null
          current_medications: string | null
          current_medications_encrypted: string | null
          daily_calorie_goal: number | null
          daily_carbs_goal: number | null
          daily_fat_goal: number | null
          daily_protein_goal: number | null
          dev_override: boolean | null
          dietary_preferences: string[] | null
          fase_menstrual_actual: string | null
          fitness_goal: Database["public"]["Enums"]["fitness_goal"]
          fitness_level: Database["public"]["Enums"]["fitness_level"]
          full_name: string
          gender: string | null
          health_conditions: string[] | null
          health_conditions_encrypted: string | null
          height: number | null
          id: string
          initial_measurements: Json | null
          initial_photo_url: string | null
          injuries_limitations: string | null
          injuries_limitations_encrypted: string | null
          lesiones_activas: string[] | null
          menstrual_auto_sync: boolean | null
          menstrual_tracking_app: string | null
          menstrual_tracking_enabled: boolean | null
          motivation_phrase: string | null
          nivel_fatiga: number | null
          notifications_enabled: boolean | null
          onboarding_completed: boolean | null
          primary_goal: string | null
          routine_assignment_error: string | null
          routine_assignment_status: string
          session_duration_minutes: number | null
          stress_level: number | null
          terms_accepted: boolean | null
          theme_preference: string | null
          training_types: string[] | null
          updated_at: string
          wearables_sync_enabled: boolean | null
          weight: number | null
        }
        Insert: {
          age?: number | null
          allergies_restrictions?: string | null
          allergies_restrictions_encrypted?: string | null
          assigned_routine_id?: string | null
          available_days_per_week?: number | null
          available_weekdays?: string[] | null
          average_sleep_hours?: number | null
          created_at?: string
          current_calorie_intake?: number | null
          current_medications?: string | null
          current_medications_encrypted?: string | null
          daily_calorie_goal?: number | null
          daily_carbs_goal?: number | null
          daily_fat_goal?: number | null
          daily_protein_goal?: number | null
          dev_override?: boolean | null
          dietary_preferences?: string[] | null
          fase_menstrual_actual?: string | null
          fitness_goal?: Database["public"]["Enums"]["fitness_goal"]
          fitness_level?: Database["public"]["Enums"]["fitness_level"]
          full_name: string
          gender?: string | null
          health_conditions?: string[] | null
          health_conditions_encrypted?: string | null
          height?: number | null
          id: string
          initial_measurements?: Json | null
          initial_photo_url?: string | null
          injuries_limitations?: string | null
          injuries_limitations_encrypted?: string | null
          lesiones_activas?: string[] | null
          menstrual_auto_sync?: boolean | null
          menstrual_tracking_app?: string | null
          menstrual_tracking_enabled?: boolean | null
          motivation_phrase?: string | null
          nivel_fatiga?: number | null
          notifications_enabled?: boolean | null
          onboarding_completed?: boolean | null
          primary_goal?: string | null
          routine_assignment_error?: string | null
          routine_assignment_status?: string
          session_duration_minutes?: number | null
          stress_level?: number | null
          terms_accepted?: boolean | null
          theme_preference?: string | null
          training_types?: string[] | null
          updated_at?: string
          wearables_sync_enabled?: boolean | null
          weight?: number | null
        }
        Update: {
          age?: number | null
          allergies_restrictions?: string | null
          allergies_restrictions_encrypted?: string | null
          assigned_routine_id?: string | null
          available_days_per_week?: number | null
          available_weekdays?: string[] | null
          average_sleep_hours?: number | null
          created_at?: string
          current_calorie_intake?: number | null
          current_medications?: string | null
          current_medications_encrypted?: string | null
          daily_calorie_goal?: number | null
          daily_carbs_goal?: number | null
          daily_fat_goal?: number | null
          daily_protein_goal?: number | null
          dev_override?: boolean | null
          dietary_preferences?: string[] | null
          fase_menstrual_actual?: string | null
          fitness_goal?: Database["public"]["Enums"]["fitness_goal"]
          fitness_level?: Database["public"]["Enums"]["fitness_level"]
          full_name?: string
          gender?: string | null
          health_conditions?: string[] | null
          health_conditions_encrypted?: string | null
          height?: number | null
          id?: string
          initial_measurements?: Json | null
          initial_photo_url?: string | null
          injuries_limitations?: string | null
          injuries_limitations_encrypted?: string | null
          lesiones_activas?: string[] | null
          menstrual_auto_sync?: boolean | null
          menstrual_tracking_app?: string | null
          menstrual_tracking_enabled?: boolean | null
          motivation_phrase?: string | null
          nivel_fatiga?: number | null
          notifications_enabled?: boolean | null
          onboarding_completed?: boolean | null
          primary_goal?: string | null
          routine_assignment_error?: string | null
          routine_assignment_status?: string
          session_duration_minutes?: number | null
          stress_level?: number | null
          terms_accepted?: boolean | null
          theme_preference?: string | null
          training_types?: string[] | null
          updated_at?: string
          wearables_sync_enabled?: boolean | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_assigned_routine_id_fkey"
            columns: ["assigned_routine_id"]
            isOneToOne: false
            referencedRelation: "predesigned_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_logs: {
        Row: {
          body_fat_percentage: number | null
          created_at: string
          energy_level: number | null
          id: string
          log_date: string
          notes: string | null
          user_id: string
          weight: number | null
        }
        Insert: {
          body_fat_percentage?: number | null
          created_at?: string
          energy_level?: number | null
          id?: string
          log_date?: string
          notes?: string | null
          user_id: string
          weight?: number | null
        }
        Update: {
          body_fat_percentage?: number | null
          created_at?: string
          energy_level?: number | null
          id?: string
          log_date?: string
          notes?: string | null
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_tracking: {
        Row: {
          body_measurements: Json | null
          created_at: string
          date: string
          energy_level: number | null
          exercises_completed: Json | null
          id: string
          menstrual_phase: string | null
          notes: string | null
          updated_at: string
          user_id: string
          weight: number | null
          workout_id: string | null
        }
        Insert: {
          body_measurements?: Json | null
          created_at?: string
          date?: string
          energy_level?: number | null
          exercises_completed?: Json | null
          id?: string
          menstrual_phase?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
          weight?: number | null
          workout_id?: string | null
        }
        Update: {
          body_measurements?: Json | null
          created_at?: string
          date?: string
          energy_level?: number | null
          exercises_completed?: Json | null
          id?: string
          menstrual_phase?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
          weight?: number | null
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_tracking_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          dev_mode: boolean
          is_pro: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dev_mode?: boolean
          is_pro?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dev_mode?: boolean
          is_pro?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          end_date: string | null
          id: string
          last_event: string | null
          paypal_subscription_id: string | null
          plan: string
          provider: string
          start_date: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          end_date?: string | null
          id?: string
          last_event?: string | null
          paypal_subscription_id?: string | null
          plan: string
          provider: string
          start_date?: string
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          end_date?: string | null
          id?: string
          last_event?: string | null
          paypal_subscription_id?: string | null
          plan?: string
          provider?: string
          start_date?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      workout_session_sets: {
        Row: {
          actual_reps: number | null
          actual_weight: number | null
          completed: boolean
          created_at: string
          exercise_id: string | null
          exercise_name_snapshot: string | null
          id: string
          rest_seconds: number | null
          rir: number | null
          rpe: number | null
          session_id: string
          set_number: number
          target_reps: number | null
          target_weight: number | null
          workout_exercise_id: string | null
          workout_exercise_name_snapshot: string | null
        }
        Insert: {
          actual_reps?: number | null
          actual_weight?: number | null
          completed?: boolean
          created_at?: string
          exercise_id?: string | null
          exercise_name_snapshot?: string | null
          id?: string
          rest_seconds?: number | null
          rir?: number | null
          rpe?: number | null
          session_id: string
          set_number: number
          target_reps?: number | null
          target_weight?: number | null
          workout_exercise_id?: string | null
          workout_exercise_name_snapshot?: string | null
        }
        Update: {
          actual_reps?: number | null
          actual_weight?: number | null
          completed?: boolean
          created_at?: string
          exercise_id?: string | null
          exercise_name_snapshot?: string | null
          id?: string
          rest_seconds?: number | null
          rir?: number | null
          rpe?: number | null
          session_id?: string
          set_number?: number
          target_reps?: number | null
          target_weight?: number | null
          workout_exercise_id?: string | null
          workout_exercise_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_session_sets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_session_sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          finished_at: string | null
          id: string
          notes: string | null
          overall_rpe: number | null
          pain_flag: boolean
          pain_notes: string | null
          session_feeling: string | null
          started_at: string
          status: string
          user_notes: string | null
          user_id: string
          workout_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          finished_at?: string | null
          id?: string
          notes?: string | null
          overall_rpe?: number | null
          pain_flag?: boolean
          pain_notes?: string | null
          session_feeling?: string | null
          started_at?: string
          status?: string
          user_notes?: string | null
          user_id: string
          workout_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          finished_at?: string | null
          id?: string
          notes?: string | null
          overall_rpe?: number | null
          pain_flag?: boolean
          pain_notes?: string | null
          session_feeling?: string | null
          started_at?: string
          status?: string
          user_notes?: string | null
          user_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_exercises: {
        Row: {
          created_at: string
          duration_minutes: number | null
          exercise_id: string | null
          id: string
          name: string
          notes: string | null
          order_index: number | null
          original_exercise_id: string | null
          original_name: string | null
          reps: number | null
          rest_seconds: number | null
          sets: number | null
          substituted_at: string | null
          substitution_count: number
          substitution_reason: string | null
          target_rir: number | null
          workout_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          exercise_id?: string | null
          id?: string
          name: string
          notes?: string | null
          order_index?: number | null
          original_exercise_id?: string | null
          original_name?: string | null
          reps?: number | null
          rest_seconds?: number | null
          sets?: number | null
          substituted_at?: string | null
          substitution_count?: number
          substitution_reason?: string | null
          target_rir?: number | null
          workout_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          exercise_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          order_index?: number | null
          original_exercise_id?: string | null
          original_name?: string | null
          reps?: number | null
          rest_seconds?: number | null
          sets?: number | null
          substituted_at?: string | null
          substitution_count?: number
          substitution_reason?: string | null
          target_rir?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_exercise_substitutions: {
        Row: {
          created_at: string
          id: string
          new_exercise_id: string
          new_name: string
          original_exercise_id: string | null
          original_name: string
          reason: string
          user_id: string
          workout_exercise_id: string
          workout_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_exercise_id: string
          new_name: string
          original_exercise_id?: string | null
          original_name: string
          reason: string
          user_id: string
          workout_exercise_id: string
          workout_id: string
        }
        Update: {
          created_at?: string
          id?: string
          new_exercise_id?: string
          new_name?: string
          original_exercise_id?: string | null
          original_name?: string
          reason?: string
          user_id?: string
          workout_exercise_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercise_substitutions_new_exercise_id_fkey"
            columns: ["new_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercise_substitutions_original_exercise_id_fkey"
            columns: ["original_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercise_substitutions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercise_substitutions_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercise_substitutions_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          estimated_calories: number | null
          id: string
          is_protected: boolean
          location: Database["public"]["Enums"]["workout_location"]
          name: string
          plan_id: string | null
          plan_source: string
          rescheduled_at: string | null
          rescheduled_from: string | null
          scheduled_date: string
          skipped: boolean
          skipped_at: string | null
          skip_reason: string | null
          tipo: Database["public"]["Enums"]["workout_type"] | null
          user_id: string
          weekday: number | null
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          estimated_calories?: number | null
          id?: string
          is_protected?: boolean
          location?: Database["public"]["Enums"]["workout_location"]
          name: string
          plan_id?: string | null
          plan_source?: string
          rescheduled_at?: string | null
          rescheduled_from?: string | null
          scheduled_date: string
          skipped?: boolean
          skipped_at?: string | null
          skip_reason?: string | null
          tipo?: Database["public"]["Enums"]["workout_type"] | null
          user_id: string
          weekday?: number | null
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          estimated_calories?: number | null
          id?: string
          is_protected?: boolean
          location?: Database["public"]["Enums"]["workout_location"]
          name?: string
          plan_id?: string | null
          plan_source?: string
          rescheduled_at?: string | null
          rescheduled_from?: string | null
          scheduled_date?: string
          skipped?: boolean
          skipped_at?: string | null
          skip_reason?: string | null
          tipo?: Database["public"]["Enums"]["workout_type"] | null
          user_id?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workouts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "predesigned_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_calendar_events: {
        Row: {
          action: string
          created_at: string
          from_date: string | null
          id: string
          reason: string | null
          to_date: string | null
          user_id: string
          workout_id: string
        }
        Insert: {
          action: string
          created_at?: string
          from_date?: string | null
          id?: string
          reason?: string | null
          to_date?: string | null
          user_id: string
          workout_id: string
        }
        Update: {
          action?: string
          created_at?: string
          from_date?: string | null
          id?: string
          reason?: string | null
          to_date?: string | null
          user_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_calendar_events_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_menstrual_phase: { Args: { _user_id: string }; Returns: string }
      calculate_weekday_from_date: {
        Args: { date_val: string }
        Returns: number
      }
      decrypt_health_data: { Args: { encrypted_data: string }; Returns: string }
      encrypt_health_data: { Args: { data: string }; Returns: string }
      get_encryption_key: { Args: never; Returns: string }
      has_dev_pro_override: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_user_pro: { Args: { _user_id: string }; Returns: boolean }
      move_workout_to_date: {
        Args: {
          _new_date: string
          _workout_id: string
        }
        Returns: Database["public"]["Tables"]["workouts"]["Row"]
      }
      skip_workout: {
        Args: {
          _reason: string
          _workout_id: string
        }
        Returns: Database["public"]["Tables"]["workouts"]["Row"]
      }
      sprint9_isodow: {
        Args: { _date: string }
        Returns: number
      }
      substitute_workout_exercise: {
        Args: {
          _new_exercise_id: string
          _reason: string
          _workout_exercise_id: string
        }
        Returns: Database["public"]["Tables"]["workout_exercises"]["Row"]
      }
    }
    Enums: {
      app_role: "user" | "pro"
      fitness_goal:
        | "bajar_peso"
        | "aumentar_masa"
        | "mantener_peso"
        | "tonificar"
        | "mejorar_resistencia"
        | "bajar_grasa"
        | "ganar_masa"
        | "rendimiento"
      fitness_level: "principiante" | "intermedio" | "avanzado"
      meal_type: "desayuno" | "colacion_am" | "comida" | "colacion_pm" | "cena"
      workout_location: "casa" | "gimnasio" | "exterior"
      workout_type: "automatico" | "manual"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "pro"],
      fitness_goal: [
        "bajar_peso",
        "aumentar_masa",
        "mantener_peso",
        "tonificar",
        "mejorar_resistencia",
        "bajar_grasa",
        "ganar_masa",
        "rendimiento",
      ],
      fitness_level: ["principiante", "intermedio", "avanzado"],
      meal_type: ["desayuno", "colacion_am", "comida", "colacion_pm", "cena"],
      workout_location: ["casa", "gimnasio", "exterior"],
      workout_type: ["automatico", "manual"],
    },
  },
} as const
