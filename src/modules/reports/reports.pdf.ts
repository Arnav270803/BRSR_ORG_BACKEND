import PDFDocument from "pdfkit";

type ReportData = Awaited<
  ReturnType<typeof import("./reports.service.js").generateCompanyReportingYearReport>
>;

type TableColumn<TRow> = {
  key: keyof TRow;
  label: string;
  width: number;
  align?: "left" | "right";
};

const page = {
  width: 595.28,
  height: 841.89,
  margin: 42
};

const theme = {
  border: "#D7E1DA",
  charcoal: "#17221B",
  green: "#1F5F3A",
  greenDark: "#17462C",
  greenSoft: "#E9F3ED",
  muted: "#647169",
  pale: "#F7FAF8",
  sand: "#F8F3EA",
  white: "#FFFFFF"
};

const contentWidth = page.width - page.margin * 2;

function cleanText(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value).replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "-");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatGeneratedDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed)) {
    return "0";
  }

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0
  }).format(parsed);
}

function toTonnes(value: string) {
  return formatNumber(Number(value) / 1000);
}

function collectPdf(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function footer(doc: PDFKit.PDFDocument, report: ReportData) {
  const range = doc.bufferedPageRange();
  const footerY = page.height - 52;

  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(theme.muted)
      .text(
        `BRSR Platform | ${cleanText(report.company.displayName)} | Confidential report`,
        page.margin,
        footerY,
        { lineBreak: false, width: contentWidth / 2 }
      )
      .text(`Page ${index + 1} of ${range.count}`, page.margin, footerY, {
        align: "right",
        lineBreak: false,
        width: contentWidth
      });
  }
}

function ensureSpace(doc: PDFKit.PDFDocument, requiredHeight: number) {
  if (doc.y + requiredHeight > page.height - 54) {
    doc.addPage();
  }
}

function sectionTitle(doc: PDFKit.PDFDocument, eyebrow: string, title: string) {
  ensureSpace(doc, 64);
  doc.moveDown(0.3);
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(theme.green)
    .text(cleanText(eyebrow).toUpperCase(), page.margin, doc.y, {
      characterSpacing: 1.1
    });
  doc.moveDown(0.35);
  doc.font("Helvetica-Bold").fontSize(15).fillColor(theme.charcoal).text(cleanText(title));
  doc.moveDown(0.5);
}

function pill(doc: PDFKit.PDFDocument, x: number, y: number, text: string, color = theme.green) {
  const width = doc.widthOfString(text) + 18;

  doc.roundedRect(x, y, width, 20, 4).fillAndStroke(`${color}12`, color);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(color).text(text, x + 9, y + 6);
}

function drawCover(doc: PDFKit.PDFDocument, report: ReportData) {
  doc.rect(0, 0, page.width, 190).fill(theme.greenDark);
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#CFE4D8")
    .text("BRSR PLATFORM", page.margin, 50, { characterSpacing: 1.7 });
  doc
    .font("Helvetica-Bold")
    .fontSize(28)
    .fillColor(theme.white)
    .text("GHG Emissions Report", page.margin, 76, { width: 330, lineGap: 2 });
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#DCEAE1")
    .text(`${cleanText(report.reportingYear.label)} | ${cleanText(report.site.name)}`, page.margin, 146);
  pill(doc, page.width - 162, 54, cleanText(report.reportingYear.setupStatus), "#DCEAE1");

  doc.y = 230;
  doc.font("Helvetica-Bold").fontSize(21).fillColor(theme.charcoal).text(cleanText(report.company.displayName));
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(theme.muted)
    .text(cleanText(report.company.legalName), { lineGap: 3 });
  doc.moveDown(1.2);

  drawKpiCards(doc, [
    { label: "Gross emissions", value: `${formatNumber(report.emissionSummary.totalKgCo2e)} kg CO2e` },
    { label: "Gross tCO2e", value: toTonnes(report.emissionSummary.totalKgCo2e) },
    { label: "Submitted records", value: formatNumber(report.emissionSummary.recordCount) },
    { label: "Selected activities", value: formatNumber(report.ghgActivitySetup.selectedActivityCount) }
  ]);

  doc.moveDown(1.6);
  drawInfoGrid(doc, [
    ["Site", report.site.name],
    ["Site type", report.site.type],
    ["Location", `${report.site.city}, ${report.site.state}, ${report.site.country}`],
    ["Generated", formatGeneratedDate(report.generatedAt)],
    ["Reporting period", `${formatDate(report.reportingYear.startDate)} - ${formatDate(report.reportingYear.endDate)}`],
    ["Primary domain", report.company.primaryDomain]
  ]);

  doc.moveDown(1.6);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(theme.muted)
    .text(
      "This report summarizes active, non-deleted GHG data records submitted for the selected company site and reporting year. Emission totals are calculated from stored activity factors and user-entered quantities.",
      { lineGap: 4 }
    );
}

