const APP_URL_ENV_KEYS = ["VITE_APP_URL", "VITE_PUBLIC_APP_URL", "VITE_SITE_URL"] as const;

const getConfiguredAppUrl = () => {
  for (const key of APP_URL_ENV_KEYS) {
    const value = import.meta.env[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().replace(/\/+$/, "");
    }
  }
  return null;
};

export const getPasswordResetRedirectUrl = () => {
  const configuredUrl = getConfiguredAppUrl();
  const origin = configuredUrl || window.location.origin;
  return `${origin}/update-password`;
};
