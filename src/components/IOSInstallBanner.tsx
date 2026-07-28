import { Share, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISMISS_KEY = "sendafit-ios-install-banner-dismissed";

function isIOSDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const platform = navigator.platform || "";
  const userAgent = navigator.userAgent || "";
  const isTouchMac = platform === "MacIntel" && navigator.maxTouchPoints > 1;

  return /iPad|iPhone|iPod/.test(userAgent) || isTouchMac;
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };

  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

export function IOSInstallBanner() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!isIOSDevice() || isStandaloneMode()) return;
    if (window.localStorage.getItem(DISMISS_KEY) === "true") return;

    setShouldShow(true);
  }, []);

  if (!shouldShow) return null;

  return (
    <div className="fixed left-2 right-2 top-[96px] z-[55] rounded-lg border border-primary/20 bg-card px-3 py-2 text-card-foreground shadow-elevated sm:left-1/2 sm:right-auto sm:w-[560px] sm:-translate-x-1/2">
      <div className="flex items-start gap-2">
        <Share className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="flex-1 text-xs leading-relaxed sm:text-sm">
          Instala SendaFit en tu iPhone desde Safari: toca Compartir y luego Agregar a pantalla de inicio.
        </p>
        <button
          type="button"
          className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Ocultar guia de instalacion en iPhone"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, "true");
            setShouldShow(false);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