function drawKpiCards(doc: PDFKit.PDFDocument, cards: Array<{ label: string; value: string }>) {
  const gap = 10;
  const width = (contentWidth - gap * 3) / 4;
  const startY = doc.y;

  cards.forEach((card, index) => {
    const x = page.margin + index * (width + gap);

    doc.roundedRect(x, startY, width, 72, 7).fillAndStroke(theme.pale, theme.border);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(theme.green).text(card.label.toUpperCase(), x + 12, startY + 14, {
      width: width - 24,
      characterSpacing: 0.8
    });
    doc.font("Helvetica-Bold").fontSize(15).fillColor(theme.charcoal).text(card.value, x + 12, startY + 37, {
      width: width - 24,
      lineGap: 1
    });
  });

  doc.y = startY + 84;
}

function drawInfoGrid(doc: PDFKit.PDFDocument, rows: Array<[string, string | number | null | undefined]>) {
  const gap = 10;
  const colWidth = (contentWidth - gap) / 2;
  const rowHeight = 44;
  let y = doc.y;

  rows.forEach(([label, value], index) => {
    if (index > 0 && index % 2 === 0) {
      y += rowHeight + 8;
    }

    const x = page.margin + (index % 2) * (colWidth + gap);

    doc.roundedRect(x, y, colWidth, rowHeight, 5).fillAndStroke(theme.white, theme.border);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(theme.muted).text(label.toUpperCase(), x + 10, y + 9, {
      width: colWidth - 20,
      characterSpacing: 0.7
    });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(theme.charcoal).text(cleanText(value), x + 10, y + 24, {
      width: colWidth - 20
    });
  });

  doc.y = y + rowHeight + 4;
}

function drawProgressRows(doc: PDFKit.PDFDocument, rows: Array<{ name: string; recordCount: number; totalKgCo2e: string }>) {
  const max = Math.max(...rows.map((row) => Number(row.totalKgCo2e)), 1);

  rows.slice(0, 8).forEach((row) => {
    ensureSpace(doc, 34);
    const y = doc.y;
    const value = Number(row.totalKgCo2e);
    const barWidth = Math.max(4, (contentWidth * 0.36 * value) / max);

    doc.font("Helvetica-Bold").fontSize(9).fillColor(theme.charcoal).text(cleanText(row.name), page.margin, y, {
      width: contentWidth * 0.46
    });
    doc.font("Helvetica").fontSize(8).fillColor(theme.muted).text(`${row.recordCount} records`, page.margin, y + 13);
    doc.roundedRect(page.margin + contentWidth * 0.5, y + 3, contentWidth * 0.36, 8, 4).fill("#E6EEE9");
    doc.roundedRect(page.margin + contentWidth * 0.5, y + 3, barWidth, 8, 4).fill(theme.green);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(theme.charcoal).text(`${formatNumber(row.totalKgCo2e)} kg`, page.margin, y, {
      align: "right",
      width: contentWidth
    });
    doc.y = y + 28;
  });
}

function tableRowHeight<TRow extends Record<string, unknown>>(
  doc: PDFKit.PDFDocument,
  columns: Array<TableColumn<TRow>>,
  row: TRow
) {
  const heights = columns.map((column) =>
    doc.heightOfString(cleanText(row[column.key]), {
      width: column.width - 12
    })
  );

  return Math.max(28, Math.max(...heights) + 14);
}

function drawTable<TRow extends Record<string, unknown>>(
  doc: PDFKit.PDFDocument,
  title: string,
  columns: Array<TableColumn<TRow>>,
  rows: TRow[],
  emptyText: string
) {
  sectionTitle(doc, "Data table", title);

  if (rows.length === 0) {
    doc.font("Helvetica").fontSize(9).fillColor(theme.muted).text(emptyText);
    return;
  }

  const drawHeader = () => {
    ensureSpace(doc, 34);
    const y = doc.y;
    let x = page.margin;

    doc.roundedRect(page.margin, y, contentWidth, 26, 5).fill(theme.greenDark);
    columns.forEach((column) => {
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(theme.white).text(column.label.toUpperCase(), x + 6, y + 9, {
        align: column.align ?? "left",
        width: column.width - 12
      });
      x += column.width;
    });
    doc.y = y + 30;
  };

  drawHeader();

  rows.forEach((row, rowIndex) => {
    const rowHeight = tableRowHeight(doc, columns, row);

    if (doc.y + rowHeight > page.height - 58) {
      doc.addPage();
      drawHeader();
    }

    const y = doc.y;
    let x = page.margin;

    doc.rect(page.margin, y, contentWidth, rowHeight).fill(rowIndex % 2 === 0 ? theme.white : theme.pale);
    doc.strokeColor(theme.border).moveTo(page.margin, y + rowHeight).lineTo(page.margin + contentWidth, y + rowHeight).stroke();

    columns.forEach((column) => {
      doc.font("Helvetica").fontSize(7.7).fillColor(theme.charcoal).text(cleanText(row[column.key]), x + 6, y + 8, {
        align: column.align ?? "left",
        lineGap: 1,
        width: column.width - 12
      });
      x += column.width;
    });

    doc.y = y + rowHeight;
  });

  doc.moveDown(0.7);
}

