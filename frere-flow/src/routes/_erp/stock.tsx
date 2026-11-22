import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useApp } from "@/store/store";
import { stockOf, stockTotal } from "@/services/ops";
import { DataTable } from "@/components/app/DataTable";
import { NativeSelect } from "@/components/app/forms";
import { PageHeader, Panel, Status } from "@/components/app/ui";
import { num } from "@/lib/format";
import { StockMoveButton } from "./mouvements";

export const Route = createFileRoute("/_erp/stock")({
  head: () => ({
    meta: [
      { title: "Stock par frigo — Frère Mahjoub" },
      { name: "description", content: "Stock indépendant par frigo." },
      { property: "og:title", content: "Stock par frigo — Frère Mahjoub" },
      { property: "og:description", content: "Stock indépendant par frigo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Stock,
});

function Stock() {
  useLanguage();
  const { state } = useApp();
  const [frigo, setFrigo] = useState("all");
  const [cat, setCat] = useState("all");
  const [low, setLow] = useState(false);
  const rows = state.products
    .flatMap((p) =>
      state.frigos.map((f) => ({ id: p.id + f.id, p, f, q: stockOf(state, p.id, f.id) })),
    )
    .filter(
      (r) =>
        (frigo === "all" || r.f.id === frigo) &&
        (cat === "all" || r.p.category === cat) &&
        (!low || r.q < r.p.alertThreshold),
    );
  const cats = [...new Set(state.products.map((p) => translate(p.category ?? "")))];

  return (
    <div className="space-y-4">
      <PageHeader
        title={translate("المخزون حسب غرفة التبريد")}
        subtitle={translate("مخزون مستقل لكل منتج في كل غرفة تبريد")}
        actions={<StockMoveButton />}
      />
      <div className="grid gap-3 md:grid-cols-3">
        {state.frigos.map((f) => {
          const tot = state.products.reduce((a, p) => a + stockOf(state, p.id, f.id), 0);
          return (
            <div key={f.id} className="rounded-xl border bg-card p-4 shadow-card">
              <div className="flex justify-between">
                <p className="font-display font-semibold">{translate(f.name ?? "")}</p>
                <span className="text-xs text-muted-foreground">{translate(f.location ?? "")}</span>
              </div>
              <p className="mt-2 font-display text-2xl font-semibold">
                {num(tot)} {translate("كغ")}
              </p>
              <div className="mt-2 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${Math.min(100, (tot / f.capacity) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {Math.round((tot / f.capacity) * 100)}% {translate("من")} {num(f.capacity)} kg
              </p>
            </div>
          );
        })}
      </div>
      <Panel>
        <DataTable
          rows={rows}
          search={(r) => r.p.name}
          filters={
            <>
              <NativeSelect
                className="sm:w-40"
                value={frigo}
                onChange={(e) => setFrigo(e.target.value)}
              >
                <option value="all">{<Text>{"كل غرف التبريد"}</Text>}</option>
                {state.frigos.map((f) => (
                  <option key={f.id} value={f.id}>
                    {translate(f.name ?? "")}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                className="sm:w-40"
                value={cat}
                onChange={(e) => setCat(e.target.value)}
              >
                <option value="all">{<Text>{"كل الفئات"}</Text>}</option>
                {cats.map((c) => (
                  <option key={c}>{translate(c)}</option>
                ))}
              </NativeSelect>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} />
                {<Text>{" المخزون المنخفض فقط"}</Text>}
              </label>
            </>
          }
          columns={[
            {
              header: translate("المنتج"),
              cell: (r) => <span className="font-medium">{translate(r.p.name ?? "")}</span>,
              sort: (r) => r.p.name,
            },
            { header: translate("الفئة"), cell: (r) => r.p.category },
            { header: translate("غرفة التبريد"), cell: (r) => r.f.name, sort: (r) => r.f.name },
            {
              header: translate("الكمية"),
              cell: (r) => (
                <b>
                  {num(r.q)} {translate(r.p.unit ?? "")}
                </b>
              ),
              sort: (r) => r.q,
            },
            {
              header: translate("حد التنبيه"),
              cell: (r) => `${num(r.p.alertThreshold)} ${r.p.unit}`,
            },
            {
              header: translate("إجمالي غرف التبريد"),
              cell: (r) => `${num(stockTotal(state, r.p.id))} ${r.p.unit}`,
            },
            {
              header: translate("الحالة"),
              cell: (r) => <Status value={r.q < r.p.alertThreshold ? "FAIBLE" : "OK"} />,
            },
          ]}
        />
      </Panel>
    </div>
  );
}
