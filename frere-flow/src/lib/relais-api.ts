// Relais /api → serveur API (frere-flow-backend), exécuté par le serveur du site (jamais dans le navigateur).
// Utile quand le site et l'API sont hébergés à deux adresses différentes (ex. Render) : pour le navigateur,
// tout reste à la même adresse, donc le cookie de session (HttpOnly, SameSite=Strict) fonctionne.
// Activé par la variable API_PROXY_TARGET (ex. https://frere-flow-api.onrender.com). Avec Caddy, inutile.

/** En-têtes jamais transmis : connexion, longueur (recalculée) et en-têtes réservés au relais */
const NON_TRANSMIS = new Set([
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
  "proxy-authorization",
  "proxy-connection",
  "content-length",
  "accept-encoding",
  "forwarded",
  "x-forwarded-host",
  "x-real-client-ip",
  "x-proxy-secret",
]);

/** Adresse IP du visiteur : la dernière de X-Forwarded-For (ajoutée par l'hébergeur, non falsifiable) */
export function ipVisiteur(request: Request): string {
  const liste = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return liste[liste.length - 1] ?? "";
}

export const estRouteApi = (pathname: string) =>
  pathname === "/api" || pathname.startsWith("/api/");

export async function relayerApi(
  request: Request,
  cible: string,
  secret: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const url = new URL(request.url);
  const destination = new URL(url.pathname + url.search, cible);

  const headers = new Headers();
  request.headers.forEach((valeur, nom) => {
    if (!NON_TRANSMIS.has(nom.toLowerCase())) headers.set(nom, valeur);
  });
  headers.set("accept-encoding", "identity"); // réponse non compressée : renvoyée telle quelle
  const ip = ipVisiteur(request);
  if (ip && secret) {
    headers.set("x-real-client-ip", ip);
    headers.set("x-proxy-secret", secret);
  }

  const avecCorps = request.method !== "GET" && request.method !== "HEAD";
  let reponse: Response;
  try {
    reponse = await fetchImpl(destination, {
      method: request.method,
      headers,
      body: avecCorps ? request.body : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
      ...(avecCorps ? { duplex: "half" } : {}),
    } as RequestInit);
  } catch {
    return new Response(JSON.stringify({ message: "تعذر الاتصال بالخادم", code: "RESEAU" }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const sortie = new Headers(reponse.headers); // conserve chaque Set-Cookie
  for (const nom of ["content-encoding", "content-length", "transfer-encoding", "connection"]) {
    sortie.delete(nom);
  }
  return new Response(reponse.body, {
    status: reponse.status,
    statusText: reponse.statusText,
    headers: sortie,
  });
}

/** En-têtes de sécurité des pages du site (hébergement sans Caddy, ex. Render) */
export const SECURITE_PAGES: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-Robots-Tag": "noindex, nofollow",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
};

export function avecSecurite(reponse: Response): Response {
  const headers = new Headers(reponse.headers);
  for (const [nom, valeur] of Object.entries(SECURITE_PAGES)) {
    if (!headers.has(nom)) headers.set(nom, valeur);
  }
  return new Response(reponse.body, {
    status: reponse.status,
    statusText: reponse.statusText,
    headers,
  });
}
