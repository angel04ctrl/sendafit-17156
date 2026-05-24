import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Bot, CalendarDays, Check, Dumbbell, Loader2, MessageSquare, Send, User, X } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useBackendApi";

type MessageRole = "user" | "assistant";

interface RoutineMetadata {
  routine_name?: string;
  days: Array<{
    day_name: string;
    weekday?: number;
    location?: "casa" | "gimnasio" | "exterior";
    duration_minutes?: number;
    estimated_calories?: number;
    exercises: Array<{
      name: string;
      sets?: number;
      reps?: number;
      notes?: string;
      duration_minutes?: number;
    }>;
  }>;
}

const weekdayNames: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miercoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sabado",
  7: "Domingo",
};

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  metadataRoutine?: RoutineMetadata | null;
  routineDismissed?: boolean;
}

const initialMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Hola, soy SendaFit AI Coach. Puedo ayudarte con entrenamiento, tecnica, nutricion, recetas y suplementacion. Cuéntame que necesitas ajustar hoy.",
};

function createMessage(role: MessageRole, content: string, metadataRoutine?: RoutineMetadata | null): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    metadataRoutine,
  };
}

function inferMuscleGroup(day: RoutineMetadata["days"][number]) {
  const text = [
    day.day_name,
    ...day.exercises.flatMap((exercise) => [exercise.name, exercise.notes || ""]),
  ].join(" ").toLowerCase();

  const groups = [
    ["Pecho", ["pecho", "press banca", "aperturas", "fondos"]],
    ["Espalda", ["espalda", "remo", "jalon", "dominada", "dorsal"]],
    ["Piernas", ["pierna", "sentadilla", "prensa", "cuadriceps", "femoral", "gluteo", "pantorrilla"]],
    ["Hombros", ["hombro", "militar", "elevaciones", "deltoide"]],
    ["Brazos", ["biceps", "triceps", "curl", "frances"]],
    ["Core", ["core", "abdomen", "abdominal", "plancha"]],
    ["Cardio", ["cardio", "correr", "bicicleta", "cuerda"]],
  ];

  return groups.find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))?.[0] || day.day_name || "General";
}

