import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

interface BudgetLineItem {
  productId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export default function CreateBudget() {
  const [, setLocation] = useLocation();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [budgetNumber, setBudgetNumber] = useState("");
  const [budgetDate, setBudgetDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [clientName, setClientName] = useState("");
  const [clientRif, setClientRif] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [observations, setObservations] = useState("Equipos 1 año de Garantia Tasa BCV");
  const [applyIVA, setApplyIVA] = useState(true);
  const [lines, setLines] = useState<BudgetLineItem[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [showClientSearch, setShowClientSearch] = useState(false);

  const { data: nextNumber } = trpc.budgets.getNextNumber.useQuery();
  const { data: config } = trpc.config.get.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery();
  const { data: searchClientResults = [] } = trpc.clients.search.useQuery(clientSearchQuery, {
    enabled: clientSearchQuery.trim().length > 0,
  });
  const createBudgetMutation = trpc.budgets.createComplete.useMutation();

  useEffect(() => {
    if (nextNumber && !budgetNumber) {
      setBudgetNumber(nextNumber);
    }
  }, [budgetNumber, nextNumber]);

  const productSearchResults = useMemo(() => {
    const query = productSearchQuery.trim().toLowerCase();
    if (!query) return [];

    return products
      .filter((product: any) => {
        const barcode = String(product.barcode ?? "").toLowerCase();
        const name = String(product.name ?? "").toLowerCase();
        return barcode.includes(query) || name.includes(query);
      })
      .slice(0, 12);
  }, [products, productSearchQuery]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const ivaRate = config?.ivaRate ? Number(config.ivaRate) : 16;
    const ivaAmount = applyIVA ? subtotal * (ivaRate / 100) : 0;
    const total = subtotal + ivaAmount;
    return { subtotal, ivaAmount, total, ivaRate };
  }, [applyIVA, config?.ivaRate, lines]);

  const addProduct = (product: any) => {
    const unitPrice = Number(product.price) || 0;
    setLines((currentLines) => [
      ...currentLines,
      {
        productId: product.id,
        description: product.name,
        quantity: 1,
        unitPrice,
        lineTotal: unitPrice,
      },
    ]);
    setProductSearchQuery("");
    searchInputRef.current?.focus();
  };

  const updateLine = (index: number, updates: Partial<BudgetLineItem>) => {
    setLines((currentLines) =>
      currentLines.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const quantity = Math.max(1, Number(updates.quantity ?? line.quantity) || 1);
        const unitPrice = Math.max(0, Number(updates.unitPrice ?? line.unitPrice) || 0);
        return {
          ...line,
          ...updates,
          quantity,
          unitPrice,
          lineTotal: quantity * unitPrice,
        };
      })
    );
  };

  const removeLine = (index: number) => {
    setLines((currentLines) => currentLines.filter((_, lineIndex) => lineIndex !== index));
  };

  const selectClient = (client: any) => {
    setClientName(client.name ?? "");
    setClientRif(client.rif ?? "");
    setClientAddress(client.address ?? "");
    setClientPhone(client.phone ?? "");
    setClientContact(client.contact ?? "");
    setShowClientSearch(false);
    setClientSearchQuery("");
  };

