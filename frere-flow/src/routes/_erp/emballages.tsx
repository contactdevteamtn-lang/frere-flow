import { Text, translate, useLanguage } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/store/store";
import { packBalance, upsert, clientBoxBalance } from "@/services/ops";
import type { PackagingType } from "@/types";
import { Field, FormDialog, NomAutreLangue } from "@/components/app/forms";
import { PageHeader, Status, Swatch } from "@/components/app/ui";
import { num } from "@/lib/format";

export const Route = createFileRoute("/_erp/emballages")({
  head: () => ({
    meta: [
      { title: "Types d'emballages — Frère Mahjoub" },
      { name: "description", content: "Gestion des caisses par type et couleur." },
      { property: "og:title", content: "Types d'emballages — Frère Mahjoub" },
      { property: "og:description", content: "Gestion des caisses par type et couleur." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Types,
});

type Draft = Omit<PackagingType, "id"> & { id?: string };

function Types() {
  useLanguage();
  const { state, run, can, readOnly } = useApp();
  const manage = can("frigos") && !readOnly;
  const [edit, setEdit] = useState<Draft | null>(null);
  return (
    <div>
      <PageHeader
        title={translate("أنواع الصناديق")}
        subtitle={translate("متابعة الصناديق حسب النوع واللون")}
        actions={
          manage && (
            <Button
              onClick={() =>
                setEdit({
                  name: "",
                  color: "",
                  hex: "#2E7D32",
                  description: "",
                  totalAvailable: 500,
                  active: true,
                })
              }
            >
              <Plus className="size-4" />
              {<Text>{" نوع جديد"}</Text>}
            </Button>
          )
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {state.packagingTypes.map((t) => {
          const b = packBalance(state, { typeId: t.id });
          const inStock = t.totalAvailable - b.remaining;
          const cb = t.clientOwned ? clientBoxBalance(state, {}) : null;
          return (
            <div key={t.id} className="overflow-hidden rounded-xl border bg-card shadow-card">
              <div className="h-2" style={{ backgroundColor: t.hex }} />
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="flex items-center gap-2 font-display font-semibold">
                      <Swatch hex={t.hex} /> {translate(t.name ?? "")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {translate(t.description ?? "")}
                    </p>
                  </div>
                  {manage && (
                    <Button size="icon" variant="ghost" onClick={() => setEdit(t)}>
                      <Pencil className="size-4" />
                    </Button>
                  )}
                </div>
                {cb ? (
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-xs text-muted-foreground">
                        {<Text>{"المستلمة من العملاء"}</Text>}
                      </p>
                      <b>{num(cb.received)}</b>
                    </div>
                    <div className="rounded-lg bg-secondary p-2">
                      <p className="text-xs text-muted-foreground">
                        {<Text>{"المُرجعة إليهم"}</Text>}
                      </p>
                      <b>{num(cb.returned)}</b>
                    </div>
                    <div className="rounded-lg bg-warning/15 p-2">
                      <p className="text-xs text-muted-foreground">
                        {<Text>{"عندنا لإرجاعها"}</Text>}
                      </p>
                      <b>{num(cb.owed)}</b>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-xs text-muted-foreground">{<Text>{"الإجمالي"}</Text>}</p>
                      <b>{num(t.totalAvailable)}</b>
                    </div>
                    <div className="rounded-lg bg-warning/15 p-2">
                      <p className="text-xs text-muted-foreground">
                        {<Text>{"لدى العملاء"}</Text>}
                      </p>
                      <b>{num(b.remaining)}</b>
                    </div>
                    <div className="rounded-lg bg-secondary p-2">
                      <p className="text-xs text-muted-foreground">
                        {<Text>{"في المستودع"}</Text>}
                      </p>
                      <b>{num(inStock)}</b>
                    </div>
                  </div>
                )}
                <div className="mt-3">
                  <Status value={t.active ? "ON" : "OFF"} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {edit && (
        <FormDialog
          open
          onOpenChange={() => setEdit(null)}
          title={edit.id ? translate("تعديل النوع") : translate("نوع صندوق جديد")}
          onSubmit={() => edit.name && run(upsert, "packagingTypes", edit) && setEdit(null)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={translate("الاسم")}>
              <Input
                required
                maxLength={60}
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                placeholder={translate("مثال: صندوق أحمر")}
              />
            </Field>
            <NomAutreLangue
              name={edit.name}
              value={edit.nameAlt}
              onChange={(v) => setEdit({ ...edit, nameAlt: v })}
            />
            <Field label={translate("اللون")}>
              <div className="flex gap-2">
                <Input
                  maxLength={30}
                  placeholder={translate("مثال: أحمر")}
                  value={edit.color}
                  onChange={(e) => setEdit({ ...edit, color: e.target.value })}
                />
                <input
                  type="color"
                  value={edit.hex}
                  onChange={(e) => setEdit({ ...edit, hex: e.target.value })}
                  className="h-9 w-12 rounded border"
                />
              </div>
            </Field>
            {!edit.id && (
              <Field label={translate("صناديق يجلبها العميل")} className="sm:col-span-2">
                <div className="flex items-center gap-2 pt-1.5">
                  <Switch
                    checked={!!edit.clientOwned}
                    onCheckedChange={(v) =>
                      setEdit({
                        ...edit,
                        clientOwned: v,
                        totalAvailable: v ? 0 : edit.totalAvailable,
                      })
                    }
                  />
                  <span className="text-xs text-muted-foreground">
                    {translate("ملك العميل: تُحسب لإرجاعها إليه، لا تدخل في مخزون صناديق الشركة")}
                  </span>
                </div>
              </Field>
            )}
            {!edit.clientOwned && (
              <Field label={translate("إجمالي عدد الصناديق")}>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  required
                  inputMode="numeric"
                  placeholder={translate("مثال: 500")}
                  value={edit.totalAvailable}
                  onChange={(e) => setEdit({ ...edit, totalAvailable: Number(e.target.value) })}
                />
              </Field>
            )}
            <Field label={translate("نشط")}>
              <div className="pt-1.5">
                <Switch
                  checked={edit.active}
                  onCheckedChange={(v) => setEdit({ ...edit, active: v })}
                />
              </div>
            </Field>
            <Field label={translate("الوصف")} className="sm:col-span-2">
              <Input
                maxLength={200}
                placeholder={translate("مثال: صندوق بلاستيكي 20 كغ")}
                value={edit.description}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
              />
            </Field>
          </div>
        </FormDialog>
      )}
    </div>
  );
}
