// Catalogue des produits : types (légume / fruits), unités de vente, liste de fruits et légumes
// proposée dans le formulaire (choix dans la liste ou saisie libre), et normalisation des noms
// pour interdire les doublons. Partagé par le site et le serveur (domain.mjs).

/** Types de produit permis (valeur enregistrée = libellé arabe, traduit à l'affichage) */
export const TYPES_PRODUIT = ["خضروات", "فواكه"] as const;
export type TypeProduit = (typeof TYPES_PRODUIT)[number];

/** Unités de vente permises (valeur enregistrée ; « kg » pour les données existantes) */
export const UNITES = ["kg", "قطعة", "طن", "صندوق"] as const;
export type Unite = (typeof UNITES)[number];

const sansAccents = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Nom comparable : casse, espaces, accents et variantes d'écriture arabe ignorés */
export function normaliserNom(v: unknown): string {
  return sansAccents(String(v ?? ""))
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "");
}

const ALIAS_TYPE: Record<string, TypeProduit> = {
  خضروات: "خضروات",
  خضر: "خضروات",
  خضار: "خضروات",
  legume: "خضروات",
  legumes: "خضروات",
  vegetable: "خضروات",
  فواكه: "فواكه",
  غلال: "فواكه",
  فاكهه: "فواكه",
  fruit: "فواكه",
  fruits: "فواكه",
};
/** Type normalisé (« légume », « Fruits », « غلال »… acceptés), ou null si inconnu */
export function typeProduit(v: unknown): TypeProduit | null {
  return ALIAS_TYPE[normaliserNom(v)] ?? null;
}

const ALIAS_UNITE: Record<string, Unite> = {
  kg: "kg",
  كغ: "kg",
  kilo: "kg",
  kilogramme: "kg",
  قطعه: "قطعة",
  piece: "قطعة",
  pieces: "قطعة",
  pc: "قطعة",
  طن: "طن",
  ton: "طن",
  tonne: "طن",
  t: "طن",
  صندوق: "صندوق",
  caisse: "صندوق",
  cagette: "صندوق",
};
/** Unité normalisée (« pièce », « tonne », « قطعة »… acceptées), ou null si inconnue */
export function uniteProduit(v: unknown): Unite | null {
  return ALIAS_UNITE[normaliserNom(v)] ?? null;
}

