// Règles métier (ventes, crédits, caisse, marchés) : chaque opération passe par la validation puis
// l'opération, exactement comme sur le serveur.
import { describe, expect, it } from "vitest";
import { buildSeed } from "@/mock/seed";
import * as ops from "@/services/ops";
import * as markets from "@/services/markets";
import { validateOp } from "@/services/validation";
import type { AppState } from "@/types";

const NOW = "2026-11-23T10:00:00.000Z";
const TODAY = "2026-11-23";
type Op = (s: AppState, ...a: unknown[]) => AppState;
const OPS = { ...ops, ...markets } as unknown as Record<string, Op>;
const exec = (s: AppState, name: string, ...args: unknown[]) =>
  OPS[name]!(s, ...validateOp(s, name, args, TODAY), "u_super", NOW);
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const code = (s: AppState, id: string) =>
  s.saleStatuses.find((x) => x.id === id)?.code ?? s.creditStatuses.find((x) => x.id === id)?.code;

const base = buildSeed();
const client = base.clients.find((c) => c.active && !c.marketId)!;
const team = base.teams[0]!;
const frigo = base.frigos[0]!;
const p = base.products.find((x) => x.active && ops.stockOf(base, x.id, frigo.id) > 50)!;
const vente = (s: AppState, paid: number, packaging: { typeId: string; quantity: number }[] = []) =>
  exec(s, "createSale", {
    clientId: client.id,
    teamId: team.id,
    frigoId: frigo.id,
    items: [{ productId: p.id, quantity: 10, unitPrice: 2 }],
    paid,
    method: "ESPECES",
    notes: "",
    packaging,
  });

describe("statut des ventes", () => {
  it("une vente non payée ne peut pas être marquée « Payée » ni « Partielle »", () => {
    const s = vente(base, 0);
    const sale = s.sales[0]!;
    expect(() => exec(s, "setSaleStatus", sale.id, "ss_paid")).toThrow();
    expect(() => exec(s, "setSaleStatus", sale.id, "ss_partial")).toThrow();
  });
  it("« Annulée » ne s'obtient que par l'annulation (stock rendu, crédit annulé)", () => {
    const s = vente(base, 0);
    expect(() => exec(s, "setSaleStatus", s.sales[0]!.id, "ss_cancelled")).toThrow();
  });
  it("suivi manuel « En attente » ↔ « Confirmée » avant paiement, puis statut calculé", () => {
    let s = vente(base, 0);
    const id = s.sales[0]!.id;
    s = exec(s, "setSaleStatus", id, "ss_confirmed");
    expect(code(s, s.sales[0]!.saleStatusId)).toBe("CONFIRMED");
    const credit = s.credits.find((c) => c.saleId === id)!;
    s = exec(s, "addCreditPayment", {
      creditId: credit.id,
      amount: 20,
      method: "ESPECES",
      notes: "",
    });
    expect(code(s, s.sales.find((x) => x.id === id)!.saleStatusId)).toBe("PAID");
    // une fois payée, plus de choix manuel
    expect(
      ops.saleStatusChoices(
        s,
        s.sales.find((x) => x.id === id)!,
      ),
    ).toHaveLength(1);
    expect(() => exec(s, "setSaleStatus", id, "ss_pending")).toThrow();
  });
});

describe("statut des crédits", () => {
  it("un crédit ne peut pas être marqué « Payé » sans paiement", () => {
    const s = vente(base, 0);
    const credit = s.credits.find((c) => c.saleId === s.sales[0]!.id)!;
    expect(() => exec(s, "setCreditStatus", credit.id, "cs_paid")).toThrow();
  });
  it("un crédit de vente ne s'annule pas seul (il suit la vente)", () => {
    const s = vente(base, 0);
    const credit = s.credits.find((c) => c.saleId === s.sales[0]!.id)!;
    expect(() => exec(s, "setCreditStatus", credit.id, "cs_cancelled")).toThrow();
    expect(ops.creditStatusChoices(s, credit)).toHaveLength(1);
  });
  it("crédit manuel : annulable puis réactivable avec le statut calculé", () => {
    let s = exec(base, "addManualCredit", {
      clientId: client.id,
      teamId: team.id,
      amount: 50,
      dueDate: "2026-12-31",
      notes: "",
    });
    const id = s.credits[0]!.id;
    s = exec(s, "addCreditPayment", { creditId: id, amount: 10, method: "ESPECES", notes: "" });
    s = exec(s, "setCreditStatus", id, "cs_cancelled");
    expect(code(s, s.credits[0]!.creditStatusId)).toBe("CANCELLED");
    expect(() => exec(s, "setCreditStatus", id, "cs_paid")).toThrow();
    s = exec(s, "setCreditStatus", id, "cs_partial");
    expect(code(s, s.credits[0]!.creditStatusId)).toBe("PARTIAL");
  });
  it("aucun paiement sur un crédit annulé ou d'une vente annulée", () => {
    let s = vente(base, 0);
    const sale = s.sales[0]!;
    s = exec(s, "cancelSale", sale.id, "test");
    const credit = s.credits.find((c) => c.saleId === sale.id)!;
    expect(() =>
      exec(s, "addCreditPayment", { creditId: credit.id, amount: 5, method: "ESPECES", notes: "" }),
    ).toThrow();
    expect(code(s, s.sales.find((x) => x.id === sale.id)!.saleStatusId)).toBe("CANCELLED");
  });
});

