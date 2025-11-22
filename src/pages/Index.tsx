/**
 * Index.tsx - Página de índice (fallback)
 * 
 * Este documento es una página de respaldo que no se usa normalmente en la app.
 * La ruta raíz redirige directamente a /auth, pero este componente existe como
 * fallback en caso de que algo falle en la redirección.
 */

/**
 * Componente Index
 * Este bloque muestra un mensaje genérico de bienvenida
 */
const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">Welcome to Your Blank App</h1>
        <p className="text-xl text-muted-foreground">Start building your amazing project here!</p>
      </div>
    </div>
  );
};

export default Index;
