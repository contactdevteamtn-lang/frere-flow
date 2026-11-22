import { Text, translate, useLanguage } from "@/lib/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/store";
import { arToFr, frToAr, hasArabic } from "@/lib/translit";

/** Boutons d'ajout / modification : masqués pour un compte « اطلاع فقط » */
export function Edit({ children }: { children: ReactNode }) {
  const { readOnly } = useApp();
  return readOnly ? null : <>{children}</>;
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  useLanguage();
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{translate(label)}</Label>
      {children}
    </div>
  );
}

export function NativeSelect({
  className,
  children,
  ...p
}: SelectHTMLAttributes<HTMLSelectElement>) {
  useLanguage();
  return (
    <select
      {...p}
      className={cn(
        "h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      {children}
    </select>
  );
}

/**
 * Anti double-soumission : un double-clic (ou Entrée + clic) n'envoie l'action qu'une fois.
 * La 2e soumission dans le délai est ignorée et le bouton est grisé pendant ce temps.
 */
export function useUneSeuleFois(delaiMs = 1200, reinitialiser?: unknown) {
  const dernier = useRef(0);
  const [bloque, setBloque] = useState(false);
  useEffect(() => {
    dernier.current = 0;
    setBloque(false);
  }, [reinitialiser]);
  useEffect(() => {
    if (!bloque) return;
    const t = setTimeout(() => setBloque(false), delaiMs);
    return () => clearTimeout(t);
  }, [bloque, delaiMs]);
  const proteger = useCallback(
    (fn: () => void) => {
      const now = Date.now();
      if (now - dernier.current < delaiMs) return;
      dernier.current = now;
      setBloque(true);
      fn();
    },
    [delaiMs],
  );
  return { proteger, bloque };
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = translate("حفظ"),
  wide,
  personnel,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  wide?: boolean;
  /** action sur son propre compte (ex. mot de passe) : permise aussi en consultation seule */
  personnel?: boolean;
}) {
  useLanguage();
  const readOnly = useApp().readOnly && !personnel;
  const { proteger, bloque } = useUneSeuleFois(1200, open);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("max-h-[90vh] overflow-y-auto", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}
      >
        <DialogHeader>
          <DialogTitle>{translate(title)}</DialogTitle>
          {description && <DialogDescription>{translate(description)}</DialogDescription>}
        </DialogHeader>
        <form
          id="fd"
          onSubmit={(e) => {
            e.preventDefault();
            proteger(onSubmit);
          }}
          className="space-y-4"
        >
          {children}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {<Text>{readOnly ? "إغلاق" : "إلغاء"}</Text>}
          </Button>
          {!readOnly && (
            <Button type="submit" form="fd" disabled={bloque} aria-busy={bloque}>
              {translate(submitLabel)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  label = translate("تأكيد"),
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  label?: string;
}) {
  useLanguage();
  const { readOnly } = useApp();
  const { proteger, bloque } = useUneSeuleFois(1200, open);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{translate(description ?? "")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{<Text>{"إلغاء"}</Text>}</AlertDialogCancel>
          {!readOnly && (
            <AlertDialogAction
              onClick={() => proteger(onConfirm)}
              disabled={bloque}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {translate(label ?? "")}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Nom dans l'autre langue (affiché quand l'application est en français / en arabe). Facultatif :
 *  laissé vide, le nom est translittéré automatiquement (la suggestion est affichée en exemple). */
export function NomAutreLangue({
  name,
  value,
  onChange,
  className,
}: {
  name: string;
  value?: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  useLanguage();
  const arabe = hasArabic(name);
  const suggestion = name.trim().length >= 2 ? (arabe ? arToFr(name) : frToAr(name)) : "";
  return (
    <Field
      label={translate(arabe || !name ? "الاسم بالفرنسية (اختياري)" : "الاسم بالعربية (اختياري)")}
      className={className}
    >
      <div className="flex gap-2">
        <Input
          maxLength={80}
          autoComplete="off"
          dir={arabe || !name ? "ltr" : "rtl"}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            suggestion ? `${translate("مثال:")} ${suggestion}` : translate("مثال: Sami Haddad")
          }
        />
        {suggestion && !value && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => onChange(suggestion)}
          >
            {translate("اقتراح")}
          </Button>
        )}
      </div>
    </Field>
  );
}
