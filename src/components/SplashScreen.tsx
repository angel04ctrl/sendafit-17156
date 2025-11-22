/**
 * SplashScreen.tsx - Pantalla de carga inicial
 * 
 * Este componente muestra una animación de carga al iniciar la aplicación.
 * Se encarga de:
 * - Mostrar logo de SendaFit con animación
 * - Animar barra de progreso de 0 a 100%
 * - Llamar callback onComplete cuando termina la animación
 * - Proporcionar una transición suave antes de mostrar contenido principal
 */

import { useEffect, useState } from "react";
import { Dumbbell } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  // Estado del progreso de carga (0-100)
  const [progress, setProgress] = useState(0);

  // Bloque de efecto - Incrementa progreso automáticamente cada 30ms
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Al llegar a 100%, limpiar intervalo y llamar callback
          clearInterval(interval);
          setTimeout(onComplete, 300);
          return 100;
        }
        return prev + 2; // Incrementar 2% cada vez
      });
    }, 30);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-gradient-hero flex items-center justify-center z-50">
      <div className="text-center space-y-8 px-6 animate-fade-in">
        <div className="w-24 h-24 mx-auto rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center animate-scale-in">
          <Dumbbell className="w-14 h-14 text-white" />
        </div>
        
        <div className="space-y-4">
          <h1 className="text-5xl font-bold text-white">SendaFit</h1>
          <p className="text-xl text-white/90 font-light">
            Tu compañera fitness
          </p>
        </div>

        <div className="w-64 mx-auto space-y-2">
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-white/70">Cargando...</p>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
