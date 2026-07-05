import type { Request, Response } from "express";

import { getCompanyAccess } from "../../middleware/authenticate.js";
import { createReportPdf } from "./reports.pdf.js";
import { generateCompanyReportingYearReport } from "./reports.service.js";

type ReportsRouteParams = {
  reportingYearId: string;
};

export async function getReportController(req: Request<ReportsRouteParams>, res: Response) {
  const company = getCompanyAccess(res);
  const report = await generateCompanyReportingYearReport(
    company.companyId,
    req.params.reportingYearId
  );

  res.status(200).json({
    data: report
  });
}

export async function downloadReportPdfController(
  req: Request<ReportsRouteParams>,
  res: Response
) {
  const company = getCompanyAccess(res);
  const report = await generateCompanyReportingYearReport(
    company.companyId,
    req.params.reportingYearId
  );
  const pdf = createReportPdf(report);
  const filename = `${report.company.displayName}-${report.reportingYear.label}-BRSR-report.pdf`
    .replace(/[^a-z0-9.-]+/gi, "-")
    .replace(/-+/g, "-");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", String(pdf.length));
  res.status(200).send(pdf);
}
