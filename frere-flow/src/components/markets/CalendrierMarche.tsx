// Calendrier des crédits des clients de marché (échéances par date), pour tous les marchés ou un seul.
import { useState } from "react";
import { translate, useLanguage } from "@/lib/i18n";
import { useApp, useTeamScope } from "@/store/store";
import { DeadlineCalendar } from "@/components/deadlines/DeadlineCalendar";
import { NativeSelect } from "@/components/app/forms";
import { Panel } from "@/components/app/ui";
import { deadlineStatus } from "@/services/deadlines";
import { isMarketCredit } from "@/services/ops";
import type { AppState, Credit, ID } from "@/types";

/** Marché d'un crédit : celui de l'échéance, du client, ou de la journée de marché de la vente */
export function marcheDuCredit(s: AppState, c: Credit): ID | undefined {
  if (c.marketId) return c.marketId;
  const client = s.clients.find((x) => x.id === c.clientId);
  if (client?.marketId) return client.marketId;
  const vente = c.saleId ? s.sales.find((v) => v.id === c.saleId) : undefined;
  return vente?.marketTripId
    ? s.marketTrips.find((t) => t.id === vente.marketTripId)?.marketId
    : undefined;
}

export function CalendrierMarche({ marketId }: { marketId?: ID }) {
  useLanguage();
  const { state, readOnly } = useApp();
  const inScope = useTeamScope();
  const [anchor, setAnchor] = useState(() => new Date());
  const [semaine, setSemaine] = useState(false);
  const [marche, setMarche] = useState<string>(marketId ?? "all");
  const rows = state.credits
    .filter((c) => inScope(c.teamId) && isMarketCredit(state, c))
    .filter((c) => marche === "all" || marcheDuCredit(state, c) === marche)
    // consultation seule : échéances déjà traitées (payées, annulées, relance cochée) non affichées
    .filter(
      (c) =>
        !readOnly ||
        !(
          ["PAID", "CANCELLED"].includes(deadlineStatus(state, c, new Date().toISOString())) ||
          c.reminderHistory?.some((r) => r.dueDate === c.dueDate)
        ),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const reste = rows.reduce((a, c) => a + c.remainingAmount, 0);
  return (
    <Panel
      title={translate("تقويم ديون السوق")}
      action={
        <div className="flex flex-wrap gap-2">
          {!marketId && (
            <NativeSelect
              className="sm:w-44"
              aria-label={translate("السوق")}
              value={marche}
              onChange={(e) => setMarche(e.target.value)}
            >
              <option value="all">{translate("كل الأسواق")}</option>
              {state.markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {translate(m.name)}
                </option>
              ))}
            </NativeSelect>
          )}
          <NativeSelect
            className="sm:w-32"
            aria-label={translate("العرض")}
            value={semaine ? "week" : "month"}
            onChange={(e) => setSemaine(e.target.value === "week")}
          >
            <option value="month">{translate("شهر")}</option>
            <option value="week">{translate("أسبوع")}</option>
          </NativeSelect>
        </div>
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">
        {translate("مواعيد ديون عملاء الأسواق حسب التاريخ: للتخطيط للمرور والتذكير.")} ·{" "}
        {rows.length} {translate("دين")} ·{" "}
        {reste.toLocaleString(undefined, { maximumFractionDigits: 3 })} TND
      </p>
      <DeadlineCalendar
        rows={rows}
        anchor={anchor}
        onAnchor={setAnchor}
        week={semaine}
        onSelect={() => {}}
      />
    </Panel>
  );
}
