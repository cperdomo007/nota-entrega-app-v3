import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Plus, Eye, Printer, Download, Search, Home } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function NotesList() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const trimmedSearchQuery = searchQuery.trim();
  const hasSearch = trimmedSearchQuery.length > 0;

  const { data: pagedNotes, isLoading: isPagedLoading } = trpc.notes.list.useQuery(
    {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    },
    { enabled: !hasSearch }
  );

  const { data: searchedNotes, isLoading: isSearchLoading } = trpc.notes.search.useQuery(
    trimmedSearchQuery,
    { enabled: hasSearch }
  );

  const notes = hasSearch ? searchedNotes : pagedNotes;
  const isLoading = hasSearch ? isSearchLoading : isPagedLoading;

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  const visibleNotes = notes || [];

  const handleViewNote = (id: number) => {
    setLocation(`/notes/${id}`);
  };

  const handlePrintNote = (id: number) => {
    setLocation(`/notes/${id}`);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  return (
    <div style={{ minHeight: "100vh", padding: "2rem", background: "linear-gradient(to bottom right, #f8fafc, #f1f5f9)" }}>
      <div style={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: "2rem", fontWeight: "bold", color: "#1e293b" }}>
              Notas de Entrega
            </h1>
            <p style={{ color: "#64748b", marginTop: "0.5rem" }}>
              Gestiona y visualiza todas tus notas emitidas
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Button
              onClick={() => setLocation("/")}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "white", color: "#334155", padding: "0.75rem 1.5rem", border: "1px solid #cbd5e1", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600" }}
            >
              <Home style={{ width: "1rem", height: "1rem" }} />
              Inicio
            </Button>
            <Button
              onClick={() => setLocation("/notes/new")}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgb(59, 130, 246)", color: "white", padding: "0.75rem 1.5rem", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600" }}
            >
              <Plus style={{ width: "1rem", height: "1rem" }} />
              Nueva Nota
            </Button>
          </div>
        </div>

        {/* Search */}
        <Card style={{ padding: "1.5rem", marginBottom: "2rem", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Search style={{ width: "1.25rem", height: "1.25rem", color: "#94a3b8", flexShrink: 0 }} />
            <Input
              placeholder="Buscar por número de nota o cliente..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ flex: 1, padding: "0.75rem", border: "none", outline: "none", fontSize: "1rem" }}
            />
          </div>
        </Card>

        {/* Notes Table */}
        <Card style={{ border: "1px solid #e2e8f0", overflow: "hidden" }}>
          {isLoading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
              Cargando notas...
            </div>
          ) : visibleNotes.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
              No hay notas para mostrar
            </div>
          ) : (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "1rem", fontWeight: "600", color: "#475569", fontSize: "0.875rem" }}>Número</th>
                    <th style={{ textAlign: "left", padding: "1rem", fontWeight: "600", color: "#475569", fontSize: "0.875rem" }}>Fecha</th>
                    <th style={{ textAlign: "left", padding: "1rem", fontWeight: "600", color: "#475569", fontSize: "0.875rem" }}>Cliente</th>
                    <th style={{ textAlign: "right", padding: "1rem", fontWeight: "600", color: "#475569", fontSize: "0.875rem" }}>Total</th>
                    <th style={{ textAlign: "center", padding: "1rem", fontWeight: "600", color: "#475569", fontSize: "0.875rem" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleNotes.map((note: any) => (
                    <tr key={note.id} style={{ borderBottom: "1px solid #e2e8f0", transition: "background 0.2s" }}>
                      <td style={{ padding: "1rem", color: "#1e293b", fontWeight: "600" }}>#{note.noteNumber}</td>
                      <td style={{ padding: "1rem", color: "#1e293b" }}>
                        {format(new Date(note.noteDate), "dd/MM/yyyy")}
                      </td>
                      <td style={{ padding: "1rem", color: "#1e293b" }}>{note.clientName}</td>
                      <td style={{ padding: "1rem", textAlign: "right", color: "#1e293b", fontWeight: "600" }}>
                        ${parseFloat(note.total).toFixed(2)}
                      </td>
                      <td style={{ padding: "1rem", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                          <button
                            onClick={() => handleViewNote(note.id)}
                            style={{ padding: "0.5rem", background: "transparent", border: "1px solid #e2e8f0", borderRadius: "0.375rem", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}
                            title="Ver detalle"
                          >
                            <Eye style={{ width: "1rem", height: "1rem" }} />
                          </button>
                          <button
                            onClick={() => handlePrintNote(note.id)}
                            style={{ padding: "0.5rem", background: "transparent", border: "1px solid #e2e8f0", borderRadius: "0.375rem", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}
                            title="Imprimir"
                          >
                            <Printer style={{ width: "1rem", height: "1rem" }} />
                          </button>
                          <button
                            onClick={() => {
                              setLocation(`/notes/${note.id}`);
                              setTimeout(() => window.print(), 500);
                            }}
                            style={{ padding: "0.5rem", background: "transparent", border: "1px solid #e2e8f0", borderRadius: "0.375rem", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}
                            title="Abrir impresión / guardar como PDF"
                          >
                            <Download style={{ width: "1rem", height: "1rem" }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div style={{ padding: "1rem", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ color: "#64748b", fontSize: "0.875rem" }}>
                  Mostrando {visibleNotes.length} de {notes?.length || 0} notas
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <Button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    style={{ padding: "0.5rem 1rem", background: page === 1 ? "#e2e8f0" : "white", border: "1px solid #e2e8f0", borderRadius: "0.375rem", cursor: page === 1 ? "not-allowed" : "pointer", color: "#64748b", fontWeight: "600" }}
                  >
                    ← Anterior
                  </Button>
                  <div style={{ padding: "0.5rem 1rem", color: "#64748b", fontWeight: "600" }}>
                    Página {page}
                  </div>
                  <Button
                    onClick={() => setPage(page + 1)}
                    disabled={hasSearch || visibleNotes.length < pageSize}
                    style={{ padding: "0.5rem 1rem", background: hasSearch || visibleNotes.length < pageSize ? "#e2e8f0" : "white", border: "1px solid #e2e8f0", borderRadius: "0.375rem", cursor: hasSearch || visibleNotes.length < pageSize ? "not-allowed" : "pointer", color: "#64748b", fontWeight: "600" }}
                  >
                    Siguiente →
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
