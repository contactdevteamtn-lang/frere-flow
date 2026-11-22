// Translittération des noms (personnes, clients, produits…) entre l'arabe et le français.
// Utilisée quand un nom n'a pas de traduction enregistrée : en français « سامي الحداد » s'affiche « Sami Haddad »,
// en arabe « Sami Haddad » s'affiche « سامي حداد ». Les noms courants en Tunisie sont dans un dictionnaire,
// le reste est translittéré lettre par lettre. L'utilisateur peut toujours corriger (champ « nom en français / en arabe »).

export const hasArabic = (s: string) => /[؀-ۿ]/.test(s);
export const hasLatin = (s: string) => /[A-Za-zÀ-ÿ]/.test(s);

/** Noms et mots fréquents (arabe → français) */
const DICO: Record<string, string> = {
  محمد: "Mohamed",
  أحمد: "Ahmed",
  احمد: "Ahmed",
  محمود: "Mahmoud",
  علي: "Ali",
  عمر: "Omar",
  عثمان: "Othman",
  مصطفى: "Mustapha",
  يوسف: "Youssef",
  إبراهيم: "Ibrahim",
  ابراهيم: "Ibrahim",
  خالد: "Khaled",
  كريم: "Karim",
  سامي: "Sami",
  وليد: "Walid",
  رياض: "Riadh",
  نادية: "Nadia",
  فاطمة: "Fatma",
  أميرة: "Amira",
  اميرة: "Amira",
  سناء: "Sana",
  سنية: "Sonia",
  هادي: "Hedi",
  الهادي: "Hedi",
  حمدي: "Hamdi",
  منير: "Mounir",
  عادل: "Adel",
  ليلى: "Leila",
  محجوب: "Mahjoub",
  الطرابلسي: "Trabelsi",
  طرابلسي: "Trabelsi",
  الحداد: "Haddad",
  حداد: "Haddad",
  كمون: "Kammoun",
  شعبان: "Chaabane",
  الصغير: "Sghaier",
  القاسمي: "Gasmi",
  قاسمي: "Gasmi",
  بن: "Ben",
  بنت: "Bent",
  عبد: "Abdel",
  الله: "lah",
  عبدالله: "Abdallah",
  "عبد الله": "Abdallah",
  صالح: "Salah",
  صلاح: "Salah",
  نور: "Nour",
  مريم: "Meriem",
  خديجة: "Khadija",
  زينب: "Zeineb",
  هالة: "Hela",
  رانية: "Rania",
  إيمان: "Imen",
  ايمان: "Imen",
  أنيس: "Anis",
  انيس: "Anis",
  طارق: "Tarek",
  حسن: "Hassen",
  حسين: "Houssem",
  حسام: "Houssem",
  بلال: "Bilel",
  نبيل: "Nabil",
  فتحي: "Fethi",
  لطفي: "Lotfi",
  منصف: "Moncef",
  الحبيب: "Habib",
  حبيب: "Habib",
  رضا: "Ridha",
  سليم: "Slim",
  سفيان: "Sofiene",
  ياسين: "Yassine",
  أيمن: "Aymen",
  ايمن: "Aymen",
  مهدي: "Mehdi",
  وائل: "Wael",
  الغربي: "Gharbi",
  الجلاصي: "Jlassi",
  العياري: "Ayari",
  الحمامي: "Hammami",
  الفرشيشي: "Ferchichi",
  التونسي: "Tounsi",
  السويسي: "Souissi",
  المحجوب: "Mahjoub",
  "عمر بن": "Omar Ben",
  مزرعة: "Ferme",
  شركة: "Société",
  سوق: "Marché",
  غرفة: "Chambre",
  التبريد: "froide",
  تبريد: "froide",
  صندوق: "Caisse",
  صناديق: "Caisses",
  أحمر: "rouge",
  أخضر: "vert",
  أزرق: "bleu",
  أصفر: "jaune",
  أبيض: "blanc",
  أسود: "noir",
  كبير: "grand",
  صغير: "petit",
  تونس: "Tunis",
  سوسة: "Sousse",
  صفاقس: "Sfax",
  المهدية: "Mahdia",
  المنستير: "Monastir",
  نابل: "Nabeul",
  بنزرت: "Bizerte",
  القيروان: "Kairouan",
  قابس: "Gabès",
  مدنين: "Médenine",
  باجة: "Béja",
  جندوبة: "Jendouba",
  الكاف: "Le Kef",
};
const DICO_INV: Record<string, string> = Object.fromEntries(
  Object.entries(DICO)
    .filter(([, fr]) => fr.length > 2)
    .map(([ar, fr]) => [fr.toLowerCase(), ar.replace(/^ال(?=..)/, "")]),
);

