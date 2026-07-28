Inicia una serie de sprints beta de estabilización para SendaFit.

No avances a features grandes nuevas. No hagas rediseños masivos. No rompas el planner, pagos, entrenamientos, sesiones activas ni historial.

Estamos en beta cerrada. Necesito corregir problemas reales encontrados usando la app y preparar cosas pequeñas para poder usarla hoy en el gimnasio.

Prioridad:
1. Auth/login/signup.
2. Coach IA aplicando rutinas válidas.
3. UX del entrenamiento activo: RIR/RPE/confianza baja.
4. PWA iOS.
5. Paleta de colores.
6. Guardar contexto de Stripe para continuar después.

Hazlo por sprints pequeños y entrégame cada uno con resumen, archivos modificados, pruebas y riesgos.

---

# Beta Sprint 0 — Auth/Login crítico

Problema:
Un usuario nuevo intentó crear cuenta. Llenó el formulario, terminó el registro y la app lo redirigió a la página principal en vez de iniciar sesión o mostrarle claramente qué hacer. Después intentó iniciar sesión con correo/contraseña y la app mostró error en inglés de inicio de sesión.

Objetivo:
Arreglar el flujo de registro/inicio de sesión para que un usuario beta pueda crear cuenta, entender qué pasó y entrar sin errores confusos.

Revisar:

- Supabase Auth config actual.
- Si email confirmation está activado o no.
- Registro con email/password.
- Login con email/password.
- Redirecciones post-signup.
- Manejo de sesión después de signup.
- Mensajes de error en español.
- Caso de usuario ya registrado.
- Caso de contraseña incorrecta.
- Caso de email no confirmado.
- Caso de cuenta creada pero sesión no iniciada.
- Redirects desde `/auth`, `/login`, `/onboarding`, `/dashboard` o rutas equivalentes.

Reglas:

1. Si el usuario queda registrado y Supabase permite sesión inmediata, debe entrar/onboarding automáticamente.
2. Si Supabase requiere confirmar correo, NO redirigirlo silenciosamente a home. Mostrar pantalla clara:
   “Revisa tu correo para confirmar tu cuenta.”
3. Si intenta login sin confirmar email, mostrar mensaje en español.
4. No mostrar errores crudos en inglés.
5. No perder el formulario sin explicación.
6. No dejar al usuario en una ruta pública si ya tiene sesión.
7. No dejar al usuario en dashboard si no tiene sesión.

Crear pruebas manuales:

- nuevo usuario válido;
- correo ya usado;
- contraseña incorrecta;
- email no confirmado si aplica;
- logout/login;
- refresh después de login;
- usuario nuevo termina onboarding.

Entrega:

- causa raíz del bug;
- archivos modificados;
- comportamiento anterior vs nuevo;
- pruebas realizadas;
- resultado de build.

---

# Beta Sprint 1 — Coach IA: rutina aplicable con ejercicios válidos

Problema real:
Se pidió al Coach IA:

“Haz un plan de entrenamiento de tres días, lunes, miércoles y viernes, con duración de dos horas cada día y concentrado en hipertrofia para aumentar masa muscular.”

El Coach respondió que no podía aplicar vista previa porque algunos ejercicios no pasaron validación:

No encontrados:
- fondos en paralelas
- press de tríceps en polea
- extensión de tríceps con mancuerna sobre la cabeza
- dominadas asistidas

Ambiguo:
- press inclinado con mancuernas

Objetivo:
El Coach debe poder convertir solicitudes normales del usuario en una rutina válida usando el catálogo actual, aliases, equivalencias y sustituciones, sin fallar por nombres comunes.

Revisar:

- `apply-ai-routine`
- resolución de ejercicios IA contra `public.exercises`
- aliases
- normalización de acentos
- normalización de mayúsculas/minúsculas
- typos comunes
- nombres en español/inglés
- ejercicios ambiguos
- fallback a sustituciones
- vista previa antes de aplicar
- mensajes al usuario

Reglas:

