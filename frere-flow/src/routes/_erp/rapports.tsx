import { Text, translate, useLanguage, locale } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp, useLookups } from "@/store/store";
import { effectiveCreditCode, packBalance, stockOf } from "@/services/ops";
import { NativeSelect } from "@/components/app/forms";
import { PageHeader, Panel, Empty } from "@/components/app/ui";
import { downloadCsv, methodeLabel } from "@/lib/format";

export const Route = createFileRoute("/_erp/rapports")({
  head: () => ({
    meta: [
      { title: "Rapports — Frère Mahjoub" },
      {
        name: "description",
        content: "Rapports ventes, crédits, paiements, stock, emballages et activité.",
      },
      { property: "og:title", content: "Rapports — Frère Mahjoub" },
      {
        property: "og:description",
        content: "Rapports ventes, crédits, paiements, stock, emballages et activité.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Rapports,
});

type Row = Record<string, string | number>;

function Rapports() {
  useLanguage();
  const { state } = useApp();
  const L = useLookups();
  const [tab, setTab] = useState("ventes");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [team, setTeam] = useState("all");
  const [client, setClient] = useState("all");
  const today = new Date().toISOString();
  const inDate = (d: string) => (!from || d >= from) && (!to || d.slice(0, 10) <= to);
  const ok = (t: string, c?: string) =>
    (team === "all" || t === team) && (client === "all" || !c || c === client);
  const r3 = (n: number) => Math.round(n * 1000) / 1000;

  const reports: Record<string, () => Row[]> = {
    ventes: () =>
      state.sales
        .filter((s) => inDate(s.saleDate) && ok(s.teamId, s.clientId))
        .map((s) => ({
          [translate("الرقم")]: s.number,
          [translate("التاريخ")]: s.saleDate.slice(0, 10),
          [translate("العميل")]: L.client.get(s.clientId)?.name ?? "",
          [translate("غرفة التبريد")]: L.team.get(s.teamId)?.name ?? "",
          [translate("غرفة التبريد")]: L.frigo.get(s.frigoId)?.name ?? "",
          [translate("الإجمالي")]: s.totalAmount,
          [translate("المدفوع")]: s.paidAmount,
          [translate("المتبقي")]: s.remainingAmount,
          [translate("الحالة")]: L.saleStatus.get(s.saleStatusId)?.label ?? "",
        })),
    credits: () =>
      state.credits
        .filter((c) => inDate(c.createdAt) && ok(c.teamId, c.clientId))
        .map((c) => ({
          [translate("العميل")]: L.client.get(c.clientId)?.name ?? "",
          [translate("غرفة التبريد")]: L.team.get(c.teamId)?.name ?? "",
          [translate("عملية بيع")]: c.saleId
            ? (L.sale.get(c.saleId)?.number ?? "")
            : translate("يدوي"),
          [translate("الإجمالي")]: c.totalAmount,
          [translate("المدفوع")]: c.paidAmount,
          [translate("المتبقي")]: c.remainingAmount,
          [translate("تاريخ الاستحقاق")]: c.dueDate,
          [translate("الحالة")]:
            state.creditStatuses.find((s) => s.code === effectiveCreditCode(state, c, today))
              ?.label ?? "",
        })),
    paiements: () =>
      [
        ...state.payments.map((p) => ({
          d: p.paymentDate,
          t: p.teamId,
          c: p.clientId,
          u: p.userId,
          a: p.amount,
          m: p.paymentMethod,
          k: translate("عملية بيع"),
        })),
        ...state.creditPayments.map((p) => ({
          d: p.paymentDate,
          t: p.teamId,
          c: p.clientId,
          u: p.userId,
          a: p.amount,
          m: p.paymentMethod,
          k: translate("دين"),
        })),
      ]
        .filter((p) => inDate(p.d) && ok(p.t, p.c))
        .sort((a, b) => b.d.localeCompare(a.d))
        .map((p) => ({
          [translate("التاريخ")]: p.d.slice(0, 10),
          [translate("النوع")]: p.k,
          [translate("العميل")]: L.client.get(p.c)?.name ?? "",
          [translate("غرفة التبريد")]: L.team.get(p.t)?.name ?? "",
          [translate("المستخدم")]: L.user.get(p.u)?.name ?? "",
          [translate("طريقة الدفع")]: methodeLabel(p.m),
          [translate("المبلغ")]: p.a,
        })),
    stock: () =>
      state.products.flatMap((p) =>
        state.frigos.map((f) => ({
          [translate("المنتج")]: p.name,
          [translate("الفئة")]: p.category,
          [translate("غرفة التبريد")]: f.name,
          [translate("الكمية")]: stockOf(state, p.id, f.id),
          [translate("الحد")]: p.alertThreshold,
        })),
      ),
    emballages: () =>
      state.clients
        .flatMap((c) =>
          state.teams.flatMap((t) =>
            state.packagingTypes.map((pt) => {
              const b = packBalance(state, { clientId: c.id, teamId: t.id, typeId: pt.id });
              return b.given && ok(t.id, c.id)
                ? {
                    [translate("العميل")]: c.name,
                    [translate("غرفة التبريد")]: t.name,
                    [translate("النوع")]: pt.name,
                    [translate("الصادر")]: b.given,
                    [translate("المرتجع")]: b.returned,
                    [translate("المتبقي")]: b.remaining,
                  }
                : null;
            }),
          ),
        )
        .filter(Boolean) as Row[],
    caisse: () =>
      state.cash
        .filter((c) => inDate(c.date) && ok(c.teamId))
        .map((c) => ({
          [translate("التاريخ")]: c.date.slice(0, 10),
          [translate("النوع")]: c.type === "ENCAISSEMENT" ? translate("قبض") : translate("صرف"),
          [translate("غرفة التبريد")]: L.team.get(c.teamId)?.name ?? "",
          [translate("المستخدم")]: L.user.get(c.userId)?.name ?? "",
          [translate("طريقة الدفع")]: methodeLabel(c.method),
          [translate("المرجع")]: c.reference,
          [translate("المبلغ")]: c.type === "ENCAISSEMENT" ? c.amount : -c.amount,
        })),
    activite: () =>
      state.users.map((u) => {
        const s = state.sales.filter(
          (x) =>
            x.userId === u.id &&
            inDate(x.saleDate) &&
            ok(x.teamId, x.clientId) &&
            x.saleStatusId !== "ss_cancelled",
        );
        const p = state.creditPayments.filter((x) => x.userId === u.id && inDate(x.paymentDate));
        return {
          [translate("المستخدم")]: u.name,
          [translate("غرفة التبريد")]: u.teamId ? (L.team.get(u.teamId)?.name ?? "") : "—",
          [translate("المبيعات")]: s.length,
          [translate("رقم المعاملات (د.ت)")]: r3(s.reduce((a, x) => a + x.totalAmount, 0)),
          [translate("دفعات سداد الديون")]: p.length,
          [translate("المبلغ المقبوض")]: r3(p.reduce((a, x) => a + x.amount, 0)),
          [translate("الإجراءات")]: state.auditLogs.filter(
            (l) => l.userId === u.id && inDate(l.date),
          ).length,
        };
      }),
    frigos: () =>
      state.frigos.map((f) => {
        const s = state.sales.filter(
          (x) =>
            x.frigoId === f.id &&
            inDate(x.saleDate) &&
            ok(x.teamId, x.clientId) &&
            x.saleStatusId !== "ss_cancelled",
        );
        return {
          [translate("غرفة التبريد")]: f.name,
          [translate("المبيعات")]: s.length,
          [translate("رقم المعاملات (د.ت)")]: r3(s.reduce((a, x) => a + x.totalAmount, 0)),
          [translate("المخزون (كغ)")]: state.products.reduce(
            (a, p) => a + stockOf(state, p.id, f.id),
            0,
          ),
          [translate("نسبة الإشغال")]:
            `${Math.round((state.products.reduce((a, p) => a + stockOf(state, p.id, f.id), 0) / f.capacity) * 100)}%`,
        };
      }),
  };
  // valeurs texte (noms, statuts…) dans la langue choisie, à l'écran comme dans l'export Excel
  const rows = reports[tab]().map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, typeof v === "string" ? translate(v) : v]),
    ),
  );
  const cols = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div>
      <PageHeader
        title={translate("التقارير")}
        subtitle={translate("التقارير حسب الفترة والفريق والعميل")}
        actions={
          <>
            <Button variant="outline" onClick={() => downloadCsv(`rapport-${tab}.csv`, rows)}>
              <FileSpreadsheet className="size-4" /> Excel
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" /> PDF
            </Button>
          </>
        }
      />
      <Panel>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto flex-wrap">
            {[
              ["ventes", translate("المبيعات")],
              ["credits", translate("الديون")],
              ["paiements", translate("المدفوعات")],
              ["stock", translate("المخزون")],
              ["emballages", translate("الصناديق")],
              ["caisse", translate("الصندوق المالي")],
              ["activite", translate("نشاط الموظفين")],
              ["frigos", translate("أداء غرف التبريد")],
            ].map(([k, v]) => (
              <TabsTrigger key={k} value={k}>
                {v}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="my-4 flex flex-wrap gap-2">
          <Input
            type="date"
            className="w-40"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          <NativeSelect className="w-40" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="all">{<Text>{"كل غرف التبريد"}</Text>}</option>
            {state.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {translate(t.name ?? "")}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect className="w-52" value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="all">{<Text>{"كل العملاء"}</Text>}</option>
            {state.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {translate(c.name ?? "")}
              </option>
            ))}
          </NativeSelect>
        </div>
        {rows.length ? (
          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  {cols.map((c) => (
                    <th key={c} className="whitespace-nowrap p-2 text-start">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    {cols.map((c) => (
                      <td key={c} className="whitespace-nowrap p-2">
                        {typeof r[c] === "number"
                          ? Number(r[c]).toLocaleString(locale(), { maximumFractionDigits: 3 })
                          : r[c]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {rows.length}
          {<Text>{" سطر"}</Text>}
        </p>
      </Panel>
    </div>
  );
}
