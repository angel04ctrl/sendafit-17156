import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { logAppError } from "@/lib/appErrorLogger";

const categoryLabels = {
  error: "Error",
  suggestion: "Sugerencia",
  confusion: "Confusion",
  problematic_screen: "Pantalla problematica",
};

const severityLabels = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  blocking: "Bloqueante",
};

export function BetaFeedbackDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<keyof typeof categoryLabels>("suggestion");
  const [severity, setSeverity] = useState<keyof typeof severityLabels>("normal");
  const [screen, setScreen] = useState(() => (typeof window !== "undefined" ? window.location.pathname : ""));
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCategory("suggestion");
    setSeverity("normal");
    setScreen(typeof window !== "undefined" ? window.location.pathname : "");
    setMessage("");
  };

  const submit = async () => {
    if (!user) {
      toast.error("Debes iniciar sesion para enviar feedback.");
      return;
    }
    if (message.trim().length < 8) {
      toast.error("Describe un poco mas lo que paso.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("feedback" as any)
        .insert({
          user_id: user.id,
          category,
          severity,
          screen: screen.trim() || null,
          message: message.trim(),
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          app_version: "closed-beta",
        });

      if (error) throw error;
      toast.success("Feedback enviado. Gracias, esto ayuda mucho.");
      reset();
      setOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No se pudo enviar feedback.";
      toast.error(errorMessage);
      void logAppError({
        userId: user.id,
        source: "beta-feedback",
        message: errorMessage,
        severity: "error",
        details: { category, screen },
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2 sm:w-auto">
          <MessageSquarePlus className="h-4 w-4" />
          Reportar beta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Feedback de beta cerrada</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Reporta errores, sugerencias, confusion o pantallas que se sintieron incomodas.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as keyof typeof categoryLabels)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Impacto</Label>
              <Select value={severity} onValueChange={(value) => setSeverity(value as keyof typeof severityLabels)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(severityLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Pantalla</Label>
            <Input value={screen} onChange={(event) => setScreen(event.target.value)} placeholder="/workouts" />
          </div>

          <div className="space-y-2">
            <Label>Que paso?</Label>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Describe que intentabas hacer, que esperabas y que ocurrio."
              rows={5}
            />
          </div>

          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting ? "Enviando..." : "Enviar feedback"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
