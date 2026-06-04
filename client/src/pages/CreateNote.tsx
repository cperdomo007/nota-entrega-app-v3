import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { format } from "date-fns";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

interface LineItem {
  productId: number;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  product: any;
  serials: string[];
}

function normalizeSerial(serial: string) {
  return serial.trim();
}

function toDateInputValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return format(value, "yyyy-MM-dd");
  }

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return format(parsed, "yyyy-MM-dd");
    }
  }

  return format(new Date(), "yyyy-MM-dd");
}

export default function CreateNote() {
  const [, setLocation] = useLocation();
  const [editMatch, editParams] = useRoute("/notes/:id/edit");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const noteId = editMatch ? Number(editParams?.id) : null;
  const isEditing = Number.isFinite(noteId);

  const [noteNumber, setNoteNumber] = useState("");
  const [noteDate, setNoteDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [clientName, setClientName] = useState("");
  const [clientRif, setClientRif] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [observations, setObservations] = useState("");
  const [applyIVA, setApplyIVA] = useState(true);
  const [lines, setLines] = useState<LineItem[]>([]);

  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [editingSerials, setEditingSerials] = useState<number | null>(null);
  const [serialInput, setSerialInput] = useState("");

  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [showClientSearch, setShowClientSearch] = useState(false);

  const { data: nextNumber } = trpc.notes.getNextNumber.useQuery();
  const { data: noteToEdit, isLoading: isLoadingNoteToEdit } = trpc.notes.getById.useQuery(
    noteId ?? 0,
    { enabled: isEditing }
  );
  const { data: config } = trpc.config.get.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery();
  const { data: searchClientResults = [] } = trpc.clients.search.useQuery(clientSearchQuery, {
    enabled: clientSearchQuery.trim().length > 0,
  });

  const createCompleteNoteMutation = trpc.notes.createComplete.useMutation();
  const updateCompleteNoteMutation = trpc.notes.updateComplete.useMutation();
  const isSaving = createCompleteNoteMutation.isPending || updateCompleteNoteMutation.isPending;

  useEffect(() => {
    if (!isEditing && nextNumber && !noteNumber) {
      setNoteNumber(nextNumber);
    }
  }, [isEditing, nextNumber, noteNumber]);

  useEffect(() => {
    if (!isEditing || !noteToEdit) return;

    setNoteNumber(String(noteToEdit.noteNumber ?? ""));
    setNoteDate(toDateInputValue(noteToEdit.noteDate));
    setClientName(String(noteToEdit.clientName ?? ""));
    setClientRif(String(noteToEdit.clientRif ?? ""));
    setClientAddress(String(noteToEdit.clientAddress ?? ""));
    setClientPhone(String(noteToEdit.clientPhone ?? ""));
    setClientContact(String(noteToEdit.clientContact ?? ""));
    setObservations(String(noteToEdit.observations ?? ""));
    setApplyIVA(Boolean(noteToEdit.applyIVA));
    setLines(
      (noteToEdit.lines ?? []).map((line: any) => {
        const quantity = Number(line.quantity) || 1;
        const unitPrice = Number(line.unitPrice) || 0;
        return {
          productId: line.productId,
          quantity,
          unitPrice,
          lineTotal: Number(line.lineTotal) || quantity * unitPrice,
          product: line.product,
          serials: (line.serials ?? []).map((serial: any) => String(serial.serial ?? serial)),
        };
      })
    );
  }, [isEditing, noteToEdit]);

  const productSearchResults = useMemo(() => {
    const query = productSearchQuery.trim().toLowerCase();
    if (!query) return [];

    return products
      .filter((product: any) => {
        const barcode = String(product.barcode ?? "").toLowerCase();
        const name = String(product.name ?? "").toLowerCase();
        return barcode.includes(query) || name.includes(query);
      })
      .slice(0, 20);
  }, [products, productSearchQuery]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const ivaRate = config?.ivaRate ? Number(config.ivaRate) : 16;
    const ivaAmount = applyIVA ? subtotal * (ivaRate / 100) : 0;
    const total = subtotal + ivaAmount;
    return { subtotal, ivaAmount, total, ivaRate };
  }, [applyIVA, config?.ivaRate, lines]);

  const resetProductSearch = () => {
    setProductSearchQuery("");
    setShowProductSearch(false);
    searchInputRef.current?.focus();
  };

  const addProduct = (product: any) => {
    setLines((currentLines) => {
      const existingIndex = currentLines.findIndex(
        (line) => line.productId === product.id && !product.hasSerial
      );

      if (existingIndex >= 0) {
        return currentLines.map((line, index) => {
          if (index !== existingIndex) return line;
          const quantity = line.quantity + 1;
          return {
            ...line,
            quantity,
            lineTotal: quantity * line.unitPrice,
          };
        });
      }

      const unitPrice = Number(product.price) || 0;
      return [
        ...currentLines,
        {
          productId: product.id,
          quantity: 1,
          unitPrice,
          lineTotal: unitPrice,
          product,
          serials: [],
        },
      ];
    });

    resetProductSearch();
  };

  const handleProductSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();

    const query = productSearchQuery.trim();
    if (!query) return;

    const exactBarcode = products.find((product: any) => String(product.barcode ?? "") === query);
    if (exactBarcode) {
      addProduct(exactBarcode);
      return;
    }

    if (productSearchResults.length === 1) {
      addProduct(productSearchResults[0]);
      return;
    }

    if (productSearchResults.length === 0) {
      alert("Producto no encontrado");
    }
  };

  const updateLine = (index: number, updates: Partial<Pick<LineItem, "quantity" | "unitPrice">>) => {
    setLines((currentLines) =>
      currentLines.map((line, lineIndex) => {
        if (lineIndex !== index) return line;

        const quantity = Math.max(1, updates.quantity ?? line.quantity);
        const unitPrice = Math.max(0, updates.unitPrice ?? line.unitPrice);
        const serials = line.product?.hasSerial ? line.serials.slice(0, quantity) : line.serials;

        return {
          ...line,
          quantity,
          unitPrice,
          serials,
          lineTotal: quantity * unitPrice,
        };
      })
    );
  };

  const removeLine = (index: number) => {
    setLines((currentLines) => currentLines.filter((_, lineIndex) => lineIndex !== index));
    if (editingSerials === index) setEditingSerials(null);
  };

  const addSerial = (lineIndex: number, value: string) => {
    const serial = normalizeSerial(value);
    if (!serial) return;

    setLines((currentLines) => {
      const allSerials = currentLines.flatMap((line) => line.serials.map(normalizeSerial));
      if (allSerials.includes(serial)) {
        alert(`El serial ${serial} ya fue agregado`);
        return currentLines;
      }

      const targetLine = currentLines[lineIndex];
      if (!targetLine) return currentLines;

      if (targetLine.serials.length >= targetLine.quantity) {
        alert(`Este producto requiere exactamente ${targetLine.quantity} serial(es)`);
        return currentLines;
      }

      return currentLines.map((line, index) =>
        index === lineIndex ? { ...line, serials: [...line.serials, serial] } : line
      );
    });

    setSerialInput("");
  };

  const removeSerial = (lineIndex: number, serialIndex: number) => {
    setLines((currentLines) =>
      currentLines.map((line, index) =>
        index === lineIndex
          ? { ...line, serials: line.serials.filter((_, idx) => idx !== serialIndex) }
          : line
      )
    );
  };

  const validateNote = () => {
    if (!noteNumber.trim()) return "El número de nota es obligatorio";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(noteDate)) return "La fecha de la nota no es válida";
    if (!clientName.trim()) return "El cliente es obligatorio";
    if (lines.length === 0) return "Agrega al menos un producto";

    const allSerials = lines.flatMap((line) => line.serials.map(normalizeSerial));
    const duplicatedSerial = allSerials.find((serial, index) => allSerials.indexOf(serial) !== index);
    if (duplicatedSerial) return `El serial ${duplicatedSerial} está duplicado`;

    for (const line of lines) {
      if (line.quantity <= 0) return `La cantidad de ${line.product?.name} debe ser mayor que cero`;
      if (line.unitPrice < 0) return `El precio de ${line.product?.name} no es válido`;
      if (line.product?.hasSerial && line.serials.length !== line.quantity) {
        return `El producto ${line.product?.name} requiere ${line.quantity} serial(es) y tiene ${line.serials.length}`;
      }
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateNote();
    if (validationError) {
      alert(validationError);
      return;
    }

    try {
      const payload = {
        noteNumber: noteNumber.trim(),
        noteDate,
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
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          serials: line.serials,
        })),
      };

      const result = isEditing
        ? await updateCompleteNoteMutation.mutateAsync({ id: noteId as number, ...payload })
        : await createCompleteNoteMutation.mutateAsync(payload);

      setLocation(`/notes/${result.id}`);
    } catch (error) {
      console.error("Error creating note:", error);
      const message = error instanceof Error ? error.message : "Error al crear la nota";
      alert(message);
    }
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

  if (isEditing && isLoadingNoteToEdit) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(to bottom right, #f8fafc, #f1f5f9)" }}>
        <div style={{ fontSize: "1.25rem", fontWeight: "600", color: "#1e293b" }}>Cargando nota...</div>
      </div>
    );
  }

  if (isEditing && !noteToEdit) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(to bottom right, #f8fafc, #f1f5f9)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: "600", color: "#1e293b", marginBottom: "1rem" }}>Nota no encontrada</div>
          <Button onClick={() => setLocation("/notes")} style={{ background: "rgb(59, 130, 246)", color: "white", padding: "0.75rem 1.5rem", border: "none", borderRadius: "0.375rem", cursor: "pointer" }}>
            Volver a notas
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "2rem", background: "linear-gradient(to bottom right, #f8fafc, #f1f5f9)" }}>
      <div style={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto" }}>
        <div style={{ marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: "bold", color: "#1e293b" }}>{isEditing ? `Editar Nota #${noteNumber}` : "Nueva Nota de Entrega"}</h1>
          <Button onClick={() => setLocation("/")} style={{ background: "transparent", color: "#64748b", border: "1px solid #e2e8f0", padding: "0.5rem 1rem", borderRadius: "0.375rem", cursor: "pointer" }}>
            ← Volver
          </Button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
          <div>
            <Card style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", marginBottom: "1rem" }}>Datos de la Nota</h2>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#475569", marginBottom: "0.25rem" }}>Número</label>
                <Input value={noteNumber} onChange={(event) => setNoteNumber(event.target.value)} placeholder="Número de nota" />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#475569", marginBottom: "0.25rem" }}>Fecha</label>
                <Input type="date" value={noteDate} onChange={(event) => setNoteDate(event.target.value)} />
              </div>
            </Card>

            <Card style={{ padding: "1.5rem" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", marginBottom: "1rem" }}>Datos del Cliente</h2>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#475569", marginBottom: "0.25rem" }}>Buscar Cliente</label>
                <div style={{ position: "relative" }}>
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
                        <div key={client.id} onClick={() => selectClient(client)} style={{ padding: "0.75rem", borderBottom: "1px solid #f1f5f9", cursor: "pointer", background: "#f8fafc" }}>
                          <div style={{ fontWeight: "500", color: "#1e293b" }}>{client.name}</div>
                          <div style={{ fontSize: "0.875rem", color: "#64748b" }}>{client.rif || "Sin RIF"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#475569", marginBottom: "0.25rem" }}>Nombre/Razón Social *</label>
                <Input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Nombre del cliente" />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#475569", marginBottom: "0.25rem" }}>RIF</label>
                <Input value={clientRif} onChange={(event) => setClientRif(event.target.value)} placeholder="J-XXXXXXXXX" />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#475569", marginBottom: "0.25rem" }}>Dirección</label>
                <Input value={clientAddress} onChange={(event) => setClientAddress(event.target.value)} placeholder="Dirección" />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#475569", marginBottom: "0.25rem" }}>Teléfono</label>
                <Input value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} placeholder="Teléfono" />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#475569", marginBottom: "0.25rem" }}>Contacto</label>
                <Input value={clientContact} onChange={(event) => setClientContact(event.target.value)} placeholder="Nombre del contacto" />
              </div>
            </Card>

            <Card style={{ padding: "1.5rem", marginTop: "1.5rem" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", marginBottom: "1rem" }}>Observaciones</h2>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#475569", marginBottom: "0.25rem" }}>Comentario opcional</label>
              <Textarea
                value={observations}
                onChange={(event) => setObservations(event.target.value)}
                placeholder="Escribe cualquier observacion adicional para esta nota"
                style={{ minHeight: "110px", resize: "vertical" }}
              />
            </Card>
          </div>

          <div>
            <Card style={{ padding: "1.5rem", position: "sticky", top: "2rem" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", marginBottom: "1.5rem" }}>Resumen</h2>
              <div style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ color: "#64748b" }}>Subtotal:</span>
                  <span style={{ fontWeight: "600", color: "#1e293b" }}>${totals.subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#64748b", cursor: "pointer" }}>
                    <input type="checkbox" checked={applyIVA} onChange={(event) => setApplyIVA(event.target.checked)} style={{ cursor: "pointer" }} />
                    Aplicar IVA ({totals.ivaRate}%)
                  </label>
                  <span style={{ fontWeight: "600", color: "#1e293b" }}>${totals.ivaAmount.toFixed(2)}</span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
                <span style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b" }}>Total Neto:</span>
                <span style={{ fontSize: "1.5rem", fontWeight: "bold", color: "rgb(59, 130, 246)" }}>${totals.total.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button onClick={handleSave} disabled={isSaving} style={{ flex: 1, background: "rgb(59, 130, 246)", color: "white", padding: "0.75rem", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600" }}>
                  {isSaving ? "Guardando..." : isEditing ? "Guardar Cambios" : "Guardar Nota"}
                </Button>
                <Button onClick={() => setLocation("/")} style={{ flex: 1, background: "transparent", color: "#64748b", border: "1px solid #e2e8f0", padding: "0.75rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600" }}>
                  Cancelar
                </Button>
              </div>
            </Card>
          </div>
        </div>

        <Card style={{ padding: "1.5rem", marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", marginBottom: "1rem" }}>Productos</h2>
          <div style={{ marginBottom: "1.5rem", position: "relative" }}>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#475569", marginBottom: "0.25rem" }}>Buscar Producto (Código o Nombre)</label>
            <Input
              ref={searchInputRef}
              value={productSearchQuery}
              onChange={(event) => {
                setProductSearchQuery(event.target.value);
                setShowProductSearch(true);
              }}
              onKeyDown={handleProductSearchKeyDown}
              placeholder="Escanea o escribe el código de barras y presiona Enter..."
              style={{ fontSize: "1rem" }}
            />
            {showProductSearch && productSearchResults.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #e2e8f0", borderRadius: "0.375rem", marginTop: "0.5rem", zIndex: 10, maxHeight: "300px", overflowY: "auto", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
                {productSearchResults.map((product: any) => (
                  <div key={product.id} onClick={() => addProduct(product)} style={{ padding: "0.75rem 1rem", cursor: "pointer", borderBottom: "1px solid #e2e8f0" }}>
                    <div style={{ fontWeight: "600", color: "#1e293b" }}>{product.name}</div>
                    <div style={{ fontSize: "0.875rem", color: "#64748b" }}>{product.barcode || "Sin código"} - ${Number(product.price).toFixed(2)} {product.hasSerial ? "- Requiere serial" : ""}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {lines.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>Agrega productos para comenzar</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600", color: "#475569", fontSize: "0.875rem" }}>Producto</th>
                    <th style={{ textAlign: "center", padding: "0.75rem", fontWeight: "600", color: "#475569", fontSize: "0.875rem" }}>Cant.</th>
                    <th style={{ textAlign: "right", padding: "0.75rem", fontWeight: "600", color: "#475569", fontSize: "0.875rem" }}>P. Unit.</th>
                    <th style={{ textAlign: "right", padding: "0.75rem", fontWeight: "600", color: "#475569", fontSize: "0.875rem" }}>Subtotal</th>
                    <th style={{ textAlign: "center", padding: "0.75rem", fontWeight: "600", color: "#475569", fontSize: "0.875rem" }}>Seriales</th>
                    <th style={{ textAlign: "center", padding: "0.75rem" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={`${line.productId}-${index}`} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "0.75rem" }}>
                        <div style={{ fontWeight: "500", color: "#1e293b" }}>{line.product?.name}</div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b" }}>{line.product?.barcode}</div>
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "center" }}>
                        <Input type="number" min="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) || 1 })} style={{ width: "70px", textAlign: "center" }} />
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "right" }}>
                        <Input type="number" min="0" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: Number(event.target.value) || 0 })} step="0.01" style={{ width: "100px", textAlign: "right" }} />
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600", color: "#1e293b" }}>${line.lineTotal.toFixed(2)}</td>
                      <td style={{ padding: "0.75rem", textAlign: "center" }}>
                        {line.product?.hasSerial ? (
                          <Button onClick={() => setEditingSerials(editingSerials === index ? null : index)} style={{ background: line.serials.length === line.quantity ? "rgb(34, 197, 94)" : "transparent", color: line.serials.length === line.quantity ? "white" : "#64748b", border: "1px solid #e2e8f0", padding: "0.25rem 0.75rem", borderRadius: "0.25rem", fontSize: "0.875rem", cursor: "pointer" }}>
                            {line.serials.length}/{line.quantity} seriales
                          </Button>
                        ) : (
                          <span style={{ fontSize: "0.875rem", color: "#94a3b8" }}>N/A</span>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "center" }}>
                        <Button onClick={() => removeLine(index)} style={{ background: "transparent", color: "#ef4444", border: "none", padding: "0.25rem", cursor: "pointer" }}>
                          <Trash2 style={{ width: "1rem", height: "1rem" }} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {editingSerials !== null && lines[editingSerials] && (
                <div style={{ marginTop: "1rem", padding: "1rem", background: "#f8fafc", borderRadius: "0.375rem", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                    <h3 style={{ fontWeight: "600", color: "#1e293b" }}>Seriales para {lines[editingSerials].product?.name}</h3>
                    <Button onClick={() => setEditingSerials(null)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                      <X style={{ width: "1.25rem", height: "1.25rem", color: "#64748b" }} />
                    </Button>
                  </div>

                  {lines[editingSerials].serials.length > 0 && (
                    <div style={{ marginBottom: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      {lines[editingSerials].serials.map((serial, serialIndex) => (
                        <div key={`${serial}-${serialIndex}`} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "white", padding: "0.5rem 0.75rem", borderRadius: "0.25rem", border: "1px solid #e2e8f0" }}>
                          <span style={{ fontSize: "0.875rem", color: "#1e293b" }}>{serial}</span>
                          <Button onClick={() => removeSerial(editingSerials, serialIndex)} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "#ef4444" }}>
                            <X style={{ width: "1rem", height: "1rem" }} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Input
                      value={serialInput}
                      onChange={(event) => setSerialInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addSerial(editingSerials, serialInput);
                        }
                      }}
                      placeholder="Escanea o ingresa un serial y presiona Enter"
                      style={{ flex: 1 }}
                    />
                    <Button onClick={() => addSerial(editingSerials, serialInput)} style={{ background: "rgb(59, 130, 246)", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600" }}>
                      <Plus style={{ width: "1rem", height: "1rem" }} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
