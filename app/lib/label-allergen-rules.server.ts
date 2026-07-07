const RULES: Array<{ words: string[]; allergens: string[] }> = [
  { words: ["wrap", "tortilla", "burrito"], allergens: ["Gluten"] },
  { words: ["tempura", "crispy", "panko", "breaded", "panade"], allergens: ["Gluten"] },

  { words: ["korean", "teriyaki", "soja", "soy", "yakitori"], allergens: ["Soja", "Sesam"] },
  { words: ["bbq"], allergens: ["Soja"] },

  { words: ["falafel", "hummus", "tahini"], allergens: ["Sesam"] },

  { words: ["halloumi", "feta", "kaese", "käse", "cheese", "mozzarella", "parmesan", "joghurt", "yogurt"], allergens: ["Milch"] },

  { words: ["lachs", "salmon"], allergens: ["Fisch"] },
  { words: ["ebi", "garnele", "garnelen", "shrimp", "prawn"], allergens: ["Krebstiere"] },

  { words: ["ei", "egg", "mayo", "mayonnaise"], allergens: ["Ei"] },

  { words: ["erdnuss", "peanut"], allergens: ["Erdnüsse"] },
  { words: ["cashew", "mandel", "almond", "walnuss", "haselnuss", "nuss", "nuts"], allergens: ["Schalenfrüchte"] },

  { words: ["sellerie", "celery"], allergens: ["Sellerie"] },
  { words: ["senf", "mustard"], allergens: ["Senf"] },
];

function normalize(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

export function guessAllergensFromLabelText(name: string, notes?: string | null) {
  const text = normalize([name, notes || ""].join(" "));
  const result = new Set<string>();

  for (const rule of RULES) {
    if (rule.words.some((word) => text.includes(normalize(word)))) {
      for (const allergen of rule.allergens) {
        result.add(allergen);
      }
    }
  }

  return Array.from(result).join(", ");
}
