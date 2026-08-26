import { Document, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, HeadingLevel, VerticalAlign, PageOrientation } from 'docx';
import { AppState } from '../types';
import { calculateAverage, calculateStandardDeviation, calculateCV, formatMoney, formatMoney4 } from './math';
import { formatAmountInWords } from './numberToWords';
import { generateDocumentBatch } from './documentBatch';
import { normalizeNmckState } from '../documents/templateNormalization';

export const METHOD_TEXT = "В соответствии со ст. 22 Федерального закона от 05.04.2013 № 44-ФЗ «О контрактной системе в сфере закупок товаров, работ, услуг для обеспечения государственных и муниципальных нужд» расчет начальной (максимальной) цены контракта (далее – НМЦК) произведен методом сопоставимых рыночных цен (анализа рынка) в соответствии с Методическими рекомендациями по применению методов определения начальной (максимальной) цены контракта, цены контракта, заключаемого с единственным поставщиком (подрядчиком, исполнителем), утвержденными Приказом Министерства экономического развития РФ от 2 октября 2013 г. N 567 (далее – Методические рекомендации).";

type DocxAlignment = (typeof AlignmentType)[keyof typeof AlignmentType];
type DocxVerticalAlign = NonNullable<ConstructorParameters<typeof TableCell>[0]["verticalAlign"]>;

const createCell = (text: string | Paragraph[], colSpan: number = 1, align: DocxAlignment = AlignmentType.CENTER, bold: boolean = false, valign: DocxVerticalAlign = VerticalAlign.CENTER, fontSize: number = 20) => {
  const content = typeof text === 'string' 
    ? [new Paragraph({ children: [new TextRun({ text, bold, font: "Times New Roman", size: fontSize })], alignment: align })]
    : text;
  
  return new TableCell({
    children: content,
    columnSpan: colSpan,
    verticalAlign: valign,
    margins: { top: 40, bottom: 40, left: 60, right: 60 } // reduced padding to fit on page
  });
};

export const generateDocx = async (state: AppState) => {
  const normalizedState = normalizeNmckState(state);
  const { requisites, suppliers, positions, prices } = normalizedState;
  const numSuppliers = suppliers.length;
  const totalCols = 4 + numSuppliers + 4;
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

  // Row 1: Характеристики
  tableRows.push(new TableRow({
    children: [
      createCell("Характеристики\nобъекта закупки", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20),
      createCell(requisites.subject, totalCols - 1, AlignmentType.LEFT, false, VerticalAlign.CENTER, 18) // 9pt
    ]
  }));

  // Row 2: Метод
  tableRows.push(new TableRow({
    children: [
      createCell("Используемый метод\nопределения НМЦ\nс обоснованием:", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20),
      createCell(
        [new Paragraph({ children: [new TextRun({ text: METHOD_TEXT, font: "Times New Roman", size: 20 })], alignment: AlignmentType.JUSTIFIED })],
        totalCols - 1,
        AlignmentType.JUSTIFIED,
        false,
        VerticalAlign.TOP,
        20
      )
    ]
  }));

  // Row 3: РАСЧЕТ НМЦК
  tableRows.push(new TableRow({
    children: [createCell("РАСЧЕТ НМЦК", totalCols, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20)]
  }));

  // Row 4: Headers
  const headerCells = [
    createCell("№", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20),
    createCell("Наименование\nтовара, услуги\n(работы)", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20),
    createCell("ЕИ", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20),
    createCell("Кол-во", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20),
    ...suppliers.map(s => createCell(`Цена единицы товара\n(работ, услуг)\n${s.kpDetails}`, 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20)),
    createCell("Средняя цена единицы\nтовара (работ, услуг),\n(руб.)", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20),
    createCell("Среднее\nквадратичное\nотклонение", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20),
    createCell("Коэффициент\nвариации,\n(%)", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20),
    createCell("НМЦК (руб.)", 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20),
  ];
  tableRows.push(new TableRow({ children: headerCells }));

  // Position Rows
  positions.forEach((pos, index) => {
    const posPrices: number[] = [];
    
    const supplierCells = suppliers.map(sup => {
      const entry = prices.find(p => p.positionId === pos.id && p.supplierId === sup.id);
      const rawPrice = entry?.price || 0;
      if (rawPrice > 0) posPrices.push(rawPrice);
      return createCell(formatMoney(rawPrice), 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20);
    });

    const average = calculateAverage(posPrices);
    const stdDev = calculateStandardDeviation(posPrices, average);
    const cv = calculateCV(posPrices);
    const posTotal = average * pos.quantity;
    grandTotal += posTotal;

    tableRows.push(new TableRow({
      children: [
        createCell(`${index + 1}`, 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20),
        createCell(pos.name, 1, AlignmentType.LEFT, false, VerticalAlign.CENTER, 20),
        createCell(pos.unit || 'штука', 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20),
        createCell(`${pos.quantity}`, 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20),
        ...supplierCells,
        createCell(formatMoney(average), 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20),
        createCell(formatMoney4(stdDev), 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20),
        createCell(formatMoney(cv) + '%', 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20),
        createCell(formatMoney(posTotal), 1, AlignmentType.CENTER, false, VerticalAlign.CENTER, 20),
      ]
    }));
  });

  // Row: Итого
  tableRows.push(new TableRow({
    children: [
      createCell("Итого:", totalCols - 1, AlignmentType.RIGHT, false, VerticalAlign.CENTER, 20),
      createCell(formatMoney(grandTotal), 1, AlignmentType.CENTER, true, VerticalAlign.CENTER, 24) // 12pt Bold
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
        margins: { top: 40, bottom: 40, left: 60, right: 60 }
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
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            }
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
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "auto" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
              left: { style: BorderStyle.NONE, size: 0, color: "auto" },
              right: { style: BorderStyle.NONE, size: 0, color: "auto" },
              insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
              insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: requisites.executorPosition, font: "Times New Roman", size: 20 })] })] // 10pt
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: requisites.executorName, font: "Times New Roman", size: 20 })], alignment: AlignmentType.RIGHT })] // 10pt
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