/** Fruits et légumes courants (arabe / français) proposés dans le formulaire produit */
export const CATALOGUE: { ar: string; fr: string; type: TypeProduit }[] = [
  // légumes
  { ar: "بطاطا", fr: "Pomme de terre", type: "خضروات" },
  { ar: "طماطم", fr: "Tomate", type: "خضروات" },
  { ar: "بصل", fr: "Oignon", type: "خضروات" },
  { ar: "بصل أخضر", fr: "Oignon vert", type: "خضروات" },
  { ar: "ثوم", fr: "Ail", type: "خضروات" },
  { ar: "جزر", fr: "Carotte", type: "خضروات" },
  { ar: "فلفل", fr: "Piment", type: "خضروات" },
  { ar: "فلفل حلو", fr: "Poivron", type: "خضروات" },
  { ar: "فلفل حار", fr: "Piment fort", type: "خضروات" },
  { ar: "كوسة", fr: "Courgette", type: "خضروات" },
  { ar: "باذنجان", fr: "Aubergine", type: "خضروات" },
  { ar: "خيار", fr: "Concombre", type: "خضروات" },
  { ar: "قرع", fr: "Potiron", type: "خضروات" },
  { ar: "لفت", fr: "Navet", type: "خضروات" },
  { ar: "بنجر", fr: "Betterave", type: "خضروات" },
  { ar: "فجل", fr: "Radis", type: "خضروات" },
  { ar: "كرنب", fr: "Chou", type: "خضروات" },
  { ar: "قنبيط", fr: "Chou-fleur", type: "خضروات" },
  { ar: "بروكلي", fr: "Brocoli", type: "خضروات" },
  { ar: "خس", fr: "Laitue", type: "خضروات" },
  { ar: "سبانخ", fr: "Épinard", type: "خضروات" },
  { ar: "سلق", fr: "Blette", type: "خضروات" },
  { ar: "بقدونس", fr: "Persil", type: "خضروات" },
  { ar: "كسبر", fr: "Coriandre", type: "خضروات" },
  { ar: "نعناع", fr: "Menthe", type: "خضروات" },
  { ar: "كرفس", fr: "Céleri", type: "خضروات" },
  { ar: "بسباس", fr: "Fenouil", type: "خضروات" },
  { ar: "قنارية", fr: "Artichaut", type: "خضروات" },
  { ar: "فول أخضر", fr: "Fève", type: "خضروات" },
  { ar: "جلبانة", fr: "Petit pois", type: "خضروات" },
  { ar: "لوبيا", fr: "Haricot vert", type: "خضروات" },
  { ar: "بامية", fr: "Gombo", type: "خضروات" },
  { ar: "بطاطا حلوة", fr: "Patate douce", type: "خضروات" },
  { ar: "فطر", fr: "Champignon", type: "خضروات" },
  { ar: "ذرة", fr: "Maïs", type: "خضروات" },
  { ar: "كراث", fr: "Poireau", type: "خضروات" },
  // fruits
  { ar: "تفاح", fr: "Pomme", type: "فواكه" },
  { ar: "برتقال", fr: "Orange", type: "فواكه" },
  { ar: "برتقال مالطي", fr: "Orange maltaise", type: "فواكه" },
  { ar: "مندرين", fr: "Mandarine", type: "فواكه" },
  { ar: "كليمنتين", fr: "Clémentine", type: "فواكه" },
  { ar: "ليمون", fr: "Citron", type: "فواكه" },
  { ar: "قارص", fr: "Citron (bergamote)", type: "فواكه" },
  { ar: "موز", fr: "Banane", type: "فواكه" },
  { ar: "إجاص", fr: "Poire", type: "فواكه" },
  { ar: "عنب", fr: "Raisin", type: "فواكه" },
  { ar: "فراولة", fr: "Fraise", type: "فواكه" },
  { ar: "دلاع", fr: "Pastèque", type: "فواكه" },
  { ar: "بطيخ", fr: "Melon", type: "فواكه" },
  { ar: "خوخ", fr: "Pêche", type: "فواكه" },
  { ar: "مشمش", fr: "Abricot", type: "فواكه" },
  { ar: "برقوق", fr: "Prune", type: "فواكه" },
  { ar: "تين", fr: "Figue", type: "فواكه" },
  { ar: "هندي", fr: "Figue de Barbarie", type: "فواكه" },
  { ar: "رمان", fr: "Grenade", type: "فواكه" },
  { ar: "تمر", fr: "Datte", type: "فواكه" },
  { ar: "كيوي", fr: "Kiwi", type: "فواكه" },
  { ar: "أناناس", fr: "Ananas", type: "فواكه" },
  { ar: "مانجو", fr: "Mangue", type: "فواكه" },
  { ar: "زعرور", fr: "Nèfle", type: "فواكه" },
  { ar: "سفرجل", fr: "Coing", type: "فواكه" },
  { ar: "كاكي", fr: "Kaki", type: "فواكه" },
  { ar: "حب الملوك", fr: "Cerise", type: "فواكه" },
  { ar: "توت", fr: "Mûre", type: "فواكه" },
  { ar: "أفوكادو", fr: "Avocat", type: "فواكه" },
];

/** Entrée du catalogue correspondant à un nom (arabe ou français), sinon undefined */
export function dansCatalogue(nom: unknown) {
  const n = normaliserNom(nom);
  return n
    ? CATALOGUE.find((c) => normaliserNom(c.ar) === n || normaliserNom(c.fr) === n)
    : undefined;
}

/**
 * Bases existantes : type et unité de chaque produit ramenés aux valeurs permises
 * (type inconnu → d'après le catalogue, sinon « خضروات » ; unité inconnue → « kg »).
 * @returns le nombre de produits corrigés
 */
export function normaliserProduits(s: {
  products: { name: string; category: string; unit: string }[];
}): number {
  let n = 0;
  for (const p of s.products) {
    const category = typeProduit(p.category) ?? dansCatalogue(p.name)?.type ?? "خضروات";
    const unit = uniteProduit(p.unit) ?? "kg";
    if (category !== p.category || unit !== p.unit) {
      p.category = category;
      p.unit = unit;
      n++;
    }
  }
  return n;
}