function drawMethodology(doc: PDFKit.PDFDocument, report: ReportData) {
  sectionTitle(doc, "Methodology", "Calculation basis and limitations");
  drawInfoGrid(doc, [
    ["Formula", report.methodology.formula],
    ["Factor source", "Stored GHG factor catalog"],
    ["Records included", "Active, non-deleted records"],
    ["Evidence uploads", "Not included in V1 PDF"]
  ]);
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(9).fillColor(theme.muted).text(cleanText(report.methodology.note), {
    lineGap: 3
  });
  doc.moveDown(0.8);

  report.limitations.forEach((limitation) => {
    ensureSpace(doc, 22);
    doc.circle(page.margin + 3, doc.y + 5, 2).fill(theme.green);
    doc.font("Helvetica").fontSize(9).fillColor(theme.charcoal).text(cleanText(limitation), page.margin + 14, doc.y, {
      lineGap: 3,
      width: contentWidth - 14
    });
    doc.moveDown(0.45);
  });
}

export async function createReportPdf(report: ReportData) {
  const doc = new PDFDocument({
    autoFirstPage: true,
    bufferPages: true,
    info: {
      Author: "BRSR Platform",
      Subject: `${report.reportingYear.label} GHG emissions report`,
      Title: `${report.company.displayName} BRSR GHG Report`
    },
    margin: page.margin,
    size: "A4"
  });
  const pdf = collectPdf(doc);

  drawCover(doc, report);

  doc.addPage();
  sectionTitle(doc, "Company profile", "Registered workspace details");
  drawInfoGrid(doc, [
    ["Company", report.company.displayName],
    ["Legal name", report.company.legalName],
    ["Industry", report.company.industry],
    ["Primary domain", report.company.primaryDomain],
    ["Company location", report.company.location],
    ["Financial year start", `Month ${report.company.financialYearStartMonth}`],
    ["Site", report.site.name],
    ["Site address", report.site.address ?? `${report.site.city}, ${report.site.state}, ${report.site.country}`]
  ]);

  sectionTitle(doc, "Emissions summary", "Scope and category breakdown");
  drawKpiCards(doc, [
    { label: "Gross kg CO2e", value: formatNumber(report.emissionSummary.totalKgCo2e) },
    { label: "Gross tCO2e", value: toTonnes(report.emissionSummary.totalKgCo2e) },
    { label: "Records", value: formatNumber(report.emissionSummary.recordCount) },
    { label: "Activities", value: formatNumber(report.ghgActivitySetup.selectedActivityCount) }
  ]);
  doc.moveDown(0.4);
  sectionTitle(doc, "Scope summary", "Emissions by scope");
  drawProgressRows(doc, report.emissionSummary.totalsByScope);
  sectionTitle(doc, "Category summary", "Largest emission categories");
  drawProgressRows(doc, report.emissionSummary.totalsByCategory);

  drawTable(
    doc,
    "Top activities by emissions",
    [
      { key: "name", label: "Activity", width: 270 },
      { key: "recordCount", label: "Records", width: 80, align: "right" },
      { key: "totalKgCo2e", label: "kg CO2e", width: 160, align: "right" }
    ],
    report.emissionSummary.totalsByActivity.slice(0, 20),
    "No activity totals are available yet."
  );

  drawTable(
    doc,
    "Approved vendor emissions",
    [
      { key: "name", label: "Vendor", width: 270 },
      { key: "recordCount", label: "Records", width: 80, align: "right" },
      { key: "totalKgCo2e", label: "kg CO2e", width: 160, align: "right" }
    ],
    report.emissionSummary.totalsByVendor,
    "No approved vendor submissions are included in this report."
  );

  drawTable(
    doc,
    "Selected GHG activities",
    [
      { key: "activity", label: "Activity", width: 185 },
      { key: "category", label: "Category", width: 135 },
      { key: "scope", label: "Scope", width: 70 },
      { key: "unit", label: "Unit", width: 50 },
      { key: "factorKgCo2e", label: "Factor", width: 70, align: "right" }
    ],
    report.ghgActivitySetup.selectedActivities.slice(0, 60),
    "No activities are selected for this reporting year."
  );

  drawTable(
    doc,
    "Submitted data records",
    [
      { key: "recordDate", label: "Date", width: 56 },
      { key: "activity", label: "Activity", width: 116 },
      { key: "scope", label: "Scope", width: 44 },
      { key: "dataOrigin", label: "Origin", width: 50 },
      { key: "vendor", label: "Vendor", width: 110 },
      { key: "quantity", label: "Qty", width: 45, align: "right" },
      { key: "unit", label: "Unit", width: 40 },
      { key: "calculatedKgCo2e", label: "kg CO2e", width: 50, align: "right" }
    ],
    report.dataRecords.slice(0, 100),
    "No data records have been submitted for this reporting year."
  );

  if (report.dataRecords.length > 100) {
    ensureSpace(doc, 28);
    doc.font("Helvetica").fontSize(8).fillColor(theme.muted).text(
      `Showing first 100 of ${report.dataRecords.length} records in this V1 PDF. The JSON report endpoint contains the full dataset.`
    );
  }

  drawMethodology(doc, report);
  footer(doc, report);
  doc.end();

  return pdf;
}
