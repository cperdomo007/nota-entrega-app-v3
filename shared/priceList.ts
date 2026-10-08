import { z } from "zod";

const money = z.number().finite().min(0).max(99999999.99)
  .refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001,
    "El precio admite hasta dos decimales");

export const priceListRowSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(255),
  availability: z.number().finite().int("Disponibilidad debe ser una cantidad entera").min(0, "Disponibilidad no puede ser negativa").max(2147483647).nullable().optional(),
  priceUSD: money,
  priceMercadoLibre: money.nullable(),
  priceCashea: money.nullable(),
});

export type PriceListInput = z.infer<typeof priceListRowSchema>;
