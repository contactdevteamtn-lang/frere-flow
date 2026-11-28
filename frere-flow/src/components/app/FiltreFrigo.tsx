// Filtre « Frigo » commun à toutes les pages : Tous les frigos / Frigo Fawzi / Frigo Houssem.
import { translate, useLanguage } from "@/lib/i18n";
import { useApp } from "@/store/store";
import type { AppState, Credit, ID } from "@/types";
import { NativeSelect } from "./forms";

export function FiltreFrigo({
  value,
  onChange,
  className = "sm:w-44",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  useLanguage();
  const { state } = useApp();
  return (
    <NativeSelect
      className={className}
      aria-label={translate("غرفة التبريد")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="all">{translate("كل غرف التبريد")}</option>
      {state.frigos.map((f) => (
        <option key={f.id} value={f.id}>
          {translate(f.name ?? "")}
        </option>
      ))}
    </NativeSelect>
  );
}

/** Frigo d'une vente, d'un crédit (via sa vente ou son frigo d'échéance) ou d'un paiement (via sa vente) */
export const frigoVente = (s: AppState, saleId?: ID) =>
  saleId ? s.sales.find((v) => v.id === saleId)?.frigoId : undefined;
export const frigoCredit = (s: AppState, c: Credit) => c.frigoId ?? frigoVente(s, c.saleId);
/** true si l'élément correspond au filtre (« all » = tout) */
export const dansFrigo = (filtre: string, frigoId?: ID) => filtre === "all" || frigoId === filtre;
