// Client HTTP de l'API (frere-flow-backend).
// La session est un cookie HttpOnly posé par le serveur : aucun jeton n'est lisible ni stocké par le site.
// Adresse : VITE_API_URL (fichier .env), sinon le port 4000 de la machine qui sert le site.
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const NETWORK_MESSAGE = "تعذر الاتصال بالخادم";

export function apiUrl() {
  const configured = import.meta.env["VITE_API_URL"] as string | undefined;
  if (configured) return configured.replace(/\/$/, "");
  return `${window.location.protocol}//${window.location.hostname}:4000/api`;
}

/** auto = mise à jour automatique : ne prolonge pas la session (déconnexion après inactivité) */
export async function api<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  opts: { auto?: boolean } = {},
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(`${apiUrl()}${path}`, {
      method,
      credentials: "include",
      headers: {
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        ...(opts.auto ? { "X-Activite": "auto" } : {}),
      },
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError(0, NETWORK_MESSAGE, "RESEAU");
  } finally {
    clearTimeout(timer);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* réponse vide */
  }
  if (!res.ok) {
    const d = (data ?? {}) as { message?: string; code?: string };
    throw new ApiError(res.status, d.message || "تعذر تنفيذ العملية", d.code);
  }
  return data as T;
}
