type AuthLikeError = {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
};

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function getSpanishAuthErrorMessage(error: unknown, fallback = "No se pudo completar la autenticacion.") {
  const authError = error as AuthLikeError;
  const code = normalize(authError?.code);
  const message = normalize(authError?.message);
  const status = Number(authError?.status);

  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Tu correo aun no esta confirmado. Revisa tu bandeja de entrada y confirma tu cuenta antes de iniciar sesion.";
  }

  if (
    code === "invalid_credentials" ||
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials") ||
    status === 400
  ) {
    return "Correo o contrasena incorrectos. Revisa tus datos e intenta nuevamente.";
  }

  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    message.includes("already registered") ||
    message.includes("user already registered") ||
    message.includes("already exists")
  ) {
    return "Este correo ya esta registrado. Inicia sesion o recupera tu contrasena.";
  }

  if (code === "weak_password" || message.includes("weak password") || message.includes("password")) {
    return "La contrasena no cumple los requisitos. Usa al menos 6 caracteres y evita claves faciles.";
  }

  if (message.includes("invalid email") || code === "email_address_invalid") {
    return "El correo electronico no tiene un formato valido.";
  }

  if (message.includes("rate limit") || message.includes("too many")) {
    return "Hiciste demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  }

  if (message.includes("network") || message.includes("fetch")) {
    return "No pudimos conectar con el servidor. Revisa tu conexion e intenta nuevamente.";
  }

  return fallback;
}
