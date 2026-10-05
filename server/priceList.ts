import { eq, sql, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { priceList } from "../drizzle/schema";
import { priceListRowSchema, type PriceListInput } from "../shared/priceList";
import { getDb } from "./db";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";

let initialization: Promise<void> | undefined;
async function database() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });
  // Additive initialization also supports deployments using the existing SQL backup.
  initialization ??= db.execute(sql`CREATE TABLE IF NOT EXISTS price_list (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    priceUSD DECIMAL(10,2) NOT NULL,
    priceMercadoLibre DECIMAL(10,2) NULL,
    priceCashea DECIMAL(10,2) NULL
  )`).then(() => undefined).catch(error => { initialization = undefined; throw error; });
  await initialization;
  return db;
}

async function saveRows(rows: PriceListInput[]) {
  const db = await database();
  return db.transaction(async tx => {
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      const [existing] = await tx.select().from(priceList)
        .where(row.id ? eq(priceList.id, row.id) : eq(priceList.name, row.name)).limit(1);
      if (row.id && !existing) throw new TRPCError({ code: "NOT_FOUND", message: `Registro ${row.id} no encontrado` });
      const values = {
        name: row.name,
        priceUSD: row.priceUSD.toFixed(2),
        priceMercadoLibre: row.priceMercadoLibre?.toFixed(2) ?? null,
        priceCashea: row.priceCashea?.toFixed(2) ?? null,
      };
      if (existing) {
        await tx.update(priceList).set(values).where(eq(priceList.id, existing.id));
        updated++;
      } else {
        await tx.insert(priceList).values(values);
        created++;
      }
    }
    return { created, updated };
  });
}

export const priceListRouter = router({
  list: publicProcedure.query(async () => (await database()).select().from(priceList).orderBy(asc(priceList.name))),
  save: protectedProcedure.input(priceListRowSchema).mutation(({ input }) => saveRows([input])),
  import: protectedProcedure.input(z.array(priceListRowSchema).min(1).max(5000))
    .mutation(({ input }) => saveRows(input)),
  delete: protectedProcedure.input(z.number().int().positive()).mutation(async ({ input }) => {
    await (await database()).delete(priceList).where(eq(priceList.id, input));
    return { success: true };
  }),
});
