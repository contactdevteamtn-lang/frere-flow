import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CreditCard, ShoppingBasket, Scale, Wallet, RotateCcw } from "lucide-react";
import { useApp, useLookups } from "@/store/store";
import { marketAnalytics } from "@/services/markets";
import { translate, useLanguage } from "@/lib/i18n";
import { dt, num } from "@/lib/format";
import { Empty, Kpi } from "@/components/app/ui";
import { Field, NativeSelect } from "@/components/app/forms";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/app/DataTable";

export function MarketAnalytics() {
  useLanguage();
  const { state, teamFilter } = useApp();
  const L = useLookups();
  const [marketId, setMarket] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const invalid = !!from && !!to && from > to;
  const d = marketAnalytics(state, {
    marketId,
    from,
    to,
    teamId: teamFilter === "all" ? undefined : teamFilter,
  });
  const products = d.products.slice(0, 8).map((p) => ({
    name: translate(L.product.get(p.productId)?.name ?? p.productId),
    value: p.quantity,
  }));
  const revenues = d.revenues.map((m) => ({
    name: translate(L.market.get(m.marketId)?.name ?? m.marketId),
    value: m.amount,
  }));
  return (
    <div className="space-y-6">
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <Field label="السوق">
          <NativeSelect
            aria-label={translate("السوق")}
            value={marketId}
            onChange={(e) => setMarket(e.target.value)}
          >
            <option value="">{translate("كل الأسواق")}</option>
            {state.markets.map((m) => (
              <option key={m.id} value={m.id}>
                {translate(m.name)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="من تاريخ">
          <Input
            aria-label={translate("من تاريخ")}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="إلى تاريخ">
          <Input
            aria-label={translate("إلى تاريخ")}
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <Button
          variant="outline"
          size="icon"
          aria-label={translate("إعادة تعيين المرشحات")}
          title={translate("إعادة تعيين المرشحات")}
          onClick={() => {
            setMarket("");
            setFrom("");
            setTo("");
          }}
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>
      {invalid ? (
        <p role="alert" className="text-sm text-destructive">
          {translate("تاريخ البداية بعد تاريخ النهاية")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="رقم معاملات الأسواق"
              value={dt(d.total)}
              icon={ShoppingBasket}
              tone="leaf"
            />
            <Kpi label="إجمالي المقبوض في الأسواق" value={dt(d.paid)} icon={Wallet} />
            <Kpi
              label="ديون الأسواق القائمة"
              value={dt(d.credit)}
              icon={CreditCard}
              tone="destructive"
            />
            <Kpi
              label="الكمية المباعة"
              value={`${num(d.volume, 1)} kg`}
              icon={Scale}
              tone="warning"
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="min-w-0 space-y-4">
              <h2 className="font-semibold">{translate("المنتجات الأكثر مبيعاً في الأسواق")}</h2>
              <div className="h-72">
                {products.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={products} margin={{ top: 10, right: 12, bottom: 40, left: 0 }}>
                      <CartesianGrid
                        vertical={false}
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="name"
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        fontSize={11}
                        stroke="var(--muted-foreground)"
                      />
                      <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                      <Tooltip formatter={(v) => `${num(Number(v), 1)} kg`} />
                      <Bar
                        name={translate("الكمية المباعة")}
                        dataKey="value"
                        fill="var(--chart-1)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty />
                )}
              </div>
            </section>
            <section className="min-w-0 space-y-4">
              <h2 className="font-semibold">{translate("مقارنة رقم المعاملات حسب السوق")}</h2>
              <div className="h-72">
                {revenues.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenues} margin={{ top: 10, right: 12, bottom: 40, left: 0 }}>
                      <CartesianGrid
                        vertical={false}
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="name"
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        fontSize={11}
                        stroke="var(--muted-foreground)"
                      />
                      <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                      <Tooltip formatter={(v) => dt(Number(v))} />
                      <Bar
                        name={translate("رقم المعاملات")}
                        dataKey="value"
                        fill="var(--chart-2)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty />
                )}
              </div>
            </section>
          </div>
          <section className="space-y-4 border-t pt-5">
            <h2 className="font-semibold">{translate("ديون العملاء حسب السوق")}</h2>
            <DataTable
              rows={d.debts.map((x) => ({ ...x, id: `${x.marketId}-${x.clientId}` }))}
              search={(x) => `${L.client.get(x.clientId)?.name} ${L.market.get(x.marketId)?.name}`}
              columns={[
                {
                  header: translate("العميل"),
                  cell: (x) => translate(L.client.get(x.clientId)?.name ?? ""),
                },
                {
                  header: translate("السوق"),
                  cell: (x) => translate(L.market.get(x.marketId)?.name ?? ""),
                },
                {
                  header: translate("المتبقي"),
                  cell: (x) => (
                    <span className="font-semibold text-destructive">{dt(x.amount)}</span>
                  ),
                  sort: (x) => x.amount,
                },
              ]}
            />
          </section>
        </>
      )}
    </div>
  );
}
