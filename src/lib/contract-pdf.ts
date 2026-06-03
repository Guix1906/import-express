// Geração de PDFs de Contrato de Honorários + Procuração ad judicia
// Usa jsPDF (browser-side). Faz upload para o bucket "documents" e
// retorna URLs assinadas + storage paths.
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";

export type ContractData = {
  companyId: string;
  companyName: string;
  clientId: string;
  cardId: string;
  clientName: string;
  clientCpf?: string | null;
  clientRg?: string | null;
  clientAddress?: string | null;
  clientCity?: string | null;
  clientMaritalStatus?: string | null;
  clientProfession?: string | null;
  contractType: "administrativo" | "judicial";
  contractValue?: number | null;
  honorarios?: number | null;
  benefitType?: string | null;
  userId: string;
};

function header(doc: jsPDF, title: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 105, 18, { align: "center" });
  doc.setLineWidth(0.3);
  doc.line(20, 22, 190, 22);
}

function paragraph(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(text, 170);
  doc.text(lines, 20, y);
  return y + lines.length * 5.5 + 3;
}

function fmtMoney(v?: number | null) {
  if (v == null) return "____________";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildContractPdf(d: ContractData): Blob {
  const doc = new jsPDF();
  header(doc, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS");
  let y = 30;
  y = paragraph(
    doc,
    `Pelo presente instrumento particular, de um lado ${d.clientName}${
      d.clientCpf ? `, inscrito(a) no CPF sob nº ${d.clientCpf}` : ""
    }${d.clientRg ? `, RG nº ${d.clientRg}` : ""}${
      d.clientMaritalStatus ? `, estado civil ${d.clientMaritalStatus}` : ""
    }${d.clientProfession ? `, profissão ${d.clientProfession}` : ""}${
      d.clientAddress ? `, residente em ${d.clientAddress}` : ""
    }${d.clientCity ? ` - ${d.clientCity}` : ""}, doravante denominado CONTRATANTE,`,
    y,
  );
  y = paragraph(
    doc,
    `e de outro lado ${d.companyName}, doravante denominado(a) CONTRATADO(A), têm entre si justo e contratado o seguinte:`,
    y,
  );

  y = paragraph(
    doc,
    `CLÁUSULA 1ª — OBJETO: O CONTRATADO prestará serviços advocatícios ao CONTRATANTE para a defesa de seus interesses em ${
      d.contractType === "judicial" ? "ação judicial" : "procedimento administrativo"
    }${d.benefitType ? ` referente a ${d.benefitType}` : ""}, perante os órgãos competentes.`,
    y,
  );

  y = paragraph(
    doc,
    `CLÁUSULA 2ª — HONORÁRIOS: Pelos serviços prestados, o CONTRATANTE pagará ao CONTRATADO o valor de ${fmtMoney(
      d.honorarios,
    )}${
      d.contractValue ? `, sendo o valor estimado da causa de ${fmtMoney(d.contractValue)}` : ""
    }, na forma a ser acordada entre as partes.`,
    y,
  );

  y = paragraph(
    doc,
    "CLÁUSULA 3ª — OBRIGAÇÕES DO CONTRATANTE: O CONTRATANTE compromete-se a fornecer ao CONTRATADO todas as informações, documentos e meios necessários ao bom desempenho da causa.",
    y,
  );

  y = paragraph(
    doc,
    "CLÁUSULA 4ª — OBRIGAÇÕES DO CONTRATADO: O CONTRATADO compromete-se a empregar zelo, diligência e técnica jurídica adequada na condução do feito, mantendo o CONTRATANTE informado sobre seu andamento.",
    y,
  );

  y = paragraph(
    doc,
    "CLÁUSULA 5ª — RESCISÃO: Este contrato poderá ser rescindido por qualquer das partes, mediante notificação prévia, ressalvados os honorários proporcionais ao serviço prestado até a data da rescisão.",
    y,
  );

  y = paragraph(
    doc,
    `CLÁUSULA 6ª — FORO: Fica eleito o foro da comarca de ${
      d.clientCity ?? "____________"
    } para dirimir quaisquer dúvidas oriundas deste contrato.`,
    y,
  );

  y += 12;
  doc.text(`${d.clientCity ?? "____________"}, ${new Date().toLocaleDateString("pt-BR")}`, 20, y);
  y += 22;
  doc.line(20, y, 95, y);
  doc.line(110, y, 185, y);
  doc.setFontSize(9);
  doc.text("CONTRATANTE", 35, y + 5);
  doc.text("CONTRATADO", 130, y + 5);

  return doc.output("blob");
}

function buildProcuracaoPdf(d: ContractData): Blob {
  const doc = new jsPDF();
  header(doc, "PROCURAÇÃO AD JUDICIA ET EXTRA");
  let y = 30;
  y = paragraph(
    doc,
    `OUTORGANTE: ${d.clientName}${d.clientCpf ? `, CPF nº ${d.clientCpf}` : ""}${
      d.clientRg ? `, RG nº ${d.clientRg}` : ""
    }${d.clientMaritalStatus ? `, ${d.clientMaritalStatus}` : ""}${
      d.clientProfession ? `, ${d.clientProfession}` : ""
    }${
      d.clientAddress ? `, residente e domiciliado(a) em ${d.clientAddress}` : ""
    }${d.clientCity ? ` - ${d.clientCity}` : ""}.`,
    y,
  );

  y = paragraph(
    doc,
    `OUTORGADO(A): ${d.companyName}, com endereço profissional na forma de seus registros.`,
    y,
  );

  y = paragraph(
    doc,
    "PODERES: Pelo presente instrumento, o(a) OUTORGANTE nomeia e constitui seu bastante procurador o(a) OUTORGADO(A) supraqualificado(a), a quem confere os poderes da cláusula ad judicia et extra, para o foro em geral, podendo representá-lo(a) perante quaisquer juízos, instâncias ou tribunais, autarquias e órgãos da administração pública, em especial junto ao INSS, propondo as ações cabíveis e defendendo-o(a) nas contrárias, podendo confessar, reconhecer a procedência do pedido, transigir, desistir, renunciar ao direito sobre que se funda a ação, receber e dar quitação, firmar compromisso, requerer benefícios, juntar e desentranhar documentos, substabelecer com ou sem reserva de poderes, agindo em conjunto ou separadamente, para o bom e fiel cumprimento do presente mandato.",
    y,
  );

  y += 12;
  doc.text(`${d.clientCity ?? "____________"}, ${new Date().toLocaleDateString("pt-BR")}`, 20, y);
  y += 22;
  doc.line(60, y, 150, y);
  doc.setFontSize(9);
  doc.text(`${d.clientName}`, 105, y + 5, { align: "center" });
  doc.text("OUTORGANTE", 105, y + 10, { align: "center" });
  return doc.output("blob");
}

async function uploadBlob(blob: Blob, storagePath: string): Promise<{ path: string; url: string }> {
  const { error } = await supabase.storage
    .from("documents")
    .upload(storagePath, blob, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`Upload: ${error.message}`);
  const { data } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  return { path: storagePath, url: data?.signedUrl ?? "" };
}

export async function generateContractDocuments(d: ContractData): Promise<{
  contractPath: string;
  procuracaoPath: string;
}> {
  const ts = Date.now();
  const safe = d.clientName
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .slice(0, 40);

  const contractBlob = buildContractPdf(d);
  const procBlob = buildProcuracaoPdf(d);

  const contractKey = `${d.companyId}/contratos/${ts}_contrato_${safe}.pdf`;
  const procKey = `${d.companyId}/procuracoes/${ts}_procuracao_${safe}.pdf`;

  const [c, p] = await Promise.all([
    uploadBlob(contractBlob, contractKey),
    uploadBlob(procBlob, procKey),
  ]);

  // Registra na tabela documents
  await supabase.from("documents").insert([
    {
      company_id: d.companyId,
      uploaded_by: d.userId,
      client_id: d.clientId,
      card_id: d.cardId,
      name: `Contrato — ${d.clientName}.pdf`,
      storage_path: c.path,
      mime_type: "application/pdf",
      category: "contrato",
    },
    {
      company_id: d.companyId,
      uploaded_by: d.userId,
      client_id: d.clientId,
      card_id: d.cardId,
      name: `Procuração — ${d.clientName}.pdf`,
      storage_path: p.path,
      mime_type: "application/pdf",
      category: "procuracao",
    },
  ]);

  return { contractPath: c.path, procuracaoPath: p.path };
}