describe("annulation d'une vente", () => {
  it("rend le stock, annule le crédit, rembourse et reprend les caisses livrées", () => {
    const type = base.packagingTypes.find((t) => !t.clientOwned)!;
    const avant = ops.packBalance(base, { clientId: client.id, typeId: type.id }).remaining;
    const stock0 = ops.stockOf(base, p.id, frigo.id);
    let s = vente(base, 8, [{ typeId: type.id, quantity: 4 }]);
    expect(ops.packBalance(s, { clientId: client.id, typeId: type.id }).remaining).toBe(avant + 4);
    const caisse = ops.cashBalance(s, team.id);
    s = exec(s, "cancelSale", s.sales[0]!.id, "test");
    expect(ops.stockOf(s, p.id, frigo.id)).toBe(stock0);
    expect(ops.packBalance(s, { clientId: client.id, typeId: type.id }).remaining).toBe(avant);
    expect(ops.cashBalance(s, team.id)).toBe(r3(caisse - 8));
    expect(code(s, s.credits.find((c) => c.saleId === s.sales[0]!.id)!.creditStatusId)).toBe(
      "CANCELLED",
    );
  });

  it("vente du marché : la marchandise retourne au camion, pas en double dans le frigo", () => {
    const marketClient = base.clients.find((c) => c.marketId)!;
    let s = exec(base, "createMarketTrip", {
      id: "trip_regle0001",
      marketId: marketClient.marketId,
      teamId: team.id,
      loads: [{ productId: p.id, frigoId: frigo.id, quantity: 20 }],
      boxes: [],
      notes: "",
    });
    const trip = () => s.marketTrips.find((t) => t.id === "trip_regle0001")!;
    const total = () =>
      ops.stockTotal(s, p.id) +
      (trip().status === "OPEN"
        ? (markets.tripProductBalance(s, trip()).get(p.id)?.remaining ?? 0)
        : 0);
    const t0 = total();
    s = exec(s, "createMarketSale", {
      tripId: "trip_regle0001",
      clientId: marketClient.id,
      items: [{ productId: p.id, quantity: 5, unitPrice: 2 }],
      paid: 10,
      method: "ESPECES",
      notes: "",
      boxes: [],
    });
    const saleId = s.sales.find((x) => x.marketTripId === "trip_regle0001")!.id;
    s = exec(s, "cancelSale", saleId, "test");
    expect(total()).toBe(t0); // rien n'est créé ni perdu
    expect(markets.tripProductBalance(s, trip()).get(p.id)?.remaining).toBe(20);
    // fermeture : les 20 kg reviennent dans le frigo d'origine, une seule fois
    s = exec(s, "closeMarketTrip", {
      tripId: "trip_regle0001",
      returns: [{ productId: p.id, quantity: 20 }],
      boxesReturned: [],
      cashCounted: 0,
      chequesCounted: 0,
      notes: "",
    });
    expect(total()).toBe(t0);
  });

  it("vente d'un jour de marché fermé : annulation refusée", () => {
    const marketClient = base.clients.find((c) => c.marketId)!;
    let s = exec(base, "createMarketTrip", {
      id: "trip_regle0002",
      marketId: marketClient.marketId,
      teamId: team.id,
      loads: [{ productId: p.id, frigoId: frigo.id, quantity: 10 }],
      boxes: [],
      notes: "",
    });
    s = exec(s, "createMarketSale", {
      tripId: "trip_regle0002",
      clientId: marketClient.id,
      items: [{ productId: p.id, quantity: 4, unitPrice: 2 }],
      paid: 8,
      method: "ESPECES",
      notes: "",
      boxes: [],
    });
    const saleId = s.sales.find((x) => x.marketTripId === "trip_regle0002")!.id;
    s = exec(s, "closeMarketTrip", {
      tripId: "trip_regle0002",
      returns: [{ productId: p.id, quantity: 6 }],
      boxesReturned: [],
      cashCounted: 8,
      chequesCounted: 0,
      notes: "",
    });
    expect(() => exec(s, "cancelSale", saleId, "test")).toThrow();
  });
});

