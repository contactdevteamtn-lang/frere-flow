import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  isSameMonth,
} from "date-fns";
import { arTN, fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Credit } from "@/types";
import { useLanguage } from "@/lib/i18n";
import { useApp, useLookups } from "@/store/store";
import { dateKey, deadlineSource, deadlineStatus } from "@/services/deadlines";
import { dt, num } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const deadlineTone = {
  OVERDUE: "border-destructive/30 bg-destructive/10 text-destructive",
  SOON: "border-warning/40 bg-warning/15 text-warning-foreground",
  PAID: "border-success/30 bg-secondary text-primary-dark",
  UPCOMING: "border-border bg-muted text-foreground",
  CANCELLED: "border-border bg-muted text-muted-foreground line-through",
};
export function DeadlineCalendar({
  rows,
  anchor,
  onAnchor,
  week,
  onSelect,
}: {
  rows: Credit[];
  anchor: Date;
  onAnchor: (d: Date) => void;
  week: boolean;
  onSelect: (c: Credit) => void;
}) {
  const { language, t } = useLanguage();
  const { state } = useApp();
  const L = useLookups();
  const today = dateKey(new Date());
  const start = startOfWeek(week ? anchor : startOfMonth(anchor), { weekStartsOn: 1 });
  const end = endOfWeek(week ? anchor : endOfMonth(anchor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const locale = language === "ar" ? arTN : fr;
  const move = (n: number) => onAnchor(week ? addWeeks(anchor, n) : addMonths(anchor, n));
  return (
    <section className="border bg-card rounded-lg" aria-label={t("تقويم الاستحقاقات")}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <h2 className="text-lg font-semibold">
          {week
            ? `${format(start, "d MMM", { locale })} – ${format(end, "d MMM yyyy", { locale })}`
            : format(anchor, "MMMM yyyy", { locale })}
        </h2>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="outline"
            aria-label={t("الفترة السابقة")}
            title={t("الفترة السابقة")}
            onClick={() => move(-1)}
          >
            <ChevronLeft className="size-4 rtl:rotate-180" />
          </Button>
          <Button variant="outline" onClick={() => onAnchor(new Date())}>
            {t("اليوم")}
          </Button>
          <Button
            size="icon"
            variant="outline"
            aria-label={t("الفترة التالية")}
            title={t("الفترة التالية")}
            onClick={() => move(1)}
          >
            <ChevronRight className="size-4 rtl:rotate-180" />
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[770px]">
          <div className="grid grid-cols-7 border-b bg-muted/60">
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className="px-2 py-3 text-center text-xs font-semibold text-muted-foreground"
              >
                {format(addDays(start, i), "EEEE", { locale })}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = dateKey(day);
              const items = rows.filter((c) => c.dueDate === key);
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-36 min-w-0 border-b border-e p-2",
                    !week && !isSameMonth(day, anchor) && "bg-muted/40",
                    key === today && "bg-accent/30",
                  )}
                >
                  <p
                    className={cn(
                      "mb-2 text-xs font-semibold",
                      key === today ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {num(day.getDate())}
                  </p>
                  <div className="space-y-1.5">
                    {items.map((c) => {
                      const source = deadlineSource(state, c);
                      return (
                        <Button
                          key={c.id}
                          variant="outline"
                          onClick={() => onSelect(c)}
                          className={cn(
                            "h-auto w-full min-w-0 items-start flex-col gap-0.5 whitespace-normal rounded-md px-2 py-1.5 text-start text-xs",
                            deadlineTone[deadlineStatus(state, c, today)],
                          )}
                        >
                          <span className="w-full break-words font-semibold">
                            {t(L.client.get(c.clientId)?.name ?? "—")}
                          </span>
                          <span className="w-full break-words">
                            {dt(c.remainingAmount || c.totalAmount)}
                          </span>
                          <span className="w-full break-words text-[10px]">
                            {source.marketId
                              ? t(L.market.get(source.marketId)?.name ?? "")
                              : source.frigoIds
                                  .map((id) => t(L.frigo.get(id)?.name ?? ""))
                                  .join(" / ") || t("يدوي")}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
