import { describe, expect, it } from "vitest";
import { buildSeed } from "@/mock/seed";
import { createSale, addCreditPayment } from "@/services/ops";
import {
  cancelDeadline,
  createDeadline,
  deadlineSource,
  deadlineStatus,
  markReminder,
  payDeadline,
  remindersToday,
  updateDeadline,
} from "@/services/deadlines";

const D = "2026-11-05T10:00:00.000Z";
const input = {
  clientId: "cli_1",
  teamId: "team_1",
  frigoId: "frg_1",
  amount: 100,
  dueDate: "2026-11-05",
  reminderDays: 3,
  notes: "",
};
function setup() {
  const s = createDeadline(buildSeed(), input, "u_super", D);
  const c = s.credits[0];
  if (!c) throw new Error("Missing credit");
  return { s, c };
}
describe("payment calendar", () => {
  it("manual deadline is a single 100 TND credit without cash creation", () => {
    const before = buildSeed();
    const { s, c } = setup();
    expect(s.credits.length).toBe(before.credits.length + 1);
    expect(c.remainingAmount).toBe(100);
    expect(s.cash.length).toBe(before.cash.length);
    expect(deadlineSource(s, c).frigoIds).toEqual(["frg_1"]);
  });
  it("red is overdue, orange covers today through three days, green is settled", () => {
    const { s, c } = setup();
    expect(deadlineStatus(s, { ...c, dueDate: "2026-11-04" }, "2026-11-05")).toBe("OVERDUE");
    expect(deadlineStatus(s, c, "2026-11-05")).toBe("SOON");
    expect(deadlineStatus(s, { ...c, dueDate: "2026-11-08" }, "2026-11-05")).toBe("SOON");
    expect(deadlineStatus(s, { ...c, dueDate: "2026-11-09" }, "2026-11-05")).toBe("UPCOMING");
    expect(deadlineStatus(s, { ...c, remainingAmount: 0 }, "2026-11-05")).toBe("PAID");
  });
  it("daily reminders obey lead time and one contact per day and commitment", () => {
    const fixture = setup();
    let s = fixture.s;
    const c = fixture.c;
    const future = { ...c, dueDate: "2026-11-08" };
    expect(remindersToday(s, [future], "2026-11-04")).toHaveLength(0);
    expect(remindersToday(s, [future], "2026-11-05")).toHaveLength(1);
    s = markReminder(s, c.id, "u", D);
    expect(remindersToday(s, [s.credits[0]], "2026-11-05")).toHaveLength(0);
    expect(remindersToday(s, [s.credits[0]], "2026-11-06")).toHaveLength(1);
  });
  it("a 25 TND deposit and 75 TND settlement create exactly 100 TND receipts", () => {
    const fixture = setup();
    let s = fixture.s;
    const c = fixture.c;
    const before = s.cash.length;
    s = payDeadline(s, { creditId: c.id, amount: 25, method: "ESPECES", notes: "" }, "u", D);
    expect(s.credits[0].remainingAmount).toBe(75);
    expect(s.cash[0].amount).toBe(25);
    s = payDeadline(s, { creditId: c.id, amount: 75, method: "CHEQUE", notes: "" }, "u", D);
    expect(s.cash.length).toBe(before + 2);
    expect(s.credits[0].remainingAmount).toBe(0);
    expect(deadlineStatus(s, s.credits[0], "2026-11-05")).toBe("PAID");
    expect(() =>
      payDeadline(s, { creditId: c.id, amount: 1, method: "ESPECES", notes: "" }, "u", D),
    ).toThrow();
  });
  it("sale debt settlement updates the original sale and cash without duplicate debt", () => {
    let s = createSale(
      buildSeed(),
      {
        clientId: "cli_1",
        teamId: "team_1",
        frigoId: "frg_1",
        items: [{ productId: "prd_1", quantity: 10, unitPrice: 2 }],
        paid: 5,
        method: "ESPECES",
        notes: "",
        packaging: [],
        dueDate: "2026-11-05",
      },
      "u",
      D,
    );
    const c = s.credits[0];
    if (!c) throw new Error("Missing credit");
    const count = s.credits.length;
    s = payDeadline(s, { creditId: c.id, amount: 15, method: "ESPECES", notes: "" }, "u", D);
    expect(s.sales[0].paidAmount).toBe(20);
    expect(s.sales[0].remainingAmount).toBe(0);
    expect(s.credits.length).toBe(count);
    expect(() =>
      updateDeadline(
        s,
        { creditId: c.id, dueDate: c.dueDate, amount: 16, reminderDays: 3, notes: "", reason: "" },
        "u",
        D,
      ),
    ).toThrow();
  });
  it("rescheduling requires a reason and updates the credit date", () => {
    const { s, c } = setup();
    const inp = {
      creditId: c.id,
      dueDate: "2026-11-10",
      amount: 100,
      reminderDays: 0,
      notes: "",
      reason: "",
    };
    expect(() => updateDeadline(s, inp, "u", D)).toThrow();
    const next = updateDeadline(s, { ...inp, reason: "Client commitment" }, "u", D);
    expect(next.credits[0].dueDate).toBe("2026-11-10");
    expect(remindersToday(next, [next.credits[0]], "2026-11-09")).toHaveLength(0);
  });
  it("manual adjustment cannot drop below payments and does not manufacture cash", () => {
    const fixture = setup();
    let s = fixture.s;
    const c = fixture.c;
    s = addCreditPayment(s, { creditId: c.id, amount: 30, method: "ESPECES", notes: "" }, "u", D);
    const inp = {
      creditId: c.id,
      dueDate: c.dueDate,
      amount: 29,
      reminderDays: 3,
      notes: "",
      reason: "",
    };
    expect(() => updateDeadline(s, inp, "u", D)).toThrow();
    const next = updateDeadline(s, { ...inp, amount: 120 }, "u", D);
    expect(next.credits[0].remainingAmount).toBe(90);
    expect(next.cash).toEqual(s.cash);
  });
  it("cancellation suppresses reminders but preserves debt and financial history", () => {
    const { s, c } = setup();
    expect(() => cancelDeadline(s, c.id, "", "u", D)).toThrow();
    const next = cancelDeadline(s, c.id, "Duplicate reminder", "u", D);
    expect(next.credits[0].remainingAmount).toBe(100);
    expect(next.cash).toEqual(s.cash);
    expect(remindersToday(next, [next.credits[0]], "2026-11-05")).toHaveLength(0);
    expect(() =>
      payDeadline(next, { creditId: c.id, amount: 10, method: "ESPECES", notes: "" }, "u", D),
    ).toThrow();
  });
  it("market sources respect exclusive clients and resolve all trip fridges", () => {
    const { s, c } = setup();
    expect(() =>
      createDeadline(s, { ...input, frigoId: undefined, marketId: "mkt_sousse" }, "u", D),
    ).toThrow();
    s.clients[0].marketId = "mkt_sousse";
    const n = createDeadline(s, { ...input, frigoId: undefined, marketId: "mkt_sousse" }, "u", D);
    expect(deadlineSource(n, n.credits[0]).marketId).toBe("mkt_sousse");
    s.marketTrips.push({
      id: "trip",
      number: "t",
      marketId: "mkt_sousse",
      teamId: "team_1",
      date: D,
      userId: "u",
      status: "OPEN",
      boxes: [],
      notes: "",
      loads: [
        { productId: "prd_1", frigoId: "frg_1", quantity: 10 },
        { productId: "prd_1", frigoId: "frg_2", quantity: 10 },
      ],
    });
    s.sales[0].marketTripId = "trip";
    expect(deadlineSource(s, { ...c, saleId: s.sales[0].id }).frigoIds).toEqual(["frg_1", "frg_2"]);
  });
  it("invalid dates and overpayments are rejected", () => {
    const { s, c } = setup();
    expect(() => createDeadline(s, { ...input, dueDate: "2026-02-30" }, "u", D)).toThrow();
    expect(() => createDeadline(s, { ...input, reminderDays: -1 }, "u", D)).toThrow();
    expect(() =>
      payDeadline(s, { creditId: c.id, amount: 101, method: "ESPECES", notes: "" }, "u", D),
    ).toThrow();
  });
});