describe("caisse", () => {
  it("un décaissement ne peut pas dépasser le solde de la caisse du Figo", () => {
    const solde = ops.cashBalance(base, team.id);
    const sortie = (amount: number) =>
      exec(base, "addCash", {
        teamId: team.id,
        type: "DECAISSEMENT",
        method: "ESPECES",
        amount,
        reference: "",
        description: "retrait test",
      });
    expect(() => sortie(r3(solde + 1))).toThrow();
    expect(ops.cashBalance(sortie(solde), team.id)).toBe(0);
  });
});

describe("invariants sur 200 opérations aléatoires", () => {
  it("stock, ventes, crédits et caisse restent cohérents", { timeout: 120000 }, () => {
    let graine = 7;
    const alea = () => (graine = (graine * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const pick = <T>(a: T[]) => a[Math.floor(alea() * a.length)]!;
    const problemes = new Set<string>();
    let s = buildSeed();
    for (let i = 0; i < 200; i++) {
      const c = pick(s.clients.filter((x) => x.active && !x.marketId));
      const t = pick(s.teams);
      const f = pick(s.frigos);
      const pr = pick(s.products.filter((x) => x.active));
      const choix = Math.floor(alea() * 7);
      try {
        if (choix <= 1)
          s = exec(s, "createSale", {
            clientId: c.id,
            teamId: t.id,
            frigoId: f.id,
            items: [{ productId: pr.id, quantity: Math.ceil(alea() * 20), unitPrice: 2 }],
            paid: r3(alea() * 40),
            method: "ESPECES",
            notes: "",
            packaging: [],
          });
        else if (choix === 2) {
          const ouverts = s.credits.filter((x) => x.remainingAmount > 0);
          if (ouverts.length) {
            const cr = pick(ouverts);
            s = exec(s, "addCreditPayment", {
              creditId: cr.id,
              amount: r3(Math.min(cr.remainingAmount, 1 + alea() * 30)),
              method: "ESPECES",
              notes: "",
            });
          }
        } else if (choix === 3) {
          const v = s.sales.filter((x) => x.saleStatusId !== "ss_cancelled" && !x.marketTripId);
          if (v.length) s = exec(s, "cancelSale", pick(v).id, "test");
        } else if (choix === 4) {
          const v = pick(s.sales);
          s = exec(s, "setSaleStatus", v.id, pick(s.saleStatuses).id);
        } else if (choix === 5) {
          const cr = pick(s.credits);
          s = exec(s, "setCreditStatus", cr.id, pick(s.creditStatuses).id);
        } else
          s = exec(s, "addCash", {
            teamId: t.id,
            type: pick(["ENCAISSEMENT", "DECAISSEMENT"]),
            method: "ESPECES",
            amount: r3(alea() * 500),
            reference: "",
            description: "test caisse",
          });
      } catch {
        /* opération refusée par une règle : l'état ne change pas */
      }
      for (const x of s.products)
        for (const y of s.frigos)
          if (ops.stockOf(s, x.id, y.id) < -1e-9) problemes.add("stock < 0");
      for (const t2 of s.teams) if (ops.cashBalance(s, t2.id) < -1e-9) problemes.add("caisse < 0");
      for (const v of s.sales) {
        if (Math.abs(v.paidAmount + v.remainingAmount - v.totalAmount) > 1e-6)
          problemes.add("vente : payé + reste ≠ total");
        const cr = s.credits.find((x) => x.saleId === v.id);
        if (v.saleStatusId === "ss_cancelled") {
          if (cr && code(s, cr.creditStatusId) !== "CANCELLED")
            problemes.add("vente annulée avec crédit actif");
        } else {
          const attendu =
            v.remainingAmount === 0
              ? ["PAID"]
              : v.paidAmount > 0
                ? ["PARTIAL"]
                : ["PENDING", "CONFIRMED"];
          if (!attendu.includes(code(s, v.saleStatusId)!))
            problemes.add("statut de vente incohérent");
          if (cr && Math.abs(cr.remainingAmount - v.remainingAmount) > 1e-6)
            problemes.add("reste vente ≠ reste crédit");
          if (cr && code(s, cr.creditStatusId) === "CANCELLED")
            problemes.add("crédit annulé, vente active");
        }
      }
      for (const cr of s.credits) {
        const k = code(s, cr.creditStatusId);
        if (k === "PAID" && cr.remainingAmount > 0) problemes.add("crédit « payé » avec un reste");
        if (Math.abs(cr.paidAmount + cr.remainingAmount - cr.totalAmount) > 1e-6)
          problemes.add("crédit : payé + reste ≠ total");
      }
    }
    expect([...problemes]).toEqual([]);
  });
});

describe("factures", () => {
  const facture = (s: AppState, saleId: string) => s.invoices.find((f) => f.saleId === saleId)!;

  it("chaque vente crée sa facture « validée », numérotée sans doublon", () => {
    expect(base.invoices.length).toBe(base.sales.length);
    expect(new Set(base.invoices.map((f) => f.number)).size).toBe(base.invoices.length);
    const s = vente(base, 0);
    const f = facture(s, s.sales[0]!.id);
    expect(f).toMatchObject({
      status: "VALIDEE",
      amount: 20,
      clientId: client.id,
      teamId: team.id,
    });
    expect(f.number).toMatch(/^FAC-\d{4}-\d{4}$/);
  });

  it("« à voir » demande un motif, puis peut revenir à « validée »", () => {
    let s = vente(base, 0);
    const id = facture(s, s.sales[0]!.id).id;
    expect(() => exec(s, "setInvoiceStatus", id, "A_VOIR", "")).toThrow();
    s = exec(s, "setInvoiceStatus", id, "A_VOIR", "prix à corriger");
    expect(s.invoices.find((f) => f.id === id)).toMatchObject({
      status: "A_VOIR",
      notes: "prix à corriger",
    });
    s = exec(s, "setInvoiceStatus", id, "VALIDEE", "");
    expect(s.invoices.find((f) => f.id === id)).toMatchObject({ status: "VALIDEE", notes: "" });
  });

  it("annuler la facture annule la vente (stock, crédit, remboursement) et devient définitif", () => {
    const stock0 = ops.stockOf(base, p.id, frigo.id);
    let s = vente(base, 8);
    const sale = s.sales[0]!;
    const id = facture(s, sale.id).id;
    expect(() => exec(s, "setInvoiceStatus", id, "ANNULEE", "")).toThrow();
    const caisse = ops.cashBalance(s, team.id);
    s = exec(s, "setInvoiceStatus", id, "ANNULEE", "client a refusé");
    expect(s.invoices.find((f) => f.id === id)).toMatchObject({
      status: "ANNULEE",
      notes: "client a refusé",
    });
    expect(code(s, s.sales.find((x) => x.id === sale.id)!.saleStatusId)).toBe("CANCELLED");
    expect(code(s, s.credits.find((c) => c.saleId === sale.id)!.creditStatusId)).toBe("CANCELLED");
    expect(ops.stockOf(s, p.id, frigo.id)).toBe(stock0);
    expect(ops.cashBalance(s, team.id)).toBe(r3(caisse - 8));
    expect(() => exec(s, "setInvoiceStatus", id, "VALIDEE", "")).toThrow();
  });

  it("annuler la vente annule aussi sa facture", () => {
    let s = vente(base, 0);
    const sale = s.sales[0]!;
    s = exec(s, "cancelSale", sale.id, "erreur de saisie");
    expect(facture(s, sale.id).status).toBe("ANNULEE");
  });

  it("base d'une version précédente : une facture créée pour chaque vente existante", () => {
    const ancienne = structuredClone(base) as AppState;
    ancienne.invoices = [];
    ancienne.sales[0]!.saleStatusId = "ss_cancelled";
    const n = ops.creerFacturesManquantes(ancienne);
    expect(n).toBe(ancienne.sales.length);
    expect(ancienne.invoices.find((f) => f.saleId === ancienne.sales[0]!.id)!.status).toBe(
      "ANNULEE",
    );
    expect(new Set(ancienne.invoices.map((f) => f.number)).size).toBe(n);
    expect(ops.creerFacturesManquantes(ancienne)).toBe(0); // rien en double au redémarrage suivant
  });
});

describe("références automatiques", () => {
  it("caisse et mouvements de stock : référence générée, unique, saisie ignorée", () => {
    let s = base;
    const refs: string[] = [];
    for (let i = 0; i < 3; i++) {
      s = exec(s, "addCash", {
        teamId: team.id,
        type: "ENCAISSEMENT",
        method: "ESPECES",
        amount: 5,
        reference: "SAISIE-MAIN",
        description: "test référence",
      });
      refs.push(s.cash[0]!.reference);
    }
    expect(refs.every((r) => /^CAI-\d{4}-\d{4}$/.test(r))).toBe(true);
    expect(new Set(refs).size).toBe(3);
    s = exec(s, "addStockMovement", {
      productId: p.id,
      frigoId: frigo.id,
      quantity: 5,
      movementType: "ENTREE",
      reference: "BR-MAIN",
      notes: "",
    });
    expect(s.stockMovements[0]!.reference).toMatch(/^MVT-\d{4}-\d{4}$/);
  });
  it("numéros de vente : suivants et uniques", () => {
    const s = vente(vente(base, 0), 0);
    const nums = s.sales.map((x) => x.number);
    expect(new Set(nums).size).toBe(nums.length);
  });
});

describe("ajout de produit : type, unité, nom unique, stock à 0 réaffecté", () => {
  const nouveau = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    category: "fruits",
    unit: "pièce",
    salePrice: 2,
    alertThreshold: 10,
    active: true,
    ...extra,
  });
  it("type limité à légume / fruits, unité kg / pièce / tonne / caisse (alias acceptés)", () => {
    const s = exec(base, "saveProduct", nouveau("ليمون"), null);
    expect(s.products[0]).toMatchObject({ category: "فواكه", unit: "قطعة" });
    expect(() =>
      exec(base, "saveProduct", nouveau("ليمون", { category: "épices" }), null),
    ).toThrow();
    expect(() => exec(base, "saveProduct", nouveau("ليمون", { unit: "litre" }), null)).toThrow();
  });
  it("nom en double refusé (casse, espaces et langue ignorées) tant que le produit a du stock", () => {
    const avecStock = base.products.find((x) => ops.stockTotal(base, x.id) > 0)!;
    for (const nom of [avecStock.name, ` ${avecStock.name}  `, avecStock.name.toUpperCase()])
      expect(() =>
        exec(base, "saveProduct", nouveau(nom), { frigoId: frigo.id, quantity: 5 }),
      ).toThrow();
  });
  it("produit existant à stock 0 : le nouveau stock lui est affecté (pas de doublon)", () => {
    let s = exec(base, "saveProduct", nouveau("كيوي"), null);
    const kiwi = s.products[0]!;
    const n = s.products.length;
    s = exec(s, "saveProduct", nouveau("  كيوي "), { frigoId: frigo.id, quantity: 30 });
    expect(s.products.length).toBe(n);
    expect(ops.stockOf(s, kiwi.id, frigo.id)).toBe(30);
    expect(s.products.find((x) => x.id === kiwi.id)!.reference).toBe(kiwi.reference);
  });
  it("produit du catalogue : reconnu en arabe comme en français", () => {
    const s = exec(base, "saveProduct", nouveau("Pastèque", { category: "" }), null);
    expect(s.products[0]!.category).toBe("فواكه");
  });
});

