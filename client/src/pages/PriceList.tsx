import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { Home, Download, Upload, Plus, Edit2, Trash2, Save, FileDown, Package, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { exportExcelRows, readExcelRows } from "@/lib/excelImport";
import { parsePriceListRows } from "@/lib/priceListExcel";
import { priceListRowSchema } from "@shared/priceList";
import "./PriceList.css";

const emptyForm = { name: "", priceUSD: "", priceMercadoLibre: "", priceCashea: "" };
const money = (value: string | null) => value === null ? "-" : `$${Number(value).toFixed(2)}`;
const pdfText = (value: string) => value.replace(/[\u2010-\u2015]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');

export default function PriceList() {
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: rows = [], isLoading, error, refetch } = trpc.priceList.list.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery();
  const { data: company } = trpc.config.get.useQuery();
  const save = trpc.priceList.save.useMutation();
  const batch = trpc.priceList.import.useMutation();
  const remove = trpc.priceList.delete.useMutation();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number>();
  const [showForm, setShowForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const busy = save.isPending || batch.isPending || remove.isPending || importing;
  const visible = rows.filter(row => row.name.toLowerCase().includes(search.trim().toLowerCase()));
  const reportError = (err: unknown) => toast.error(err instanceof Error ? err.message : "No se pudo completar la operacion");
  const close = () => { setShowForm(false); setEditingId(undefined); setForm(emptyForm); };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = priceListRowSchema.safeParse({
      id: editingId, name: form.name,
      priceUSD: form.priceUSD.trim() ? Number(form.priceUSD) : null,
      priceMercadoLibre: form.priceMercadoLibre.trim() ? Number(form.priceMercadoLibre) : null,
      priceCashea: form.priceCashea.trim() ? Number(form.priceCashea) : null,
    });
    if (!result.success) { toast.error(result.error.issues[0].message); return; }
    try {
      await save.mutateAsync(result.data);
      await refetch(); close(); toast.success("Precios guardados");
    } catch (err) { reportError(err); }
  }

  async function importFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const parsed = parsePriceListRows(await readExcelRows(file));
      const result = await batch.mutateAsync(parsed);
      await refetch();
      toast.success(`${result.created} creados, ${result.updated} actualizados`);
    } catch (err) { reportError(err); }
    finally { setImporting(false); }
  }

  async function copyProducts() {
    const existing = new Set(rows.map(row => row.name.trim().toLowerCase()));
    const additions = products.filter(product => !existing.has(product.name.trim().toLowerCase()));
    if (!additions.length) { toast.info("Todos los productos ya estan en la lista"); return; }
    try {
      const result = await batch.mutateAsync(additions.map(product => ({
        name: product.name, priceUSD: Number(product.price), priceMercadoLibre: null, priceCashea: null,
      })));
      await refetch(); toast.success(`${result.created} productos agregados`);
    } catch (err) { reportError(err); }
  }

  async function exportPdf() {
    setPdfBusy(true);
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Lista de Precios", 14, 18);
      doc.setFontSize(10);
      const companyLines = doc.splitTextToSize(pdfText(company?.businessName || ""), 180);
      if (company?.businessName) doc.text(companyLines, 14, 26);
      const dateY = 28 + (company?.businessName ? companyLines.length * 5 : 0);
      doc.text(`Fecha: ${new Date().toLocaleDateString("es-VE")}`, 14, dateY);
      autoTable(doc, {
        startY: dateY + 6,
        head: [["Nombre de Producto", "Precio USD", "Precio Mercado Libre", "Precio CASHEA"]],
        body: visible.map(row => [pdfText(row.name), money(row.priceUSD), money(row.priceMercadoLibre), money(row.priceCashea)]),
        theme: "grid", styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak" },
        headStyles: { fillColor: [55, 65, 81] },
        columnStyles: { 0: { cellWidth: 78 }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
        margin: { top: 14, bottom: 18 },
      });
      for (let page = 1; page <= doc.getNumberOfPages(); page++) {
        doc.setPage(page); doc.setFontSize(9);
        doc.text(`Pagina ${page} de ${doc.getNumberOfPages()}`, 196, 288, { align: "right" });
      }
      doc.save("lista_precios.pdf");
    } catch (err) { reportError(err); }
    finally { setPdfBusy(false); }
  }

  function exportExcel(template = false) {
    exportExcelRows(template ? "plantilla_lista_precios.xlsx" : "lista_precios.xlsx", "Lista de Precios",
      template ? [{ ID: "", "Nombre de Producto": "", "Precio USD": "", "Precio Mercado Libre": "", "Precio CASHEA": "" }]
      : visible.map(row => ({ ID: row.id, "Nombre de Producto": row.name, "Precio USD": Number(row.priceUSD),
        "Precio Mercado Libre": row.priceMercadoLibre === null ? "" : Number(row.priceMercadoLibre),
        "Precio CASHEA": row.priceCashea === null ? "" : Number(row.priceCashea) })));
  }

  return <main className="price-list min-h-screen bg-gray-50 p-4 sm:p-8">
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Lista de Precios</h1>
        <div className="price-list-header-actions">
          <Button variant="outline" className="price-list-home" title="Inicio" onClick={() => navigate("/")}><Home size={16} /> Inicio</Button>
          <Button className="price-list-new" disabled={busy || !!error} onClick={() => { close(); setShowForm(true); }}><Plus size={16} /> Nuevo Producto</Button>
        </div>
      </header>
      <div className="mb-5 flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importFile} />
        <Button variant="outline" disabled={busy || isLoading || !!error} onClick={() => fileRef.current?.click()}><Upload size={16} />{importing ? "Importando..." : "Importar Excel"}</Button>
        <Button variant="outline" onClick={() => exportExcel(true)}><Download size={16} /> Plantilla Excel</Button>
        <Button variant="outline" disabled={!visible.length || busy} onClick={() => exportExcel()}><Download size={16} /> Exportar Excel</Button>
        <Button variant="outline" disabled={!visible.length || pdfBusy} onClick={exportPdf}><FileDown size={16} />{pdfBusy ? "Generando..." : "Exportar PDF"}</Button>
        <Button variant="outline" disabled={busy || isLoading || !!error || !products.length} onClick={copyProducts}><Package size={16} /> Agregar del Maestro</Button>
      </div>
      {showForm && <form onSubmit={submit} className="mb-6 border-y bg-white py-5">
        <h2 className="mb-4 text-lg font-semibold">{editingId ? "Editar Precios" : "Nuevo Producto"}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium">Nombre de Producto *<Input className="mt-2" required maxLength={255} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          {(["priceUSD", "priceMercadoLibre", "priceCashea"] as const).map((key, index) => <label key={key} className="text-sm font-medium">
            {["Precio USD *", "Precio Mercado Libre", "Precio CASHEA"][index]}
            <Input className="mt-2" type="number" min="0" max="99999999.99" step="0.01" required={index === 0} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
          </label>)}
        </div>
        <div className="mt-4 flex gap-2"><Button disabled={busy} type="submit"><Save size={16} /> Guardar</Button><Button variant="outline" type="button" disabled={busy} onClick={close}>Cancelar</Button></div>
      </form>}
      <div className="relative mb-4 max-w-md"><Search className="absolute left-3 top-3 text-gray-500" size={16} /><Input aria-label="Buscar producto" placeholder="Buscar producto..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div>
      {error ? <div role="alert" className="py-6 text-red-700">{error.message}<Button variant="outline" className="ml-3" onClick={() => refetch()}>Reintentar</Button></div>
        : isLoading ? <p className="py-8">Cargando precios...</p>
        : <div className="overflow-x-auto border bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-100"><tr>{["Nombre de Producto", "Precio USD", "Precio Mercado Libre", "Precio CASHEA", "Acciones"].map((heading, index) => <th key={heading} className={`p-3 ${index === 0 ? "text-left" : "text-right"}`}>{heading}</th>)}</tr></thead>
            <tbody>{visible.map(row => <tr key={row.id} className="border-t">
              <td className="max-w-sm break-words p-3">{row.name}</td>
              <td className="p-3 text-right tabular-nums">{money(row.priceUSD)}</td>
              <td className="p-3 text-right tabular-nums">{money(row.priceMercadoLibre)}</td>
              <td className="p-3 text-right tabular-nums">{money(row.priceCashea)}</td>
              <td className="p-3"><div className="flex justify-end gap-2">
                <Button variant="outline" size="icon" title="Editar" aria-label={`Editar ${row.name}`} disabled={busy} onClick={() => {
                  setEditingId(row.id); setForm({ name: row.name, priceUSD: row.priceUSD, priceMercadoLibre: row.priceMercadoLibre ?? "", priceCashea: row.priceCashea ?? "" });
                  setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" });
                }}><Edit2 size={16} /></Button>
                <Button variant="outline" size="icon" title="Eliminar" aria-label={`Eliminar ${row.name}`} disabled={busy} onClick={async () => {
                  if (!confirm(`Eliminar ${row.name} de la lista de precios?`)) return;
                  try { await remove.mutateAsync(row.id); await refetch(); if (editingId === row.id) close(); toast.success("Registro eliminado"); } catch (err) { reportError(err); }
                }}><Trash2 size={16} className="text-red-600" /></Button>
              </div></td>
            </tr>)}{!visible.length && <tr><td colSpan={5} className="p-8 text-center text-gray-500">{search ? "Sin coincidencias" : "No hay precios registrados"}</td></tr>}</tbody>
          </table>
        </div>}
      <p className="mt-3 text-sm text-gray-500">{visible.length} productos</p>
    </div>
  </main>;
}
