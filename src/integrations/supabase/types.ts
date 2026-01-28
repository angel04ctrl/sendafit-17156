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
          conversation_type: string
          created_at: string
          generated_content: Json | null
          id: string
          messages: Json | null
          saved_to_app: boolean | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_type: string
          created_at?: string
          generated_content?: Json | null
          id?: string
          messages?: Json | null
          saved_to_app?: boolean | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_type?: string
          created_at?: string
          generated_content?: Json | null
          id?: string
          messages?: Json | null
          saved_to_app?: boolean | null
          title?: string | null
          updated_at?: string
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
      exercises: {
        Row: {
          calorias_por_repeticion: number | null
          created_at: string
          descripcion: string
          duracion_promedio_segundos: number | null
          equipamiento: string | null
          grupo_muscular: string
          id: string
          imagen: string | null
          lugar: string | null
          maquina_gym: string | null
          nivel: string
          nombre: string
          objetivo: string | null
          repeticiones_sugeridas: number | null
          series_sugeridas: number | null
          tipo_entrenamiento: string
          video: string | null
        }
        Insert: {
          calorias_por_repeticion?: number | null
          created_at?: string
          descripcion: string
          duracion_promedio_segundos?: number | null
          equipamiento?: string | null
          grupo_muscular: string
          id: string
          imagen?: string | null
          lugar?: string | null
          maquina_gym?: string | null
          nivel: string
          nombre: string
          objetivo?: string | null
          repeticiones_sugeridas?: number | null
          series_sugeridas?: number | null
          tipo_entrenamiento: string
          video?: string | null
        }
        Update: {
          calorias_por_repeticion?: number | null
          created_at?: string
          descripcion?: string
          duracion_promedio_segundos?: number | null
          equipamiento?: string | null
          grupo_muscular?: string
          id?: string
          imagen?: string | null
          lugar?: string | null
          maquina_gym?: string | null
          nivel?: string
          nombre?: string
          objetivo?: string | null
          repeticiones_sugeridas?: number | null
          series_sugeridas?: number | null
          tipo_entrenamiento?: string
          video?: string | null
        }
        Relationships: []
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
          created_at: string
          id: string
          log_date: string
          notes: string | null
          user_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          log_date?: string
          notes?: string | null
          user_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string
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
      user_subscriptions: {
        Row: {
          created_at: string
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
      workout_exercises: {
        Row: {
          created_at: string
          duration_minutes: number | null
          id: string
          name: string
          notes: string | null
          reps: number | null
          sets: number | null
          workout_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          id?: string
          name: string
          notes?: string | null
          reps?: number | null
          sets?: number | null
          workout_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          id?: string
          name?: string
          notes?: string | null
          reps?: number | null
          sets?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
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
          location: Database["public"]["Enums"]["workout_location"]
          name: string
          plan_id: string | null
          scheduled_date: string
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
          location?: Database["public"]["Enums"]["workout_location"]
          name: string
          plan_id?: string | null
          scheduled_date: string
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
          location?: Database["public"]["Enums"]["workout_location"]
          name?: string
          plan_id?: string | null
          scheduled_date?: string
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
