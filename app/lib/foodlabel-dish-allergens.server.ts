export type DeliveryDishAllergenRule = {
  id: string;
  dishName: string;
  allergens: string;
  note: string;
};

export const DEFAULT_DELIVERY_DISH_ALLERGENS: Array<Omit<DeliveryDishAllergenRule, "id">> = [
  { dishName: "Chicken", allergens: "Egg, Soy, Gluten", note: "Chicken marinade" },
  { dishName: "Salmon", allergens: "Fish", note: "Salmon" },
  { dishName: "Raw Salmon", allergens: "Fish", note: "Raw salmon" },
  { dishName: "Sea Bream", allergens: "Fish", note: "Sea bream" },
  { dishName: "Trout", allergens: "Fish", note: "Trout" },
  { dishName: "Ebi", allergens: "Crustaceans, Gluten, Egg", note: "Shrimp tempura" },
  { dishName: "Shrimp", allergens: "Crustaceans", note: "Shrimp" },
  { dishName: "Tempura", allergens: "Gluten, Egg", note: "Tempura batter" },
  { dishName: "Tofu", allergens: "Soy", note: "Tofu" },
  { dishName: "Planted Chicken", allergens: "Soy, Gluten", note: "Planted Chicken" },
  { dishName: "Vegan Tuna", allergens: "Soy, Gluten", note: "Vegan tuna" },
  { dishName: "Halloumi", allergens: "Milk", note: "Halloumi" },
  { dishName: "Creamy Tomato Sauce", allergens: "Milk", note: "Creamy sauce" },
  { dishName: "Creamy", allergens: "Milk", note: "Creamy sauce" },
  { dishName: "Gnocchi", allergens: "Gluten, Egg", note: "Gnocchi" },
  { dishName: "Wrap", allergens: "Gluten", note: "Wrap" },
  { dishName: "Crispy", allergens: "Gluten, Egg", note: "Crispy coating" },
  { dishName: "Sesame", allergens: "Sesame", note: "Sesame" },
  { dishName: "Soy", allergens: "Soy", note: "Soy" },
  { dishName: "Falafel", allergens: "Sesame", note: "Falafel" },
  { dishName: "Mustard", allergens: "Mustard", note: "Mustard" },
  { dishName: "Vegan", allergens: "", note: "Vegan" },
  { dishName: "Vegetarian", allergens: "", note: "Vegetarian" },

  // Exact overrides
  { dishName: "Lemon Chicken Bowl", allergens: "No declared allergens", note: "Chicken, spices" }
];

export async function ensureFoodLabelDishAllergenTable(prisma: any) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FoodLabelDishAllergen" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "dishName" TEXT NOT NULL,
      "allergens" TEXT NOT NULL DEFAULT '',
      "note" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE ("tenantId", "dishName")
    )
  `);
}

export async function seedDefaultFoodLabelDishAllergens(prisma: any, tenantId: string) {
  await ensureFoodLabelDishAllergenTable(prisma);

  for (const rule of DEFAULT_DELIVERY_DISH_ALLERGENS) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "FoodLabelDishAllergen"
        ("id", "tenantId", "dishName", "allergens", "note", "updatedAt")
       VALUES
        ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT ("tenantId", "dishName") DO NOTHING`,
      crypto.randomUUID(),
      tenantId,
      rule.dishName,
      rule.allergens,
      rule.note
    );
  }
}

export function formatDishAllergenDetails(rule: { allergens?: string | null; note?: string | null }) {
  const allergens = String(rule.allergens || "").trim();
  const note = String(rule.note || "").trim();

  if (allergens && note) return `Allergens: ${allergens} | Note: ${note}`;
  if (allergens) return `Allergens: ${allergens}`;
  if (note) return `Note: ${note}`;

  return "";
}

export async function getFoodLabelDishAllergenRules(prisma: any, tenantId: string) {
  await seedDefaultFoodLabelDishAllergens(prisma, tenantId);

  return await prisma.$queryRawUnsafe<DeliveryDishAllergenRule[]>(
    `SELECT "id", "dishName", "allergens", "note"
     FROM "FoodLabelDishAllergen"
     WHERE "tenantId" = $1
     ORDER BY "dishName" ASC`,
    tenantId
  );
}

export async function getDeliveryDishDetailsMap(prisma: any, tenantId: string) {
  const rules = await getFoodLabelDishAllergenRules(prisma, tenantId);
  const map: Record<string, string> = {};

  for (const rule of rules) {
    const details = formatDishAllergenDetails(rule);
    if (rule.dishName && details) {
      map[rule.dishName] = details;
    }
  }

  return map;
}
