// Relais /api → serveur API : cookies, IP du visiteur protégée par secret, en-têtes, erreurs réseau.
import { describe, expect, it, vi } from "vitest";
import { avecSecurite, estRouteApi, ipVisiteur, relayerApi } from "@/lib/relais-api";

const CIBLE = "https://api.exemple.test";
const SECRET = "secret-relais-0123456789-0123456789-abcdef";

function appel(init: RequestInit & { url?: string } = {}) {
  return new Request(init.url ?? "https://site.exemple.test/api/auth/login?x=1", init);
}

describe("relais /api", () => {
  it("ne relaie que /api et /api/…", () => {
    expect(estRouteApi("/api")).toBe(true);
    expect(estRouteApi("/api/state")).toBe(true);
    expect(estRouteApi("/apiculture")).toBe(false);
    expect(estRouteApi("/dashboard")).toBe(false);
  });

  it("transmet chemin, méthode, corps, cookie, origine et l'IP du visiteur avec le secret", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    await relayerApi(
      appel({
        method: "POST",
        body: JSON.stringify({ email: "a@b.tn" }),
        headers: {
          "content-type": "application/json",
          cookie: "ff_session=abc",
          origin: "https://site.exemple.test",
          "x-forwarded-for": "6.6.6.6, 196.203.1.2",
        },
      }),
      CIBLE,
      SECRET,
      fetchImpl as unknown as typeof fetch,
    );
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("https://api.exemple.test/api/auth/login?x=1");
    expect(init.method).toBe("POST");
    const h = init.headers as Headers;
    expect(h.get("cookie")).toBe("ff_session=abc");
    expect(h.get("origin")).toBe("https://site.exemple.test");
    expect(h.get("x-real-client-ip")).toBe("196.203.1.2"); // la dernière (ajoutée par l'hébergeur)
    expect(h.get("x-proxy-secret")).toBe(SECRET);
    expect(h.get("accept-encoding")).toBe("identity");
  });

  it("ignore un secret ou une IP envoyés par le navigateur lui-même", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}"));
    await relayerApi(
      appel({ headers: { "x-proxy-secret": "pirate", "x-real-client-ip": "1.1.1.1" } }),
      CIBLE,
      "",
      fetchImpl as unknown as typeof fetch,
    );
    const h = (fetchImpl.mock.calls[0] as unknown as [URL, RequestInit])[1].headers as Headers;
    expect(h.get("x-proxy-secret")).toBeNull();
    expect(h.get("x-real-client-ip")).toBeNull();
  });

  it("renvoie chaque Set-Cookie et retire Content-Encoding", async () => {
    const reponse = new Response("{}", { status: 200 });
    reponse.headers.append("set-cookie", "ff_session=1; HttpOnly; Path=/api");
    reponse.headers.append("set-cookie", "ff_mfa=; Max-Age=0; Path=/api");
    reponse.headers.set("content-encoding", "gzip");
    const r = await relayerApi(
      appel(),
      CIBLE,
      SECRET,
      (async () => reponse) as unknown as typeof fetch,
    );
    expect(r.headers.getSetCookie()).toHaveLength(2);
    expect(r.headers.get("content-encoding")).toBeNull();
  });

  it("API injoignable → 502 JSON (jamais de plantage)", async () => {
    const r = await relayerApi(appel(), CIBLE, SECRET, (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch);
    expect(r.status).toBe(502);
    expect((await r.json()).code).toBe("RESEAU");
  });

  it("IP du visiteur : dernière adresse de X-Forwarded-For", () => {
    expect(ipVisiteur(appel({ headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" } }))).toBe(
      "2.2.2.2",
    );
    expect(ipVisiteur(appel())).toBe("");
  });

  it("pages : en-têtes de sécurité ajoutés (CSP, HSTS, anti-iframe, noindex)", () => {
    const r = avecSecurite(
      new Response("<html></html>", { headers: { "content-type": "text/html" } }),
    );
    expect(r.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(r.headers.get("strict-transport-security")).toContain("max-age=");
    expect(r.headers.get("x-frame-options")).toBe("DENY");
    expect(r.headers.get("x-robots-tag")).toContain("noindex");
  });
});
