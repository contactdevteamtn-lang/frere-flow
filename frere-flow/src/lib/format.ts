import { locale, translate } from "./i18n";
export const dt = (n: number | string | null | undefined) =>
  `${Number(n ?? 0).toLocaleString(locale(), { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${translate("د.ت")}`;

export const num = (n: number | string | null | undefined, d = 0) =>
  Number(n ?? 0).toLocaleString(locale(), { maximumFractionDigits: d });

export const dateFr = (s: string | null | undefined) =>
  s
    ? new Date(s).toLocaleDateString(locale(), { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export const dateTimeFr = (s: string | null | undefined) =>
  s
    ? new Date(s).toLocaleString(locale(), {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const METHODES = [
  { value: "ESPECES", label: "نقداً" },
  { value: "CHEQUE", label: "شيك" },
  { value: "VIREMENT", label: "تحويل بنكي" },
  { value: "AUTRE", label: "أخرى" },
];
export const methodeLabel = (m: string) =>
  METHODES.find((x) => x.value === m)?.label
    ? translate(METHODES.find((x) => x.value === m)?.label ?? m)
    : m;

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  // Anti-injection de formules Excel : un texte commençant par = + - @ (ou tabulation) est neutralisé
  const esc = (v: unknown) => {
    let t = String(v ?? "");
    if (typeof v !== "number" && /^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return `"${t.replace(/"/g, '""')}"`;
  };
  const csv =
    "\uFEFF" +
    [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
