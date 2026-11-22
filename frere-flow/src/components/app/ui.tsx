import { Text, translate, useLanguage } from "@/lib/i18n";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  useLanguage();
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-foreground md:text-3xl">{translate(title)}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{translate(subtitle)}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  useLanguage();
  return (
    <section className={cn("rounded-xl border bg-card shadow-card", className)}>
      {title && (
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Kpi({
  label,
  value,
  icon: Icon,
  hint,
  tone = "primary",
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: string;
  tone?: "primary" | "leaf" | "warning" | "destructive";
}) {
  useLanguage();
  const tones = {
    primary: "bg-secondary text-primary",
    leaf: "bg-accent text-primary-dark",
    warning: "bg-warning/15 text-warning-foreground",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {translate(label)}
          </p>
          <p className="mt-2 truncate font-display text-xl font-semibold text-foreground md:text-2xl">
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{translate(hint)}</p>}
        </div>
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", tones[tone])}>
          <Icon className="size-5" />
        </span>
      </div>
    </div>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: translate("قيد الانتظار"), cls: "bg-warning/15 text-warning-foreground" },
  CONFIRMED: { label: translate("مؤكدة"), cls: "bg-accent text-accent-foreground" },
  PAID: { label: translate("المدفوع"), cls: "bg-secondary text-primary-dark" },
  PARTIAL: { label: translate("جزئي"), cls: "bg-warning/15 text-warning-foreground" },
  CANCELLED: { label: translate("ملغى"), cls: "bg-muted text-muted-foreground line-through" },
  ACTIVE: { label: translate("نشط"), cls: "bg-accent text-accent-foreground" },
  OVERDUE: { label: translate("متأخر"), cls: "bg-destructive/10 text-destructive" },
  SORTIE: { label: translate("خروج"), cls: "bg-warning/15 text-warning-foreground" },
  RETOUR: { label: translate("إرجاع"), cls: "bg-secondary text-primary-dark" },
  ENTREE: { label: translate("إدخال"), cls: "bg-secondary text-primary-dark" },
  TRANSFERT: { label: translate("نقل"), cls: "bg-accent text-accent-foreground" },
  AJUSTEMENT: { label: translate("تسوية"), cls: "bg-muted text-foreground" },
  ENCAISSEMENT: { label: translate("قبض"), cls: "bg-secondary text-primary-dark" },
  DECAISSEMENT: { label: translate("صرف"), cls: "bg-destructive/10 text-destructive" },
  OPEN: { label: translate("جارية"), cls: "bg-warning/15 text-warning-foreground" },
  CLOSED: { label: translate("مغلقة"), cls: "bg-secondary text-primary-dark" },
  ON: { label: translate("نشط"), cls: "bg-secondary text-primary-dark" },
  OFF: { label: translate("غير نشط"), cls: "bg-muted text-muted-foreground" },
  FAIBLE: { label: translate("مخزون منخفض"), cls: "bg-destructive/10 text-destructive" },
  OK: { label: translate("متوفر"), cls: "bg-secondary text-primary-dark" },
};

export function Status({ value, label }: { value: string; label?: string }) {
  useLanguage();
  const s = STATUS[value] ?? { label: value, cls: "bg-muted text-muted-foreground" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        s.cls,
      )}
    >
      {translate(label ?? s.label)}
    </span>
  );
}

export function Empty({ text = translate("لا توجد بيانات حالياً") }: { text?: string }) {
  useLanguage();
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
      <Inbox className="size-8 opacity-50" />
      <p className="text-sm">{translate(text)}</p>
    </div>
  );
}

export function Loading() {
  useLanguage();
  return (
    <div className="flex items-center justify-center py-12 text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
    </div>
  );
}

export function Swatch({ hex }: { hex: string }) {
  useLanguage();
  return (
    <span className="inline-block size-3.5 rounded-full border" style={{ backgroundColor: hex }} />
  );
}

export const thCls = "text-xs uppercase tracking-wide text-muted-foreground";