  const handleSave = async () => {
    if (!budgetNumber.trim()) return alert("El numero de presupuesto es obligatorio");
    if (!clientName.trim()) return alert("El cliente es obligatorio");
    if (lines.length === 0) return alert("Agrega al menos un item");

    try {
      const result = await createBudgetMutation.mutateAsync({
        budgetNumber: budgetNumber.trim(),
        budgetDate,
        clientName: clientName.trim(),
        clientRif: clientRif.trim() || undefined,
        clientAddress: clientAddress.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        clientContact: clientContact.trim() || undefined,
        observations: observations.trim() || undefined,
        applyIVA,
        ivaRate: totals.ivaRate,
        lines: lines.map((line) => ({
          productId: line.productId,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        })),
      });

      setLocation(`/budgets/${result.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al crear el presupuesto";
      alert(message);
    }
  };

  return (
    <div style={{ minHeight: "100vh", padding: "2rem", background: "linear-gradient(to bottom right, #f8fafc, #f1f5f9)" }}>
      <div style={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto" }}>
        <div style={{ marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: "bold", color: "#1e293b" }}>Nuevo Presupuesto</h1>
          <Button onClick={() => setLocation("/budgets")} style={{ background: "white", color: "#334155", border: "1px solid #cbd5e1", padding: "0.75rem 1.5rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600" }}>
            Volver
          </Button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
          <div>
            <Card style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", marginBottom: "1rem" }}>Datos del Presupuesto</h2>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#475569", marginBottom: "0.25rem" }}>Numero</label>
              <Input value={budgetNumber} onChange={(event) => setBudgetNumber(event.target.value)} style={{ marginBottom: "1rem" }} />
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#475569", marginBottom: "0.25rem" }}>Fecha</label>
              <Input type="date" value={budgetDate} onChange={(event) => setBudgetDate(event.target.value)} />
            </Card>

            <Card style={{ padding: "1.5rem" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", marginBottom: "1rem" }}>Datos del Cliente</h2>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#475569", marginBottom: "0.25rem" }}>Buscar Cliente</label>
              <div style={{ position: "relative", marginBottom: "1rem" }}>
                <Input
                  value={clientSearchQuery}
                  onChange={(event) => {
                    setClientSearchQuery(event.target.value);
                    setShowClientSearch(true);
                  }}
                  placeholder="Buscar por nombre, RIF o email"
                />
                {showClientSearch && searchClientResults.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #e2e8f0", borderRadius: "0.375rem", marginTop: "0.25rem", zIndex: 10, maxHeight: "200px", overflowY: "auto" }}>
                    {searchClientResults.map((client: any) => (
                      <div key={client.id} onClick={() => selectClient(client)} style={{ padding: "0.75rem", borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}>
                        <div style={{ fontWeight: "500", color: "#1e293b" }}>{client.name}</div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b" }}>{client.rif || "Sin RIF"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Nombre/Razon Social" style={{ marginBottom: "1rem" }} />
              <Input value={clientRif} onChange={(event) => setClientRif(event.target.value)} placeholder="RIF" style={{ marginBottom: "1rem" }} />
              <Input value={clientAddress} onChange={(event) => setClientAddress(event.target.value)} placeholder="Direccion" style={{ marginBottom: "1rem" }} />
              <Input value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} placeholder="Telefono" style={{ marginBottom: "1rem" }} />
              <Input value={clientContact} onChange={(event) => setClientContact(event.target.value)} placeholder="Atencion / Contacto" />
            </Card>
          </div>

          <Card style={{ padding: "1.5rem", alignSelf: "start", position: "sticky", top: "2rem" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", marginBottom: "1.5rem" }}>Resumen</h2>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <span style={{ color: "#64748b" }}>Sub-Total</span>
              <strong>${totals.subtotal.toFixed(2)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#64748b" }}>
                <input type="checkbox" checked={applyIVA} onChange={(event) => setApplyIVA(event.target.checked)} />
                IVA ({totals.ivaRate}%)
              </label>
              <strong>${totals.ivaAmount.toFixed(2)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", paddingTop: "1rem", marginBottom: "1.5rem" }}>
              <span style={{ fontSize: "1.125rem", fontWeight: "600" }}>TOTAL NETO</span>
              <span style={{ fontSize: "1.5rem", fontWeight: "bold", color: "rgb(59, 130, 246)" }}>${totals.total.toFixed(2)}</span>
            </div>
            <Button onClick={handleSave} disabled={createBudgetMutation.isPending} style={{ width: "100%", background: "rgb(59, 130, 246)", color: "white", border: "none", padding: "0.75rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600" }}>
              {createBudgetMutation.isPending ? "Guardando..." : "Guardar Presupuesto"}
            </Button>
          </Card>
        </div>

        <Card style={{ padding: "1.5rem", marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", marginBottom: "1rem" }}>Items</h2>
          <div style={{ position: "relative", marginBottom: "1rem" }}>
            <Input ref={searchInputRef} value={productSearchQuery} onChange={(event) => setProductSearchQuery(event.target.value)} placeholder="Buscar producto por codigo o nombre..." />
            {productSearchResults.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #e2e8f0", borderRadius: "0.375rem", marginTop: "0.25rem", zIndex: 10, maxHeight: "260px", overflowY: "auto" }}>
                {productSearchResults.map((product: any) => (
                  <div key={product.id} onClick={() => addProduct(product)} style={{ padding: "0.75rem", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ fontWeight: "600", color: "#1e293b" }}>{product.name}</div>
                    <div style={{ fontSize: "0.875rem", color: "#64748b" }}>{product.barcode || "Sin codigo"} - ${Number(product.price).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button onClick={() => setLines((current) => [...current, { description: "", quantity: 1, unitPrice: 0, lineTotal: 0 }])} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "white", color: "#334155", border: "1px solid #cbd5e1", padding: "0.5rem 1rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600", marginBottom: "1rem" }}>
            <Plus style={{ width: "1rem", height: "1rem" }} />
            Agregar item manual
          </Button>
          {lines.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "2rem" }}>Agrega productos o items manuales</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: "0.75rem", textAlign: "left" }}>Descripcion</th>
                    <th style={{ padding: "0.75rem", textAlign: "center" }}>Cant.</th>
                    <th style={{ padding: "0.75rem", textAlign: "right" }}>Precio Unit.</th>
                    <th style={{ padding: "0.75rem", textAlign: "right" }}>Total</th>
                    <th style={{ padding: "0.75rem" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={index} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "0.75rem" }}><Input value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} /></td>
                      <td style={{ padding: "0.75rem", textAlign: "center" }}><Input type="number" min="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) || 1 })} style={{ width: "80px", textAlign: "center" }} /></td>
                      <td style={{ padding: "0.75rem", textAlign: "right" }}><Input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: Number(event.target.value) || 0 })} style={{ width: "120px", textAlign: "right" }} /></td>
                      <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600" }}>${line.lineTotal.toFixed(2)}</td>
                      <td style={{ padding: "0.75rem", textAlign: "center" }}><Button onClick={() => removeLine(index)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}><Trash2 style={{ width: "1rem", height: "1rem" }} /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card style={{ padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", marginBottom: "1rem" }}>Observaciones</h2>
          <Textarea value={observations} onChange={(event) => setObservations(event.target.value)} style={{ minHeight: "110px", resize: "vertical" }} />
        </Card>
      </div>
    </div>
  );
}
