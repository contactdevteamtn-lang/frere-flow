import { translate, type Language } from "@/lib/i18n";
import { NativeSelect } from "@/components/app/forms";

export type DisplayLang = Language | "both";

/** Render a stored label in the chosen display language(s). */
export function showIn(text: string, mode: DisplayLang): string {
  if (!text) return "";
  if (mode === "both") {
    const ar = translate(text, "ar");
    const fr = translate(text, "fr");
    return ar === fr ? ar : `${ar} / ${fr}`;
  }
  return translate(text, mode);
}

export function DisplayLanguageFilter({
  value,
  onChange,
}: {
  value: DisplayLang;
  onChange: (v: DisplayLang) => void;
}) {
  return (
    <NativeSelect
      className="sm:w-44"
      aria-label={translate("لغة العرض")}
      value={value}
      onChange={(e) => onChange(e.target.value as DisplayLang)}
    >
      <option value="ar">العربية</option>
      <option value="fr">Français</option>
      <option value="both">العربية / Français</option>
    </NativeSelect>
  );
}
