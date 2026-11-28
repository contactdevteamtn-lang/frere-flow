import { useState } from "react";
import { Wallet, Ban, Bell, Phone } from "lucide-react";
import type { Credit, PaymentMethod } from "@/types";
import { useApp, useLookups, useTeamScope } from "@/store/store";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormDialog, NativeSelect, Confirm } from "@/components/app/forms";
import {
  cancelDeadline,
  createDeadline,
  dateKey,
  deadlineStatus,
  markReminder,
  payDeadline,
  updateDeadline,
} from "@/services/deadlines";
import { dt, dateTimeFr, METHODES } from "@/lib/format";

export function DeadlineDialog({
  credit,
  onClose,
  payment = false,
}: {
  credit?: Credit;
  onClose: () => void;
  payment?: boolean;
}) {
  const { state, run, teamFilter } = useApp();
  const L = useLookups();
  const inScope = useTeamScope();
  const { t } = useLanguage();
  const [form, setForm] = useState({
    clientId: credit?.clientId ?? "",
    teamId:
      credit?.teamId ??
      (teamFilter === "all" ? (state.teams.find((x) => x.active)?.id ?? "") : teamFilter),
    source: credit?.marketId
      ? `market:${credit.marketId}`
      : credit?.frigoId
        ? `frigo:${credit.frigoId}`
        : "",
    amount: credit?.totalAmount ?? 0,
    dueDate: credit?.dueDate ?? dateKey(new Date()),
    reminderDays: credit?.reminderDays ?? 3,
    notes: credit?.notes ?? "",
    reason: "",
  });
  const [pay, setPay] = useState(payment);
  const [amount, setAmount] = useState(credit?.remainingAmount ?? 0);
  const [method, setMethod] = useState<PaymentMethod>("ESPECES");
  const [cancel, setCancel] = useState(false);
  const field = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const inactive =
    credit && ["PAID", "CANCELLED"].includes(deadlineStatus(state, credit, dateKey(new Date())));
  const submit = () => {
    if (credit) {
      if (pay) {
        if (run(payDeadline, { creditId: credit.id, amount, method, notes: form.notes })) onClose();
      } else if (run(updateDeadline, { creditId: credit.id, ...form })) onClose();
    } else {
      const [kind, id] = form.source.split(":");
      if (
        run(createDeadline, {
          ...form,
          frigoId: kind === "frigo" ? id : undefined,
          marketId: kind === "market" ? id : undefined,
        })
      )
        onClose();
    }
  };
  return (
    <>
      <FormDialog
        open
        onOpenChange={onClose}
        title={t(pay ? "تحصيل سريع" : credit ? "إدارة الاستحقاق" : "استحقاق يدوي جديد")}
        onSubmit={inactive ? onClose : submit}
        submitLabel={t(inactive ? "إغلاق" : pay ? "حفظ الدفعة" : "حفظ")}
      >
        {credit && (
          <div className="flex flex-wrap justify-between gap-2 border-b pb-3">
            <b>{t(L.client.get(credit.clientId)?.name ?? "")}</b>
            <span>
              {t("المتبقي")}: <b>{dt(credit.remainingAmount)}</b>
            </span>
          </div>
        )}
        {pay && credit ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="المبلغ (د.ت)">
              <Input
                aria-label={t("المبلغ (د.ت)")}
                type="number"
                min="0.001"
                max={credit.remainingAmount}
                step="0.001"
                required
                inputMode="decimal"
                placeholder={t("مثال: 125.500")}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </Field>
            <Field label="طريقة الدفع">
              <NativeSelect
                aria-label={t("طريقة الدفع")}
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              >
                {METHODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {t(m.label)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAmount(credit.remainingAmount)}
            >
              {t("تسديد كامل المتبقي")}
            </Button>
            <Field label="ملاحظات">
              <Input
                maxLength={500}
                placeholder={t("مثال: دفعة نقداً")}
                value={form.notes}
                onChange={(e) => field("notes", e.target.value)}
              />
            </Field>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {!credit && (
              <>
                <Field label="العميل">
                  <NativeSelect
                    aria-label={t("العميل")}
                    required
                    value={form.clientId}
                    onChange={(e) => {
                      field("clientId", e.target.value);
                      field("source", "");
                    }}
                  >
                    <option value="">{t("اختر…")}</option>
                    {state.clients
                      .filter((x) => x.active)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {t(x.name)}
                        </option>
                      ))}
                  </NativeSelect>
                </Field>
                <Field label="غرفة التبريد">
                  <NativeSelect
                    aria-label={t("غرفة التبريد")}
                    required
                    value={form.teamId}
                    onChange={(e) => field("teamId", e.target.value)}
                  >
                    {state.teams
                      .filter((x) => x.active && inScope(x.id))
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {t(x.name)}
                        </option>
                      ))}
                  </NativeSelect>
                </Field>
                <Field label="غرفة التبريد / السوق" className="sm:col-span-2">
                  <NativeSelect
                    aria-label={t("غرفة التبريد / السوق")}
                    required
                    value={form.source}
                    onChange={(e) => field("source", e.target.value)}
                  >
                    <option value="">{t("اختر…")}</option>
                    {state.frigos
                      .filter((x) => x.active)
                      .map((x) => (
                        <option key={x.id} value={`frigo:${x.id}`}>
                          {t(x.name)}
                        </option>
                      ))}
                    {state.markets
                      .filter((x) => x.active && x.id === L.client.get(form.clientId)?.marketId)
                      .map((x) => (
                        <option key={x.id} value={`market:${x.id}`}>
                          {t(x.name)}
                        </option>
                      ))}
                  </NativeSelect>
                </Field>
              </>
            )}
            <Field label="المبلغ (د.ت)">
              <Input
                aria-label={t("المبلغ (د.ت)")}
                type="number"
                min={Math.max(credit?.paidAmount ?? 0, 0.001)}
                step="0.001"
                required
                inputMode="decimal"
                placeholder={t("مثال: 300.000")}
                value={form.amount || ""}
                disabled={!!credit?.saleId || !!inactive}
                onChange={(e) => field("amount", Number(e.target.value))}
              />
            </Field>
            <Field label="تاريخ الاستحقاق">
              <Input
                aria-label={t("تاريخ الاستحقاق")}
                type="date"
                required
                disabled={!!inactive}
                value={form.dueDate}
                onChange={(e) => field("dueDate", e.target.value)}
              />
            </Field>
            <Field label="التذكير قبل (أيام)">
              <Input
                aria-label={t("التذكير قبل (أيام)")}
                type="number"
                min="0"
                max="365"
                step="1"
                required
                inputMode="numeric"
                placeholder={t("مثال: 3")}
                disabled={!!inactive}
                value={form.reminderDays}
                onChange={(e) => field("reminderDays", Number(e.target.value))}
              />
            </Field>
            {credit && (
              <Field label="سبب التأجيل / الإلغاء">
                <Input
                  aria-label={t("سبب التأجيل / الإلغاء")}
                  required={credit.dueDate !== form.dueDate}
                  maxLength={200}
                  placeholder={t("مثال: طلب العميل")}
                  value={form.reason}
                  onChange={(e) => field("reason", e.target.value)}
                />
              </Field>
            )}
            <Field label="ملاحظات" className="sm:col-span-2">
              <Input
                aria-label={t("ملاحظات")}
                maxLength={500}
                placeholder={t("مثال: دين قديم قبل البرنامج")}
                disabled={!!inactive}
                value={form.notes}
                onChange={(e) => field("notes", e.target.value)}
              />
            </Field>
          </div>
        )}
        {credit && !inactive && (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button type="button" onClick={() => setPay(!pay)}>
              <Wallet className="size-4" />
              {t(pay ? "إدارة الاستحقاق" : "تحصيل سريع")}
            </Button>
            <Button type="button" variant="outline" onClick={() => run(markReminder, credit.id)}>
              <Bell className="size-4" />
              {t("تمت متابعة العميل")}
            </Button>
            {L.client.get(credit.clientId)?.phone && (
              <Button type="button" asChild variant="outline">
                <a href={`tel:${L.client.get(credit.clientId)?.phone}`}>
                  <Phone className="size-4" />
                  {t("اتصال")}
                </a>
              </Button>
            )}
            <Button type="button" variant="destructive" onClick={() => setCancel(true)}>
              <Ban className="size-4" />
              {t("إلغاء الاستحقاق")}
            </Button>
          </div>
        )}
        {!!credit?.reminderHistory?.length && (
          <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
            <b>{t("سجل المتابعة")}</b>
            {credit.reminderHistory.map((r) => (
              <p key={r.date}>
                {dateTimeFr(r.date)} · {t(L.user.get(r.userId)?.name ?? "")}
              </p>
            ))}
          </div>
        )}
      </FormDialog>
      <Confirm
        open={cancel}
        onOpenChange={setCancel}
        title={t("إلغاء الاستحقاق؟")}
        description="سيُلغى التذكير فقط، ويبقى الدين والمدفوعات في السجل المالي."
        onConfirm={() => {
          if (credit && run(cancelDeadline, credit.id, form.reason)) onClose();
        }}
      />
    </>
  );
}
