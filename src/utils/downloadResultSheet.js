import { createResultExportModel, createWorkbookExportModel } from './resultExportModel.js';

const COLORS = {
  navy: [20, 38, 55],
  teal: [22, 112, 110],
  tealSoft: [228, 242, 240],
  ink: [31, 45, 57],
  muted: [94, 108, 120],
  line: [218, 226, 232],
  soft: [246, 248, 250],
  white: [255, 255, 255],
};

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

const operatingHeadings = ['Variable', 'Unit', 'Minimum', 'Normal', 'Maximum'];
const operatingRows = model => model.operatingConditions.map(({ label, unit, values }) => [label, unit, ...values]);

function appendOperatingPdf(doc, autoTable, models) {
  let first = true;
  for (const model of models) {
    if (!first) doc.addPage('a4', 'portrait');
    first = false;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...COLORS.navy);
    doc.text('Worksheet calculation', 18, 24);
    doc.setFontSize(10);
    const subtitle = doc.splitTextToSize(`${model.sheetName || 'Manual entry'} | ${model.serviceLabel}`, 174);
    doc.text(subtitle, 18, 34);
    autoTable(doc, {
      startY: 40 + (subtitle.length - 1) * 5,
      margin: { left: 18, right: 18 },
      head: [['Minimum Cv', 'Normal Cv', 'Maximum Cv']],
      body: [model.values.map(({ value }) => value)],
      theme: 'grid',
      styles: { halign: 'center', fontSize: 11, cellPadding: 4 },
      headStyles: { fillColor: COLORS.teal },
    });
    const conditionsY = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.navy);
    doc.text('Operating conditions used for this calculation', 18, conditionsY);
    autoTable(doc, {
      startY: conditionsY + 6,
      margin: { top: 18, bottom: 24, left: 18, right: 18 },
      head: [operatingHeadings], body: operatingRows(model), theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak', halign: 'center' },
      headStyles: { fillColor: COLORS.navy },
      columnStyles: { 0: { cellWidth: 48, halign: 'left' }, 1: { cellWidth: 24 } },
      alternateRowStyles: { fillColor: COLORS.soft },
    });
  }
}

async function operatingWordBlocks(model, index) {
  const { Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType } = await import('docx');
  const table = (headings, rows, widths) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: widths,
    rows: [headings, ...rows].map((row, rowIndex) => new TableRow({
      tableHeader: rowIndex === 0, cantSplit: true,
      children: row.map((text, column) => new TableCell({
        margins: { top: 120, bottom: 120, left: 120, right: 120 },
        shading: { fill: rowIndex === 0 ? '142637' : rowIndex % 2 ? 'F6F8FA' : 'FFFFFF' },
        children: [new Paragraph({
          alignment: column === 0 && headings.length > 3 ? AlignmentType.LEFT : AlignmentType.CENTER,
          children: [new TextRun({ text: String(text), bold: rowIndex === 0, color: rowIndex === 0 ? 'FFFFFF' : '1F2D39', size: 18 })],
        })],
      })),
    })),
  });
  return [
    new Paragraph({ text: model.sheetName || 'Manual calculation', pageBreakBefore: index > 0, keepNext: true, spacing: { after: 160 } }),
    new Paragraph({ text: `${model.serviceLabel} service`, keepNext: true, spacing: { after: 240 } }),
    table(['Minimum Cv', 'Normal Cv', 'Maximum Cv'], [model.values.map(({ value }) => value)], [3333, 3333, 3334]),
    new Paragraph({ text: 'Operating conditions', keepNext: true, spacing: { before: 240, after: 160 } }),
    table(operatingHeadings, operatingRows(model), [3000, 1300, 1900, 1900, 1900]),
  ];
}

async function createPdfDownload(models, { filename }) {
  const [{ jsPDF }, tableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  appendOperatingPdf(doc, tableModule.autoTable ?? tableModule.default, models);
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(`${page} / ${total}`, 192, 287, { align: 'right' });
  }
  triggerDownload(doc.output('blob'), `${filename}.pdf`);
}

export async function downloadResultPdf(payload) {
  const model = createResultExportModel(payload);
  return createPdfDownload([model], model);
}

export async function downloadWorkbookPdf(payload) {
  const model = createWorkbookExportModel(payload);
  return createPdfDownload(model.sheets, model);
}

async function createWordDownload(models, { title, subject, filename }) {
  const operatingBlocks = await Promise.all(models.map(operatingWordBlocks));
  const { Document, Packer, PageOrientation } = await import('docx');

  const document = new Document({
    creator: 'Control Valve Sizing Calculator',
    title,
    subject,
    description: 'Result-only export from the Control Valve Sizing Calculator',
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 22, color: '1F2D39' },
          paragraph: { spacing: { after: 140, line: 276 } },
        },
      },
      paragraphStyles: [
        {
          id: 'Title',
          name: 'Title',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Arial', size: 38, bold: true, color: '142637' },
          paragraph: { spacing: { after: 320 } },
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Arial', size: 24, bold: true, color: '142637' },
          paragraph: { spacing: { before: 0, after: 120 }, keepNext: true },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children: operatingBlocks.flat(),
    }],
  });

  triggerDownload(await Packer.toBlob(document), `${filename}.docx`);
}

export async function downloadResultWord(payload) {
  const model = createResultExportModel(payload);
  return createWordDownload([model], {
    title: model.title,
    subject: `${model.serviceLabel} control valve Cv calculation results`,
    filename: model.filename,
  });
}

export async function downloadWorkbookWord(payload) {
  const model = createWorkbookExportModel(payload);
  return createWordDownload(model.sheets, { title: model.title, subject: 'Cv results and operating conditions', filename: model.filename });
}
