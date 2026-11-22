import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { translations } from "./translations";
import { arToFr, frToAr, hasArabic, hasLatin } from "./translit";

export type Language = "ar" | "fr";
let activeLanguage: Language = "ar";
export const locale = () => (activeLanguage === "ar" ? "ar-TN" : "fr-TN");
const entries = Object.entries(translations).sort(([a], [b]) => b.length - a.length);
const reverse = Object.fromEntries(entries.map(([ar, fr]) => [fr, ar]));
const expression = new RegExp(
  entries.map(([ar]) => ar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "g",
);

/* Noms saisis par les utilisateurs (clients, personnes, produits, marchés…) : chacun a sa version française
   et arabe — celle saisie dans le champ « nom en français / en arabe », sinon la traduction connue, sinon
   une translittération automatique. Mis à jour par le store à chaque changement des données. */
const noms = {
  fr: new Map<string, string>(),
  ar: new Map<string, string>(),
  re: null as RegExp | null,
};
const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function versionsNom(name: string, nameAlt?: string): { fr: string; ar: string } {
  const alt = (nameAlt ?? "").trim();
  const fr = !hasArabic(name)
    ? name
    : alt && !hasArabic(alt) && hasLatin(alt)
      ? alt
      : (translations[name] ?? arToFr(name));
  const ar = hasArabic(name) ? name : alt && hasArabic(alt) ? alt : (reverse[name] ?? frToAr(name));
  return { fr, ar };
}
export function enregistrerNoms(items: { name?: string; nameAlt?: string }[]) {
  noms.fr.clear();
  noms.ar.clear();
  for (const it of items) {
    const name = (it.name ?? "").trim();
    if (!name || (!hasArabic(name) && !hasLatin(name))) continue;
    const { fr, ar } = versionsNom(name, it.nameAlt);
    noms.fr.set(name, fr);
    noms.fr.set(ar, fr);
    noms.ar.set(name, ar);
    noms.ar.set(fr, ar);
  }
  const cles = [...noms.fr.keys()].filter(hasArabic).sort((a, b) => b.length - a.length);
  noms.re = cles.length ? new RegExp(cles.map(echapper).join("|"), "g") : null;
}

export function translate(text: string, language: Language = activeLanguage): string {
  if (language === "ar") return noms.ar.get(text) ?? reverse[text] ?? text;
  const nom = noms.fr.get(text);
  if (nom !== undefined) return nom;
  if (translations[text] !== undefined) return translations[text]!;
  const avecNoms = noms.re ? text.replace(noms.re, (m) => noms.fr.get(m) ?? m) : text;
  return avecNoms.replace(expression, (match) => translations[match] ?? match);
}

const LanguageContext = createContext({
  language: "ar" as Language,
  setLanguage: (_language: Language) => {},
});
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("ar");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("mahjoub-language");
    if (saved === "fr" || saved === "ar") {
      activeLanguage = saved;
      setLanguage(saved);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    if (ready) localStorage.setItem("mahjoub-language", language);
  }, [language, ready]);
  const change = (next: Language) => {
    activeLanguage = next;
    setLanguage(next);
  };
  return (
    <LanguageContext.Provider value={{ language, setLanguage: change }}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useLanguage() {
  const context = useContext(LanguageContext);
  return { ...context, t: (text: string) => translate(text, context.language) };
}

export function Text({ children }: { children: string }) {
  const { t } = useLanguage();
  return <>{t(children)}</>;
}
