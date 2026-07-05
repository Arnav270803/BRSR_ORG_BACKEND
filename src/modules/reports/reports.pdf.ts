type ReportData = Awaited<
  ReturnType<typeof import("./reports.service.js").generateCompanyReportingYearReport>
>;

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function sanitizeText(value: string) {
  return value.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "-");
}

function wrapLine(value: string, maxLength: number) {
  const words = sanitizeText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

function buildReportLines(report: ReportData) {
  const lines: string[] = [];
  const add = (value = "") => lines.push(value);

  add(`${report.company.displayName} - BRSR GHG Report`);
  add(`Generated: ${new Date(report.generatedAt).toLocaleString("en-IN")}`);
  add("");
  add("Company summary");
  add(`Company name: ${report.company.displayName}`);
  add(`Legal name: ${report.company.legalName}`);
  add(`Industry: ${report.company.industry}`);
  add(`Location: ${report.company.location}`);
  add(`Primary domain: ${report.company.primaryDomain}`);
  add(`Financial year starts: month ${report.company.financialYearStartMonth}`);
  add("");
  add("Reporting year summary");
  add(`Selected year: ${report.reportingYear.label}`);
  add(`Start date: ${report.reportingYear.startDate}`);
  add(`End date: ${report.reportingYear.endDate}`);
  add(`Setup status: ${report.reportingYear.setupStatus}`);
  add("");
  add("Emission and data summary");
  add(`Total selected activities: ${report.ghgActivitySetup.selectedActivityCount}`);
  add(`Total records submitted: ${report.emissionSummary.recordCount}`);
  add(`Total calculated kg CO2e: ${report.emissionSummary.totalKgCo2e}`);
  add("");
  add("Totals by scope");
  for (const row of report.emissionSummary.totalsByScope) {
    add(`${row.name}: ${row.totalKgCo2e} kg CO2e (${row.recordCount} records)`);
  }
  add("");
  add("Totals by category");
  for (const row of report.emissionSummary.totalsByCategory) {
    add(`${row.name}: ${row.totalKgCo2e} kg CO2e (${row.recordCount} records)`);
  }
  add("");
  add("Totals by activity");
  for (const row of report.emissionSummary.totalsByActivity.slice(0, 30)) {
    add(`${row.name}: ${row.totalKgCo2e} kg CO2e (${row.recordCount} records)`);
  }
  add("");
  add("GHG activity setup");
  for (const activity of report.ghgActivitySetup.selectedActivities.slice(0, 50)) {
    add(
      `${activity.activity} | ${activity.category} | ${activity.scope ?? "Scope not set"} | ${activity.unit} | factor ${activity.factorKgCo2e ?? "not set"}`
    );
  }
  add("");
  add("Data records table");
  for (const record of report.dataRecords.slice(0, 100)) {
    add(
      `${record.recordDate} | ${record.activity} | ${record.category}/${record.scope ?? "Scope not set"} | ${record.quantity} ${record.unit} | factor ${record.factorKgCo2e ?? "not set"} | ${record.calculatedKgCo2e ?? "not calculated"} kg CO2e | ${record.createdBy}`
    );
    if (record.notes) {
      add(`Notes: ${record.notes}`);
    }
  }
  add("");
  add("Methodology note");
  add(`Emissions are calculated as: ${report.methodology.formula}`);
  add(report.methodology.note);
  add("");
  add("Limitations and future scope");
  for (const limitation of report.limitations) {
    add(`- ${limitation}`);
  }

  return lines.flatMap((line) => wrapLine(line, 92));
}

function renderPdfPage(lines: string[], pageNumber: number) {
  const contentLines = ["BT", "/F1 10 Tf", "50 780 Td", "14 TL"];

  for (const line of lines) {
    contentLines.push(`(${escapePdfText(line)}) Tj`);
    contentLines.push("T*");
  }

  contentLines.push("ET");
  contentLines.push("BT /F1 8 Tf 50 28 Td");
  contentLines.push(`(Page ${pageNumber}) Tj`);
  contentLines.push("ET");

  return contentLines.join("\n");
}

export function createReportPdf(report: ReportData) {
  const lines = buildReportLines(report);
  const linesPerPage = 52;
  const pages: string[] = [];

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(renderPdfPage(lines.slice(index, index + linesPerPage), pages.length + 1));
  }

  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  const fontObjectId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageObjectIds: number[] = [];
  const pagesObjectId = 2 + pages.length * 2;

  for (const pageContent of pages) {
    const contentObjectId = addObject(
      `<< /Length ${Buffer.byteLength(pageContent, "utf8")} >>\nstream\n${pageContent}\nendstream`
    );
    const pageObjectId = addObject(
      `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );

    pageObjectIds.push(pageObjectId);
  }

  addObject(
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`
  );
  const catalogObjectId = addObject(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);
  const chunks = ["%PDF-1.4\n"];
  const offsets: number[] = [0];

  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(chunks.join(""), "utf8"));
    chunks.push(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`);
  }

  const xrefOffset = Buffer.byteLength(chunks.join(""), "utf8");
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");
  for (let index = 1; index < offsets.length; index += 1) {
    chunks.push(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectId} 0 R >>\n`);
  chunks.push(`startxref\n${xrefOffset}\n%%EOF`);

  return Buffer.from(chunks.join(""), "utf8");
}
