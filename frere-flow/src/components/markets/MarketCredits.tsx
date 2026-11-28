import { Text, translate, useLanguage } from "@/lib/i18n";
import { useState } from "react";
import { Wallet, CreditCard, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp, useLookups, useTeamScope } from "@/store/store";
import { effectiveCreditCode, isMarketCredit } from "@/services/ops";
import type { Credit } from "@/types";
import { DataTable } from "@/components/app/DataTable";
import { Edit, NativeSelect } from "@/components/app/forms";
import { Kpi, Panel, Status } from "@/components/app/ui";
import { dateFr, dt } from "@/lib/format";
import { PayCreditDialog } from "@/routes/_erp/credits";

/** Dettes des clients des marchés : séparées des dettes des clients normaux (page Dettes). */
export function MarketCredits() {
  useLanguage();
  const { state } = useApp();
  const L = useLookups();
  const inScope = useTeamScope();
  const [market, setMarket] = useState("all");
  const [st, setSt] = useState("open");
  const [pay, setPay] = useState<Credit | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const marketOf = (c: Credit) => {
    const tripId = c.saleId ? L.sale.get(c.saleId)?.marketTripId : undefined;
    return (
      c.marketId ??
      L.client.get(c.clientId)?.marketId ??
      state.marketTrips.find((t) => t.id === tripId)?.marketId ??
      ""
    );
  };
  const all = state.credits
    .filter((c) => inScope(c.teamId) && isMarketCredit(state, c))
    .map((c) => ({ ...c, code: effectiveCreditCode(state, c, today), market: marketOf(c) }))
    .filter((c) => market === "all" || c.market === market);
  const open = all.filter((c) => ["ACTIVE", "PARTIAL", "OVERDUE"].includes(c.code));
  const rows = st === "open" ? open : st === "all" ? all : all.filter((c) => c.code === st);

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={translate("ديون الأسواق المفتوحة")} value={open.length} icon={CreditCard} />
        <Kpi
          label={translate("المتبقي للتحصيل")}
          value={dt(open.reduce((a, c) => a + c.remainingAmount, 0))}
          icon={Wallet}
          tone="warning"
        />
        <Kpi
          label={translate("متأخر")}
          value={all.filter((c) => c.code === "OVERDUE").length}
          icon={AlertTriangle}
          tone="destructive"
        />
        <Kpi
          label={translate("مسددة")}
          value={all.filter((c) => c.code === "PAID").length}
          icon={CheckCircle2}
          tone="leaf"
        />
      </div>
      <Panel>
        <DataTable
          rows={rows}
          search={(c) =>
            `${L.client.get(c.clientId)?.name} ${c.saleId ? L.sale.get(c.saleId)?.number : ""}`
          }
          filters={
            <>
              <NativeSelect
                className="sm:w-44"
                aria-label={translate("السوق")}
                value={market}
                onChange={(e) => setMarket(e.target.value)}
              >
                <option value="all">{translate("كل الأسواق")}</option>
                {state.markets.map((m) => (
                  <option key={m.id} value={m.id}>
                    {translate(m.name)}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect className="sm:w-48" value={st} onChange={(e) => setSt(e.target.value)}>
                <option value="open">{translate("الديون المفتوحة")}</option>
                <option value="all">{translate("الكل")}</option>
                {state.creditStatuses.map((s) => (
                  <option key={s.id} value={s.code}>
                    {translate(s.label ?? "")}
                  </option>
                ))}
              </NativeSelect>
            </>
          }
          columns={[
            {
              header: translate("العميل"),
              cell: (c) => (
                <span className="font-medium">
                  {translate(L.client.get(c.clientId)?.name ?? "")}
                </span>
              ),
              sort: (c) => L.client.get(c.clientId)?.name ?? "",
            },
            {
              header: translate("السوق"),
              cell: (c) => translate(L.market.get(c.market)?.name ?? "—"),
            },
            {
              header: translate("غرفة التبريد"),
              cell: (c) => translate(L.team.get(c.teamId)?.name ?? ""),
            },
            {
              header: translate("عملية بيع"),
              cell: (c) => (
                <span className="font-mono text-xs">
                  {c.saleId ? L.sale.get(c.saleId)?.number : translate("يدوي")}
                </span>
              ),
            },
            {
              header: translate("الإجمالي"),
              cell: (c) => dt(c.totalAmount),
              sort: (c) => c.totalAmount,
            },
            { header: translate("المدفوع"), cell: (c) => dt(c.paidAmount) },
            {
              header: translate("المتبقي"),
              cell: (c) => (
                <b className={c.remainingAmount > 0 ? "text-destructive" : ""}>
                  {dt(c.remainingAmount)}
                </b>
              ),
              sort: (c) => c.remainingAmount,
            },
            {
              header: translate("تاريخ الاستحقاق"),
              cell: (c) => dateFr(c.dueDate),
              sort: (c) => c.dueDate,
            },
            { header: translate("الحالة"), cell: (c) => <Status value={c.code} /> },
            {
              header: "",
              cell: (c) =>
                c.remainingAmount > 0 && c.code !== "CANCELLED" ? (
                  <Edit>
                    <Button size="sm" onClick={() => setPay(c)}>
                      <Wallet className="size-4" />
                      <Text>{" سداد"}</Text>
                    </Button>
                  </Edit>
                ) : null,
            },
          ]}
        />
      </Panel>
      {pay && <PayCreditDialog credit={pay} onClose={() => setPay(null)} />}
    </div>
  );
}
