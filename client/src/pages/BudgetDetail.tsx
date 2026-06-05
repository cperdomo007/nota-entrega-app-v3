import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, Printer, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function BudgetDetail() {
  const [match, params] = useRoute("/budgets/:id");
  const [, setLocation] = useLocation();
  const budgetId = Number(params?.id);
  const { data: budget, isLoading } = trpc.budgets.getById.useQuery(budgetId, { enabled: !!budgetId });
  const { data: config } = trpc.config.get.useQuery();
  const deleteBudgetMutation = trpc.budgets.delete.useMutation({
    onSuccess: () => setLocation("/budgets"),
  });

  if (!match) return null;

  if (isLoading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Cargando presupuesto...</div>;
  }

  if (!budget) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "1rem" }}>Presupuesto no encontrado</div>
          <Button onClick={() => setLocation("/budgets")}>Volver</Button>
        </div>
      </div>
    );
  }

  const subtotal = Number(budget.subtotal || 0);
  const ivaAmount = Number(budget.ivaAmount || 0);
  const total = Number(budget.total || 0);
  const lines = budget.lines ?? [];

  return (
    <div className="budget-detail-page" style={{ minHeight: "100vh", padding: "2rem", background: "linear-gradient(to bottom right, #f8fafc, #f1f5f9)" }}>
      <div className="budget-detail-shell" style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div className="budget-detail-screen-header" style={{ marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "2rem", fontWeight: "bold", color: "#1e293b" }}>Presupuesto #{budget.budgetNumber}</h1>
            <p style={{ color: "#64748b", marginTop: "0.5rem" }}>{format(new Date(budget.budgetDate as any), "dd/MM/yyyy")}</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgb(59, 130, 246)", color: "white", border: "none", padding: "0.75rem 1.5rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600" }}>
              <Printer style={{ width: "1rem", height: "1rem" }} />
              Imprimir
            </Button>
            <Button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "white", color: "#334155", border: "1px solid #cbd5e1", padding: "0.75rem 1.5rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600" }}>
              <Download style={{ width: "1rem", height: "1rem" }} />
              Guardar PDF
            </Button>
            <Button
              onClick={() => {
                if (confirm("¿Eliminar este presupuesto?")) deleteBudgetMutation.mutate(budgetId);
              }}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "white", color: "#dc2626", border: "1px solid #fecaca", padding: "0.75rem 1.5rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600" }}
            >
              <Trash2 style={{ width: "1rem", height: "1rem" }} />
              Eliminar
            </Button>
            <Button onClick={() => setLocation("/budgets")} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "white", color: "#334155", border: "1px solid #cbd5e1", padding: "0.75rem 1.5rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600" }}>
              <ArrowLeft style={{ width: "1rem", height: "1rem" }} />
              Volver
            </Button>
          </div>
        </div>

        <div className="budget-print-content" style={{ background: "white", padding: "2.5rem", fontFamily: "Arial, sans-serif", fontSize: "11px", lineHeight: 1.4 }}>
          {config && (
            <div style={{ marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #333" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "2rem", alignItems: "start" }}>
                <div>
                  {config.logoDataUrl ? (
                    <img src={config.logoDataUrl} alt="Logo de la empresa" style={{ maxWidth: "160px", maxHeight: "80px", objectFit: "contain", display: "block" }} />
                  ) : (
                    <div style={{ fontSize: "18px", fontWeight: "bold", color: "#003366" }}>{config.businessName || "LOGO"}</div>
                  )}
                </div>
                <div style={{ fontSize: "10px", lineHeight: 1.6 }}>
                  <div><strong>Rif:</strong> {config.rif}</div>
                  <div><strong>Dirección Fiscal:</strong> {config.address}</div>
                  <div><strong>Teléfonos:</strong> {config.phone1}{config.phone2 ? ` / ${config.phone2}` : ""}</div>
                  <div><strong>E-mail:</strong> {config.email}</div>
                  <div><strong>Website:</strong> {config.website}</div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "2rem", marginBottom: "1.5rem", alignItems: "center" }}>
            <h1 style={{ textAlign: "center", fontSize: "16px", margin: 0 }}>PRESUPUESTO</h1>
            <div style={{ textAlign: "center", border: "2px solid #333", padding: "0.5rem", fontWeight: "bold" }}>Nº {budget.budgetNumber}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "1.5rem" }}>
            <div>
              <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>Datos del Cliente</div>
              <div><strong>Nombre o Razon Social:</strong> {budget.clientName}</div>
              <div><strong>Rif:</strong> {budget.clientRif || ""}</div>
              <div><strong>Dirección:</strong> {budget.clientAddress || ""}</div>
            </div>
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div style={{ border: "1px solid #333", padding: "0.5rem", textAlign: "center" }}>
                  <div style={{ fontSize: "9px", color: "#666" }}>Cliente</div>
                  <div style={{ fontWeight: "bold" }}>{budget.clientRif || "-"}</div>
                </div>
                <div style={{ border: "1px solid #333", padding: "0.5rem", textAlign: "center" }}>
                  <div style={{ fontSize: "9px", color: "#666" }}>Fecha</div>
                  <div style={{ fontWeight: "bold" }}>{format(new Date(budget.budgetDate as any), "dd-MM-yyyy")}</div>
                </div>
              </div>
              <div><strong>Atención:</strong> {budget.clientContact || ""}</div>
              <div><strong>Teléfonos de Contacto:</strong> {budget.clientPhone || ""}</div>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #333", marginBottom: "1rem" }}>
            <thead>
              <tr style={{ background: "#003366", color: "white" }}>
                <th style={{ border: "1px solid #333", padding: "0.4rem", width: "8%" }}>Item N°</th>
                <th style={{ border: "1px solid #333", padding: "0.4rem", textAlign: "left" }}>Descripción</th>
                <th style={{ border: "1px solid #333", padding: "0.4rem", width: "10%" }}>Cant.</th>
                <th style={{ border: "1px solid #333", padding: "0.4rem", textAlign: "right", width: "15%" }}>Precio Unit.</th>
                <th style={{ border: "1px solid #333", padding: "0.4rem", textAlign: "right", width: "15%" }}>Total Bs</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line: any, index: number) => (
                <tr key={line.id}>
                  <td style={{ border: "1px solid #ccc", padding: "0.4rem", textAlign: "center" }}>{index + 1}</td>
                  <td style={{ border: "1px solid #ccc", padding: "0.4rem" }}>{line.description}</td>
                  <td style={{ border: "1px solid #ccc", padding: "0.4rem", textAlign: "center" }}>{line.quantity}</td>
                  <td style={{ border: "1px solid #ccc", padding: "0.4rem", textAlign: "right" }}>{Number(line.unitPrice).toFixed(2)}</td>
                  <td style={{ border: "1px solid #ccc", padding: "0.4rem", textAlign: "right", fontWeight: "bold" }}>{Number(line.lineTotal).toFixed(2)}</td>
                </tr>
              ))}
              {[...Array(Math.max(0, 8 - lines.length))].map((_, index) => (
                <tr key={`empty-${index}`}>
                  <td style={{ border: "1px solid #ccc", padding: "0.4rem", height: "1.5rem" }}></td>
                  <td style={{ border: "1px solid #ccc", padding: "0.4rem" }}></td>
                  <td style={{ border: "1px solid #ccc", padding: "0.4rem" }}></td>
                  <td style={{ border: "1px solid #ccc", padding: "0.4rem" }}></td>
                  <td style={{ border: "1px solid #ccc", padding: "0.4rem" }}></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 250px", gap: "2rem", marginBottom: "2rem" }}>
            <div style={{ border: "1px solid #333", padding: "0.5rem", minHeight: "2.25rem" }}>
              <strong>Observaciones:</strong> <span style={{ whiteSpace: "pre-wrap" }}>{budget.observations || ""}</span>
            </div>
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", marginBottom: "0.4rem" }}>
                <span style={{ textAlign: "right" }}>Sub-Total</span>
                <strong>{subtotal.toFixed(2)}</strong>
              </div>
              {budget.applyIVA && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", marginBottom: "0.4rem" }}>
                  <span style={{ textAlign: "right" }}>IVA</span>
                  <strong>{ivaAmount.toFixed(2)}</strong>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", borderTop: "2px solid #333", paddingTop: "0.5rem" }}>
                <span style={{ textAlign: "right", fontWeight: "bold" }}>TOTAL NETO Bs.</span>
                <strong>{total.toFixed(2)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media print {
          body { margin: 0; padding: 0; background: white; }
          .budget-detail-page { background: white !important; padding: 0 !important; min-height: auto !important; }
          .budget-detail-shell { max-width: 100% !important; margin: 0 !important; }
          .budget-detail-screen-header { display: none !important; }
          .budget-print-content { padding: 0.35in !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
