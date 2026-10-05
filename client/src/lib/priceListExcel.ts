import { priceListRowSchema, type PriceListInput } from "@shared/priceList";
import { pickCell, toMoneyNumber, type ExcelRow } from "./excelImport";

export function parsePriceListRows(rows: ExcelRow[]): PriceListInput[] {
  if (!rows.length) throw new Error("El archivo no contiene registros");
  return rows.map((row, index) => {
    const idText = pickCell(row, ["ID"]);
    const name = pickCell(row, ["Nombre de Producto", "Nombre del Producto", "Nombre", "Producto"]);
    const usd = pickCell(row, ["Precio USD"]);
    const ml = pickCell(row, ["Precio Mercado Libre"]);
    const cashea = pickCell(row, ["Precio CASHEA"]);
    if (!usd) throw new Error(`Fila ${index + 2}: falta Precio USD`);
    if ([usd, ml, cashea].some(value => value && toMoneyNumber(value) === null)) {
      throw new Error(`Fila ${index + 2}: el precio debe ser un numero valido`);
    }
    const result = priceListRowSchema.safeParse({
      id: idText ? Number(idText) : undefined,
      name,
      priceUSD: toMoneyNumber(usd),
      priceMercadoLibre: ml ? toMoneyNumber(ml) : null,
      priceCashea: cashea ? toMoneyNumber(cashea) : null,
    });
    if (!result.success) throw new Error(`Fila ${index + 2}: ${result.error.issues[0].message}`);
    return result.data;
  });
}