1. No usar texto libre como identidad. Siempre intentar resolver a `exercise_id`.
2. Si el ejercicio existe por alias, usarlo.
3. Si el usuario o IA usa un nombre común, mapear al ejercicio correcto.
4. Si hay typo leve como “mancuerda” en vez de “mancuerna”, intentar normalización segura.
5. Si un ejercicio no existe pero hay alternativa equivalente, usar sustitución válida y explicarlo.
6. Si hay ambigüedad, no fallar directamente si se puede resolver por contexto:
   - músculo
   - patrón
   - equipo
   - nivel
   - objetivo
7. No elegir con `ILIKE '%press%'` de forma peligrosa.
8. No usar ejercicios `deprecado` o `revisar`.
9. No aplicar nada si la vista previa no es válida.
10. El usuario debe recibir una respuesta útil:
   “Preparé una vista previa válida usando ejercicios equivalentes disponibles.”

Casos específicos a resolver:

- “fondos en paralelas” debe existir o mapearse correctamente.
- “press de tríceps en polea” debe mapearse a pushdown/jalón de tríceps en polea si existe.
- “extensión de tríceps con mancuerna sobre la cabeza” debe existir o mapearse.
- “dominadas asistidas” debe existir, agregarse o mapearse a una variante válida si el catálogo lo permite.
- “press inclinado con mancuernas” no debe quedar ambiguo; debe haber una resolución canónica.

Si faltan ejercicios realmente importantes, crear una migración pequeña para agregarlos con metadata completa:
- nombre
- aliases
- grupo muscular
- músculo principal
- secundarios
- equipo
- patrón
- instrucciones
- cues
- errores
- sustituciones
- reps/descanso/RIR
- estado_calidad = curado si está completo

Prueba manual obligatoria:
Pedir exactamente:
“Haz un plan de entrenamiento de tres días, lunes, miércoles y viernes, con duración de dos horas cada día y concentrado en hipertrofia para aumentar masa muscular.”

Resultado esperado:
- vista previa válida;
- 3 días;
- lunes/miércoles/viernes;
- hipertrofia;
- duración aproximada 2 horas;
- ejercicios con `exercise_id`;
- opción clara para aplicar.

Entrega:
- causa raíz;
- cambios en resolver ejercicios;
- ejercicios agregados/mapeados;
- prueba manual;
- SQL de validación si aplica;
- build.

---
# Sprint 1.1: Coach IA con contexto conversacional y edición de rutina en progreso.

No avances a features grandes nuevas. No cambies macros, pagos, paleta, PWA ni Stripe en este sprint.

## Problema real

El Coach IA pierde contexto después de proponer una rutina.

Ejemplo:

Usuario:
“Hazme un plan de entrenamiento de tres días, lunes, miércoles y viernes, con duración de dos horas cada día y enfocado en hipertrofia para ganar masa muscular.”

El Coach genera una rutina.

Luego el usuario dice:
“Quiero que lunes sea brazos, miércoles espalda y viernes pierna.”

El Coach responde algo genérico como:
“Soy un coach de IA y puedo ayudarte con entrenamiento, nutrición…”

Eso está mal.

El Coach debería entender que el usuario está modificando la rutina que acaba de pedir.

## Objetivo

El Coach debe mantener contexto suficiente para permitir una conversación natural sobre una rutina en progreso.

Debe poder entender frases como:

- “Cambia el lunes por brazos.”
- “Haz que miércoles sea espalda.”
- “No quiero pierna el lunes.”
- “Mejor pon pecho y tríceps el viernes.”
- “Cambia ese ejercicio.”
- “Dame otra opción.”
- “Ahora aplícala.”
- “No me gusta esa distribución.”
- “Déjalo en lunes, miércoles y viernes.”

## Solución esperada

No depender solamente de la ventana de contexto del modelo.

Crear o usar un estado estructurado del Coach.

Por ejemplo:

- conversación activa;
- mensajes recientes;
- intención actual;
- rutina en borrador;
- rutina pendiente de aplicar;
- cambios solicitados;
- preview validada;
- ejercicios resueltos con `exercise_id`.

