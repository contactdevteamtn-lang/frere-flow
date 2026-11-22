import { describe, expect, it } from "vitest";
import { enregistrerNoms, translate } from "@/lib/i18n";
import { arToFr, frToAr } from "@/lib/translit";
import { buildSeed } from "@/mock/seed";

describe("noms en français / en arabe", () => {
  it("translittère les noms tunisiens courants", () => {
    expect(arToFr("محمد الطرابلسي")).toBe("Mohamed Trabelsi");
    expect(arToFr("سامي بن عمر")).toBe("Sami Ben Omar");
    expect(frToAr("Sami Haddad")).toBe("سامي حداد");
  });
  it("utilise le nom saisi dans l'autre langue en priorité", () => {
    enregistrerNoms([{ name: "منير بن علي", nameAlt: "Mounir B. Ali" }, { name: "Karim Jlassi" }]);
    expect(translate("منير بن علي", "fr")).toBe("Mounir B. Ali");
    expect(translate("Mounir B. Ali", "ar")).toBe("منير بن علي");
    expect(translate("Karim Jlassi", "ar")).toBe("كريم جلاصي");
    expect(translate("Karim Jlassi", "fr")).toBe("Karim Jlassi");
  });
  it("remplace aussi les noms à l'intérieur d'une phrase (historique)", () => {
    enregistrerNoms([{ name: "وليد كمون" }]);
    expect(translate("وليد كمون", "fr")).toBe("Walid Kammoun");
    expect(/[؀-ۿ]/.test(translate("وليد كمون → سامي", "fr").split("→")[0]!)).toBe(false);
  });
  it("aucune donnée de démonstration ne reste en arabe quand le site est en français", () => {
    const s = buildSeed();
    enregistrerNoms([
      ...s.clients,
      ...s.users,
      ...s.products,
      ...s.frigos,
      ...s.packagingTypes,
      ...s.roles,
      ...s.markets,
      ...s.teams,
    ]);
    const restes: string[] = [];
    const voir = (o: unknown) => {
      if (typeof o === "string") {
        if (/[؀-ۿ]/.test(translate(o, "fr"))) restes.push(o);
      } else if (Array.isArray(o)) o.forEach(voir);
      else if (o && typeof o === "object") Object.values(o).forEach(voir);
    };
    voir(s);
    expect(restes).toEqual([]);
  });
});
