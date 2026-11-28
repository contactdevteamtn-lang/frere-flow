import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Wallet, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApp, useLookups, useTeamScope } from "@/store/store";
import {
  addCreditPayment,
  addManualCredit,
  creditStatusChoices,
  effectiveCreditCode,
  setCreditStatus,
  isMarketCredit,
} from "@/services/ops";
import type { Credit, PaymentMethod } from "@/types";
import { DataTable } from "@/components/app/DataTable";
import { Field, FormDialog, NativeSelect, Edit } from "@/components/app/forms";
import { Kpi, PageHeader, Panel, Status } from "@/components/app/ui";
import { METHODES, dateFr, dateTimeFr, dt, methodeLabel } from "@/lib/format";
import { CreditCard, AlertTriangle, CheckCircle2 } from "lucide-react";
import { FiltreFrigo, dansFrigo, frigoCredit, frigoVente } from "@/components/app/FiltreFrigo";

export const Route = createFileRoute("/_erp/credits")({
  head: () => ({
    meta: [
      { title: "Crédits — Frère Mahjoub" },
      { name: "description", content: "Suivi des crédits clients par Frigo." },
      { property: "og:title", content: "Crédits — Frère Mahjoub" },
      { property: "og:description", content: "Suivi des crédits clients par Frigo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Credits,
});

export function PayCreditDialog({ credit, onClose }: { credit: Credit; onClose: () => void }) {
  useLanguage();
  const { run } = useApp();
  const L = useLookups();
  const [amount, setAmount] = useState(credit.remainingAmount);
  const [method, setMethod] = useState<PaymentMethod>("ESPECES");
  const [notes, setNotes] = useState("");
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      title={translate("إضافة دفعة")}
      description={translate(
        `${L.client.get(credit.clientId)?.name} · ${L.team.get(credit.teamId)?.name} · المتبقي ${dt(credit.remainingAmount)}`,
      )}
      onSubmit={() =>
        run(addCreditPayment, { creditId: credit.id, amount, method, notes }) && onClose()
      }
      submitLabel={translate("حفظ الدفعة")}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={translate("المبلغ (د.ت)")}>
          <Input
            type="number"
            step="0.001"
            min={0.001}
            max={credit.remainingAmount}
            required
            inputMode="decimal"
            placeholder={translate("مثال: 125.500")}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </Field>
        <Field label={translate("طريقة الدفع")}>
          <NativeSelect value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {METHODES.map((m) => (
              <option key={m.value} value={m.value}>
                {translate(m.label ?? "")}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={translate("ملاحظة")} className="sm:col-span-2">
          <Input
            maxLength={500}
            placeholder={translate("مثال: دفعة نقداً في المحل")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>
      <p className="text-sm text-muted-foreground">
        {<Text>{"المتبقي بعد الدفع: "}</Text>}
        <b className="text-foreground">{dt(Math.max(credit.remainingAmount - (amount || 0), 0))}</b>
      </p>
    </FormDialog>
  );
}

function Credits() {
  useLanguage();
  const { state, run, can, teamFilter } = useApp();
  const L = useLookups();
  const inScope = useTeamScope();
  const today = new Date().toISOString();
  const [pay, setPay] = useState<Credit | null>(null);
  const [hist, setHist] = useState<Credit | null>(null);
  const [add, setAdd] = useState(false);
  const [st, setSt] = useState("open");
  const [frigo, setFrigo] = useState("all");
  const [nc, setNc] = useState({
    clientId: "",
    teamId: teamFilter === "all" ? state.teams[0].id : teamFilter,
    amount: 0,
    dueDate: "",
    notes: "",
  });

  // dettes des marchés : dans la section Marchés
  const all = state.credits
    .filter((c) => inScope(c.teamId) && !isMarketCredit(state, c))
    .map((c) => ({ ...c, code: effectiveCreditCode(state, c, today) }));
  const rows = all.filter(
    (c) =>
      st === "all" ||
      (st === "open" ? ["ACTIVE", "PARTIAL", "OVERDUE"].includes(c.code) : c.code === st),
  );
  const open = all.filter((c) => ["ACTIVE", "PARTIAL", "OVERDUE"].includes(c.code));

  return (
    <div>
      <PageHeader
        title={translate("الديون")}
        subtitle={translate("كل دين مرتبط بعملية البيع وغرفة التبريد الخاص به")}
        actions={
          can("credits") && (
            <Edit>
              <Button variant="outline" onClick={() => setAdd(true)}>
                <Plus className="size-4" />
                {<Text>{" دين يدوي"}</Text>}
              </Button>
            </Edit>
          )
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={translate("الديون المفتوحة")} value={open.length} icon={CreditCard} />
        <Kpi
          label={translate("المتبقي للتحصيل")}
          value={dt(open.reduce((a, c) => a + c.remainingAmount, 0))}
          icon={CreditCard}
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
          rows={rows.filter((c) => dansFrigo(frigo, frigoCredit(state, c)))}
          search={(c) =>
            `${L.client.get(c.clientId)?.name} ${c.saleId ? L.sale.get(c.saleId)?.number : ""}`
          }
          filters={
            <>
              <FiltreFrigo value={frigo} onChange={setFrigo} />
              <NativeSelect className="sm:w-52" value={st} onChange={(e) => setSt(e.target.value)}>
                <option value="open">{<Text>{"الديون المفتوحة"}</Text>}</option>
                <option value="all">{<Text>{"الكل"}</Text>}</option>
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
            { header: translate("غرفة التبريد"), cell: (c) => L.team.get(c.teamId)?.name },
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
              header: translate("تاريخ الإنشاء"),
              cell: (c) => dateFr(c.createdAt),
              sort: (c) => c.createdAt,
            },
            {
              header: translate("تاريخ الاستحقاق"),
              cell: (c) => dateFr(c.dueDate),
              sort: (c) => c.dueDate,
            },
            { header: translate("الحالة"), cell: (c) => <Status value={c.code} /> },
            {
              header: "",
              cell: (c) => (
                <div className="flex gap-1">
                  {c.remainingAmount > 0 && c.code !== "CANCELLED" && (
                    <Edit>
                      <Button size="sm" onClick={() => setPay(c)}>
                        <Wallet className="size-4" />
                        {<Text>{" سداد"}</Text>}
                      </Button>
                    </Edit>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => setHist(c)}>
                    <History className="size-4" />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Panel>
      {pay && <PayCreditDialog credit={pay} onClose={() => setPay(null)} />}
      {hist && (
        <Dialog open onOpenChange={() => setHist(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {translate("السجل")} — {translate(L.client.get(hist.clientId)?.name ?? "")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>{<Text>{"المبلغ الأصلي"}</Text>}</span>
                <b>{dt(hist.totalAmount)}</b>
              </div>
              {state.creditPayments
                .filter((p) => p.creditId === hist.id)
                .map((p) => (
                  <div key={p.id} className="flex justify-between border-t pt-2">
                    <span>
                      {dateTimeFr(p.paymentDate)} · {methodeLabel(p.paymentMethod)} ·{" "}
                      {translate(L.user.get(p.userId)?.name ?? "")}
                    </span>
                    <b className="text-primary">−{dt(p.amount)}</b>
                  </div>
                ))}
              <div className="flex justify-between border-t pt-2">
                <span>{<Text>{"المتبقي"}</Text>}</span>
                <b className="text-destructive">
                  {dt(state.credits.find((c) => c.id === hist.id)?.remainingAmount)}
                </b>
              </div>
            </div>
            {/* statut calculé d'après les paiements ; un crédit de vente suit la vente ;
                seul un crédit manuel peut être annulé (dette abandonnée) ou réactivé */}
            {(() => {
              const actuel = state.credits.find((c) => c.id === hist.id);
              if (!actuel) return null;
              const choix = creditStatusChoices(state, actuel);
              return can("caisse") && choix.length > 1 ? (
                <Field label={translate("حالة الدين")}>
                  <NativeSelect
                    value={actuel.creditStatusId}
                    onChange={(e) => run(setCreditStatus, hist.id, e.target.value)}
                  >
                    {state.creditStatuses
                      .filter((s) => choix.includes(s.id))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {translate(s.label ?? "")}
                        </option>
                      ))}
                  </NativeSelect>
                </Field>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {translate(
                    actuel.saleId
                      ? "يُسدَّد هذا الدين بتسجيل دفعة، ويُلغى بإلغاء عملية البيع."
                      : "الحالة تُحسب تلقائياً من المدفوعات.",
                  )}
                </p>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}
      {add && (
        <FormDialog
          open
          onOpenChange={() => setAdd(false)}
          title={translate("دين يدوي جديد")}
          onSubmit={() =>
            run(addManualCredit, {
              ...nc,
              dueDate: nc.dueDate || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
            }) && setAdd(false)
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={translate("العميل")}>
              <NativeSelect
                required
                value={nc.clientId}
                onChange={(e) => setNc({ ...nc, clientId: e.target.value })}
              >
                <option value="">{<Text>{"اختر…"}</Text>}</option>
                {state.clients
                  .filter((c) => !c.marketId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {translate(c.name ?? "")}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
            <Field label={translate("غرفة التبريد")}>
              <NativeSelect
                value={nc.teamId}
                onChange={(e) => setNc({ ...nc, teamId: e.target.value })}
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
                placeholder={translate("مثال: 350.000")}
                value={nc.amount || ""}
                onChange={(e) => setNc({ ...nc, amount: Number(e.target.value) })}
              />
            </Field>
            <Field label={translate("تاريخ الاستحقاق")}>
              <Input
                type="date"
                value={nc.dueDate}
                onChange={(e) => setNc({ ...nc, dueDate: e.target.value })}
              />
            </Field>
            <Field label={translate("ملاحظات")} className="sm:col-span-2">
              <Input
                maxLength={500}
                placeholder={translate("مثال: دين قديم قبل البرنامج")}
                value={nc.notes}
                onChange={(e) => setNc({ ...nc, notes: e.target.value })}
              />
            </Field>
          </div>
        </FormDialog>
      )}
    </div>
  );
}