Si ya existen tablas o estructuras para mensajes del coach, reutilizarlas. Si no existen, proponer una solución mínima segura.

## Reglas

1. Cuando el Coach genera una rutina, debe guardarla como `draft` o “vista previa pendiente”.
2. Si el usuario manda un mensaje posterior y existe una rutina pendiente, el Coach debe interpretar referencias como:
   - “el lunes”
   - “ese entrenamiento”
   - “la rutina”
   - “cámbialo”
   - “ponlo”
   - “mejor así”
3. El Coach debe modificar el draft, no empezar de cero.
4. El Coach debe devolver una nueva vista previa.
5. No debe aplicar la rutina sin confirmación explícita.
6. Si el usuario dice “aplícalo”, “sí, déjala así”, “guardar rutina” o equivalente, entonces puede aplicar la rutina validada.
7. Si no hay draft activo, el Coach debe pedir contexto en vez de responder genérico.
8. No debe perder `exercise_id`.
9. No debe usar ejercicios no resueltos.
10. No debe usar texto libre como identidad.
11. Si hay ambigüedad real, preguntar una aclaración concreta.

## Ejemplo esperado

Usuario:
“Hazme un plan de 3 días lunes, miércoles y viernes, 2 horas, hipertrofia.”

Coach:
“Preparé esta vista previa…”

Usuario:
“Quiero que lunes sea brazos, miércoles espalda y viernes pierna.”

Coach:
“Claro. Actualicé la distribución de la rutina pendiente:
- Lunes: brazos
- Miércoles: espalda
- Viernes: pierna

También ajusté los ejercicios para mantener el volumen de hipertrofia. ¿Quieres que la aplique?”

## Casos de prueba obligatorios

### Caso A

Usuario pide rutina de 3 días.
Luego pide cambiar los grupos musculares por día.
Resultado:
El Coach modifica la rutina pendiente.

### Caso B

Usuario pide cambiar un ejercicio específico.
Resultado:
El Coach usa sustitución válida con `exercise_id`.

### Caso C

Usuario dice “aplícalo”.
Resultado:
Solo aplica si la vista previa es válida.

### Caso D

Usuario dice “no, mejor déjalo como antes”.
Resultado:
El Coach puede volver a la versión anterior del draft si la estructura lo permite, o regenerar una vista previa anterior.

### Caso E

Usuario inicia una conversación nueva sin draft.
Resultado:
El Coach no inventa contexto.

### Caso F

Usuario pide una rutina y luego refresca la página.
Resultado:
El draft pendiente no se pierde si la sesión sigue activa o está guardado.

## Revisar archivos

Revisar como mínimo:

- edge function del coach
- `apply-ai-routine`
- resolución de ejercicios IA
- tablas/memoria de mensajes si existen
- frontend del chat
- preview/aplicación de rutina
- manejo de errores

## UX

No responder con frases genéricas cuando el usuario está hablando de la rutina pendiente.

Evitar:
“Soy un coach de IA y puedo ayudarte con nutrición y entrenamiento…”

Usar:
“Estoy tomando como referencia la rutina que acabamos de crear…”

## Entrega

Al terminar entrega:

1. Causa raíz de la pérdida de contexto.
2. Cómo guardaste el contexto.
3. Dónde se guarda el draft de rutina.
4. Cómo se modifica el draft.
5. Cómo se aplica.
6. Cómo evitas aplicar rutinas inválidas.
7. Archivos modificados.
8. Migraciones si fueron necesarias.
9. Pruebas realizadas.
10. Resultado de `npm run build`.
11. Resultado de `deno check` si tocaste Edge Functions.
12. Riesgos pendientes.

# Beta Sprint 2 — UX entrenamiento: RIR/RPE/confianza baja

Problemas:
En entrenamiento activo aparecen campos:
- RIR opcional
- RPE opcional

El usuario no entiende qué significan.

También aparecen etiquetas como:
- confianza baja

Ejemplo en modal:
“mantener… aún estamos construyendo tu historial…” y aparece “confianza baja”.

