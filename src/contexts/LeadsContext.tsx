import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { LeadsContextType, Lead, LeadFilters, Interaction } from "../types";
import {
  getLeads,
  createLead,
  updateLead as updateLeadService,
  deleteLead as deleteLeadService,
  addInteraction as addInteractionService,
} from "../services/leadsService";
import { useAuth } from "./AuthContext";
import * as XLSX from "xlsx";

export const LeadsContext = createContext<LeadsContextType | undefined>(
  undefined
);

interface LeadsProviderProps {
  children: ReactNode;
}

export const LeadsProvider: React.FC<LeadsProviderProps> = ({ children }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filters, setFilters] = useState<LeadFilters>({});
  const { user } = useAuth();

  // Carregar leads do Supabase
  useEffect(() => {
    const loadLeads = async () => {
      if (!user) {
        setLeads([]);
        return;
      }

      const { leads: fetchedLeads, error } = await getLeads();

      if (error) {
        console.error("Erro ao carregar leads:", error);
      } else {
        setLeads(fetchedLeads);
      }
    };

    loadLeads();
  }, [user]);

  const addLead = async (
    newLead: Omit<Lead, "id" | "createdAt" | "updatedAt" | "interactions"> | Omit<Lead, "id" | "createdAt" | "updatedAt" | "interactions" | "createdBy">
  ) => {
    if (!user) return;

    const leadData = {
      ...newLead,
      createdBy: ('createdBy' in newLead && newLead.createdBy) ? newLead.createdBy : user.id,
    };

    const { lead, error } = await createLead(leadData);

    if (error) {
      console.error("Erro ao criar lead:", error);
      throw new Error(error);
    }

    if (lead) {
      setLeads((prev) => [lead, ...prev]);
    }
  };

  const updateLead = async (id: string, updatedData: Partial<Lead>) => {
    const { lead, error } = await updateLeadService(id, updatedData);

    if (error) {
      console.error("Erro ao atualizar lead:", error);
      throw new Error(error);
    }

    if (lead) {
      setLeads((prev) => prev.map((l) => (l.id === id ? lead : l)));
    }
  };

  const deleteLead = async (id: string) => {
    const { error } = await deleteLeadService(id);

    if (error) {
      console.error("Erro ao deletar lead:", error);
      throw new Error(error);
    }

    setLeads((prev) => prev.filter((lead) => lead.id !== id));
  };

  const addInteraction = async (
    leadId: string,
    interaction: Omit<Interaction, "id" | "leadId">
  ) => {
    if (!user) return;

    const { error } = await addInteractionService(
      leadId,
      user.id,
      interaction.type,
      interaction.description
    );

    if (error) {
      console.error("Erro ao adicionar interação:", error);
      throw new Error(error);
    }

    // Recarregar o lead atualizado
    const { leads: updatedLeads } = await getLeads();
    if (updatedLeads) {
      setLeads(updatedLeads);
    }
  };

  const getLead = (id: string): Lead | undefined => {
    return leads.find((lead) => lead.id === id);
  };

  const filteredLeads = leads.filter((lead) => {
    // Filtro de busca por texto
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        lead.name.toLowerCase().includes(searchLower) ||
        lead.email.toLowerCase().includes(searchLower) ||
        lead.company?.toLowerCase().includes(searchLower) ||
        lead.phone.includes(filters.search);

      if (!matchesSearch) return false;
    }

    // Filtro por status
    if (filters.status && filters.status.length > 0) {
      if (!filters.status.includes(lead.status)) return false;
    }

    // Filtro por origem
    if (filters.source && filters.source.length > 0) {
      if (!filters.source.includes(lead.source)) return false;
    }

    // Filtro por data (criação)
    if (filters.dateFrom) {
      if (new Date(lead.createdAt) < new Date(filters.dateFrom)) return false;
    }

    if (filters.dateTo) {
      const dateTo = new Date(filters.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      if (new Date(lead.createdAt) > dateTo) return false;
    }

    // Filtro por responsável
    if (filters.assignedTo) {
      if (lead.assignedTo !== filters.assignedTo) return false;
    }

    return true;
  });

  const importLeads = async (file: File): Promise<void> => {
    if (!user) throw new Error("Usuário não autenticado");

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const importPromises = jsonData.map(async (row: unknown) => {
            const r = row as Record<string, string>;
            const leadData = {
              name: r.nome || r.name || "",
              email: r.email || "",
              phone: r.telefone || r.phone || "",
              company: r.empresa || r.company,
              position: r.cargo || r.position,
              status: (r.status || "novo") as Lead["status"],
              source: (r.origem || r.source || "outro") as Lead["source"],
              value: parseFloat(r.valor || r.value || "0") || undefined,
              observations: r.observacoes || r.observations,
              tags: r.tags
                ? r.tags.split(",").map((t: string) => t.trim())
                : [],
              createdBy: user.id,
            };

            return createLead(leadData);
          });

          await Promise.all(importPromises);

          // Recarregar leads
          const { leads: updatedLeads } = await getLeads();
          if (updatedLeads) {
            setLeads(updatedLeads);
          }

          resolve();
        } catch {
          reject(new Error("Erro ao processar arquivo"));
        }
      };

      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      reader.readAsBinaryString(file);
    });
  };

  const exportLeads = () => {
    const dataToExport = filteredLeads.map((lead) => ({
      Nome: lead.name,
      Email: lead.email,
      Telefone: lead.phone,
      Empresa: lead.company || "",
      Cargo: lead.position || "",
      Status: lead.status,
      Origem: lead.source,
      Valor: lead.value || 0,
      "Data Criação": new Date(lead.createdAt).toLocaleDateString("pt-BR"),
      Observações: lead.observations || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

    const fileName = `leads-${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <LeadsContext.Provider
      value={{
        leads,
        addLead,
        updateLead,
        deleteLead,
        addInteraction,
        getLead,
        filteredLeads,
        filters,
        setFilters,
        importLeads,
        exportLeads,
      }}
    >
      {children}
    </LeadsContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLeads = (): LeadsContextType => {
  const context = useContext(LeadsContext);
  if (!context) {
    throw new Error("useLeads must be used within a LeadsProvider");
  }
  return context;
};
