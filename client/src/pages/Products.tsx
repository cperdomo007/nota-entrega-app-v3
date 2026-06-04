import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Plus, Edit2, Trash2, ArrowLeft, Save, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { exportExcelRows, pickCell, readExcelRows, toBoolean, toInteger, toMoneyNumber } from "@/lib/excelImport";

export default function Products() {
  const [, setLocation] = useLocation();
  const importInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const { data: products, isLoading, refetch } = trpc.products.list.useQuery();
  const createProductMutation = trpc.products.create.useMutation();
  const updateProductMutation = trpc.products.update.useMutation();
  const deleteProductMutation = trpc.products.delete.useMutation();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [formData, setFormData] = useState({
    barcode: "",
    name: "",
    description: "",
    price: "",
    unit: "",
    hasSerial: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
    setFormData((prev) => ({
      ...prev,
      [name]: val,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const price = Number(formData.price);

    if (!formData.name.trim()) {
      toast.error("El nombre del producto es obligatorio");
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      toast.error("El precio debe ser mayor que cero");
      return;
    }

    if (!formData.unit.trim()) {
      toast.error("La unidad es obligatoria");
      return;
    }

    const payload = {
      barcode: formData.barcode.trim() || undefined,
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      price,
      unit: formData.unit.trim(),
      hasSerial: formData.hasSerial,
    };

    try {
      if (editingId) {
        await updateProductMutation.mutateAsync({
          id: editingId,
          ...payload,
        });
        toast.success("Producto actualizado");
      } else {
        await createProductMutation.mutateAsync(payload);
        toast.success("Producto creado");
      }
      setFormData({ barcode: "", name: "", description: "", price: "", unit: "", hasSerial: false });
      setEditingId(null);
      setShowForm(false);
      refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al guardar el producto";
      toast.error(message);
      console.error(error);
    }
  };

  const handleEdit = (product: any) => {
    setFormData({
      barcode: product.barcode || "",
      name: product.name,
      description: product.description || "",
      price: product.price,
      unit: product.unit || "",
      hasSerial: product.hasSerial,
    });
    setEditingId(product.id);
    setShowForm(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const handleDelete = async (id: number) => {
    if (confirm("¿Estás seguro de que deseas eliminar este producto?")) {
      try {
        await deleteProductMutation.mutateAsync(id);
        toast.success("Producto eliminado");
        refetch();
      } catch (error) {
        toast.error("Error al eliminar el producto");
        console.error(error);
      }
    }
  };

  const handleCancel = () => {
    setFormData({ barcode: "", name: "", description: "", price: "", unit: "", hasSerial: false });
    setEditingId(null);
    setShowForm(false);
  };

  const handleImportProducts = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsImporting(true);
    try {
      const rows = await readExcelRows(file);
      const existingByBarcode = new Map(
        (products ?? [])
          .filter((product: any) => product.barcode)
          .map((product: any) => [String(product.barcode).trim().toLowerCase(), product])
      );
      const existingByName = new Map(
        (products ?? []).map((product: any) => [String(product.name).trim().toLowerCase(), product])
      );
      const importsByKey = new Map<string, any>();

      for (const row of rows) {
        const barcode = pickCell(row, ["codigo", "codigo de barras", "barcode", "codigobarras"]);
        const name = pickCell(row, ["nombre", "producto", "nombre del producto", "name"]);
        const description = pickCell(row, ["descripcion", "descripción", "description", "detalle"]);
        const priceText = pickCell(row, ["precio", "price", "precio unitario", "preciounitario"]);
        const unit = pickCell(row, ["unidad", "unit"]) || "Unidad";
        const category = pickCell(row, ["categoria", "categoría", "category"]);
        const stockText = pickCell(row, ["stock", "existencia", "cantidad"]);
        const serialText = pickCell(row, ["serial", "tiene serial", "has serial", "hasserial", "numero de serie"]);
        const price = toMoneyNumber(priceText);

        if (!name || price === null || price <= 0) continue;

        const key = barcode ? `barcode:${barcode.toLowerCase()}` : `name:${name.toLowerCase()}`;
        importsByKey.set(key, {
          barcode: barcode || undefined,
          name,
          description: description || undefined,
          category: category || undefined,
          price,
          unit,
          hasSerial: toBoolean(serialText),
          stock: toInteger(stockText, 0),
        });
      }

      let created = 0;
      let updated = 0;

      for (const payload of Array.from(importsByKey.values())) {
        const match = payload.barcode
          ? existingByBarcode.get(String(payload.barcode).trim().toLowerCase())
          : existingByName.get(String(payload.name).trim().toLowerCase());

        if (match) {
          await updateProductMutation.mutateAsync({ id: match.id, ...payload });
          updated += 1;
        } else {
          await createProductMutation.mutateAsync(payload);
          created += 1;
        }
      }

      await refetch();
      toast.success(`Importacion lista: ${created} creados, ${updated} actualizados`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al importar productos";
      toast.error(message);
      console.error(error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportProducts = () => {
    const rows = (products ?? []).map((product: any) => ({
      "Codigo de Barras": product.barcode || "",
      "Nombre": product.name || "",
      "Descripcion": product.description || "",
      "Categoria": product.category || "",
      "Precio": Number(product.price || 0),
      "Unidad": product.unit || "",
      "Tiene Serial": product.hasSerial ? "Si" : "No",
      "Stock": product.stock ?? 0,
    }));

    if (rows.length === 0) {
      toast.error("No hay productos para exportar");
      return;
    }

    exportExcelRows("maestro_productos.xlsx", "Productos", rows);
    toast.success("Productos exportados");
  };

  return (
    <div style={{ minHeight: "100vh", padding: "2rem", background: "linear-gradient(to bottom right, #f8fafc, #f1f5f9)" }}>
      <div style={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button
              onClick={() => setLocation("/")}
              style={{ padding: "0.5rem", background: "transparent", border: "1px solid #e2e8f0", borderRadius: "0.375rem", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <ArrowLeft style={{ width: "1.25rem", height: "1.25rem" }} />
            </button>
            <div>
              <h1 style={{ fontSize: "2rem", fontWeight: "bold", color: "#1e293b" }}>
                Gestión de Productos
              </h1>
              <p style={{ color: "#64748b", marginTop: "0.5rem" }}>
                Administra el catálogo de productos
              </p>
            </div>
          </div>
          {!showForm && (
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportProducts}
                style={{ display: "none" }}
              />
              <Button
                onClick={() => importInputRef.current?.click()}
                disabled={isImporting}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "white", color: "#334155", padding: "0.75rem 1.5rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600", opacity: isImporting ? 0.6 : 1 }}
              >
                <Upload style={{ width: "1rem", height: "1rem" }} />
                {isImporting ? "Importando..." : "Importar Excel"}
              </Button>
              <Button
                onClick={handleExportProducts}
                disabled={isLoading || !products?.length}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "white", color: "#334155", padding: "0.75rem 1.5rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", cursor: isLoading || !products?.length ? "not-allowed" : "pointer", fontWeight: "600", opacity: isLoading || !products?.length ? 0.6 : 1 }}
              >
                <Download style={{ width: "1rem", height: "1rem" }} />
                Exportar Excel
              </Button>
              <Button
                onClick={() => setShowForm(true)}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgb(59, 130, 246)", color: "white", padding: "0.75rem 1.5rem", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600" }}
              >
                <Plus style={{ width: "1rem", height: "1rem" }} />
                Nuevo Producto
              </Button>
            </div>
          )}
        </div>

        {/* Form */}
        {showForm && (
          <Card ref={formRef} style={{ padding: "2rem", marginBottom: "2rem", border: "1px solid #e2e8f0" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#1e293b", marginBottom: "1.5rem" }}>
              {editingId ? "Editar Producto" : "Nuevo Producto"}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#475569", marginBottom: "0.5rem" }}>
                    Código de Barras
                  </label>
                  <Input
                    type="text"
                    name="barcode"
                    value={formData.barcode}
                    onChange={handleChange}
                    placeholder="Ej: 7891234567890"
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "1rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#475569", marginBottom: "0.5rem" }}>
                    Nombre del Producto *
                  </label>
                  <Input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Ej: Laptop Dell"
                    required
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "1rem" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#475569", marginBottom: "0.5rem" }}>
                  Descripción
                </label>
                <Input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Ej: Laptop Dell Inspiron 15"
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "1rem" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#475569", marginBottom: "0.5rem" }}>
                    Precio *
                  </label>
                  <Input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="Ej: 1200.00"
                    step="0.01"
                    min="0.01"
                    required
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "1rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#475569", marginBottom: "0.5rem" }}>
                    Unidad
                  </label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "1rem" }}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Unidad">Unidad</option>
                    <option value="Caja">Caja</option>
                    <option value="Paquete">Paquete</option>
                    <option value="Kg">Kg</option>
                    <option value="Litro">Litro</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: "2rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  name="hasSerial"
                  checked={formData.hasSerial}
                  onChange={handleChange}
                  style={{ width: "1rem", height: "1rem", cursor: "pointer" }}
                />
                <label style={{ fontSize: "0.875rem", fontWeight: "500", color: "#475569", cursor: "pointer" }}>
                  Este producto tiene número de serie
                </label>
              </div>

              <div style={{ display: "flex", gap: "1rem" }}>
                <Button
                  type="submit"
                  disabled={createProductMutation.isPending || updateProductMutation.isPending}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", background: "rgb(59, 130, 246)", color: "white", padding: "0.75rem 1.5rem", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600", opacity: createProductMutation.isPending || updateProductMutation.isPending ? 0.6 : 1 }}
                >
                  <Save style={{ width: "1rem", height: "1rem" }} />
                  {createProductMutation.isPending || updateProductMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
                <Button
                  type="button"
                  onClick={handleCancel}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", background: "transparent", color: "#64748b", border: "1px solid #e2e8f0", padding: "0.75rem 1.5rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600" }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Products Table */}
        <Card style={{ border: "1px solid #e2e8f0", overflow: "hidden" }}>
          {isLoading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
              Cargando productos...
            </div>
          ) : products?.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
              No hay productos. Crea el primero.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ textAlign: "left", padding: "1rem", fontWeight: "600", color: "#475569", fontSize: "0.875rem" }}>Código</th>
                  <th style={{ textAlign: "left", padding: "1rem", fontWeight: "600", color: "#475569", fontSize: "0.875rem" }}>Nombre</th>
                  <th style={{ textAlign: "left", padding: "1rem", fontWeight: "600", color: "#475569", fontSize: "0.875rem" }}>Descripción</th>
                  <th style={{ textAlign: "right", padding: "1rem", fontWeight: "600", color: "#475569", fontSize: "0.875rem" }}>Precio</th>
                  <th style={{ textAlign: "center", padding: "1rem", fontWeight: "600", color: "#475569", fontSize: "0.875rem" }}>Serial</th>
                  <th style={{ textAlign: "center", padding: "1rem", fontWeight: "600", color: "#475569", fontSize: "0.875rem" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products?.map((product: any) => (
                  <tr key={product.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "1rem", color: "#1e293b", fontSize: "0.875rem" }}>{product.barcode || "-"}</td>
                    <td style={{ padding: "1rem", color: "#1e293b", fontWeight: "600" }}>{product.name}</td>
                    <td style={{ padding: "1rem", color: "#64748b", fontSize: "0.875rem" }}>{product.description || "-"}</td>
                    <td style={{ padding: "1rem", textAlign: "right", color: "#1e293b", fontWeight: "600" }}>${parseFloat(product.price).toFixed(2)}</td>
                    <td style={{ padding: "1rem", textAlign: "center", color: "#1e293b" }}>
                      {product.hasSerial ? "✓" : "-"}
                    </td>
                    <td style={{ padding: "1rem", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                        <button
                          onClick={() => handleEdit(product)}
                          style={{ padding: "0.5rem", background: "transparent", border: "1px solid #e2e8f0", borderRadius: "0.375rem", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}
                          title="Editar"
                        >
                          <Edit2 style={{ width: "1rem", height: "1rem" }} />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          style={{ padding: "0.5rem", background: "transparent", border: "1px solid #e2e8f0", borderRadius: "0.375rem", cursor: "pointer", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center" }}
                          title="Eliminar"
                        >
                          <Trash2 style={{ width: "1rem", height: "1rem" }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