Eso se ve técnico, antiestético y confuso para beta.

Objetivo:
Hacer que la experiencia de entrenamiento sea más entendible y limpia para usuarios normales.

Cambios requeridos:

## RIR/RPE

No mostrar simplemente:

- RIR
- RPE

Cambiar a lenguaje entendible.

Opciones:

- “Repeticiones en reserva”
- “Esfuerzo percibido”

Y agregar tooltip o texto corto:

RIR:
“Cuántas repeticiones más crees que podrías hacer al terminar la serie. Ejemplo: 2 significa que aún podrías hacer 2 repeticiones más.”

RPE:
“Qué tan difícil se sintió la serie del 1 al 10. 10 significa esfuerzo máximo.”

Mejor UX:
Mover RIR/RPE a una sección colapsable:

“Datos avanzados opcionales”

o mostrar solo uno si la app realmente lo necesita.

No obligar al usuario a llenarlos.

## PR

Si aparece PR, explicar:
“Récord personal: tu mejor marca registrada en este ejercicio.”

No confundirlo solo con 1 repetición máxima. Puede ser mejor peso/reps según el contexto.

## Confianza baja

No mostrar etiquetas técnicas como:

- confianza baja
- low confidence
- confidence

al usuario final.

Eso puede quedarse como dato interno, pero no visible.

Reemplazar visualmente por algo amigable si hace falta:

En vez de:
“Confianza baja”

usar:
“Primeras sesiones”
o
“Recomendación inicial”
o simplemente no mostrar badge.

Para mensajes tipo:
“Aún estamos construyendo tu historial…”

dejarlo más limpio:

“Usa un peso cómodo y deja 2–3 repeticiones en reserva. Con más entrenamientos, SendaFit ajustará mejor tus sugerencias.”

Sin badge de confianza.

Revisar:

- ActiveWorkout
- ExerciseDetailModal
- componentes de progresión
- cards de sugerencias
- badges
- cualquier texto `confidence`, `low confidence`, `confianza baja`

Entrega:
- archivos modificados;
- capturas o descripción de antes/después;
- build;
- prueba manual en un entrenamiento.

---

# Beta Sprint 3 — PWA iOS/iPadOS

Problema:
En Android/Chrome/Edge aparece opción de instalar/agregar PWA. En iOS no queda claro cómo instalar SendaFit como app.

Objetivo:
Revisar configuración PWA para iOS/iPadOS y agregar guía de instalación si hace falta.

Revisar:

- `manifest.webmanifest`
- icons
- apple-touch-icon
- theme-color
- display standalone
- service worker
- start_url
- scope
- viewport
- meta `apple-mobile-web-app-capable`
- meta `apple-mobile-web-app-status-bar-style`
- meta `apple-mobile-web-app-title`
- comportamiento en Safari iOS
- Chrome iOS si aplica

Reglas:
No asumir que iOS muestra botón automático igual que Android.
Agregar una guía dentro de la app o landing:

“Para instalar en iPhone:
1. Abre SendaFit en Safari.
2. Toca Compartir.
3. Toca Agregar a pantalla de inicio.
4. Confirma Agregar.”

Detectar si el usuario está en iOS y no está en standalone mode.
Mostrar banner discreto:
“Instala SendaFit en tu iPhone desde Safari > Compartir > Agregar a pantalla de inicio.”

No molestar si ya está instalada.

Entrega:
- checklist PWA;
- archivos modificados;
- guía agregada;
- prueba manual esperada en iOS;
- build.

---

# Beta Sprint 4 — Paleta visual SendaFit Performance

Objetivo:
Cambiar la paleta visual de SendaFit a una estética más sobria, limpia, profesional, elegante y fitness-tech, sin romper funcionalidades.

No hacer rediseño estructural.
No cambiar flujos.
No tocar lógica de negocio.
No tocar auth, planner, macros, Stripe ni Supabase salvo que sea necesario para estilos.

Paleta a aplicar:

## Light mode