describe("vente depuis les deux frigos : une facture par frigo", () => {
  it("lignes de Frigo Fawzi et Frigo Houssem → 2 ventes, 2 factures, paiement au prorata", () => {
    const [fa, fh] = base.frigos;
    const pa = base.products.find((x) => x.active && ops.stockOf(base, x.id, fa!.id) > 20)!;
    const ph = base.products.find((x) => x.active && ops.stockOf(base, x.id, fh!.id) > 20)!;
    const s = exec(base, "createSale", {
      clientId: client.id,
      teamId: team.id,
      frigoId: fa!.id,
      items: [
        { productId: pa.id, quantity: 10, unitPrice: 3, frigoId: fa!.id }, // 30
        { productId: ph.id, quantity: 10, unitPrice: 1, frigoId: fh!.id }, // 10
      ],
      paid: 20,
      method: "ESPECES",
      notes: "",
      packaging: [],
    });
    const nouvelles = s.sales.slice(0, 2);
    expect(new Set(nouvelles.map((v) => v.frigoId))).toEqual(new Set([fa!.id, fh!.id]));
    const va = nouvelles.find((v) => v.frigoId === fa!.id)!;
    const vh = nouvelles.find((v) => v.frigoId === fh!.id)!;
    expect([va.totalAmount, va.paidAmount]).toEqual([30, 15]);
    expect([vh.totalAmount, vh.paidAmount]).toEqual([10, 5]);
    const factures = s.invoices.filter((f) => f.saleId === va.id || f.saleId === vh.id);
    expect(factures).toHaveLength(2);
    expect(ops.stockOf(s, pa.id, fa!.id)).toBe(ops.stockOf(base, pa.id, fa!.id) - 10);
    expect(ops.stockOf(s, ph.id, fh!.id)).toBe(ops.stockOf(base, ph.id, fh!.id) - 10);
  });
});

