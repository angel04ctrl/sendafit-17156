# Beta Sprint 4 - Paleta visual SendaFit Performance

## Objetivo

Cambiar la paleta visual de SendaFit a una estetica mas sobria, limpia, profesional, elegante y fitness-tech sin redisenar flujos ni tocar logica de negocio.

## Paleta anterior detectada

- Base visual global en `src/index.css`: fondo lila claro, primario morado vibrante, secundario rosa, acento cian.
- Gradientes: `gradient-primary`, `gradient-secondary`, `gradient-hero`, `gradient-card` con predominio morado/rosa.
- PWA: `theme-color` morado `#a855f7` y `background_color` lila `#faf7ff`.
- Clases hardcodeadas visibles: `blue-*`, `amber-*`, `green-*`, `red-*`, `rose-*`, `orange-*`, `yellow-*` en botones de ayuda, alertas, estados, stats, comidas, calendario, reportes, perfil y toasts.
- Hex restantes no aplicables: `src/App.css` no se importa en la app; `chart.tsx` usa selectores de stroke de Recharts (`#ccc`, `#fff`), no paleta de marca.

## Paleta nueva aplicada

### Light mode

- Fondo principal: `#F8FAFC`
- Superficie/cards: `#FFFFFF`
- Texto principal: `#0F172A`
- Texto secundario: `#64748B`
- Borde: `#E2E8F0`
- Primario: `#2563EB`
- Primario hover: `#1D4ED8`
- Acento fitness: `#14B8A6`
- Exito/progreso: `#22C55E`
- Advertencia: `#F59E0B`
- Error: `#EF4444`

### Dark mode

- Fondo principal: `#020617`
- Superficie/cards: `#0F172A`
- Superficie elevada: `#111827`
- Texto principal: `#F8FAFC`
- Texto secundario: `#94A3B8`
- Borde: `#1E293B`
- Primario: `#3B82F6`
- Primario hover: `#60A5FA`
- Acento fitness: `#2DD4BF`
- Exito/progreso: `#22C55E`
- Advertencia: `#FBBF24`
- Error: `#F87171`

## Archivos modificados

- `src/index.css`
- `tailwind.config.ts`
- `index.html`
- `vite.config.ts`
- `src/components/ui/button.tsx`
- `src/components/ui/toast.tsx`
- `src/components/StatCard.tsx`
- `src/components/OfflineBanner.tsx`
- `src/components/AdaptiveWorkoutActions.tsx`
- `src/components/AddExerciseDialog.tsx`
- `src/components/MenstrualTrackingCard.tsx`
- `src/components/MealHistorySection.tsx`
- `src/components/PaymentModal.tsx`
- `src/components/PaymentSuccessModal.tsx`
- `src/components/RoutineManager.tsx`
- `src/components/ai/AiPrivacyNotice.tsx`
- `src/components/ai/FoodAnalysisModal.tsx`
- `src/components/ai/GymMachineScanner.tsx`
- `src/pages/Calendar.tsx`
- `src/pages/Macros.tsx`
- `src/pages/NotFound.tsx`
- `src/pages/Profile.tsx`
- `src/pages/Reports.tsx`
- `src/pages/Workouts.tsx`

## Chequeo manual pendiente/recomendado

- Login: revisar hero, botones, inputs y estado oscuro.
- Onboarding: revisar botones principales, selected states y progress.
- Dashboard: revisar cards, gradientes, stats y carrusel mobile.
- Entrenar: revisar Hoy, Semana, Rutina, completar, mover, saltar y eliminar.
- ActiveWorkout: revisar botones y estados de ejercicios.
- Macros: revisar analisis IA, correccion manual y historial.
- Coach: revisar burbujas, markdown y acciones pendientes.
- Perfil: revisar tarjeta PRO/dev mode, formularios y dark mode.
- Stripe/paywall: revisar modal PRO, success y estados de ahorro.

## Validacion tecnica

- `npm run build`: OK.
- Barrido de paleta vieja en `src`, `index.html`, `vite.config.ts`: sin clases morado/rosa/ambar/azul/verde/rojo directas relevantes. Queda `prose` en Coach por Tailwind Typography, no es color.
- Hex directos restantes:
  - `index.html` y `vite.config.ts`: colores PWA nuevos.
  - `src/App.css`: archivo no importado por `src/main.tsx`.
  - `src/components/ui/chart.tsx`: selectores internos de Recharts para strokes `#ccc` y `#fff`, no paleta de marca.

## Riesgos visuales

- El cambio global de `--secondary` de rosa a superficie neutra puede hacer que botones secundarios se vean menos llamativos, intencional para el nuevo tono profesional.
- Algunos elementos con gradiente primario ahora combinan azul y teal; revisar visualmente que el contraste se mantenga sobre texto blanco.
- `src/App.css` conserva hex del template, pero no esta importado por `src/main.tsx`.
