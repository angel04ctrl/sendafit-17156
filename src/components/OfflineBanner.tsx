import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);

  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function OfflineBanner() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (isOnline) return null;

  return (
    <div className="fixed left-2 right-2 top-[54px] z-[60] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950 shadow-elevated sm:left-1/2 sm:right-auto sm:w-[520px] sm:-translate-x-1/2">
      <div className="flex items-start gap-2">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-xs leading-relaxed sm:text-sm">
          Estas sin conexion. Puedes ver datos recientes; los cambios se sincronizaran cuando vuelvas.
        </p>
      </div>
    </div>
  );
}
