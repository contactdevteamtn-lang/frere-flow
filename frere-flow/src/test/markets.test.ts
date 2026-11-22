import { describe, expect, it } from "vitest";
import { buildSeed } from "@/mock/seed";
import { addCreditPayment, stockOf } from "@/services/ops";
import {
  closeMarketTrip,
  createMarketSale,
  createMarketTrip,
  tripProductBalance,
  tripTotals,
  marketAnalytics,
  saveMarketClient,
  saveMarket,
} from "@/services/markets";

const D = "2026-11-01T08:00:00.000Z";
function setup() {
  let s = buildSeed();
  const client = s.clients[0];
  if (!client) throw new Error("Missing client fixture");
  client.marketId = "mkt_sousse";
  const p = s.products.find((x) => stockOf(s, x.id, "frg_1") >= 100)!;
  const before = stockOf(s, p.id, "frg_1");
  s = createMarketTrip(
    s,
    {
      id: "trip_t",
      marketId: "mkt_sousse",
      teamId: s.teams[0]!.id,
      loads: [{ productId: p.id, frigoId: "frg_1", quantity: 100 }],
      boxes: [{ typeId: s.packagingTypes[0]!.id, quantity: 10 }],
      notes: "",
    },
    "u",
    D,
  );
  return { s, p, before };
}

