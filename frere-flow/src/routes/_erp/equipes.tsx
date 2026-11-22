import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { UsersRound } from "lucide-react";
import { useApp } from "@/store/store";
import { PageHeader, Status } from "@/components/app/ui";
import { dt } from "@/lib/format";

export const Route = createFileRoute("/_erp/equipes")({
  head: () => ({
    meta: [
      { title: "Équipes / Figos — Frère Mahjoub" },
      { name: "description", content: "Performance comparée de Figo 1 et Figo 2." },
      { property: "og:title", content: "Équipes / Figos — Frère Mahjoub" },
      { property: "og:description", content: "Performance comparée de Figo 1 et Figo 2." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Equipes,
});

function Equipes() {
  useLanguage();
  const { state } = useApp();
  return (
    <div>
      <PageHeader
        title={translate("الفرق / فيغو")}
        subtitle={translate("مبيعات وديون ومدفوعات مستقلة لكل فريق فيغو")}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {state.teams.map((t) => {
          const sales = state.sales.filter(
            (s) => s.teamId === t.id && s.saleStatusId !== "ss_cancelled",
          );
          const credits = state.credits.filter(
            (c) =>
              c.teamId === t.id && c.remainingAmount > 0 && c.creditStatusId !== "cs_cancelled",
          );
          const paid = [...state.payments, ...state.creditPayments]
            .filter((p) => p.teamId === t.id)
            .reduce((a, p) => a + p.amount, 0);
          const cash = state.cash
            .filter((c) => c.teamId === t.id)
            .reduce((a, c) => a + (c.type === "ENCAISSEMENT" ? c.amount : -c.amount), 0);
          const clients = new Set(sales.map((s) => s.clientId)).size;
          const members = state.users.filter((u) => u.teamId === t.id);
          return (
            <div key={t.id} className="rounded-xl border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-hero text-primary-foreground">
                    <UsersRound className="size-5" />
                  </span>
                  <div>
                    <p className="font-display text-lg font-semibold">{translate(t.name ?? "")}</p>
                    <p className="text-xs text-muted-foreground">
                      {translate(t.description ?? "")}
                      {<Text>{" · المسؤول: "}</Text>}
                      {t.responsable}
                    </p>
                  </div>
                </div>
                <Status value={t.active ? "ON" : "OFF"} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                {[
                  [translate("المبيعات"), sales.length],
                  [translate("رقم المعاملات"), dt(sales.reduce((a, s) => a + s.totalAmount, 0))],
                  [translate("المقبوض"), dt(paid)],
                  [
                    translate("الديون المفتوحة"),
                    `${credits.length} · ${dt(credits.reduce((a, c) => a + c.remainingAmount, 0))}`,
                  ],
                  [translate("رصيد الصندوق المالي"), dt(cash)],
                  [translate("العملاء المخدومون"), clients],
                ].map(([k, v]) => (
                  <div key={String(k)} className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <p className="font-semibold">{v}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                {<Text>{"الأعضاء: "}</Text>}
                {members.map((m) => translate(m.name ?? "")).join(", ") || "—"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