function RoutinePreview({ routine }: { routine: RoutineMetadata }) {
  const exerciseCount = routine.days.reduce((total, day) => total + day.exercises.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <CalendarDays className="h-3 w-3" />
          {routine.days.length} dias
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Dumbbell className="h-3 w-3" />
          {exerciseCount} ejercicios
        </Badge>
      </div>

      <div className="space-y-3">
        {routine.days.map((day, dayIndex) => (
          <div key={`${day.day_name}-${dayIndex}`} className="rounded-md border bg-background/80 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {day.weekday ? weekdayNames[day.weekday] || `Dia ${day.weekday}` : `Dia ${dayIndex + 1}`}: {day.day_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {inferMuscleGroup(day)}
                  {day.duration_minutes ? ` • ${day.duration_minutes} min` : ""}
                  {day.location ? ` • ${day.location}` : ""}
                </p>
              </div>
              <Badge variant="outline" className="text-[11px]">
                {day.exercises.length} ejercicios
              </Badge>
            </div>
            <ul className="space-y-1.5">
              {day.exercises.map((exercise, exerciseIndex) => (
                <li key={`${exercise.name}-${exerciseIndex}`} className="text-xs text-foreground">
                  <span className="font-medium">{exercise.name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    {exercise.sets || 3}x{exercise.reps || 10}
                    {exercise.notes ? ` - ${exercise.notes}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

async function getFunctionErrorMessage(error: unknown) {
  const maybeError = error as { message?: string; context?: Response };
  if (maybeError.context instanceof Response) {
    const body = await maybeError.context.json().catch(() => null);
    if (body?.error) return String(body.error);
  }
  return maybeError.message || "No se pudo completar la solicitud.";
}

export default function CoachChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useUserProfile(user?.id);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const userContext = useMemo(() => ({
    weight: profile?.weight,
    height: profile?.height,
    goal: profile?.fitness_goal || profile?.primary_goal,
    fitness_level: profile?.fitness_level,
    menstrual_phase: profile?.fase_menstrual_actual || "N/A",
    available_weekdays: profile?.available_weekdays,
    available_days_per_week: profile?.available_days_per_week,
    injuries_limitations: profile?.injuries_limitations,
    health_conditions: profile?.health_conditions,
  }), [profile]);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const history = messages
        .filter((item) => item.id !== "welcome")
        .slice(-8)
        .map((item) => ({ role: item.role, content: item.content }));

      const { data, error } = await supabase.functions.invoke("coach-chat", {
        body: {
          user_message: message,
          history,
          user_context: userContext,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "No se pudo contactar al Coach.");
      return data as { message: string; metadata_routine?: RoutineMetadata | null };
    },
    onSuccess: (data) => {
      setMessages((current) => [
        ...current,
        createMessage("assistant", data.message, data.metadata_routine || null),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Error en el chat");
    },
  });

  const applyRoutineMutation = useMutation({
    mutationFn: async (metadataRoutine: RoutineMetadata) => {
      const { data, error } = await supabase.functions.invoke("apply-ai-routine", {
        body: { metadata_routine: metadataRoutine },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error));
      if (!data?.success) throw new Error(data?.error || "No se pudo aplicar la rutina.");
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user-routine"] }),
        queryClient.invalidateQueries({ queryKey: ["todays-workouts"] }),
        queryClient.invalidateQueries({ queryKey: ["weekly-workouts"] }),
        queryClient.invalidateQueries({ queryKey: ["workouts-by-date"] }),
        queryClient.invalidateQueries({ queryKey: ["all-workouts"] }),
      ]);
      toast.success("Tu rutina fue personalizada por SendaFit AI Coach.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la rutina");
    },
  });

  const sendMessage = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || chatMutation.isPending) return;

    setMessages((current) => [...current, createMessage("user", trimmed)]);
    setInputValue("");
    chatMutation.mutate(trimmed);
  };

  const dismissRoutine = (messageId: string) => {
    setMessages((current) => current.map((message) =>
      message.id === messageId ? { ...message, routineDismissed: true } : message,
    ));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="flex h-screen flex-col px-3 pb-20 pt-16 sm:px-4">
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
          <header className="sticky top-14 z-10 border-b bg-background/95 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold">SendaFit AI Coach</h1>
                <p className="text-xs text-muted-foreground">Entrenamiento, tecnica y nutricion</p>
              </div>
              <Badge variant="secondary" className="ml-auto gap-1">
                <MessageSquare className="h-3 w-3" />
                IA
              </Badge>
            </div>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 pr-1">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}

                <div className={`max-w-[82%] space-y-2 ${message.role === "user" ? "items-end" : "items-start"}`}>
                  <Card className={`p-3 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                    )}
                  </Card>

                  {message.role === "assistant" && message.metadataRoutine && !message.routineDismissed && (
                    <Card className="border-primary/30 p-3">
                      <p className="text-sm font-medium">
                        {message.metadataRoutine.routine_name || "Rutina sugerida por el Coach"}
                      </p>
                      <div className="mt-3">
                        <RoutinePreview routine={message.metadataRoutine} />
                      </div>
                      <p className="mt-3 text-sm font-medium">Quieres aplicar esta rutina y reemplazar tu plan actual?</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Se eliminaran los entrenamientos automaticos previos y se insertara la rutina sugerida por el Coach.
                      </p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <Button
                          size="sm"
                          className="gap-2"
                          disabled={applyRoutineMutation.isPending}
                          onClick={() => applyRoutineMutation.mutate(message.metadataRoutine!)}
                        >
                          {applyRoutineMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Si, actualizar rutina
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => dismissRoutine(message.id)}
                        >
                          <X className="h-4 w-4" />
                          No, gracias
                        </Button>
                      </div>
                    </Card>
                  )}
                </div>

                {message.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <Card className="bg-muted p-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </Card>
              </div>
            )}
          </div>

          <footer className="border-t bg-background py-3">
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Pregunta sobre entrenamiento, nutricion o tecnica..."
                disabled={chatMutation.isPending}
              />
              <Button onClick={sendMessage} disabled={!inputValue.trim() || chatMutation.isPending} size="icon">
                {chatMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
