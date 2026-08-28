import { Document, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, HeadingLevel, VerticalAlign, PageOrientation } from 'docx';
import { AppState } from '../types';
import { calculateAverage, calculateStandardDeviation, calculateCV, formatMoney, formatMoney4 } from './math';
import { formatAmountInWords } from './numberToWords';
import { generateDocumentBatch } from './documentBatch';
import { normalizeNmckState } from '../documents/templateNormalization';

export const METHOD_TEXT = "В соответствии со ст. 22 Федерального закона от 05.04.2013 № 44-ФЗ «О контрактной системе в сфере закупок товаров, работ, услуг для обеспечения государственных и муниципальных нужд» расчет начальной (максимальной) цены контракта (далее – НМЦК) произведен методом сопоставимых рыночных цен (анализа рынка) в соответствии с Методическими рекомендациями по применению методов определения начальной (максимальной) цены контракта, цены контракта, заключаемого с единственным поставщиком (подрядчиком, исполнителем), утвержденными Приказом Министерства экономического развития РФ от 2 октября 2013 г. N 567 (далее – Методические рекомендации).";

type DocxAlignment = (typeof AlignmentType)[keyof typeof AlignmentType];
type DocxVerticalAlign = NonNullable<ConstructorParameters<typeof TableCell>[0]["verticalAlign"]>;

const TWIPS_PER_CM = 567;
const PAGE_CONTENT_TWIPS = Math.round(27.7 * TWIPS_PER_CM);
const COL_NUM_TWIPS = TWIPS_PER_CM;
const COL_UNIT_TWIPS = Math.round(1.5 * TWIPS_PER_CM);
const COL_QTY_TWIPS = Math.round(1.5 * TWIPS_PER_CM);
const COL_NMCK_TWIPS = Math.round(2.6 * TWIPS_PER_CM);
const COL_LABEL_TWIPS = Math.round(3.5 * TWIPS_PER_CM);
const SIGNATURE_CELL_TWIPS = Math.round(4.5 * TWIPS_PER_CM);

const BORDER_NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const BORDER_BOTTOM = { style: BorderStyle.SINGLE, size: 8, color: "000000" } as const;
const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
} as const;

function buildColumnWidths(totalCols: number): number[] {
  const fixed = COL_NUM_TWIPS + COL_UNIT_TWIPS + COL_QTY_TWIPS + COL_NMCK_TWIPS;
  const flexCount = totalCols - 4;
  const remaining = PAGE_CONTENT_TWIPS - fixed;
  const base = Math.floor(remaining / flexCount);
  const extra = remaining - base * flexCount;
  return Array.from({ length: totalCols }, (_, index) => {
    if (index === 0) return COL_NUM_TWIPS;
    if (index === 2) return COL_UNIT_TWIPS;
    if (index === 3) return COL_QTY_TWIPS;
    if (index === totalCols - 1) return COL_NMCK_TWIPS;
    return base + (index === 1 ? extra : 0);
  });
}

function sumColumnWidths(widths: number[], start: number, span: number): number {
  return widths.slice(start, start + span).reduce((total, width) => total + width, 0);
}

const createCell = (
  text: string | Paragraph[],
  colSpan: number = 1,
  align: DocxAlignment = AlignmentType.CENTER,
  bold: boolean = false,
  valign: DocxVerticalAlign = VerticalAlign.CENTER,
  fontSize: number = 20,
  widthDx?: number,
) => {
  const content = typeof text === 'string' 
    ? [new Paragraph({ children: [new TextRun({ text, bold, font: "Times New Roman", size: fontSize })], alignment: align })]
    : text;
  
  return new TableCell({
    children: content,
    columnSpan: colSpan,
    verticalAlign: valign,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    ...(widthDx !== undefined ? { width: { size: widthDx, type: WidthType.DXA } } : {}),
  });
};

