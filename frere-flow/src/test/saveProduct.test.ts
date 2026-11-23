// Produit + stock dans un frigo choisi directement dans le formulaire produit (un seul enregistrement).
import { describe, expect, it } from "vitest";
import { buildSeed } from "@/mock/seed";
import { saveProduct, stockOf } from "@/services/ops";
import { validateOp } from "@/services/validation";

const NOW = "2026-11-23T10:00:00.000Z";
const TODAY = "2026-11-23";
const nouveau = {
  reference: "",
  name: "فلفل",
  category: "خضروات",
  unit: "kg",
  salePrice: 2.5,
  alertThreshold: 100,
  active: true,
};

/** Comme le site et le serveur : validation (nettoyage) puis opération */
function executer(state: ReturnType<typeof buildSeed>, item: unknown, stock: unknown) {
  const [p, st] = validateOp(state, "saveProduct", [item, stock], TODAY);
  return saveProduct(state, p as never, st as never, "u_super", NOW);
}

describe("saveProduct", () => {
  it("nouveau produit + quantité → produit créé et stock entré dans le frigo choisi", () => {
    const s = buildSeed();
    const frigo = s.frigos.find((f) => f.active)!;
    const r = executer(s, nouveau, { frigoId: frigo.id, quantity: 350 });
    const p = r.products.find((x) => x.name === "فلفل")!;
    expect(p).toBeDefined();
    expect(p.reference).toMatch(/^PDT-\d{3}$/);
    expect(stockOf(r, p.id, frigo.id)).toBe(350);
    const mv = r.stockMovements[0]!;
    expect(mv).toMatchObject({ productId: p.id, frigoId: frigo.id, movementType: "ENTREE" });
    // les autres frigos ne sont pas touchés
    for (const f of r.frigos.filter((x) => x.id !== frigo.id))
      expect(stockOf(r, p.id, f.id)).toBe(0);
  });

  it("sans quantité → produit seul, aucun mouvement de stock", () => {
    const s = buildSeed();
    const avant = s.stockMovements.length;
    for (const stock of [
      null,
      { frigoId: s.frigos[0]!.id, quantity: 0 },
      { frigoId: "", quantity: "" },
    ]) {
      const r = executer(s, nouveau, stock);
      expect(r.products.some((x) => x.name === "فلفل")).toBe(true);
      expect(r.stockMovements.length).toBe(avant);
    }
  });

  it("produit existant + quantité → stock ajouté au frigo choisi", () => {
    const s = buildSeed();
    const p = s.products[0]!;
    const f = s.frigos.find((x) => x.active)!;
    const avant = stockOf(s, p.id, f.id);
    const r = executer(s, { ...p }, { frigoId: f.id, quantity: 40 });
    expect(stockOf(r, p.id, f.id)).toBe(avant + 40);
    expect(r.products.length).toBe(s.products.length); // modifié, pas dupliqué
  });

  it("référence toujours automatique : la suivante libre, une saisie est ignorée", () => {
    const s = buildSeed();
    const max = Math.max(
      ...s.products.map((p) => Number(/^PDT-(\d+)$/.exec(p.reference)?.[1] ?? 0)),
    );
    const attendu = `PDT-${String(max + 1).padStart(3, "0")}`;
    const r1 = executer(s, { ...nouveau, reference: "" }, null);
    expect(r1.products.find((x) => x.name === "فلفل")!.reference).toBe(attendu);
    // une référence envoyée (même en double ou fantaisiste) est ignorée
    const doublon = s.products[0]!.reference;
    for (const reference of [doublon, "MA-REF", "<script>"]) {
      const r = executer(s, { ...nouveau, reference }, null);
      expect(r.products.find((x) => x.name === "فلفل")!.reference).toBe(attendu);
    }
    // deux créations successives : jamais la même référence
    const [p2] = validateOp(r1, "saveProduct", [{ ...nouveau, name: "ثوم" }, null], TODAY);
    const r2 = saveProduct(r1, p2 as never, null, "u_super", NOW);
    expect(r2.products.find((x) => x.name === "ثوم")!.reference).toBe(
      `PDT-${String(max + 2).padStart(3, "0")}`,
    );
  });

  it("modification : la référence existante est conservée", () => {
    const s = buildSeed();
    const p = s.products[0]!;
    const r = executer(s, { ...p, reference: "AUTRE-REF", salePrice: 9 }, null);
    const apres = r.products.find((x) => x.id === p.id)!;
    expect(apres.reference).toBe(p.reference);
    expect(apres.salePrice).toBe(9);
  });

  it("refuse un frigo inconnu, inactif ou une quantité invalide", () => {
    const s = buildSeed();
    s.frigos[0]!.active = false;
    const inactif = s.frigos[0]!.id;
    const actif = s.frigos.find((x) => x.active)!.id;
    expect(() => executer(s, nouveau, { frigoId: "inconnu", quantity: 10 })).toThrow();
    expect(() => executer(s, nouveau, { frigoId: inactif, quantity: 10 })).toThrow();
    expect(() => executer(s, nouveau, { frigoId: actif, quantity: -5 })).toThrow();
    expect(() => executer(s, nouveau, { frigoId: actif, quantity: "abc" })).toThrow();
  });
});
