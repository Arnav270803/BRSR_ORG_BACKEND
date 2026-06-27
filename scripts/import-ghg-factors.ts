import "dotenv/config";

import { Prisma, PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";

type CellValue = string | number | boolean | Date | null | undefined;

type FactorColumn = {
  primaryColumnIndex: number;
  variant: string | null;
  headers: {
    columnIndex: number;
    label: string;
  }[];
};

const EXCLUDED_SHEETS = new Set([
  "Introduction",
  "What's new",
  "Index",
  "Conversions",
  "Fuel properties",
  "Haul definition"
]);

const prisma = new PrismaClient({
  log: ["warn", "error"]
});

function cellToString(value: CellValue): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function cellToNumber(value: CellValue): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function columnName(index: number): string {
  let column = "";
  let current = index + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    current = Math.floor((current - 1) / 26);
  }

  return column;
}

function normalizeCode(value: string): string {
  return value
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function getMetadata(rows: CellValue[][], label: string): string | null {
  for (const row of rows.slice(0, 8)) {
    for (let index = 0; index < row.length; index += 1) {
      if (cellToString(row[index]) === label) {
        return cellToString(row[index + 1] as CellValue);
      }
    }
  }

  return null;
}

function getDescription(rows: CellValue[][]): string | null {
  for (const row of rows.slice(7, 14)) {
    const firstCell = cellToString(row[0] as CellValue);

    if (firstCell && firstCell !== "Guidance" && !firstCell.startsWith("Example of")) {
      return firstCell;
    }
  }

  return null;
}

function isHeaderRow(row: CellValue[]): boolean {
  const labels = row.map(cellToString);

  return labels[0] === "Activity" && labels.some((label) => label === "Unit");
}

function getHeaderRows(rows: CellValue[][]): number[] {
  return rows.reduce<number[]>((indexes, row, index) => {
    if (isHeaderRow(row)) {
      indexes.push(index);
    }

    return indexes;
  }, []);
}

function getDimensionColumns(headerRow: CellValue[]) {
  const firstFactorColumnIndex = headerRow.findIndex((value) =>
    cellToString(value)?.startsWith("kg CO2e")
  );

  if (firstFactorColumnIndex < 0) {
    return [];
  }

  return headerRow.slice(0, firstFactorColumnIndex).map((value, index) => ({
    columnIndex: index,
    label: cellToString(value) ?? `Column ${columnName(index)}`
  }));
}

function getFilledVariantLabels(variantRow: CellValue[] | undefined): Array<string | null> {
  if (!variantRow) {
    return [];
  }

  const labels: Array<string | null> = [];
  let current: string | null = null;

  for (const value of variantRow) {
    const text = cellToString(value);

    if (text) {
      current = text;
    }

    labels.push(current);
  }

  return labels;
}

function getFactorColumns(headerRow: CellValue[], variantRow: CellValue[] | undefined): FactorColumn[] {
  const variants = getFilledVariantLabels(variantRow);
  const groups: FactorColumn[] = [];
  let currentGroup: FactorColumn | null = null;

  headerRow.forEach((value, columnIndex) => {
    const label = cellToString(value);

    if (!label?.startsWith("kg CO2e")) {
      return;
    }

    if (label === "kg CO2e") {
      currentGroup = {
        primaryColumnIndex: columnIndex,
        variant: variants[columnIndex] ?? null,
        headers: []
      };
      groups.push(currentGroup);
    }

    currentGroup?.headers.push({
      columnIndex,
      label
    });
  });

  return groups;
}

function getRawRow(headers: CellValue[], row: CellValue[]) {
  const raw: Record<string, string | number | boolean> = {};

  headers.forEach((header, index) => {
    const label = cellToString(header) ?? columnName(index);
    const value = row[index];

    if (value !== null && value !== undefined && value !== "") {
      raw[`${columnName(index)}:${label}`] = value instanceof Date ? value.toISOString() : value;
    }
  });

  return raw;
}

async function importSheet(sheetName: string, sheetIndex: number, rows: CellValue[][]) {
  const headerRows = getHeaderRows(rows);

  if (headerRows.length === 0) {
    return {
      categories: 0,
      activities: 0
    };
  }

  const sourceYear = cellToNumber(getMetadata(rows, "Year:"));
  const sourceVersion = getMetadata(rows, "Version:");
  const scope = getMetadata(rows, "Scope:");

  const category = await prisma.ghgCategory.upsert({
    where: {
      sourceSheet: sheetName
    },
    update: {
      name: sheetName,
      scope,
      description: getDescription(rows),
      sortOrder: sheetIndex,
      isActive: true
    },
    create: {
      name: sheetName,
      sourceSheet: sheetName,
      scope,
      description: getDescription(rows),
      sortOrder: sheetIndex,
      isActive: true
    }
  });

  let importedActivities = 0;

  for (let blockIndex = 0; blockIndex < headerRows.length; blockIndex += 1) {
    const headerRowIndex = headerRows[blockIndex] as number;
    const nextHeaderRowIndex = headerRows[blockIndex + 1] ?? rows.length;
    const headerRow = rows[headerRowIndex] ?? [];
    const variantRow = rows[headerRowIndex - 1];
    const dimensionColumns = getDimensionColumns(headerRow);
    const factorColumns = getFactorColumns(headerRow, variantRow);
    const dimensionState: Record<string, string> = {};

    if (dimensionColumns.length === 0 || factorColumns.length === 0) {
      continue;
    }

    for (let rowIndex = headerRowIndex + 1; rowIndex < nextHeaderRowIndex; rowIndex += 1) {
      const row = rows[rowIndex] ?? [];
      const hasAnyFactor = factorColumns.some((factorColumn) =>
        factorColumn.headers.some((header) => cellToNumber(row[header.columnIndex] as CellValue) !== null)
      );

      if (!hasAnyFactor) {
        continue;
      }

      for (const dimensionColumn of dimensionColumns) {
        const value = cellToString(row[dimensionColumn.columnIndex] as CellValue);

        if (value) {
          dimensionState[dimensionColumn.label] = value;
        }
      }

      const activity = dimensionState.Activity;
      const unit = dimensionState.Unit;

      if (!activity || !unit) {
        continue;
      }

      const subtypeParts = dimensionColumns
        .filter((column) => column.label !== "Activity" && column.label !== "Unit")
        .map((column) => dimensionState[column.label])
        .filter(Boolean);
      const subtype = subtypeParts.length > 0 ? subtypeParts.join(" / ") : "";

      for (const factorColumn of factorColumns) {
        const factorKgCo2e = cellToNumber(row[factorColumn.primaryColumnIndex] as CellValue);

        if (factorKgCo2e === null) {
          continue;
        }

        const factorData = factorColumn.headers.reduce<Record<string, string>>((data, header) => {
          const value = cellToNumber(row[header.columnIndex] as CellValue);

          if (value !== null) {
            data[header.label] = String(value);
          }

          return data;
        }, {});

        const variant = factorColumn.variant ?? "";
        const sortOrder = rowIndex * 100 + factorColumn.primaryColumnIndex;

        await prisma.ghgActivity.upsert({
          where: {
            sourceSheet_sourceRow_unit_activity_subtype_variant: {
              sourceSheet: sheetName,
              sourceRow: rowIndex + 1,
              unit,
              activity,
              subtype,
              variant
            }
          },
          update: {
            categoryId: category.id,
            sourceYear,
            sourceVersion,
            scope,
            activity,
            subtype,
            variant,
            unit,
            factorKgCo2e: new Prisma.Decimal(String(factorKgCo2e)),
            factorData,
            rawData: getRawRow(headerRow, row),
            sortOrder,
            isActive: true
          },
          create: {
            categoryId: category.id,
            sourceSheet: sheetName,
            sourceYear,
            sourceVersion,
            sourceRow: rowIndex + 1,
            scope,
            activity,
            subtype,
            variant,
            unit,
            factorKgCo2e: new Prisma.Decimal(String(factorKgCo2e)),
            factorData,
            rawData: getRawRow(headerRow, row),
            sortOrder,
            isActive: true
          }
        });

        importedActivities += 1;
      }
    }
  }

  return {
    categories: 1,
    activities: importedActivities
  };
}

async function main() {
  const workbookPath =
    process.argv[2] ?? path.resolve(process.cwd(), "..", "ghg-conversion-factors-2025-full-set.xlsx");
  const workbookBuffer = await readFile(workbookPath);
  const workbook = XLSX.read(workbookBuffer, {
    cellDates: true,
    raw: true
  });

  let categoryCount = 0;
  let activityCount = 0;

  for (const [sheetIndex, sheetName] of workbook.SheetNames.entries()) {
    if (EXCLUDED_SHEETS.has(sheetName)) {
      continue;
    }

    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      continue;
    }

    const rows = XLSX.utils.sheet_to_json<CellValue[]>(sheet, {
      header: 1,
      defval: null,
      raw: true
    });
    const result = await importSheet(sheetName, sheetIndex, rows);

    categoryCount += result.categories;
    activityCount += result.activities;
  }

  console.log(`Imported ${categoryCount} GHG categories and ${activityCount} GHG activities.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