export const generateDocx = async (state: AppState) => {
  const normalizedState = normalizeNmckState(state);
  const { requisites, suppliers, positions, prices } = normalizedState;
  const numSuppliers = suppliers.length;
  const totalCols = 4 + numSuppliers + 4;
  const columnWidths = buildColumnWidths(totalCols);
  const widthAt = (start: number, span = 1) => sumColumnWidths(columnWidths, start, span);
  let grandTotal = 0;

  // Calculate minimum total among all suppliers
  const supplierTotals = suppliers.map(sup => {
    let supTotal = 0;
    positions.forEach(pos => {
      const entry = prices.find(p => p.positionId === pos.id && p.supplierId === sup.id);
      const rawPrice = entry?.price || 0;
      supTotal += rawPrice * pos.quantity;
    });
    return supTotal;
  });
  const minSupplierTotal = Math.min(...supplierTotals) || 0;

  const tableRows: TableRow[] = [];

  const introTable = new Table({
    width: { size: PAGE_CONTENT_TWIPS, type: WidthType.DXA },
    columnWidths: [COL_LABEL_TWIPS, PAGE_CONTENT_TWIPS - COL_LABEL_TWIPS],
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          createCell("Характеристики\nобъекта закупки", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, COL_LABEL_TWIPS),
          createCell(requisites.subject, 1, AlignmentType.LEFT, false, VerticalAlign.CENTER, 18, PAGE_CONTENT_TWIPS - COL_LABEL_TWIPS),
        ]
      }),
      new TableRow({
        children: [
          createCell("Используемый метод\nопределения НМЦ\nс обоснованием:", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, COL_LABEL_TWIPS),
          createCell(
            [new Paragraph({ children: [new TextRun({ text: METHOD_TEXT, font: "Times New Roman", size: 20 })], alignment: AlignmentType.JUSTIFIED })],
            1,
            AlignmentType.JUSTIFIED,
            false,
            VerticalAlign.TOP,
            20,
            PAGE_CONTENT_TWIPS - COL_LABEL_TWIPS
          ),
        ]
      }),
    ],
  });

  // Row: РАСЧЕТ НМЦК
  tableRows.push(new TableRow({
    children: [createCell("РАСЧЕТ НМЦК", totalCols, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, widthAt(0, totalCols))]
  }));

  // Row 4: Headers
  const headerCells = [
    createCell("№", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, columnWidths[0]),
    createCell("Наименование\nтовара, услуги\n(работы)", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, columnWidths[1]),
    createCell("ЕИ", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, columnWidths[2]),
    createCell("Кол-во", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, columnWidths[3]),
    ...suppliers.map((s, supplierIndex) => createCell(`Цена единицы товара\n(работ, услуг)\n${s.kpDetails}`, 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, columnWidths[4 + supplierIndex])),
    createCell("Средняя цена единицы\nтовара (работ, услуг),\n(руб.)", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, columnWidths[4 + numSuppliers]),
    createCell("Среднее\nквадратичное\nотклонение", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, columnWidths[5 + numSuppliers]),
    createCell("Коэффициент\nвариации,\n(%)", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, columnWidths[6 + numSuppliers]),
    createCell("НМЦК (руб.)", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, columnWidths[totalCols - 1]),
  ];
  tableRows.push(new TableRow({ children: headerCells }));

  // Position Rows
  positions.forEach((pos, index) => {
    const posPrices: number[] = [];
    
    const supplierCells = suppliers.map((sup, supplierIndex) => {
      const entry = prices.find(p => p.positionId === pos.id && p.supplierId === sup.id);
      const rawPrice = entry?.price || 0;
      if (rawPrice > 0) posPrices.push(rawPrice);
      return createCell(formatMoney(rawPrice), 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, columnWidths[4 + supplierIndex]);
    });

    const average = calculateAverage(posPrices);
    const stdDev = calculateStandardDeviation(posPrices, average);
    const cv = calculateCV(posPrices);
    const posTotal = average * pos.quantity;
    grandTotal += posTotal;

    tableRows.push(new TableRow({
      children: [
        createCell(`${index + 1}`, 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, columnWidths[0]),
        createCell(pos.name, 1, AlignmentType.LEFT, false, VerticalAlign.CENTER, 20, columnWidths[1]),
        createCell(pos.unit || 'штука', 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, columnWidths[2]),
        createCell(`${pos.quantity}`, 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, columnWidths[3]),
        ...supplierCells,
        createCell(formatMoney(average), 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, columnWidths[4 + numSuppliers]),
        createCell(formatMoney4(stdDev), 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, columnWidths[5 + numSuppliers]),
        createCell(formatMoney(cv) + '%', 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, columnWidths[6 + numSuppliers]),
        createCell(formatMoney(posTotal), 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20, columnWidths[totalCols - 1]),
      ]
    }));
  });

  // Row: Итого
  tableRows.push(new TableRow({
    children: [
      createCell("Итого:", totalCols - 1, AlignmentType.RIGHT, false, VerticalAlign.CENTER, 20, widthAt(0, totalCols - 1)),
      createCell(formatMoney(grandTotal), 1, AlignmentType.CENTER, true, VerticalAlign.CENTER, 24, columnWidths[totalCols - 1])
    ]
  }));

  // Row: Вывод
  const conclusionContent = [
    new Paragraph({
      children: [
        new TextRun({ text: "На основании проведенного анализа рынка и расчетов Заказчик принимает решение о минимальном значении цены за единицу, в соответствии с выделенными лимитами бюджетных обязательств. НМЦК составляет: ", font: "Times New Roman", size: 20 }),
        new TextRun({ text: formatMoney(minSupplierTotal), font: "Times New Roman", size: 28, bold: true }), // 14pt Bold
        new TextRun({ text: ` рублей (${formatAmountInWords(minSupplierTotal)}).`, font: "Times New Roman", size: 20 })
      ],
      alignment: AlignmentType.CENTER
    })
  ];
  tableRows.push(new TableRow({
    children: [
      new TableCell({
        children: conclusionContent,
        columnSpan: totalCols,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        width: { size: widthAt(0, totalCols), type: WidthType.DXA },
      })
    ]
  }));

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: { top: 567, right: 567, bottom: 567, left: 567 } // 1cm margins to fit everything
          }
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: 'Обоснование начальной (максимальной) цены', bold: true, font: "Times New Roman", size: 20 }) // 10pt
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: requisites.subject, font: "Times New Roman", size: 18 }) // 9pt
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: '' }),
          introTable,
          new Table({
            rows: tableRows,
            width: { size: PAGE_CONTENT_TWIPS, type: WidthType.DXA },
            columnWidths,
            borders: TABLE_BORDERS,
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({ 
                text: 'Цена Контракта включает в себя стоимость оказываемых Услуг, а также налоги и сборы, установленные действующим законодательством Российской Федерации.',
                font: "Times New Roman", size: 20 
              })
            ]
          }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: PAGE_CONTENT_TWIPS, type: WidthType.DXA },
            columnWidths: [
              SIGNATURE_CELL_TWIPS,
              PAGE_CONTENT_TWIPS - SIGNATURE_CELL_TWIPS * 2,
              SIGNATURE_CELL_TWIPS,
            ],
            borders: {
              top: BORDER_NONE,
              bottom: BORDER_NONE,
              left: BORDER_NONE,
              right: BORDER_NONE,
              insideHorizontal: BORDER_NONE,
              insideVertical: BORDER_NONE,
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: SIGNATURE_CELL_TWIPS, type: WidthType.DXA },
                    verticalAlign: VerticalAlign.CENTER,
                    borders: {
                      top: BORDER_NONE,
                      left: BORDER_NONE,
                      right: BORDER_NONE,
                      bottom: BORDER_BOTTOM,
                    },
                    children: [new Paragraph({
                      children: [new TextRun({ text: requisites.executorPosition, font: "Times New Roman", size: 20 })],
                      alignment: AlignmentType.CENTER,
                    })]
                  }),
                  new TableCell({
                    width: { size: PAGE_CONTENT_TWIPS - SIGNATURE_CELL_TWIPS * 2, type: WidthType.DXA },
                    verticalAlign: VerticalAlign.CENTER,
                    borders: {
                      top: BORDER_NONE,
                      left: BORDER_NONE,
                      right: BORDER_NONE,
                      bottom: BORDER_NONE,
                    },
                    children: [new Paragraph({ children: [new TextRun({ text: "", font: "Times New Roman", size: 20 })] })]
                  }),
                  new TableCell({
                    width: { size: SIGNATURE_CELL_TWIPS, type: WidthType.DXA },
                    verticalAlign: VerticalAlign.CENTER,
                    borders: {
                      top: BORDER_NONE,
                      left: BORDER_NONE,
                      right: BORDER_NONE,
                      bottom: BORDER_BOTTOM,
                    },
                    children: [new Paragraph({
                      children: [new TextRun({ text: requisites.executorName, font: "Times New Roman", size: 20 })],
                      alignment: AlignmentType.CENTER,
                    })]
                  })
                ]
              })
            ]
          })
        ],
      },
    ],
  });

  await generateDocumentBatch(
    [{ document: doc, filename: "Обоснование_НМЦК.docx" }],
    { singleFileName: "Обоснование_НМЦК.docx", zipFileName: "Обоснования_НМЦК.zip" }
  );
};