const AR_LETTRES: Record<string, string> = {
  ا: "a",
  أ: "a",
  إ: "i",
  آ: "a",
  ب: "b",
  ت: "t",
  ث: "th",
  ج: "j",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "dh",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "ch",
  ص: "s",
  ض: "dh",
  ط: "t",
  ظ: "dh",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "k",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  ة: "a",
  و: "ou",
  ي: "i",
  ى: "a",
  ئ: "i",
  ؤ: "ou",
  ء: "",
  ڨ: "g",
  پ: "p",
  ڤ: "v",
  ـ: "",
  "ً": "",
  "ٌ": "",
  "ٍ": "",
  "َ": "",
  "ُ": "",
  "ِ": "",
  "ّ": "",
  "ْ": "",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};
const majuscule = (w: string) => (w ? w[0]!.toUpperCase() + w.slice(1) : w);

function motArFr(mot: string): string {
  if (DICO[mot]) return DICO[mot]!;
  let w = mot;
  let prefixe = "";
  if (w.startsWith("ال") && w.length > 3) {
    const reste = w.slice(2);
    if (DICO[reste]) return DICO[reste]!;
    prefixe = "El ";
    w = reste;
  }
  let out = "";
  for (const ch of w) out += AR_LETTRES[ch] ?? ch;
  out = out
    .replace(/aa+/g, "a")
    .replace(/ii+/g, "i")
    .replace(/(ou){2,}/g, "ou");
  return prefixe + majuscule(out);
}

/** Arabe → français (pour l'affichage d'un nom en français) */
export function arToFr(texte: string): string {
  if (DICO[texte.trim()]) return DICO[texte.trim()]!;
  return texte
    .split(/(\s+)/)
    .map((p) => (/\s/.test(p) || !hasArabic(p) ? p : motArFr(p)))
    .join("")
    .replace(/\bEl (\p{Lu})/gu, "$1")
    .trim();
}

const FR_DIGRAMMES: [RegExp, string][] = [
  [/kh/g, "خ"],
  [/gh/g, "غ"],
  [/ch|sh/g, "ش"],
  [/th/g, "ث"],
  [/dh/g, "ذ"],
  [/ou|oo|w/g, "و"],
  [/ss/g, "س"],
  [/qu/g, "ك"],
  [/ph/g, "ف"],
];
const FR_LETTRES: Record<string, string> = {
  a: "ا",
  b: "ب",
  c: "ك",
  d: "د",
  e: "",
  f: "ف",
  g: "ق",
  h: "ه",
  i: "ي",
  j: "ج",
  k: "ك",
  l: "ل",
  m: "م",
  n: "ن",
  o: "و",
  p: "ب",
  q: "ق",
  r: "ر",
  s: "س",
  t: "ت",
  u: "و",
  v: "ف",
  x: "كس",
  y: "ي",
  z: "ز",
  é: "ي",
  è: "ي",
  ê: "ي",
  ë: "ي",
  à: "ا",
  â: "ا",
  î: "ي",
  ï: "ي",
  ô: "و",
  û: "و",
  ù: "و",
  ç: "س",
};

function motFrAr(mot: string): string {
  const bas = mot.toLowerCase();
  if (DICO_INV[bas]) return DICO_INV[bas]!;
  let w = bas;
  for (const [re, ar] of FR_DIGRAMMES) w = w.replace(re, ar);
  let out = "";
  [...w].forEach((ch, i) => {
    if (ch === "e" && i === 0) out += "ا";
    else if (ch === "a" && i === 0) out += "أ";
    else out += FR_LETTRES[ch] ?? ch;
  });
  return out.replace(/اا+/g, "ا").replace(/يي+/g, "ي").replace(/وو+/g, "و");
}

/** Français → arabe (pour l'affichage d'un nom en arabe) */
export function frToAr(texte: string): string {
  return texte
    .split(/(\s+|-)/)
    .map((p) => (/^(\s+|-)$/.test(p) || !hasLatin(p) ? p : motFrAr(p)))
    .join("")
    .replace(/-/g, " ")
    .trim();
}
