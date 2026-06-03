// Geração simples de PDF para um contrato cadastrado em /app/contratos
import { jsPDF } from "jspdf";

export type SimpleContractPdf = {
  companyName: string;
  title: string;
  clientName?: string | null;
  counterparty?: string | null;
  contractType: string;
  value?: number | null;
  paymentTerms?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  signedAt?: string | null;
  notes?: string | null;
};

const fmtBRL = (v?: number | null) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtDate = (v?: string | null) => {
  if (!v) return "—";
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
};

export function generateSimpleContractPdf(c: SimpleContractPdf): jsPDF {
  const doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(c.title || "Contrato", 105, 20, { align: "center" });
  doc.setLineWidth(0.3);
  doc.line(20, 24, 190, 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  let y = 35;
  const line = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 20, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value || "—", 130);
    doc.text(lines, 60, y);
    y += Math.max(7, lines.length * 5.5);
  };

  line("Escritório", c.companyName);
  line("Tipo", c.contractType);
  line("Cliente", c.clientName ?? "—");
  line("Contraparte", c.counterparty ?? "—");
  line("Valor", fmtBRL(c.value));
  line("Forma de pagamento", c.paymentTerms ?? "—");
  line("Início", fmtDate(c.startDate));
  line("Fim", fmtDate(c.endDate));
  line("Assinado em", fmtDate(c.signedAt));

  if (c.notes) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.text("Observações", 20, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(c.notes, 170);
    doc.text(lines, 20, y);
    y += lines.length * 5.5;
  }

  y = Math.max(y + 30, 230);
  doc.line(30, y, 90, y);
  doc.line(120, y, 180, y);
  doc.setFontSize(9);
  doc.text("Contratante", 60, y + 5, { align: "center" });
  doc.text("Contratado", 150, y + 5, { align: "center" });

  return doc;
}
