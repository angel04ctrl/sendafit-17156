# Sprint 13 - Checklist Mobile, PWA, Performance y Offline

## PWA

- Ejecutar `npm run build`.
- Abrir `dist/manifest.webmanifest` y confirmar:
  - `name`
  - `short_name`
  - `theme_color`
  - `background_color`
  - `display: standalone`
  - `orientation: portrait`
  - iconos `192x192` y `512x512`
- Probar instalacion desde Chrome/Android.
- Probar instalacion desde Safari/iOS con "Agregar a pantalla de inicio".
- Confirmar `apple-touch-icon`, `apple-mobile-web-app-title` y modo standalone en iOS.

## Offline

- Entrar con conexion y visitar Inicio, Entrenar, Macros y Reportes.
- Apagar conexion.
- Confirmar banner: "Estas sin conexion...".
- Confirmar que datos recientes siguen visibles.
- Recuperar conexion y confirmar que el banner desaparece.

## Imagenes IA

- Subir JPG/PNG/WebP menor a 12 MB en comida.
- Confirmar que se genera preview y analiza.
- Subir imagen grande y confirmar que se comprime o muestra error claro.
- Repetir en identificacion de maquinas.

## Mobile

- Probar en viewport movil:
  - Navbar inferior sin solapar contenido.
  - FoodAnalysisModal sin botones fuera de pantalla.
  - GymMachineScanner sin doble scroll incomodo.
  - Crear entrenamiento y agregar ejercicio con teclado abierto.

## Performance

- Confirmar que `localStorage` no crece sin limite con cache de queries.
- Confirmar que la app no hace reload completo al volver online.
- Confirmar que las pantallas principales siguen cargando con Suspense/lazy loading.
