import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  Plus,
  CalendarDays,
  List,
  Bell,
  Phone,
  Check,
  CalendarClock,
  Pencil,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, Edit } from "@/components/app/forms";
import { isMarketCredit } from "@/services/ops";
import { PageHeader, Empty } from "@/components/app/ui";
import { DataTable } from "@/components/app/DataTable";
import { useApp, useLookups, useTeamScope } from "@/store/store";
import { useLanguage } from "@/lib/i18n";
import { dateFr, dt, num } from "@/lib/format";
import {
  dateKey,
  deadlineSource,
  deadlineStatus,
  markReminder,
  remindersToday,
} from "@/services/deadlines";
import { DeadlineCalendar, deadlineTone } from "@/components/deadlines/DeadlineCalendar";
import { DeadlineDialog } from "@/components/deadlines/DeadlineDialog";
import type { Credit } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_erp/echeances")({
  head: () => ({
    meta: [
      { title: "Calendrier des Échéances — Frère Mahjoub" },
      {
        name: "description",
        content: "Échéances clients, rappels, crédits et encaissements par frigo et marché.",
      },
      { property: "og:title", content: "Calendrier des Échéances — Frère Mahjoub" },
      {
        property: "og:description",
        content: "Suivi des échéances, engagements de paiement et relances clients.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Deadlines,
});
const labels = {
  OVERDUE: "متأخر",
  SOON: "خلال 3 أيام",
  UPCOMING: "قادم",
  PAID: "مسددة",
  CANCELLED: "ملغى",
};
function Deadlines() {
  const { t } = useLanguage();
  const { state, run, can, readOnly } = useApp();
  const L = useLookups();
  const inScope = useTeamScope();
  const [view, setView] = useState<"month" | "week" | "list">("month");
  const [anchor, setAnchor] = useState(new Date());
  const [frigo, setFrigo] = useState("all");
  const [market, setMarket] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ credit?: Credit; payment?: boolean } | null>(null);
  const today = dateKey(new Date());
  const sourceLabel = (c: Credit) => {
    const src = deadlineSource(state, c);
    return (
      [
        src.marketId ? t(L.market.get(src.marketId)?.name ?? "") : "",
        ...src.frigoIds.map((id) => t(L.frigo.get(id)?.name ?? "")),
      ]
        .filter(Boolean)
        .join(" / ") || t("يدوي")
    );
  };
  const all = state.credits
    .filter((c) => inScope(c.teamId) && (can("marches") || !isMarketCredit(state, c)))
    .filter((c) => {
      const src = deadlineSource(state, c);
      const cl = L.client.get(c.clientId);
      return (
        (frigo === "all" || src.frigoIds.includes(frigo)) &&
        (market === "all" || src.marketId === market) &&
        `${t(cl?.name ?? "")} ${cl?.phone ?? ""} ${cl?.code ?? ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      );
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const rows = all.filter((c) => {
    const code = deadlineStatus(state, c, today);
    return status === "all"
      ? code !== "CANCELLED"
      : status === "upcoming"
        ? ["SOON", "UPCOMING"].includes(code)
        : code === status;
  });
  const reminders = remindersToday(state, all, today);
  const writable = can("credits");
  const open = (c: Credit, payment = false) => {
    if (writable && !readOnly) setDialog({ credit: c, payment });
  };
  const badge = (c: Credit) => {
    const code = deadlineStatus(state, c, today);
    return (
      <span className={cn("inline-flex rounded-md border px-2 py-1 text-xs", deadlineTone[code])}>
        {t(labels[code])}
      </span>
    );
  };
  if (!writable) return <Empty />;
  return (
    <div className="space-y-5">
      <PageHeader
        title="تقويم الاستحقاقات والتذكيرات"
        actions={
          <Edit>
            <Button onClick={() => setDialog({})}>
              <Plus className="size-4" />
              {t("استحقاق يدوي جديد")}
            </Button>
          </Edit>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <NativeSelect
          aria-label={t("غرفة التبريد")}
          value={frigo}
          onChange={(e) => setFrigo(e.target.value)}
        >
          <option value="all">{t("كل غرف التبريد")}</option>
          {state.frigos.map((f) => (
            <option key={f.id} value={f.id}>
              {t(f.name)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t("السوق")}
          value={market}
          onChange={(e) => setMarket(e.target.value)}
        >
          <option value="all">{t("كل الأسواق")}</option>
          {state.markets.map((m) => (
            <option key={m.id} value={m.id}>
              {t(m.name)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t("الحالة")}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">{t("الكل")}</option>
          <option value="upcoming">{t("قادم")}</option>
          <option value="OVERDUE">{t("متأخر")}</option>
          <option value="PAID">{t("مسددة")}</option>
          <option value="CANCELLED">{t("ملغى")}</option>
        </NativeSelect>
        <Input
          aria-label={t("بحث العميل")}
          placeholder={t("بحث العميل")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <section className="border-y py-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Bell className="size-4 text-warning-foreground" />
          {t("تذكيرات ومتابعات اليوم")}{" "}
          <span className="text-muted-foreground">({num(reminders.length)})</span>
        </h2>
        {reminders.length ? (
          <div className="max-h-72 overflow-y-auto divide-y">
            {reminders.map((c) => (
              <div
                key={c.id}
                className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <b className="break-words">{t(L.client.get(c.clientId)?.name ?? "—")}</b>
                  <p className="text-xs text-muted-foreground">
                    {dateFr(c.dueDate)} · {sourceLabel(c)} · {dt(c.remainingAmount)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    title={t("تمت متابعة العميل")}
                    aria-label={t("تمت متابعة العميل")}
                    onClick={() => run(markReminder, c.id)}
                  >
                    <Check className="size-4" />
                  </Button>
                  {L.client.get(c.clientId)?.phone && (
                    <Button size="icon" variant="outline" asChild>
                      <a
                        aria-label={t("اتصال")}
                        title={t("اتصال")}
                        href={`tel:${L.client.get(c.clientId)?.phone}`}
                      >
                        <Phone className="size-4" />
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => open(c)}>
                    <CalendarClock className="size-4" />
                    {t("التزام بالدفع")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-3 text-sm text-muted-foreground">{t("لا توجد متابعات اليوم")}</p>
        )}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label={t("طريقة العرض")}>
          {(["month", "week", "list"] as const).map((v) => (
            <Button
              key={v}
              variant={view === v ? "default" : "outline"}
              onClick={() => setView(v)}
              aria-pressed={view === v}
            >
              {v === "list" ? <List className="size-4" /> : <CalendarDays className="size-4" />}
              {t(v === "month" ? "شهر" : v === "week" ? "أسبوع" : "قائمة / أجندة")}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          {(["OVERDUE", "SOON", "PAID"] as const).map((code) => (
            <span key={code} className={cn("rounded-md border px-2 py-1", deadlineTone[code])}>
              {t(labels[code])}
            </span>
          ))}
        </div>
      </div>
      {view !== "list" ? (
        <DeadlineCalendar
          rows={rows}
          anchor={anchor}
          onAnchor={setAnchor}
          week={view === "week"}
          onSelect={(c) => open(c)}
        />
      ) : (
        <DataTable
          rows={rows}
          pageSize={15}
          columns={[
            { header: "تاريخ الاستحقاق", cell: (c) => dateFr(c.dueDate) },
            { header: "العميل", cell: (c) => t(L.client.get(c.clientId)?.name ?? "—") },
            {
              header: "الهاتف",
              cell: (c) => <span dir="ltr">{L.client.get(c.clientId)?.phone || "—"}</span>,
            },
            { header: "غرفة التبريد / السوق", cell: sourceLabel },
            { header: "الإجمالي", cell: (c) => dt(c.totalAmount) },
            { header: "المتبقي", cell: (c) => dt(c.remainingAmount) },
            { header: "الحالة", cell: badge },
            {
              header: "أيام التأخير",
              cell: (c) =>
                num(
                  deadlineStatus(state, c, today) === "OVERDUE"
                    ? Math.max(0, differenceInCalendarDays(parseISO(today), parseISO(c.dueDate)))
                    : 0,
                ),
            },
            {
              header: "الإجراءات",
              cell: (c) => (
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t("إدارة الاستحقاق")}
                    title={t("إدارة الاستحقاق")}
                    onClick={() => open(c)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  {!["PAID", "CANCELLED"].includes(deadlineStatus(state, c, today)) && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t("تحصيل سريع")}
                        title={t("تحصيل سريع")}
                        onClick={() => open(c, true)}
                      >
                        <Wallet className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t("تمت متابعة العميل")}
                        title={t("تمت متابعة العميل")}
                        onClick={() => run(markReminder, c.id)}
                      >
                        <Bell className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}
      {dialog && (
        <DeadlineDialog
          credit={dialog.credit}
          payment={dialog.payment}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
