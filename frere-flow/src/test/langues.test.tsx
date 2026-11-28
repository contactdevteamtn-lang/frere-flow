// Langue de l'interface : en français tout est en français, en arabe tout est en arabe.
// 1) Chaque page est affichée avec les données de démonstration dans les deux langues :
//    aucun texte arabe en français, aucun texte français en arabe (hors codes, emails, bouton de langue).
// 2) Chaque texte arabe écrit dans le code a sa traduction française complète.
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { buildSeed } from "@/mock/seed";
import { routeTree } from "@/routeTree.gen";
import { translate } from "@/lib/i18n";

const AR = /[؀-ۿ]/;
const LATIN = /[A-Za-zÀ-ÿ]{3,}/;

const seed = buildSeed();
const etat = { ...seed, sessionUserId: "u_super" };
for (const u of etat.users) (u as { password?: string }).password = "";

// le serveur est remplacé par les données de démonstration
vi.stubGlobal(
  "fetch",
  vi.fn(async (url: string) => {
    const u = String(url);
    const corps = u.includes("/auth/public")
      ? {
          users: [],
          roles: [],
          teams: [],
          settings: seed.settings,
          demoLogin: false,
          idleMinutes: 30,
        }
      : u.includes("/state")
        ? { version: 1, state: etat }
        : {};
    return new Response(JSON.stringify(corps), { status: 200 });
  }),
);

const PAGES = [
  "/dashboard",
  "/ventes",
  "/factures",
  "/clients",
  `/clients/${seed.clients[0]!.id}`,
  "/credits",
  "/echeances",
  "/paiements",
  "/caisse",
  "/produits",
  "/stock",
  "/mouvements",
  "/frigos",
  "/emballages",
  "/emballages-mouvements",
  "/emballages-soldes",
  "/marches",
  "/equipes",
  "/utilisateurs",
  "/historique",
  "/rapports",
  "/parametres",
];

/** Textes visibles (et info-bulles, textes d'aide, libellés d'accessibilité) qui ne sont pas dans la bonne langue */
function horsLangue(racine: HTMLElement, langue: "fr" | "ar"): string[] {
  const mauvais = (t: string) =>
    langue === "fr"
      ? AR.test(t) && t !== "العربية" // bouton « العربية » : chaque langue est écrite dans sa propre écriture
      : // codes (PDT-001, FAWZI…), emails, noms de langue et de format ne se traduisent pas
        LATIN.test(
          t.replace(/\S+@\S+|\b[A-Z][A-Z0-9-]{1,14}\b|\bFrançais\b|\bExcel\b|\bPDF\b/g, ""),
        );
  const out = new Set<string>();
  const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = w.nextNode())) {
    const t = (n.textContent ?? "").trim();
    if (t && mauvais(t)) out.add(t);
  }
  racine.querySelectorAll("[placeholder],[title],[aria-label]").forEach((e) => {
    for (const a of ["placeholder", "title", "aria-label"]) {
      const v = e.getAttribute(a);
      if (v && mauvais(v.replace(/\salt\+T$/, ""))) out.add(`[${a}] ${v}`);
    }
  });
  return [...out];
}

describe.each(["fr", "ar"] as const)("pages en %s", (langue) => {
  it("chaque page est entièrement dans la langue choisie", async () => {
    localStorage.setItem("mahjoub-language", langue);
    const problemes: string[] = [];
    for (const page of PAGES) {
      const router = createRouter({
        routeTree,
        history: createMemoryHistory({ initialEntries: [page] }),
        context: { queryClient: new QueryClient() },
      });
      const vue = render(<RouterProvider router={router} />);
      await act(async () => {
        await new Promise((r) => setTimeout(r, 300));
      });
      expect(vue.container.textContent?.length, `${page} affichée`).toBeGreaterThan(50);
      for (const t of horsLangue(vue.container, langue)) problemes.push(`${page} : ${t}`);
      vue.unmount();
    }
    expect(problemes).toEqual([]);
  }, 120000);
});

describe("traductions du code", () => {
  it("chaque texte arabe de l'interface a une traduction française complète", () => {
    const fichiers = (d: string): string[] =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(d, e.name);
        if (e.isDirectory()) return ["test", "mock"].includes(e.name) ? [] : fichiers(p);
        return /\.tsx?$/.test(e.name) && !/translations\.ts$|translit\.ts$|routeTree\.gen/.test(p)
          ? [p]
          : [];
      });
    const RE =
      /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`|>([^<>{}\n]*[؀-ۿ][^<>{}\n]*)</g;
    const BORD = /^[\s:،,.\-—()«»!؟?]+|[\s:،,.\-—()«»!؟?]+$/g;
    const restes: string[] = [];
    for (const f of fichiers("src")) {
      const src = fs.readFileSync(f, "utf8");
      let m: RegExpExecArray | null;
      RE.lastIndex = 0;
      while ((m = RE.exec(src))) {
        const brut = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
        if (!AR.test(brut)) continue;
        for (const morceau of brut.split(/\$\{[^}]*\}/)) {
          const t = morceau.trim().replace(BORD, "");
          if (!t || !AR.test(t) || t === "العربية") continue;
          const essais = [morceau, morceau.trim(), morceau.trim().replace(/[\s:]+$/, ""), t];
          if (essais.some((e) => !AR.test(translate(e, "fr")))) continue;
          restes.push(`${path.relative("src", f)} : ${t}`);
        }
      }
    }
    expect(restes).toEqual([]);
  });
});
