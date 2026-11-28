import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, CreditCard, Landmark, ShoppingCart, Wallet } from "lucide-react";
import { useApp, useLookups, useTeamScope } from "@/store/store";
import { buildDashboardData } from "@/services/dashboard";
import { stockOf } from "@/services/ops";
import { FiltreFrigo, frigoCredit } from "@/components/app/FiltreFrigo";
import { Kpi, PageHeader, Panel, Status } from "@/components/app/ui";
import { dateFr, dt, num } from "@/lib/format";

export const Route = createFileRoute("/_erp/dashboard")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Frère Mahjoub" },
      { name: "description", content: "Vue d'ensemble des ventes, crédits, stocks et emballages." },
      { property: "og:title", content: "Tableau de bord — Frère Mahjoub" },
      {
        property: "og:description",
        content: "Vue d'ensemble des ventes, crédits, stocks et emballages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const C = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function Dashboard() {
  const { language } = useLanguage();
  const { state, teamFilter } = useApp();
  const L = useLookups();
  const inScope = useTeamScope();
  // date fixée à l'ouverture de la page
  const today = useMemo(() => new Date().toISOString(), []);
  const [frigo, setFrigo] = useState("all");
  // filtre frigo : ventes, paiements et crédits de ce frigo ; stock de ce frigo seulement
  const etat = useMemo(() => {
    if (frigo === "all") return state;
    const ventes = new Set(state.sales.filter((v) => v.frigoId === frigo).map((v) => v.id));
    const credits = state.credits.filter((c) => frigoCredit(state, c) === frigo);
    const ids = new Set(credits.map((c) => c.id));
    return {
      ...state,
      frigos: state.frigos.filter((x) => x.id === frigo),
      sales: state.sales.filter((v) => ventes.has(v.id)),
      saleItems: state.saleItems.filter((i) => ventes.has(i.saleId)),
      payments: state.payments.filter((p) => ventes.has(p.saleId)),
      credits,
      creditPayments: state.creditPayments.filter((p) => ids.has(p.creditId)),
    };
  }, [state, frigo]);
  // recalculé aussi au changement de langue (mois, noms des graphiques)
  const d = useMemo(
    () => buildDashboardData(etat, teamFilter, inScope, today),
    [etat, inScope, teamFilter, today, language], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // stock : un groupe de barres par produit, une barre par frigo
  const stockParProduit = useMemo(
    () =>
      etat.products
        .filter((p) => p.active)
        .map((p) => ({
          name: translate(p.name),
          ...Object.fromEntries(etat.frigos.map((x) => [x.id, stockOf(etat, p.id, x.id)])),
        })),
    [etat, language], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const montant = (v: unknown) => dt(Number(v));
  const kg = (v: unknown) => `${num(Number(v))} kg`;
  const court = (v: number) => (Math.abs(v) >= 1000 ? `${num(v / 1000, 1)}k` : num(v));
  const nom = (n?: string) => translate(n ?? "");

  const alertes = [
    ...d.overdue.slice(0, 3).map((c) => ({
      key: c.id,
      tone: "destructive" as const,
      text: `${translate("دين متأخر")} — ${nom(L.client.get(c.clientId)?.name)} (${dt(c.remainingAmount)})`,
    })),
    ...d.ruptures.slice(0, 2).map((x) => ({
      key: "r" + x.p.id,
      tone: "destructive" as const,
      text: `${translate("نفاد المخزون")} — ${nom(x.p.name)}`,
    })),
    ...d.low.slice(0, 2).map((x) => ({
      key: x.p.id + x.f.id,
      tone: "warning" as const,
      text: `${translate("مخزون منخفض")} — ${nom(x.p.name)} · ${nom(x.f.name)} (${num(x.q)} kg)`,
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={translate("لوحة المتابعة")}
        actions={<FiltreFrigo value={frigo} onChange={setFrigo} />}
      />

      {/* chiffres essentiels en haut : ventes, paiements, solde de la caisse, crédits */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label={translate("مبيعات الشهر")}
          value={dt(d.monthSales)}
          icon={ShoppingCart}
          tone="leaf"
        />
        <Kpi
          label={translate("المدفوعات المستلمة هذا الشهر")}
          value={dt(d.monthPaid)}
          icon={Wallet}
        />
        <Kpi
          label={translate("رصيد الصندوق المالي")}
          value={dt(d.cashBal)}
          icon={Landmark}
          tone="leaf"
        />
        <Kpi
          label={translate("إجمالي الديون")}
          value={dt(d.creditTotal)}
          icon={CreditCard}
          tone="destructive"
        />
      </div>

      {/* graphiques */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title={translate("تطور المبيعات والمدفوعات والديون")} className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={d.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mois" fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis
                  fontSize={12}
                  stroke="var(--muted-foreground)"
                  tickFormatter={court}
                  width={48}
                />
                <Tooltip formatter={montant} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="ventes"
                  name={translate("المبيعات")}
                  stroke="var(--chart-1)"
                  fill="var(--chart-1)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="paiements"
                  name={translate("المدفوعات")}
                  stroke="var(--chart-2)"
                  fill="var(--chart-2)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="credits"
                  name={translate("الديون")}
                  stroke="var(--chart-4)"
                  fill="var(--chart-4)"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title={translate("الصناديق لدى العملاء")}>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={d.packDist} dataKey="value" nameKey="name" outerRadius={90}>
                  {d.packDist.map((p) => (
                    <Cell key={translate(p.name ?? "")} fill={p.hex} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${num(Number(v))} ${translate("صندوق")}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title={translate("المخزون حسب غرفة التبريد (كغ)")}>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={stockParProduit}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" interval={0} />
              <YAxis
                fontSize={12}
                stroke="var(--muted-foreground)"
                tickFormatter={court}
                width={48}
              />
              <Tooltip formatter={kg} />
              <Legend />
              {etat.frigos.map((x, i) => (
                <Bar
                  key={x.id}
                  dataKey={x.id}
                  name={nom(x.name)}
                  fill={C[i % C.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          title={translate("أحدث المبيعات")}
          className="xl:col-span-2"
          action={
            <Link to="/ventes" className="text-sm text-primary hover:underline">
              {<Text>{"عرض الكل"}</Text>}
            </Link>
          }
        >
          <div className="divide-y">
            {d.sales.slice(0, 5).map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {v.number} · {nom(L.client.get(v.clientId)?.name)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {nom(L.frigo.get(v.frigoId)?.name)} · {dateFr(v.saleDate)}
                  </p>
                </div>
                <div className="text-end">
                  <p className="font-semibold">{dt(v.totalAmount)}</p>
                  <Status
                    value={L.saleStatus.get(v.saleStatusId)?.code ?? ""}
                    label={L.saleStatus.get(v.saleStatusId)?.label}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title={translate("التنبيهات")}>
          <div className="space-y-2 text-sm">
            {alertes.map((a) => (
              <Alert key={a.key} tone={a.tone} text={a.text} />
            ))}
            {!alertes.length && (
              <p className="text-muted-foreground">{<Text>{"لا توجد تنبيهات."}</Text>}</p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Alert({ text, tone }: { text: string; tone: "warning" | "destructive" }) {
  useLanguage();
  return (
    <div
      className={
        tone === "destructive"
          ? "flex gap-2 rounded-lg bg-destructive/10 p-2.5 text-destructive"
          : "flex gap-2 rounded-lg bg-warning/15 p-2.5 text-warning-foreground"
      }
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" /> <span>{text}</span>
    </div>
  );
}
