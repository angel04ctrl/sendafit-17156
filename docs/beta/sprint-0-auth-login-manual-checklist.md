# Sprint Beta 0 - Auth/Login manual checklist

## Causa raiz

El registro anterior guardaba `email`, `password` y `fullName` en `sessionStorage` y creaba el usuario de Supabase Auth hasta terminar el onboarding. Si Supabase tenia confirmacion de correo activa, el usuario quedaba en un estado ambiguo: podia ver onboarding sin sesion real y las operaciones de perfil/rutina fallaban o redirigian con mensajes poco claros.

## Comportamiento esperado

- Registro crea la cuenta en Supabase Auth inmediatamente.
- Si Supabase entrega sesion, el usuario entra a onboarding para completar perfil.
- Si Supabase requiere confirmacion de correo, la app muestra una pantalla clara de revisar correo.
- Onboarding requiere una sesion autenticada real.
- Login y recuperacion de contrasena muestran errores en espanol, no errores crudos en ingles.
- `/dashboard` y rutas privadas siguen bloqueadas sin sesion.
- `/auth` redirige a usuarios con sesion mediante `PublicOnlyRoute`.

## Pruebas manuales

1. Registro con confirmacion de correo activa:
   - Crear cuenta nueva.
   - Esperado: pantalla "Revisa tu correo" y no entrar a dashboard sin confirmar.

2. Registro con sesion inmediata:
   - Crear cuenta nueva en un entorno sin confirmacion obligatoria.
   - Esperado: navegar a `/onboarding` con el nombre precargado.

3. Onboarding sin sesion:
   - Abrir `/onboarding` en navegador anonimo o tras cerrar sesion.
   - Esperado: redireccion a `/auth` con mensaje para iniciar sesion.

4. Login con credenciales incorrectas:
   - Usar password invalido.
   - Esperado: mensaje en espanol, sin texto raw de Supabase.

5. Usuario autenticado en ruta publica:
   - Con sesion activa, abrir `/auth`.
   - Esperado: redireccion fuera de auth por `PublicOnlyRoute`.

6. Dashboard sin sesion:
   - Cerrar sesion y abrir `/dashboard`.
   - Esperado: redireccion a `/auth`.

## Validacion tecnica

- Ejecutar `npm run build`.
- Ejecutar `git diff --check`.
