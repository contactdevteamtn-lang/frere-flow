import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useApp, useLookups } from "@/store/store";
import { DataTable } from "@/components/app/DataTable";
import { NativeSelect } from "@/components/app/forms";
import { PageHeader, Panel } from "@/components/app/ui";
import { dateTimeFr } from "@/lib/format";

export const Route = createFileRoute("/_erp/historique")({
  head: () => ({
    meta: [
      { title: "Historique — Frère Mahjoub" },
      { name: "description", content: "Journal d'audit de toutes les actions importantes." },
      { property: "og:title", content: "Historique — Frère Mahjoub" },
      { property: "og:description", content: "Journal d'audit de toutes les actions importantes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Historique,
});

function Historique() {
  useLanguage();
  const { state } = useApp();
  const L = useLookups();
  const [entity, setEntity] = useState("all");
  const [user, setUser] = useState("all");
  const entities = [...new Set(state.auditLogs.map((l) => l.entity))];
  const rows = state.auditLogs.filter(
    (l) => (entity === "all" || l.entity === entity) && (user === "all" || l.userId === user),
  );
  return (
    <div>
      <PageHeader
        title={translate("سجل العمليات / التدقيق")}
        subtitle={translate(`${state.auditLogs.length} عملية مسجلة`)}
      />
      <Panel>
        <DataTable
          rows={rows}
          pageSize={15}
          search={(l) => `${l.action} ${l.details}`}
          filters={
            <>
              <NativeSelect
                className="sm:w-44"
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
              >
                <option value="all">{<Text>{"كل الكيانات"}</Text>}</option>
                {entities.map((e) => (
                  <option key={e}>{e}</option>
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
            { header: translate("التاريخ"), cell: (l) => dateTimeFr(l.date), sort: (l) => l.date },
            {
              header: translate("المستخدم"),
              cell: (l) => L.user.get(l.userId)?.name ?? translate("النظام"),
            },
            {
              header: translate("الإجراء"),
              cell: (l) => <span className="font-medium">{translate(l.action ?? "")}</span>,
            },
            { header: translate("الكيان"), cell: (l) => l.entity },
            {
              header: translate("التفاصيل"),
              cell: (l) => (
                <span className="text-muted-foreground">{translate(l.details ?? "")}</span>
              ),
              className: "whitespace-normal",
            },
          ]}
        />
      </Panel>
    </div>
  );
}
