import { describe, expect, it } from "vitest";
import { buildDashboardData } from "@/services/dashboard";
import { buildSeed } from "@/mock/seed";

const TODAY = "2026-11-21T12:00:00.000Z";

describe("dashboard data", () => {
  it("returns scoped KPIs and chart data", () => {
    const state = buildSeed();
    const teamId = state.teams[0]?.id;
    if (!teamId) throw new Error("Missing team fixture");

    const data = buildDashboardData(state, teamId, (id) => id === teamId, TODAY);

    expect(data.monthly).toHaveLength(6);
    expect(data.byTeam.length).toBe(state.teams.length);
    expect(data.stockByFrigo.length).toBe(state.frigos.length);
    expect(data.packDist.length).toBe(
      state.packagingTypes.filter((type) => !type.clientOwned).length,
    );
  });

  it("counts team-scoped sales and monthly sales", () => {
    const state = buildSeed();
    const teamId = state.teams[0]?.id;
    if (!teamId) throw new Error("Missing team fixture");
    state.sales = [
      {
        id: "sale_test",
        number: "V-TEST",
        clientId: state.clients[0]?.id ?? "",
        teamId,
        frigoId: state.frigos[0]?.id ?? "",
        userId: state.users[0]?.id ?? "",
        saleStatusId: "ss_confirmed",
        saleDate: "2026-11-10T10:00:00.000Z",
        totalAmount: 125,
        paidAmount: 125,
        remainingAmount: 0,
        paymentType: "ESPECES",
        notes: "",
      },
    ];

    const data = buildDashboardData(state, teamId, () => true, TODAY);

    expect(data.monthSales).toBe(125);
    expect(data.sales).toHaveLength(1);
  });
});
