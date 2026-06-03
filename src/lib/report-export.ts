import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export type ExportSection = {
  title: string;
  rows: Record<string, string | number>[];
};

export function exportToPDF(title: string, sections: ExportSection[]) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(title, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(new Date().toLocaleString("pt-BR"), 14, 24);

  let y = 32;
  for (const s of sections) {
    if (!s.rows.length) continue;
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text(s.title, 14, y);
    const head = [Object.keys(s.rows[0])];
    const body = s.rows.map((r) => Object.values(r).map((v) => String(v)));
    autoTable(doc, {
      startY: y + 3,
      head,
      body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [99, 102, 241] },
      margin: { left: 14, right: 14 },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 10;
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
  }
  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.pdf`);
}

export function exportToExcel(title: string, sections: ExportSection[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sections) {
    if (!s.rows.length) continue;
    const ws = XLSX.utils.json_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.title.slice(0, 30));
  }
  XLSX.writeFile(wb, `${title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.xlsx`);
}
