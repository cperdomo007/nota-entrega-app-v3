import { describe, expect, it } from "vitest";
import { parsePriceListRows } from "../client/src/lib/priceListExcel";
import { priceListRowSchema } from "../shared/priceList";

describe("Lista de precios", () => {
  it("imports exported IDs, zero prices and empty optional prices", () => {
    expect(parsePriceListRows([{ ID: 4, "Nombre de Producto": "Escaner", "Precio USD": "10,50", "Precio Mercado Libre": 0, "Precio CASHEA": "" }]))
      .toEqual([{ id: 4, name: "Escaner", priceUSD: 10.5, priceMercadoLibre: 0, priceCashea: null }]);
  });
  it("rejects the entire file when a row is invalid", () => {
    expect(() => parsePriceListRows([
      { "Nombre de Producto": "Valido", "Precio USD": 1 },
      { "Nombre de Producto": "Invalido", "Precio USD": "texto" },
    ])).toThrow("Fila 3");
    expect(() => parsePriceListRows([{ "Nombre de Producto": "Falta precio" }])).toThrow("falta Precio USD");
    expect(() => parsePriceListRows([{ "Nombre de Producto": "Producto", "Precio USD": 1, "Precio CASHEA": "texto" }])).toThrow("Fila 2");
  });
  it("rejects negative, overflowing and excessive precision prices", () => {
    for (const priceUSD of [-1, Infinity, 100000000, 1.234]) {
      expect(priceListRowSchema.safeParse({ name: "Producto", priceUSD, priceMercadoLibre: null, priceCashea: null }).success).toBe(false);
    }
  });
});
