import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useApp } from "@/store/store";
import { packBalance, clientBoxBalance } from "@/services/ops";
import { PageHeader, Panel, Swatch } from "@/components/app/ui";

export const Route = createFileRoute("/_erp/emballages-soldes")({
  head: () => ({
    meta: [
      { title: "Soldes emballages clients — Frère Mahjoub" },
      {
        name: "description",
        content: "Emballages restants chez chaque client, par type et par Figo.",
      },
      { property: "og:title", content: "Soldes emballages clients — Frère Mahjoub" },
      {
        property: "og:description",
        content: "Emballages restants chez chaque client, par type et par Figo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Soldes,
});

function Soldes() {
  useLanguage();
  const { state, teamFilter } = useApp();
  const teams = state.teams.filter((t) => teamFilter === "all" || t.id === teamFilter);
  const types = state.packagingTypes.filter((t) => !t.clientOwned);
  // recherche par client (nom en arabe ou en français, code, téléphone)
  const [q, setQ] = useState("");
  const cherche = q.trim().toLowerCase();
  const clients = state.clients.filter(
    (c) =>
      !cherche ||
      [translate(c.name, "ar"), translate(c.name, "fr"), c.code, c.phone]
        .join(" ")
        .toLowerCase()
        .includes(cherche),
  );
  return (
    <div>
      <PageHeader
        title={translate("أرصدة صناديق العملاء")}
        subtitle={translate("الرصيد حسب العميل والنوع وفريق فيغو، دون دمج")}
      />
      <Panel>
        <div className="relative mb-3 sm:w-72">
          <Search className="absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="ps-8"
            placeholder={translate("بحث عن عميل…")}
            aria-label={translate("بحث عن عميل…")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2 text-start">{<Text>{"العميل"}</Text>}</th>
                <th className="p-2 text-start">{<Text>{"فيغو"}</Text>}</th>
                {types.map((t) => (
                  <th key={t.id} className="p-2 text-end">
                    <span className="inline-flex items-center gap-1.5">
                      <Swatch hex={t.hex} />
                      {translate(t.color ?? "")}
                    </span>
                  </th>
                ))}
                <th className="p-2 text-end">{<Text>{"الإجمالي"}</Text>}</th>
                <th className="p-2 text-end">{<Text>{"صناديق العميل عندنا"}</Text>}</th>
              </tr>
            </thead>
            <tbody>
              {clients.flatMap((c) =>
                teams.map((t) => {
                  const tot = packBalance(state, { clientId: c.id, teamId: t.id });
                  const own = clientBoxBalance(state, { clientId: c.id, teamId: t.id });
                  if (!tot.given && !own.received) return null;
                  return (
                    <tr key={c.id + t.id} className="border-t">
                      <td className="p-2 font-medium">
                        <Link
                          to="/clients/$id"
                          params={{ id: c.id }}
                          className="hover:text-primary"
                        >
                          {translate(c.name ?? "")}
                        </Link>
                      </td>
                      <td className="p-2">{translate(t.name ?? "")}</td>
                      {types.map((pt) => {
                        const b = packBalance(state, {
                          clientId: c.id,
                          typeId: pt.id,
                          teamId: t.id,
                        });
                        return (
                          <td
                            key={pt.id}
                            className="p-2 text-end"
                            title={`${translate("الصادر")} ${b.given} · ${translate("المرتجع")} ${b.returned}`}
                          >
                            {b.remaining || "—"}
                          </td>
                        );
                      })}
                      <td className="p-2 text-end font-semibold">
                        <span className="inline-flex items-center gap-1">
                          {tot.remaining >= state.settings.packagingAlert && (
                            <AlertTriangle className="size-4 text-warning" />
                          )}
                          {tot.remaining}
                        </span>
                      </td>
                      <td
                        className="p-2 text-end"
                        title={`${translate("المستلمة")} ${own.received} · ${translate("المُرجعة")} ${own.returned}`}
                      >
                        {own.owed || "—"}
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
