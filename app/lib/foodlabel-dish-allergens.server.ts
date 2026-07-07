export type DeliveryDishAllergenRule = {
  id: string;
  dishName: string;
  allergens: string;
  note: string;
};

export const DEFAULT_DELIVERY_DISH_ALLERGENS: Array<Omit<DeliveryDishAllergenRule, "id">> = [
  { dishName: "Chicken Shawarma Grill Bowl", allergens: "Egg, Soy, Gluten, Sesame, Mustard", note: "Chicken" },
  { dishName: "Lemon Chicken Bowl", allergens: "No declared allergens", note: "Chicken, spices" },
  { dishName: "Crispy Chicken Salad", allergens: "Gluten, Egg, Soy, Milk, Mustard", note: "Chicken" },
  { dishName: "Falafel Wrap", allergens: "Gluten, Sesame", note: "Vegan" },
  { dishName: "Mediterranean Halloumi Crunch Wrap", allergens: "Gluten, Milk, Sesame", note: "Vegetarian" },
  { dishName: "Ebi Tempura Bowl", allergens: "Gluten, Crustaceans, Egg, Soy", note: "Ebi/Shrimp" },
  { dishName: "Mediterranean Grill Bowl", allergens: "Sesame, Mustard", note: "Vegan/Vegetarian check" },
  { dishName: "Veggie Oriental Bowl", allergens: "Sesame, Mustard", note: "Vegetarian" },
  { dishName: "Planted Chicken Power Bowl", allergens: "Soy, Gluten", note: "Planted Chicken" },
  { dishName: "Crispy Tofu Wrap", allergens: "Gluten, Soy, Sesame", note: "Vegan" },
  { dishName: "Vegan Beetroot Salad", allergens: "Mustard", note: "Vegan" },
  { dishName: "Asian Greens with Sesame Salmon", allergens: "Fish, Sesame, Soy, Gluten", note: "Salmon" },
  { dishName: "Vegan Tuna Bowl", allergens: "Soy, Gluten", note: "Vegan" },
  { dishName: "Green Tofu Fitness Bowl", allergens: "Soy, Sesame", note: "Vegan" },
  { dishName: "Garden Halloumi Bowl", allergens: "Milk, Sesame, Mustard", note: "Vegetarian" },
  { dishName: "Fennel Citrus Sea Bream Salad", allergens: "Fish, Mustard", note: "Sea Bream" },
  { dishName: "Trout Herb Salad", allergens: "Fish, Mustard", note: "Trout" },
  { dishName: "Oriental Salad", allergens: "Sesame, Mustard", note: "Vegan/Vegetarian check" },
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
