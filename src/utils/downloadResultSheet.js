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

function metadataRows(model) {
  return [
    ['Service', model.serviceLabel],
    ['Source', model.sourceLabel],
    ...(model.workbookName ? [['Workbook', model.workbookName]] : []),
    ...(model.sheetName ? [['Worksheet', model.sheetName]] : []),
  ];
}

function renderPdfResultPage(doc, autoTable, model, pageNumber, pageCount) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;

  doc.setFillColor(...COLORS.navy);
  doc.rect(0, 0, pageWidth, 42, 'F');
  doc.setFillColor(...COLORS.teal);
  doc.rect(0, 0, 5, 42, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('ENGINEERING CALCULATION REPORT', margin, 12);
  doc.setFontSize(19);
  doc.text('Control Valve Sizing', margin, 25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(195, 210, 219);
  doc.text('Calculated flow coefficient summary', margin, 33);

  const badgeText = `${model.serviceLabel.toUpperCase()} SERVICE`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const badgeWidth = doc.getTextWidth(badgeText) + 10;
  doc.setFillColor(...COLORS.teal);
  doc.roundedRect(pageWidth - margin - badgeWidth, 16, badgeWidth, 10, 2, 2, 'F');
  doc.setTextColor(...COLORS.white);
  doc.text(badgeText, pageWidth - margin - (badgeWidth / 2), 22.5, { align: 'center' });

  doc.setTextColor(...COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('Report details', margin, 55);
  doc.setDrawColor(...COLORS.teal);
  doc.setLineWidth(0.8);
  doc.line(margin, 58.5, margin + 13, 58.5);
  autoTable(doc, {
    startY: 63,
    margin: { left: margin, right: margin },
    theme: 'plain',
    body: metadataRows(model),
    styles: {
      font: 'helvetica',
      fontSize: 9,
      textColor: COLORS.ink,
      cellPadding: { top: 3.2, right: 4, bottom: 3.2, left: 4 },
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 35, fontStyle: 'bold', textColor: COLORS.muted },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: COLORS.soft },
  });

  const resultHeadingY = doc.lastAutoTable.finalY + 13;
  doc.setTextColor(...COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('Operating condition results', margin, resultHeadingY);
  doc.setDrawColor(...COLORS.teal);
  doc.setLineWidth(0.8);
  doc.line(margin, resultHeadingY + 3.5, margin + 13, resultHeadingY + 3.5);
  autoTable(doc, {
    startY: resultHeadingY + 8,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [['Operating condition', 'Calculated Cv']],
    body: model.values.map(({ label, value }) => [label.replace(/ Cv$/, ''), value]),
    headStyles: {
      fillColor: COLORS.navy,
      textColor: COLORS.white,
      fontStyle: 'bold',
      lineColor: COLORS.navy,
      cellPadding: 4,
    },
    styles: {
      font: 'helvetica',
      fontSize: 10,
      textColor: COLORS.ink,
      lineColor: COLORS.line,
      lineWidth: 0.25,
      cellPadding: 4.2,
    },
    alternateRowStyles: { fillColor: COLORS.soft },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 48, halign: 'right', fontStyle: 'bold' },
    },
  });

  const maximumY = doc.lastAutoTable.finalY + 10;
  doc.setFillColor(...COLORS.tealSoft);
  doc.roundedRect(margin, maximumY, pageWidth - (margin * 2), 31, 2.5, 2.5, 'F');
  doc.setFillColor(...COLORS.teal);
  doc.roundedRect(margin, maximumY, 4, 31, 2, 2, 'F');
  doc.rect(margin + 2, maximumY, 2, 31, 'F');
  doc.setTextColor(...COLORS.teal);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('SIZING REFERENCE', margin + 10, maximumY + 8.5);
  doc.setTextColor(...COLORS.navy);
  doc.setFontSize(11.5);
  doc.text('Maximum calculated Cv', margin + 10, maximumY + 17);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(8.5);
  doc.text(model.governingText, margin + 10, maximumY + 24.5);
  doc.setTextColor(...COLORS.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(model.maximumValue, pageWidth - margin - 9, maximumY + 19, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.teal);
  doc.text('Cv', pageWidth - margin - 9, maximumY + 26, { align: 'right' });

  const footerLineY = pageHeight - 18;
  doc.setDrawColor(...COLORS.line);
  doc.line(margin, footerLineY, pageWidth - margin, footerLineY);
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(7.5);
  doc.text('CONTROL VALVE SIZING  /  CALCULATION SUMMARY', margin, pageHeight - 10);
  doc.text(`${String(pageNumber).padStart(2, '0')} / ${String(pageCount).padStart(2, '0')}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
}

async function createPdfDownload(models, { title, subject, filename }) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = autoTableModule.autoTable ?? autoTableModule.default;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setProperties({
    title,
    subject,
    author: 'Control Valve Sizing Calculator',
    creator: 'Control Valve Sizing Calculator',
  });

  models.forEach((model, index) => {
    if (index > 0) doc.addPage('a4', 'portrait');
    renderPdfResultPage(doc, autoTable, model, index + 1, models.length);
  });

  triggerDownload(doc.output('blob'), `${filename}.pdf`);
}

export async function downloadResultPdf(payload) {
  const model = createResultExportModel(payload);
  return createPdfDownload([model], {
    title: model.title,
    subject: `${model.serviceLabel} control valve Cv calculation results`,
    filename: model.filename,
  });
}

export async function downloadWorkbookPdf(payload) {
  const workbook = createWorkbookExportModel(payload);
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = autoTableModule.autoTable ?? autoTableModule.default;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;

  doc.setProperties({
    title: workbook.title,
    subject: `${workbook.sheets.length} calculated worksheet Cv results from ${workbook.workbookName}`,
    author: 'Control Valve Sizing Calculator',
    creator: 'Control Valve Sizing Calculator',
  });

  doc.setFillColor(...COLORS.navy);
  doc.rect(0, 0, pageWidth, 42, 'F');
  doc.setFillColor(...COLORS.teal);
  doc.rect(0, 0, 5, 42, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('ENGINEERING CALCULATION REPORT', margin, 12);
  doc.setFontSize(19);
  doc.text('Control Valve Sizing', margin, 25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(195, 210, 219);
  doc.text('Workbook calculation summary', margin, 33);

  const countLabel = `${workbook.sheets.length} ${workbook.sheets.length === 1 ? 'VALVE' : 'VALVES'}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const badgeWidth = doc.getTextWidth(countLabel) + 10;
  doc.setFillColor(...COLORS.teal);
  doc.roundedRect(pageWidth - margin - badgeWidth, 16, badgeWidth, 10, 2, 2, 'F');
  doc.setTextColor(...COLORS.white);
  doc.text(countLabel, pageWidth - margin - (badgeWidth / 2), 22.5, { align: 'center' });

  doc.setTextColor(...COLORS.muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('SOURCE WORKBOOK', margin, 55);
  doc.setTextColor(...COLORS.ink);
  doc.setFontSize(14.5);
  const workbookLines = doc.splitTextToSize(workbook.workbookName, pageWidth - (margin * 2));
  doc.text(workbookLines, margin, 63);

  const tableStartY = 63 + (workbookLines.length * 5.2) + 9;

  autoTable(doc, {
    startY: tableStartY,
    margin: { top: 20, right: margin, bottom: 24, left: margin },
    theme: 'grid',
    head: [['Sheet name', 'Minimum Cv', 'Normal Cv', 'Maximum Cv']],
    body: workbook.sheets.map(({ sheetName, values }) => [
      sheetName,
      ...values.map(({ value }) => value),
    ]),
    showHead: 'everyPage',
    headStyles: {
      fontSize: 9,
      fillColor: COLORS.navy,
      textColor: COLORS.white,
      fontStyle: 'bold',
      lineColor: COLORS.navy,
      cellPadding: 3.4,
    },
    styles: {
      font: 'helvetica',
      fontSize: 10,
      textColor: COLORS.ink,
      lineColor: COLORS.line,
      lineWidth: 0.25,
      cellPadding: 3.4,
      overflow: 'linebreak',
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: COLORS.soft },
    columnStyles: {
      0: { cellWidth: 75 },
      1: { cellWidth: 33, halign: 'right' },
      2: { cellWidth: 33, halign: 'right' },
      3: { cellWidth: 33, halign: 'right' },
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);
    const footerLineY = pageHeight - 18;
    doc.setDrawColor(...COLORS.line);
    doc.line(margin, footerLineY, pageWidth - margin, footerLineY);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('CONTROL VALVE SIZING  /  WORKBOOK SUMMARY', margin, pageHeight - 10);
    doc.text(`${String(pageNumber).padStart(2, '0')} / ${String(pageCount).padStart(2, '0')}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  triggerDownload(doc.output('blob'), `${workbook.filename}.pdf`);
}

async function createWordDownload(models, { title, subject, filename }) {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    Packer,
    PageBreak,
    PageOrientation,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
  } = await import('docx');

  const border = { color: 'DAE2E8', size: 4, style: BorderStyle.SINGLE };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (text, { bold = false, color = '1F2D39', fill, alignment = AlignmentType.LEFT } = {}) => new TableCell({
    borders,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 130, bottom: 130, left: 160, right: 160 },
    ...(fill ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill } } : {}),
    children: [new Paragraph({
      alignment,
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: String(text), bold, color, size: 20, font: 'Arial' })],
    })],
  });

  function resultBlocks(model, index) {
    const metadataTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [2600, 7400],
      rows: metadataRows(model).map(([label, value]) => new TableRow({
        children: [
          cell(label, { bold: true, color: '5E6C78', fill: 'F6F8FA' }),
          cell(value),
        ],
      })),
    });

    const resultsTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [6500, 3500],
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            cell('Operating condition', { bold: true, color: 'FFFFFF', fill: '142637' }),
            cell('Calculated Cv', { bold: true, color: 'FFFFFF', fill: '142637', alignment: AlignmentType.RIGHT }),
          ],
        }),
        ...model.values.map(({ label, value }) => new TableRow({
          children: [
            cell(label.replace(/ Cv$/, '')),
            cell(value, { bold: true, alignment: AlignmentType.RIGHT }),
          ],
        })),
      ],
    });

    return [
      ...(index > 0 ? [new Paragraph({ children: [new PageBreak()] })] : []),
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: 'ENGINEERING CALCULATION REPORT', bold: true, color: '16706E', size: 17, font: 'Arial' })],
      }),
      new Paragraph({
        style: 'Title',
        children: [new TextRun({ text: 'Control Valve Sizing' })],
      }),
      new Paragraph({
        spacing: { after: 300 },
        children: [
          new TextRun({ text: 'Calculated flow coefficient summary  ', color: '5E6C78', size: 20, font: 'Arial' }),
          new TextRun({ text: `${model.serviceLabel.toUpperCase()} SERVICE`, bold: true, color: '16706E', size: 18, font: 'Arial' }),
        ],
      }),
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: 'Report details' })],
      }),
      metadataTable,
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 320 },
        children: [new TextRun({ text: 'Operating condition results' })],
      }),
      resultsTable,
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 320, after: 90 },
        children: [new TextRun({ text: 'Sizing reference' })],
      }),
      new Paragraph({
        spacing: { after: 70 },
        children: [
          new TextRun({ text: 'Maximum calculated Cv   ', bold: true, color: '142637', size: 23, font: 'Arial' }),
          new TextRun({ text: model.maximumValue, bold: true, color: '16706E', size: 38, font: 'Arial' }),
          new TextRun({ text: ' Cv', color: '16706E', size: 22, font: 'Arial' }),
        ],
      }),
      new Paragraph({
        spacing: { after: 300 },
        children: [new TextRun({ text: model.governingText, color: '5E6C78', size: 20, font: 'Arial' })],
      }),
      new Paragraph({
        border: { top: { color: 'DAE2E8', size: 4, style: BorderStyle.SINGLE, space: 8 } },
        spacing: { before: 160 },
        children: [new TextRun({
          text: `CONTROL VALVE SIZING  /  CALCULATION SUMMARY  /  ${String(index + 1).padStart(2, '0')} OF ${String(models.length).padStart(2, '0')}`,
          color: '5E6C78',
          size: 16,
          font: 'Arial',
        })],
      }),
    ];
  }

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
      children: models.flatMap(resultBlocks),
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
  const workbook = createWorkbookExportModel(payload);
  const {
    AlignmentType,
    BorderStyle,
    Document,
    Packer,
    PageOrientation,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
  } = await import('docx');

  const border = { color: 'DAE2E8', size: 4, style: BorderStyle.SINGLE };
  const borders = { top: border, bottom: border, left: border, right: border };
  const summaryCell = (text, {
    bold = false,
    color = '1F2D39',
    fill,
    alignment = AlignmentType.LEFT,
  } = {}) => new TableCell({
    borders,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 150, bottom: 150, left: 180, right: 180 },
    ...(fill ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill } } : {}),
    children: [new Paragraph({
      alignment,
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: String(text), bold, color, size: 20, font: 'Arial' })],
    })],
  });

  const resultsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [4000, 2000, 2000, 2000],
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          summaryCell('Sheet name', { bold: true, color: 'FFFFFF', fill: '142637' }),
          summaryCell('Minimum Cv', {
            bold: true,
            color: 'FFFFFF',
            fill: '142637',
            alignment: AlignmentType.RIGHT,
          }),
          summaryCell('Normal Cv', {
            bold: true,
            color: 'FFFFFF',
            fill: '142637',
            alignment: AlignmentType.RIGHT,
          }),
          summaryCell('Maximum Cv', {
            bold: true,
            color: 'FFFFFF',
            fill: '142637',
            alignment: AlignmentType.RIGHT,
          }),
        ],
      }),
      ...workbook.sheets.map(({ sheetName, values }, index) => {
        const fill = index % 2 === 1 ? 'F6F8FA' : undefined;
        return new TableRow({
          children: [
            summaryCell(sheetName, { fill }),
            ...values.map(({ value }) => summaryCell(value, { fill, alignment: AlignmentType.RIGHT })),
          ],
        });
      }),
    ],
  });

  const document = new Document({
    creator: 'Control Valve Sizing Calculator',
    title: workbook.title,
    subject: `${workbook.sheets.length} calculated worksheet Cv results from ${workbook.workbookName}`,
    description: 'Ordered workbook summary from the Control Valve Sizing Calculator',
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 22, color: '1F2D39' },
          paragraph: { spacing: { after: 140, line: 276 } },
        },
      },
      paragraphStyles: [{
        id: 'Title',
        name: 'Title',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { font: 'Arial', size: 38, bold: true, color: '142637' },
        paragraph: { spacing: { after: 320 } },
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children: [
        new Paragraph({
          spacing: { after: 100 },
          children: [new TextRun({
            text: 'ENGINEERING CALCULATION REPORT',
            bold: true,
            color: '16706E',
            size: 18,
            font: 'Arial',
          })],
        }),
        new Paragraph({
          style: 'Title',
          children: [new TextRun({ text: 'Control Valve Sizing' })],
        }),
        new Paragraph({
          spacing: { after: 300 },
          children: [
            new TextRun({ text: 'Workbook calculation summary  ', color: '5E6C78', size: 20, font: 'Arial' }),
            new TextRun({
              text: `${workbook.sheets.length} ${workbook.sheets.length === 1 ? 'VALVE' : 'VALVES'}`,
              bold: true,
              color: '16706E',
              size: 18,
              font: 'Arial',
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 70 },
          children: [new TextRun({
            text: 'WORKBOOK NAME',
            bold: true,
            color: '5E6C78',
            size: 17,
            font: 'Arial',
          })],
        }),
        new Paragraph({
          spacing: { after: 260 },
          keepNext: true,
          children: [new TextRun({
            text: workbook.workbookName,
            bold: true,
            color: '1F2D39',
            size: 28,
            font: 'Arial',
          })],
        }),
        resultsTable,
        new Paragraph({
          border: { top: { color: 'DAE2E8', size: 4, style: BorderStyle.SINGLE, space: 8 } },
          spacing: { before: 320 },
          children: [new TextRun({
            text: 'CONTROL VALVE SIZING  /  WORKBOOK SUMMARY',
            color: '5E6C78',
            size: 16,
            font: 'Arial',
          })],
        }),
      ],
    }],
  });

  triggerDownload(await Packer.toBlob(document), `${workbook.filename}.docx`);
}
