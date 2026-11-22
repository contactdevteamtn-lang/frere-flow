import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
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
import {
  AlertTriangle,
  Boxes,
  CreditCard,
  Landmark,
  ShoppingCart,
  Users,
  Wallet,
  Clock,
} from "lucide-react";
import { useApp, useLookups, useTeamScope } from "@/store/store";
import { buildDashboardData } from "@/services/dashboard";
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
  const { state, teamFilter } = useApp();
  const L = useLookups();
  const inScope = useTeamScope();
  const today = new Date().toISOString();
  const d = useMemo(
    () => buildDashboardData(state, teamFilter, inScope, today),
    [state, inScope, teamFilter, today],
  );

  const scopeLabel = teamFilter === "all" ? translate("كل فرق فيغو") : L.team.get(teamFilter)?.name;

  return (
    <div className="space-y-6">
      <PageHeader
        title={translate("لوحة المتابعة")}
        subtitle={translate(`نظرة عامة — ${scopeLabel}`)}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label={translate("إجمالي العملاء")}
          value={state.clients.length}
          hint={translate(`${d.activeClients} نشط خلال 90 يوماً`)}
          icon={Users}
        />
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
          label={translate("الديون القائمة")}
          value={d.openCredits.length}
          hint={translate(`${d.overdue.length} متأخر`)}
          icon={CreditCard}
          tone="warning"
        />
        <Kpi
          label={translate("إجمالي الديون")}
          value={dt(d.creditTotal)}
          icon={CreditCard}
          tone="destructive"
        />
        <Kpi label={translate("الصناديق لدى العملاء")} value={num(d.pack)} icon={Boxes} />
        <Kpi
          label={translate("المبيعات المعلقة")}
          value={d.pending.length}
          icon={Clock}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title={translate("تطور المبيعات والمدفوعات والديون")} className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={d.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mois" fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis fontSize={12} stroke="var(--muted-foreground)" />
                <Tooltip formatter={(v) => dt(Number(v))} />
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
        <Panel title={translate("المبيعات حسب فريق فيغو")}>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={d.byTeam}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {d.byTeam.map((_, i) => (
                    <Cell key={i} fill={C[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => dt(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title={translate("المخزون حسب غرفة التبريد (كغ)")} className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={d.stockByFrigo}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis fontSize={12} stroke="var(--muted-foreground)" />
                <Tooltip />
                <Legend />
                {state.products.slice(0, 5).map((p, i) => (
                  <Bar
                    key={p.id}
                    dataKey={translate(p.name ?? "")}
                    fill={C[i]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
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
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

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
            {d.sales.slice(0, 6).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {s.number} · {translate(L.client.get(s.clientId)?.name ?? "")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {translate(L.team.get(s.teamId)?.name ?? "")} ·{" "}
                    {translate(L.frigo.get(s.frigoId)?.name ?? "")} · {dateFr(s.saleDate)}
                  </p>
                </div>
                <div className="text-end">
                  <p className="font-semibold">{dt(s.totalAmount)}</p>
                  <Status
                    value={L.saleStatus.get(s.saleStatusId)?.code ?? ""}
                    label={L.saleStatus.get(s.saleStatusId)?.label}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title={translate("التنبيهات")}>
          <div className="space-y-2 text-sm">
            {d.overdue.slice(0, 4).map((c) => (
              <Alert
                key={c.id}
                tone="destructive"
                text={translate(
                  `دين متأخر — ${L.client.get(c.clientId)?.name} (${dt(c.remainingAmount)})`,
                )}
              />
            ))}
            {d.low.slice(0, 4).map((x) => (
              <Alert
                key={x.p.id + x.f.id}
                tone="warning"
                text={translate(`مخزون منخفض — ${x.p.name} · ${x.f.name} (${num(x.q)} kg)`)}
              />
            ))}
            {d.packAlerts.slice(0, 3).map((x) => (
              <Alert
                key={x.c.id}
                tone="warning"
                text={translate(`صناديق غير مرجعة — ${x.c.name} (${x.r})`)}
              />
            ))}
            {d.pending.slice(0, 2).map((s) => (
              <Alert key={s.id} tone="warning" text={translate(`دفعة معلقة — ${s.number}`)} />
            ))}
            {!d.overdue.length && !d.low.length && !d.packAlerts.length && (
              <p className="text-muted-foreground">{<Text>{"لا توجد تنبيهات."}</Text>}</p>
            )}
          </div>
          <div className="mt-5 border-t pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {<Text>{"أبرز العملاء"}</Text>}
            </p>
            {d.top.map(([id, v], i) => (
              <div key={id} className="flex justify-between py-1 text-sm">
                <span>
                  {i + 1}. {translate(L.client.get(id)?.name ?? "")}
                </span>
                <span className="font-medium">{dt(v)}</span>
              </div>
            ))}
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
