# Beta Sprint 3 - PWA iOS/iPadOS

## Configuracion revisada

- `manifest.webmanifest` generado por Vite PWA:
  - `id`: `/`
  - `name`: `SendaFit - Tu Entrenadora Personal`
  - `short_name`: `SendaFit`
  - `display`: `standalone`
  - `orientation`: `portrait`
  - `start_url`: `/`
  - `scope`: `/`
  - iconos `192x192` y `512x512`
- `index.html`:
  - `viewport` con `viewport-fit=cover`
  - `mobile-web-app-capable`
  - `apple-mobile-web-app-capable`
  - `apple-mobile-web-app-title`
  - `apple-mobile-web-app-status-bar-style`
  - `apple-touch-icon` `180x180`
  - `theme-color`
- Service worker:
  - `vite-plugin-pwa` con `registerType: autoUpdate`

## Guia visible en app

En iPhone/iPad, si SendaFit se abre en navegador y no esta en modo instalado, la app muestra un banner discreto:

`Instala SendaFit en tu iPhone desde Safari: toca Compartir y luego Agregar a pantalla de inicio.`

El banner:

- Solo aparece en iOS/iPadOS.
- No aparece en modo standalone.
- Se puede cerrar.
- Guarda la preferencia de cierre en `localStorage`.

## Prueba manual esperada

1. Abrir SendaFit en Safari en iPhone o iPad.
2. Confirmar que aparece el banner de instalacion.
3. Tocar `Compartir`.
4. Tocar `Agregar a pantalla de inicio`.
5. Confirmar `Agregar`.
6. Abrir SendaFit desde el icono instalado.
7. Confirmar que abre en modo app, sin barra normal de Safari.
8. Confirmar que el banner de instalacion ya no aparece.
9. Abrir SendaFit en Chrome iOS y confirmar que no se promete instalacion automatica.

## Nota iOS

iOS no muestra un prompt automatico de instalacion como Android/Chrome. El camino correcto para beta es guiar al usuario a instalar desde Safari usando `Compartir > Agregar a pantalla de inicio`.
