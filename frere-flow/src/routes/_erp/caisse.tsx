import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  Landmark,
  Banknote,
  FileCheck2,
  ArrowRightLeft,
  CalendarDays,
  CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp, useLookups, useTeamScope } from "@/store/store";
import { addCash } from "@/services/ops";
import type { CashEntry } from "@/types";
import { DataTable } from "@/components/app/DataTable";
import { Field, FormDialog, NativeSelect, Edit } from "@/components/app/forms";
import { Kpi, PageHeader, Panel, Status } from "@/components/app/ui";
import { METHODES, dateTimeFr, dt, methodeLabel } from "@/lib/format";

export const Route = createFileRoute("/_erp/caisse")({
  head: () => ({
    meta: [
      { title: "Caisse — Frère Mahjoub" },
      { name: "description", content: "Mouvements et solde de caisse par Figo." },
      { property: "og:title", content: "Caisse — Frère Mahjoub" },
      { property: "og:description", content: "Mouvements et solde de caisse par Figo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Caisse,
});

function Caisse() {
  useLanguage();
  const { state, run, teamFilter } = useApp();
  const L = useLookups();
  const inScope = useTeamScope();
  const [method, setMethod] = useState("all");
  const [user, setUser] = useState("all");
  const [from, setFrom] = useState("");
  const [add, setAdd] = useState(false);
  const [f, setF] = useState<Omit<CashEntry, "id" | "userId" | "date">>({
    teamId: teamFilter === "all" ? state.teams[0].id : teamFilter,
    type: "DECAISSEMENT",
    method: "ESPECES",
    amount: 0,
    reference: "",
    description: "",
  });

  const all = state.cash.filter((c) => inScope(c.teamId));
  const rows = all.filter(
    (c) =>
      (method === "all" || c.method === method) &&
      (user === "all" || c.userId === user) &&
      (!from || c.date >= from),
  );
  const sign = (c: CashEntry) => (c.type === "ENCAISSEMENT" ? c.amount : -c.amount);
  const sum = (arr: CashEntry[]) => arr.reduce((a, c) => a + sign(c), 0);
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  return (
    <div>
      <PageHeader
        title={translate("الصندوق المالي")}
        subtitle={translate("تتبع العمليات حسب فريق فيغو والمستخدم")}
        actions={
          <Edit>
            <Button onClick={() => setAdd(true)}>
              <Plus className="size-4" />
              {<Text>{" عملية يدوية"}</Text>}
            </Button>
          </Edit>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label={translate("الرصيد الحالي")} value={dt(sum(all))} icon={Landmark} />
        <Kpi
          label={translate("نقداً")}
          value={dt(sum(all.filter((c) => c.method === "ESPECES")))}
          icon={Banknote}
          tone="leaf"
        />
        <Kpi
          label={translate("شيكات")}
          value={dt(sum(all.filter((c) => c.method === "CHEQUE")))}
          icon={FileCheck2}
        />
        <Kpi
          label={translate("تحويلات بنكية")}
          value={dt(sum(all.filter((c) => c.method === "VIREMENT")))}
          icon={ArrowRightLeft}
        />
        <Kpi
          label={translate("اليوم")}
          value={dt(sum(all.filter((c) => c.date.startsWith(today))))}
          icon={CalendarDays}
          tone="leaf"
        />
        <Kpi
          label={translate("هذا الشهر")}
          value={dt(sum(all.filter((c) => c.date.startsWith(month))))}
          icon={CalendarRange}
        />
      </div>
      <Panel title={translate("حركات الصندوق المالي")}>
        <DataTable
          rows={rows}
          search={(c) => `${c.reference} ${translate(c.description ?? "")}`}
          filters={
            <>
              <Input
                type="date"
                className="sm:w-40"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                title={translate("من تاريخ")}
              />
              <NativeSelect
                className="sm:w-40"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="all">{<Text>{"كل طرق الدفع"}</Text>}</option>
                {METHODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {translate(m.label ?? "")}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                className="sm:w-48"
                value={user}
                onChange={(e) => setUser(e.target.value)}
              >
                <option value="all">{<Text>{"كل المستخدمين"}</Text>}</option>
                {state.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {translate(u.name ?? "")}
                  </option>
                ))}
              </NativeSelect>
            </>
          }
          columns={[
            { header: translate("التاريخ"), cell: (c) => dateTimeFr(c.date), sort: (c) => c.date },
            { header: translate("النوع"), cell: (c) => <Status value={c.type} /> },
            { header: translate("فيغو"), cell: (c) => L.team.get(c.teamId)?.name },
            { header: translate("المستخدم"), cell: (c) => L.user.get(c.userId)?.name },
            { header: translate("طريقة الدفع"), cell: (c) => methodeLabel(c.method) },
            {
              header: translate("المرجع"),
              cell: (c) => <span className="font-mono text-xs">{c.reference}</span>,
            },
            { header: translate("الوصف"), cell: (c) => c.description },
            {
              header: translate("المبلغ"),
              cell: (c) => (
                <b className={c.type === "ENCAISSEMENT" ? "text-primary" : "text-destructive"}>
                  {c.type === "ENCAISSEMENT" ? "+" : "−"}
                  {dt(c.amount)}
                </b>
              ),
              sort: (c) => sign(c),
            },
          ]}
        />
      </Panel>
      {add && (
        <FormDialog
          open
          onOpenChange={() => setAdd(false)}
          title={translate("عملية مالية")}
          onSubmit={() => run(addCash, f) && setAdd(false)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={translate("النوع")}>
              <NativeSelect
                value={f.type}
                onChange={(e) => setF({ ...f, type: e.target.value as CashEntry["type"] })}
              >
                <option value="ENCAISSEMENT">{<Text>{"قبض"}</Text>}</option>
                <option value="DECAISSEMENT">{<Text>{"صرف"}</Text>}</option>
              </NativeSelect>
            </Field>
            <Field label={translate("فيغو")}>
              <NativeSelect
                value={f.teamId}
                onChange={(e) => setF({ ...f, teamId: e.target.value })}
              >
                {state.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {translate(t.name ?? "")}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={translate("المبلغ (د.ت)")}>
              <Input
                type="number"
                step="0.001"
                min={0.001}
                required
                inputMode="decimal"
                placeholder={translate("مثال: 45.500")}
                value={f.amount || ""}
                onChange={(e) => setF({ ...f, amount: Number(e.target.value) })}
              />
            </Field>
            <Field label={translate("طريقة الدفع")}>
              <NativeSelect
                value={f.method}
                onChange={(e) => setF({ ...f, method: e.target.value as CashEntry["method"] })}
              >
                {METHODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {translate(m.label ?? "")}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={translate("المرجع")}>
              <Input
                maxLength={30}
                dir="ltr"
                placeholder={translate("مثال: CH-004512")}
                value={f.reference}
                onChange={(e) => setF({ ...f, reference: e.target.value })}
              />
            </Field>
            <Field label={translate("الوصف")}>
              <Input
                required
                value={f.description}
                onChange={(e) => setF({ ...f, description: e.target.value })}
                minLength={3}
                maxLength={200}
                placeholder={translate("مثال: وقود الشاحنة")}
              />
            </Field>
          </div>
        </FormDialog>
      )}
    </div>
  );
}
