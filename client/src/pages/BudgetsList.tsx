import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Eye, FileText, Home, Plus, Search } from "lucide-react";
import { format } from "date-fns";

export default function BudgetsList() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const trimmedSearchQuery = searchQuery.trim();
  const hasSearch = trimmedSearchQuery.length > 0;

  const { data: pagedBudgets = [], isLoading: isPagedLoading } = trpc.budgets.list.useQuery(
    { limit: 50, offset: 0 },
    { enabled: !hasSearch }
  );
  const { data: searchedBudgets = [], isLoading: isSearchLoading } = trpc.budgets.search.useQuery(
    trimmedSearchQuery,
    { enabled: hasSearch }
  );
  const budgets = hasSearch ? searchedBudgets : pagedBudgets;
  const isLoading = hasSearch ? isSearchLoading : isPagedLoading;

  return (
    <div style={{ minHeight: "100vh", padding: "2rem", background: "linear-gradient(to bottom right, #f8fafc, #f1f5f9)" }}>
      <div style={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto" }}>
        <div style={{ marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "2rem", fontWeight: "bold", color: "#1e293b" }}>Presupuestos</h1>
            <p style={{ color: "#64748b", marginTop: "0.5rem" }}>Crea y consulta presupuestos para tus clientes</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Button onClick={() => setLocation("/")} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "white", color: "#334155", border: "1px solid #cbd5e1", padding: "0.75rem 1.5rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600" }}>
              <Home style={{ width: "1rem", height: "1rem" }} />
              Inicio
            </Button>
            <Button onClick={() => setLocation("/budgets/new")} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgb(59, 130, 246)", color: "white", border: "none", padding: "0.75rem 1.5rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600" }}>
              <Plus style={{ width: "1rem", height: "1rem" }} />
              Nuevo Presupuesto
            </Button>
          </div>
        </div>

        <Card style={{ padding: "1.5rem", marginBottom: "2rem", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Search style={{ width: "1.25rem", height: "1.25rem", color: "#94a3b8", flexShrink: 0 }} />
            <Input
              placeholder="Buscar por numero de presupuesto o cliente..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              style={{ flex: 1, padding: "0.75rem", border: "none", outline: "none", fontSize: "1rem" }}
            />
          </div>
        </Card>

        <Card style={{ border: "1px solid #e2e8f0", overflow: "hidden" }}>
          {isLoading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>Cargando presupuestos...</div>
          ) : budgets.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
              <FileText style={{ width: "3rem", height: "3rem", color: "rgba(100, 116, 139, 0.35)", margin: "0 auto 1rem" }} />
              No hay presupuestos para mostrar
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ textAlign: "left", padding: "1rem", color: "#475569" }}>Numero</th>
                  <th style={{ textAlign: "left", padding: "1rem", color: "#475569" }}>Fecha</th>
                  <th style={{ textAlign: "left", padding: "1rem", color: "#475569" }}>Cliente</th>
                  <th style={{ textAlign: "right", padding: "1rem", color: "#475569" }}>Total</th>
                  <th style={{ textAlign: "center", padding: "1rem", color: "#475569" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((budget: any) => (
                  <tr key={budget.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "1rem", fontWeight: "600", color: "#1e293b" }}>#{budget.budgetNumber}</td>
                    <td style={{ padding: "1rem", color: "#1e293b" }}>{format(new Date(budget.budgetDate), "dd/MM/yyyy")}</td>
                    <td style={{ padding: "1rem", color: "#1e293b" }}>{budget.clientName}</td>
                    <td style={{ padding: "1rem", textAlign: "right", fontWeight: "600", color: "#1e293b" }}>${Number(budget.total || 0).toFixed(2)}</td>
                    <td style={{ padding: "1rem", textAlign: "center" }}>
                      <button onClick={() => setLocation(`/budgets/${budget.id}`)} title="Ver detalle" style={{ padding: "0.5rem", background: "transparent", border: "1px solid #e2e8f0", borderRadius: "0.375rem", cursor: "pointer", color: "#64748b" }}>
                        <Eye style={{ width: "1rem", height: "1rem" }} />
                      </button>
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
