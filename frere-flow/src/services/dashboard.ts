import type { AppState, ID } from "@/types";
import { translate } from "@/lib/i18n";
import { effectiveCreditCode, packBalance, stockOf } from "./ops";

export type DashboardTeamScope = (teamId: ID) => boolean;

export function buildDashboardData(
  state: AppState,
  teamFilter: ID | "all",
  inScope: DashboardTeamScope,
  today = new Date().toISOString(),
) {
  const month = today.slice(0, 7);
  const cancelled = "ss_cancelled";
  const sales = state.sales.filter(
    (sale) => inScope(sale.teamId) && sale.saleStatusId !== cancelled,
  );
  const credits = state.credits.filter((credit) => inScope(credit.teamId));
  const openCredits = credits.filter((credit) =>
    ["ACTIVE", "PARTIAL", "OVERDUE"].includes(effectiveCreditCode(state, credit, today)),
  );
  const overdue = credits.filter(
    (credit) => effectiveCreditCode(state, credit, today) === "OVERDUE",
  );
  const cash = state.cash.filter((entry) => inScope(entry.teamId));
  const cashBal = cash.reduce(
    (total, entry) => total + (entry.type === "ENCAISSEMENT" ? entry.amount : -entry.amount),
    0,
  );
  const received = [...state.payments, ...state.creditPayments].filter((payment) =>
    inScope(payment.teamId),
  );
  const cutoff = new Date(Date.now() - 90 * 864e5).toISOString();
  const activeClients = new Set(
    sales.filter((sale) => sale.saleDate >= cutoff).map((sale) => sale.clientId),
  );
  const scopeTeamId = teamFilter === "all" ? undefined : teamFilter;
  const pack = state.packagingTypes.reduce(
    (total, type) => total + packBalance(state, { typeId: type.id, teamId: scopeTeamId }).remaining,
    0,
  );

  const monthly: Record<
    string,
    { mois: string; ventes: number; paiements: number; credits: number }
  > = {};
  for (let i = 5; i >= 0; i--) {
    const date = new Date(today);
    date.setMonth(date.getMonth() - i);
    const key = date.toISOString().slice(0, 7);
    monthly[key] = {
      mois: translate(
        [
          "جانفي",
          "فيفري",
          "مارس",
          "أفريل",
          "ماي",
          "جوان",
          "جويلية",
          "أوت",
          "سبتمبر",
          "أكتوبر",
          "نوفمبر",
          "ديسمبر",
        ][date.getMonth()]!,
      ),
      ventes: 0,
      paiements: 0,
      credits: 0,
    };
  }
  sales.forEach((sale) => {
    const item = monthly[sale.saleDate.slice(0, 7)];
    if (item) item.ventes += sale.totalAmount;
  });
  received.forEach((payment) => {
    const item = monthly[payment.paymentDate.slice(0, 7)];
    if (item) item.paiements += payment.amount;
  });
  credits.forEach((credit) => {
    const item = monthly[credit.createdAt.slice(0, 7)];
    if (item) item.credits += credit.totalAmount;
  });

  const byTeam = state.teams.map((team) => ({
    name: translate(team.name),
    value: Math.round(
      state.sales
        .filter((sale) => sale.teamId === team.id && sale.saleStatusId !== cancelled)
        .reduce((total, sale) => total + sale.totalAmount, 0),
    ),
  }));
  const stockByFrigo = state.frigos.map((frigo) => ({
    name: translate(frigo.name),
    ...Object.fromEntries(
      state.products
        .slice(0, 5)
        .map((product) => [product.name, stockOf(state, product.id, frigo.id)]),
    ),
  }));
  const packDist = state.packagingTypes
    .filter((type) => !type.clientOwned)
    .map((type) => ({
      name: type.name,
      hex: type.hex,
      value: packBalance(state, { typeId: type.id, teamId: scopeTeamId }).remaining,
    }));
  const topMap = new Map<string, number>();
  sales.forEach((sale) =>
    topMap.set(sale.clientId, (topMap.get(sale.clientId) ?? 0) + sale.totalAmount),
  );
  const top = [...topMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const low = state.products
    .flatMap((product) =>
      state.frigos.map((frigo) => ({
        p: product,
        f: frigo,
        q: stockOf(state, product.id, frigo.id),
      })),
    )
    .filter((item) => item.q < item.p.alertThreshold);
  const packAlerts = state.clients
    .map((client) => ({
      c: client,
      r: packBalance(state, { clientId: client.id, teamId: scopeTeamId }).remaining,
    }))
    .filter((item) => item.r >= state.settings.packagingAlert);

  return {
    sales,
    openCredits,
    overdue,
    cashBal,
    activeClients: activeClients.size,
    pack,
    monthSales: sales
      .filter((sale) => sale.saleDate.startsWith(month))
      .reduce((total, sale) => total + sale.totalAmount, 0),
    monthPaid: received
      .filter((payment) => payment.paymentDate.startsWith(month))
      .reduce((total, payment) => total + payment.amount, 0),
    creditTotal: openCredits.reduce((total, credit) => total + credit.remainingAmount, 0),
    monthly: Object.values(monthly),
    byTeam,
    stockByFrigo,
    packDist,
    top,
    low,
    packAlerts,
    pending: sales.filter((sale) => sale.saleStatusId === "ss_pending"),
  };
}