- Fondo principal: #F8FAFC
- Superficie/cards: #FFFFFF
- Texto principal: #0F172A
- Texto secundario: #64748B
- Borde: #E2E8F0
- Primario: #2563EB
- Primario hover: #1D4ED8
- Acento fitness: #14B8A6
- Éxito/progreso: #22C55E
- Advertencia: #F59E0B
- Error: #EF4444

## Dark mode

- Fondo principal: #020617
- Superficie/cards: #0F172A
- Superficie elevada: #111827
- Texto principal: #F8FAFC
- Texto secundario: #94A3B8
- Borde: #1E293B
- Primario: #3B82F6
- Primario hover: #60A5FA
- Acento fitness: #2DD4BF
- Éxito/progreso: #22C55E
- Advertencia: #FBBF24
- Error: #F87171

Antes de cambiar:
1. Extraer paleta actual.
2. Detectar variables CSS existentes.
3. Detectar clases hardcodeadas.
4. Detectar colores en badges, charts, cards, buttons, nav, progress bars.

Aplicación:
- Preferir CSS variables/Tailwind tokens.
- No hardcodear colores en 50 componentes si puede evitarse.
- Mantener contraste y legibilidad.
- Revisar estados hover, disabled, error, warning, success.
- Revisar mobile.
- Revisar dark mode si ya existe.
- No romper shadcn.

Entrega:
- paleta anterior detectada;
- paleta nueva aplicada;
- archivos modificados;
- riesgos visuales;
- build;
- prueba manual de pantallas principales:
  - Login
  - Onboarding
  - Dashboard
  - Entrenar
  - ActiveWorkout
  - Macros
  - Coach
  - Perfil
  - Stripe/paywall si existe.

---

# Beta Sprint 5 — Stripe: guardar contexto para continuar después

No configurar Stripe ahora si no se está trabajando activamente en pagos.

Objetivo:
Guardar el contexto actual de Stripe para retomarlo después sin confusión.

Crear documento:

`docs/stripe-setup-continuation.md`

Debe incluir:

- Se está creando/configurando Stripe desde cero otra vez.
- Producto recomendado:
  - SendaFit Pro
- Precio fundador:
  - $79 MXN/mes
- Precio futuro:
  - $99 MXN/mes
- Estrategia:
  - $79 para primeros usuarios fundadores o periodo de lanzamiento.
  - Mantener $79 a usuarios fundadores mientras sigan suscritos.
  - Crear precio futuro de $99 sin cambiar el producto.
- Producto Stripe:
  - `SendaFit Pro`
- Metadata recomendada producto:
  - product_key = sendafit_pro
  - plan = pro
- Price/env recomendado:
  - STRIPE_PRICE_SENDAFIT_PRO_FOUNDER_MONTHLY
  - luego STRIPE_PRICE_SENDAFIT_PRO_MONTHLY
- No usar “Beta” en el nombre del producto.
- Guardar Price ID real cuando Stripe lo genere.
- Pendiente:
  - webhook
  - checkout
  - customer portal
  - planes/entitlements
  - pruebas test mode
  - pasar a live mode

No modificar código de pagos todavía salvo documentación.

Entrega:
- documento creado;
- resumen de dónde quedamos;
- próximos pasos cuando retomemos Stripe.

---

# Orden de ejecución recomendado

Primero hacer:

1. Beta Sprint 0 — Auth/Login.
2. Beta Sprint 1 — Coach IA/rutinas válidas.
3. Beta Sprint 2 — UX entrenamiento.

Estos tres son los urgentes para usar SendaFit hoy en el gimnasio.

Después:

4. Beta Sprint 3 — PWA iOS.
5. Beta Sprint 4 — Paleta.
6. Beta Sprint 5 — Stripe contexto.

No avances al siguiente sprint si el actual rompe build o deja flujo crítico dañado.

Al final de cada sprint ejecutar:

- npm run build
- git diff --check

Si toca Edge Functions:

- deno check --no-lock en funciones modificadas

Si toca Supabase:

- migración segura
- SQL de validación