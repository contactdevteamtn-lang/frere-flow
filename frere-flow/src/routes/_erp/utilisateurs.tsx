import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  Pencil,
  ShieldCheck,
  Check,
  Trash2,
  RotateCcw,
  MonitorSmartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp, useLookups } from "@/store/store";
import { upsert } from "@/services/ops";
import { ALL_PERMS } from "@/mock/seed";
import type { PermissionKey, Role, SecMode, User } from "@/types";
import { DataTable } from "@/components/app/DataTable";
import { Field, FormDialog, NativeSelect, NomAutreLangue } from "@/components/app/forms";
import { PageHeader, Panel, Status } from "@/components/app/ui";
import { dateFr } from "@/lib/format";

export const Route = createFileRoute("/_erp/utilisateurs")({
  head: () => ({
    meta: [
      { title: "Utilisateurs & rôles — Frère Mahjoub" },
      { name: "description", content: "Gestion des utilisateurs, rôles et permissions." },
      { property: "og:title", content: "Utilisateurs & rôles — Frère Mahjoub" },
      { property: "og:description", content: "Gestion des utilisateurs, rôles et permissions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Admin,
});

const PERM_LABEL: Record<PermissionKey, string> = {
  dashboard: translate("لوحة المتابعة"),
  clients: translate("العملاء"),
  produits: translate("المنتجات"),
  ventes: translate("المبيعات"),
  credits: translate("الديون"),
  paiements: translate("المدفوعات"),
  caisse: translate("إدارة الصندوق المالي"),
  stock: translate("المخزون"),
  frigos: translate("إدارة غرف التبريد"),
  emballages: translate("الصناديق"),
  equipes: translate("الفرق"),
  rapports: translate("التقارير"),
  administration: translate("الإدارة"),
  historique: translate("السجل"),
  parametres: translate("الإعدادات"),
  marches: translate("الأسواق"),
  lecture: translate("اطلاع فقط (بدون تعديل)"),
};

type UDraft = Omit<User, "id"> & { id?: string };

/** Modes de sécurité de la connexion : nom + explication simple pour le directeur */
const SEC_MODES: { value: SecMode; label: string; aide: string }[] = [
  { value: "none", label: "كلمة المرور فقط", aide: "الأبسط: البريد الإلكتروني وكلمة المرور فقط." },
  {
    value: "totp",
    label: "رمز من تطبيق الهاتف (الأكثر أماناً)",
    aide: "عند أول دخول يمسح المستخدم رمز QR بتطبيق Google Authenticator المجاني، ثم يكتب في كل دخول الرمز المكوّن من 6 أرقام الظاهر على هاتفه. يعمل حتى بدون إنترنت على الهاتف.",
  },
  {
    value: "pin",
    label: "رمز PIN شخصي",
    aide: "عند أول دخول يختار المستخدم رمزاً من 4 إلى 6 أرقام، ويُطلب منه بعد كلمة المرور في كل دخول.",
  },
  {
    value: "email",
    label: "رمز يُرسل بالبريد",
    aide: "في كل دخول يصل رمز من 6 أرقام إلى بريد المستخدم، صالح 10 دقائق.",
  },
  {
    value: "device",
    label: "أجهزة معتمدة فقط",
    aide: "لا يمكن الدخول إلا من الحواسيب والهواتف التي توافق عليها. عند الدخول من جهاز جديد يظهر هنا في انتظار موافقتك.",
  },
];
const modeLabel = (m?: SecMode) => SEC_MODES.find((x) => x.value === (m ?? "none"))?.label ?? "";

function Admin() {
  useLanguage();
  const { state, run, securite, emailDisponible } = useApp();
  const L = useLookups();
  const [u, setU] = useState<UDraft | null>(null);
  const enAttente = state.users.flatMap((x) =>
    (x.devices ?? []).filter((d) => d.status === "pending").map((d) => ({ user: x, d })),
  );
  const live = u?.id ? state.users.find((x) => x.id === u.id) : undefined;
  const [r, setR] = useState<(Omit<Role, "id"> & { id?: string }) | null>(null);

  return (
    <div>
      <PageHeader
        title={translate("المستخدمون والأدوار")}
        subtitle={translate("يمكن للمستخدم امتلاك دور واحد أو عدة أدوار")}
      />
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">{<Text>{"المستخدمون"}</Text>}</TabsTrigger>
          <TabsTrigger value="roles">{<Text>{"الأدوار"}</Text>}</TabsTrigger>
          <TabsTrigger value="perms">{<Text>{"الصلاحيات"}</Text>}</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="pt-4">
          {enAttente.length > 0 && (
            <Panel
              title={
                <span className="flex items-center gap-2">
                  <MonitorSmartphone className="size-4 text-primary" />
                  {translate("أجهزة في انتظار موافقتك")}
                </span>
              }
              className="mb-4"
            >
              <div className="space-y-2">
                {enAttente.map(({ user, d }) => (
                  <div
                    key={user.id + d.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm"
                  >
                    <span>
                      <b>{translate(user.name)}</b> · {d.name} ·{" "}
                      <span className="text-muted-foreground">
                        {dateFr(d.createdAt)}
                        {d.ip ? ` · ${d.ip}` : ""}
                      </span>
                    </span>
                    <span className="flex gap-2">
                      <Button size="sm" onClick={() => void securite(user.id, "approuver", d.id)}>
                        <Check className="size-4" />
                        {translate("موافقة")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void securite(user.id, "retirer", d.id)}
                      >
                        <Trash2 className="size-4" />
                        {translate("رفض")}
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          <Panel action={null}>
            <div className="mb-3 flex justify-end">
              <Button
                onClick={() =>
                  setU({
                    name: "",
                    email: "",
                    phone: "",
                    password: "",
                    active: true,
                    createdAt: new Date().toISOString(),
                    roleIds: ["role_lecture"],
                    secMode: "none",
                  })
                }
              >
                <Plus className="size-4" />
                {<Text>{" مستخدم جديد"}</Text>}
              </Button>
            </div>
            <DataTable
              rows={state.users}
              search={(x) => `${translate(x.name ?? "")} ${x.email}`}
              columns={[
                {
                  header: translate("الاسم"),
                  cell: (x) => <span className="font-medium">{translate(x.name ?? "")}</span>,
                  sort: (x) => x.name,
                },
                { header: translate("البريد الإلكتروني"), cell: (x) => x.email },
                { header: translate("الهاتف"), cell: (x) => x.phone },
                {
                  header: translate("الأدوار"),
                  cell: (x) =>
                    x.roleIds.map((id) => state.roles.find((y) => y.id === id)?.name).join(", "),
                },
                {
                  header: translate("غرفة التبريد"),
                  cell: (x) => (x.teamId ? L.team.get(x.teamId)?.name : "—"),
                },
                { header: translate("تاريخ الإنشاء"), cell: (x) => dateFr(x.createdAt) },
                {
                  header: translate("حماية الدخول"),
                  cell: (x) => (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      {(x.secMode ?? "none") !== "none" && (
                        <ShieldCheck className="size-3.5 text-primary" />
                      )}
                      {translate(modeLabel(x.secMode))}
                      {x.passwordInitial && (
                        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning-foreground">
                          {translate("كلمة مرور أولية")}
                        </span>
                      )}
                    </span>
                  ),
                },
                {
                  header: translate("الحالة"),
                  cell: (x) => <Status value={x.active ? "ON" : "OFF"} />,
                },
                {
                  header: "",
                  cell: (x) => (
                    <Button size="icon" variant="ghost" onClick={() => setU(x)}>
                      <Pencil className="size-4" />
                    </Button>
                  ),
                },
              ]}
            />
          </Panel>
        </TabsContent>
        <TabsContent value="roles" className="grid gap-4 pt-4 md:grid-cols-3">
          {state.roles.map((role) => (
            <div key={role.id} className="rounded-xl border bg-card p-5 shadow-card">
              <div className="flex justify-between">
                <p className="font-display font-semibold">{translate(role.name ?? "")}</p>
                <Button size="icon" variant="ghost" onClick={() => setR(role)}>
                  <Pencil className="size-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{translate(role.description ?? "")}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {state.users.filter((x) => x.roleIds.includes(role.id)).length}
                {<Text>{" مستخدم · "}</Text>}
                {role.permissions.length}
                {<Text>{" صلاحيات"}</Text>}
              </p>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="perms" className="pt-4">
          <Panel>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2 text-start">{<Text>{"القسم"}</Text>}</th>
                    {state.roles.map((x) => (
                      <th key={x.id} className="p-2 text-center">
                        {translate(x.name ?? "")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ALL_PERMS.map((p) => (
                    <tr key={p} className="border-t">
                      <td className="p-2">{PERM_LABEL[p]}</td>
                      {state.roles.map((role) => (
                        <td key={role.id} className="p-2 text-center">
                          <Checkbox
                            checked={role.permissions.includes(p)}
                            disabled={role.id === "role_super"}
                            onCheckedChange={(v) =>
                              run(upsert, "roles", {
                                ...role,
                                permissions: v
                                  ? [...role.permissions, p]
                                  : role.permissions.filter((x) => x !== p),
                              })
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
      {u && (
        <FormDialog
          open
          onOpenChange={() => setU(null)}
          title={u.id ? translate("تعديل المستخدم") : translate("مستخدم جديد")}
          onSubmit={() =>
            u.name && u.email && u.roleIds.length && run(upsert, "users", u) && setU(null)
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={translate("الاسم")}>
              <Input
                required
                maxLength={80}
                autoComplete="off"
                placeholder={translate("مثال: سامي الطرابلسي")}
                value={u.name}
                onChange={(e) => setU({ ...u, name: e.target.value })}
              />
            </Field>
            <NomAutreLangue
              name={u.name}
              value={u.nameAlt}
              onChange={(v) => setU({ ...u, nameAlt: v })}
            />
            <Field label={translate("البريد الإلكتروني")}>
              <Input
                type="email"
                required
                inputMode="email"
                maxLength={120}
                dir="ltr"
                placeholder={translate("مثال: prenom@frere-mahjoub.tn")}
                value={u.email}
                onChange={(e) => setU({ ...u, email: e.target.value })}
              />
            </Field>
            <Field label={translate("الهاتف")}>
              <Input
                type="tel"
                inputMode="tel"
                maxLength={20}
                dir="ltr"
                placeholder={translate("مثال: 98 123 456")}
                value={u.phone}
                onChange={(e) => setU({ ...u, phone: e.target.value })}
              />
            </Field>
            <Field label={translate("كلمة المرور")}>
              <Input
                type="password"
                autoComplete="new-password"
                maxLength={72}
                dir="ltr"
                required={!u.id}
                placeholder={translate("8 أحرف مع أرقام، مثال: Ferme2026 (فارغ = بدون تغيير)")}
                value={u.password}
                onChange={(e) => setU({ ...u, password: e.target.value })}
              />
            </Field>
            <Field label={translate("غرفة التبريد المرتبط")}>
              <NativeSelect
                value={u.teamId ?? ""}
                onChange={(e) => setU({ ...u, teamId: e.target.value || undefined })}
              >
                <option value="">{<Text>{"بدون (الكل)"}</Text>}</option>
                {state.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {translate(t.name ?? "")}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={translate("نشط")}>
              <div className="pt-1.5">
                <Switch checked={u.active} onCheckedChange={(v) => setU({ ...u, active: v })} />
              </div>
            </Field>
            <Field label={translate("وضع حماية الدخول")} className="sm:col-span-2">
              <NativeSelect
                aria-label={translate("وضع حماية الدخول")}
                value={u.secMode ?? "none"}
                onChange={(e) => setU({ ...u, secMode: e.target.value as SecMode })}
              >
                {SEC_MODES.map((m) => (
                  <option
                    key={m.value}
                    value={m.value}
                    disabled={m.value === "email" && !emailDisponible && live?.secMode !== "email"}
                  >
                    {translate(m.label)}
                    {m.value === "email" && !emailDisponible
                      ? ` (${translate("غير مهيأ على الخادم")})`
                      : ""}
                  </option>
                ))}
              </NativeSelect>
              <p className="mt-1.5 rounded-lg bg-mint/60 p-2.5 text-xs text-muted-foreground">
                {translate(SEC_MODES.find((m) => m.value === (u.secMode ?? "none"))?.aide ?? "")}
              </p>
            </Field>
            {live && (live.secMode ?? "none") !== "none" && live.secMode === u.secMode && (
              <div className="space-y-2 rounded-lg border p-3 text-sm sm:col-span-2">
                {(live.secMode === "totp" || live.secMode === "pin") && (
                  <p>
                    {translate(
                      live.secSetup
                        ? "مُفعّل: سبق للمستخدم إعداده."
                        : "لم يُعدّ بعد: سيُطلب منه ذلك عند دخوله القادم.",
                    )}
                  </p>
                )}
                {live.secMode === "device" && (
                  <div className="space-y-1.5">
                    {!(live.devices ?? []).length && (
                      <p className="text-muted-foreground">
                        {translate("لا توجد أجهزة بعد: أول دخول للمستخدم سيظهر هنا للموافقة.")}
                      </p>
                    )}
                    {(live.devices ?? []).map((d) => (
                      <div
                        key={d.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5"
                      >
                        <span>
                          {d.name} ·{" "}
                          <span className="text-xs text-muted-foreground">
                            {translate(d.status === "approved" ? "معتمد" : "في الانتظار")} ·{" "}
                            {dateFr(d.lastSeen ?? d.createdAt)}
                          </span>
                        </span>
                        <span className="flex gap-1">
                          {d.status === "pending" && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void securite(live.id, "approuver", d.id)}
                            >
                              <Check className="size-4" />
                              {translate("موافقة")}
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={translate("إزالة الجهاز")}
                            onClick={() => void securite(live.id, "retirer", d.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void securite(live.id, "reinitialiser")}
                >
                  <RotateCcw className="size-4" />
                  {translate("إعادة تعيين الحماية (هاتف ضائع أو رمز منسي)")}
                </Button>
              </div>
            )}
            <Field label={translate("الأدوار")} className="sm:col-span-2">
              <div className="flex flex-wrap gap-4 pt-1">
                {state.roles.map((role) => (
                  <label key={role.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={u.roleIds.includes(role.id)}
                      onCheckedChange={(v) =>
                        setU({
                          ...u,
                          roleIds: v
                            ? [...u.roleIds, role.id]
                            : u.roleIds.filter((x) => x !== role.id),
                        })
                      }
                    />
                    {translate(role.name ?? "")}
                  </label>
                ))}
              </div>
            </Field>
          </div>
        </FormDialog>
      )}
      {r && (
        <FormDialog
          open
          onOpenChange={() => setR(null)}
          title={translate("تعديل الدور")}
          onSubmit={() => r.name && run(upsert, "roles", r) && setR(null)}
        >
          <Field label={translate("الاسم")}>
            <Input
              required
              maxLength={50}
              placeholder={translate("مثال: محاسب")}
              value={r.name}
              onChange={(e) => setR({ ...r, name: e.target.value })}
            />
          </Field>
          <NomAutreLangue
            name={r.name}
            value={r.nameAlt}
            onChange={(v) => setR({ ...r, nameAlt: v })}
          />
          <Field label={translate("الوصف")}>
            <Input
              maxLength={200}
              placeholder={translate("مثال: متابعة الدفوعات والصندوق")}
              value={r.description}
              onChange={(e) => setR({ ...r, description: e.target.value })}
            />
          </Field>
        </FormDialog>
      )}
    </div>
  );
}