describe("modification complète d'une facture", () => {
  it("quantité augmentée : stock sorti, total, crédit et facture recalculés", () => {
    let s = vente(base, 0); // 10 × 2 = 20, non payé
    const sale = s.sales[0]!;
    const stock0 = ops.stockOf(s, p.id, frigo.id);
    s = exec(s, "editSale", sale.id, { items: [{ productId: p.id, quantity: 15, unitPrice: 2 }] });
    const v = s.sales.find((x) => x.id === sale.id)!;
    expect([v.totalAmount, v.remainingAmount]).toEqual([30, 30]);
    expect(ops.stockOf(s, p.id, frigo.id)).toBe(stock0 - 5);
    expect(s.credits.find((c) => c.saleId === sale.id)!.remainingAmount).toBe(30);
    expect(s.invoices.find((f) => f.saleId === sale.id)).toMatchObject({
      amount: 30,
      status: "VALIDEE",
    });
  });
  it("nouveau total inférieur au déjà payé : différence remboursée, vente « payée »", () => {
    let s = vente(base, 20); // payée 20
    const sale = s.sales[0]!;
    const caisse = ops.cashBalance(s, team.id);
    const stock0 = ops.stockOf(s, p.id, frigo.id);
    s = exec(s, "editSale", sale.id, { items: [{ productId: p.id, quantity: 5, unitPrice: 2 }] });
    const v = s.sales.find((x) => x.id === sale.id)!;
    expect([v.totalAmount, v.paidAmount, v.remainingAmount]).toEqual([10, 10, 0]);
    expect(code(s, v.saleStatusId)).toBe("PAID");
    expect(ops.cashBalance(s, team.id)).toBe(r3(caisse - 10));
    expect(ops.stockOf(s, p.id, frigo.id)).toBe(stock0 + 5);
  });
  it("refusée : vente annulée, stock insuffisant, aucune ligne", () => {
    const s = vente(base, 0);
    const id = s.sales[0]!.id;
    expect(() =>
      exec(s, "editSale", id, { items: [{ productId: p.id, quantity: 10_000_000, unitPrice: 2 }] }),
    ).toThrow();
    expect(() => exec(s, "editSale", id, { items: [] })).toThrow();
    const annulee = exec(s, "cancelSale", id, "test");
    expect(() =>
      exec(annulee, "editSale", id, { items: [{ productId: p.id, quantity: 1, unitPrice: 2 }] }),
    ).toThrow();
  });
});

describe("alertes du tableau de bord (données réelles)", () => {
  it("rupture de stock, crédit élevé après une vente récente, caisses élevées", async () => {
    const { buildDashboardData } = await import("@/services/dashboard");
    let s = vente(base, 0); // vente récente à crédit (20 DT)
    s = { ...s, settings: { ...s.settings, creditAlert: 1, packagingAlert: 1 } };
    // produit vidé : sortie de tout son stock
    const vide = s.products.find((x) => x.active && ops.stockTotal(s, x.id) > 0)!;
    for (const f of s.frigos) {
      const q = ops.stockOf(s, vide.id, f.id);
      if (q > 0)
        s = exec(s, "addStockMovement", {
          productId: vide.id,
          frigoId: f.id,
          quantity: q,
          movementType: "SORTIE",
          notes: "",
        });
    }
    const d = buildDashboardData(s, "all", () => true, NOW);
    expect(d.ruptures.some((r) => r.p.id === vide.id)).toBe(true);
    expect(d.creditAlerts.some((c) => c.clientId === client.id)).toBe(true);
    expect(d.packAlerts.length).toBeGreaterThan(0);
  });
});