describe("market trips", () => {
  it("market clients belong to one exact market", () => {
    const { s, p } = setup();
    const client = s.clients[0];
    if (!client) throw new Error("Missing client");
    client.marketId = "mkt_mahdia";
    expect(() =>
      createMarketSale(
        s,
        {
          tripId: "trip_t",
          clientId: client.id,
          items: [{ productId: p.id, quantity: 10, unitPrice: 2 }],
          boxes: [],
          paid: 0,
          method: "ESPECES",
          notes: "",
        },
        "u",
        D,
      ),
    ).toThrow("العميل غير تابع لهذا السوق");
    client.marketId = undefined;
    expect(() =>
      createMarketSale(
        s,
        {
          tripId: "trip_t",
          clientId: client.id,
          items: [{ productId: p.id, quantity: 10, unitPrice: 2 }],
          boxes: [],
          paid: 0,
          method: "ESPECES",
          notes: "",
        },
        "u",
        D,
      ),
    ).toThrow("العميل غير تابع لهذا السوق");
  });
  it("creates market places and exclusively attached customers", () => {
    let { s } = setup();
    s = saveMarket(s, { name: "New market", city: "New city" }, "u", D);
    const m = s.markets.at(-1);
    if (!m) throw new Error("Missing market");
    s = saveMarketClient(
      s,
      { marketId: m.id, name: "New client", phone: "123", address: "Stand 4" },
      "u",
      D,
    );
    const c = s.clients.at(-1);
    expect(c?.marketId).toBe(m.id);
    expect(c?.address).toBe("Stand 4");
    expect(() =>
      saveMarketClient(
        s,
        { id: c?.id, marketId: "mkt_sousse", name: "Changed", phone: "", address: "" },
        "u",
        D,
      ),
    ).toThrow();
  });
  it("analytics exclude ordinary sales and obey market and date filters", () => {
    const { s, p } = setup();
    const n = createMarketSale(
      s,
      {
        tripId: "trip_t",
        clientId: s.clients[0]?.id ?? "",
        items: [{ productId: p.id, quantity: 40, unitPrice: 2 }],
        boxes: [],
        paid: 50,
        method: "ESPECES",
        notes: "",
      },
      "u",
      D,
    );
    const d = marketAnalytics(n, { marketId: "mkt_sousse", from: "2026-11-01", to: "2026-11-01" });
    expect(d.total).toBe(80);
    expect(d.paid).toBe(50);
    expect(d.credit).toBe(30);
    expect(d.volume).toBe(40);
    expect(d.products[0]?.quantity).toBe(40);
    expect(d.debts[0]?.amount).toBe(30);
    expect(marketAnalytics(n, { marketId: "mkt_mahdia" }).total).toBe(0);
    expect(marketAnalytics(n, { from: "2026-11-02" }).volume).toBe(0);
  });
  it("cash reconciles actual payment methods and remains frozen after closing", () => {
    const { s, p } = setup();
    let n = createMarketSale(
      s,
      {
        tripId: "trip_t",
        clientId: s.clients[0]?.id ?? "",
        items: [{ productId: p.id, quantity: 40, unitPrice: 2 }],
        boxes: [],
        paid: 50,
        method: "ESPECES",
        notes: "",
      },
      "u",
      D,
    );
    const credit = n.credits[0];
    if (!credit) throw new Error("Missing credit");
    n = addCreditPayment(
      n,
      { creditId: credit.id, amount: 10, method: "CHEQUE", notes: "" },
      "u",
      "2026-11-01T09:00:00.000Z",
    );
    expect(tripTotals(n, n.marketTrips[0]).cash).toBe(50);
    expect(tripTotals(n, n.marketTrips[0]).cheques).toBe(10);
    n = closeMarketTrip(
      n,
      {
        tripId: "trip_t",
        returns: [{ productId: p.id, quantity: 60 }],
        boxesReturned: [],
        cashCounted: 50,
        chequesCounted: 10,
        notes: "",
      },
      "u",
      "2026-11-01T10:00:00.000Z",
    );
    n = addCreditPayment(
      n,
      { creditId: credit.id, amount: 20, method: "ESPECES", notes: "" },
      "u",
      "2026-11-02T09:00:00.000Z",
    );
    expect(tripTotals(n, n.marketTrips[0]).paid).toBe(60);
    expect(n.marketTrips[0].closing?.cashGap).toBe(0);
    expect(marketAnalytics(n).credit).toBe(0);
    expect(marketAnalytics(n).paid).toBe(80);
  });
  it("departure removes goods from the source fridge", () => {
    const { s, p, before } = setup();
    expect(stockOf(s, p.id, "frg_1")).toBe(before - 100);
  });
  it("returns unsold goods to both source fridges without shifting stock", () => {
    const fixture = setup();
    let s = fixture.s;
    const p = fixture.p;
    s.stockMovements.push({
      id: "source_test",
      productId: p.id,
      frigoId: "frg_2",
      quantity: 100,
      movementType: "ENTREE",
      date: D,
      userId: "u",
      reference: "test",
      notes: "",
    });
    const first = stockOf(s, p.id, "frg_1");
    const second = stockOf(s, p.id, "frg_2");
    s = createMarketTrip(
      s,
      {
        id: "two_sources",
        marketId: "mkt_sousse",
        teamId: s.teams[0]?.id ?? "",
        loads: [
          { productId: p.id, frigoId: "frg_1", quantity: 40 },
          { productId: p.id, frigoId: "frg_2", quantity: 60 },
        ],
        boxes: [],
        notes: "",
      },
      "u",
      D,
    );
    s = createMarketSale(
      s,
      {
        tripId: "two_sources",
        clientId: s.clients[0]?.id ?? "",
        items: [{ productId: p.id, quantity: 30, unitPrice: 2 }],
        boxes: [],
        paid: 60,
        method: "ESPECES",
        notes: "",
      },
      "u",
      D,
    );
    s = closeMarketTrip(
      s,
      {
        tripId: "two_sources",
        returns: [{ productId: p.id, quantity: 70 }],
        boxesReturned: [],
        cashCounted: 60,
        chequesCounted: 0,
        notes: "",
      },
      "u",
      D,
    );
    expect(stockOf(s, p.id, "frg_1")).toBe(first - 30);
    expect(stockOf(s, p.id, "frg_2")).toBe(second);
  });
  it("cannot sell more than what is on the truck", () => {
    const { s, p } = setup();
    expect(() =>
      createMarketSale(
        s,
        {
          tripId: "trip_t",
          clientId: s.clients[0]!.id,
          items: [{ productId: p.id, quantity: 101, unitPrice: 1 }],
          boxes: [],
          paid: 0,
          method: "ESPECES",
          notes: "",
        },
        "u",
        D,
      ),
    ).toThrow();
  });
  it("unpaid part of a market sale becomes a credit", () => {
    const { s, p } = setup();
    const n = createMarketSale(
      s,
      {
        tripId: "trip_t",
        clientId: s.clients[0]!.id,
        items: [{ productId: p.id, quantity: 40, unitPrice: 2 }],
        boxes: [],
        paid: 50,
        method: "ESPECES",
        notes: "",
      },
      "u",
      D,
    );
    expect(n.sales[0]!.remainingAmount).toBe(30);
    expect(n.credits[0]!.remainingAmount).toBe(30);
    expect(tripProductBalance(n, n.marketTrips[0]!).get(p.id)!.remaining).toBe(60);
  });
  it("closing returns unsold goods to the fridge and records gaps", () => {
    const { s, p, before } = setup();
    let n = createMarketSale(
      s,
      {
        tripId: "trip_t",
        clientId: s.clients[0]!.id,
        items: [{ productId: p.id, quantity: 40, unitPrice: 2 }],
        boxes: [],
        paid: 80,
        method: "ESPECES",
        notes: "",
      },
      "u",
      D,
    );
    n = closeMarketTrip(
      n,
      {
        tripId: "trip_t",
        returns: [{ productId: p.id, quantity: 55 }],
        boxesReturned: [{ typeId: n.packagingTypes[0]!.id, quantity: 9 }],
        cashCounted: 75,
        chequesCounted: 0,
        notes: "",
      },
      "u",
      D,
    );
    const c = n.marketTrips[0]!.closing!;
    expect(n.marketTrips[0]!.status).toBe("CLOSED");
    expect(stockOf(n, p.id, "frg_1")).toBe(before - 100 + 55);
    expect(c.goodsGap).toBe(-5);
    expect(c.boxesGap).toBe(-1);
    expect(c.cashGap).toBe(-5);
    expect(() =>
      createMarketSale(
        n,
        {
          tripId: "trip_t",
          clientId: n.clients[0]!.id,
          items: [{ productId: p.id, quantity: 1, unitPrice: 1 }],
          boxes: [],
          paid: 0,
          method: "ESPECES",
          notes: "",
        },
        "u",
        D,
      ),
    ).toThrow();
  });
});
