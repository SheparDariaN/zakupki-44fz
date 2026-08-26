import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  VerticalAlign,
} from "docx";
import { KpDocxData } from "../types";
import { KP_VENDOR_BATCH_SCENARIO } from "../documents/batchScenarios";
import { normalizeKpState } from "../documents/templateNormalization";
import { generateDocumentBatchFromScenario, sanitizeFileName } from "./documentBatch";

const buildDocument = (data: KpDocxData, vendorInfo: string) => {
  const TIMES = "Times New Roman";
  const HEADER_BLOCK_WIDTH = 4650; // 8.2 cm in twips.
  const HEADER_TABLE_WIDTH = HEADER_BLOCK_WIDTH * 2;

  const t = (text: string, bold: boolean = false, size: number = 24) =>
    new TextRun({ text, font: TIMES, bold, size });

  const createCell = (text: string | string[], colSpan: number = 1, align: typeof AlignmentType.LEFT = AlignmentType.LEFT) => {
    const lines = Array.isArray(text) ? text : [text];
    return new TableCell({
      columnSpan: colSpan,
      verticalAlign: VerticalAlign.TOP,
      margins: { top: 0, bottom: 0, left: 100, right: 100 },
      children: lines.map(
        (line) =>
          new Paragraph({
            children: [t(line, false, 22)],
            alignment: align,
            spacing: { line: 240, after: 0 },
          })
      ),
    });
  };

  const createCellWithParagraphs = (paragraphs: Paragraph[], colSpan: number = 1) => {
    return new TableCell({
      columnSpan: colSpan,
      verticalAlign: VerticalAlign.TOP,
      margins: { top: 0, bottom: 0, left: 100, right: 100 },
      children: paragraphs,
    });
  };

  const createHeaderCell = (text: string) => {
    return new TableCell({
      columnSpan: 2,
      verticalAlign: VerticalAlign.TOP,
      margins: { top: 0, bottom: 0, left: 100, right: 100 },
      children: [
        new Paragraph({
          children: [t(text, true, 22)],
          alignment: AlignmentType.CENTER,
          spacing: { line: 240, after: 0 },
        }),
      ],
    });
  };

  const serviceParagraphs = [
    new Paragraph({ children: [t("1. Место оказания услуг: 650064, г. Кемерово, ул. Арочная, 37А, Государственное казенное учреждение «Центр информационных технологий Кузбасса».", false, 22)], alignment: AlignmentType.JUSTIFIED, spacing: { line: 240, after: 0 } })
  ];

  data.serviceConditions.forEach((condition, index) => {
    serviceParagraphs.push(
      new Paragraph({ children: [t(`${index + 2}. ${condition}`, false, 22)], alignment: AlignmentType.JUSTIFIED, spacing: { line: 240, after: 0 } })
    );
  });

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1134,
              right: 850,
              bottom: 1134,
              left: 1701,
            },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              t("ГОСУДАРСТВЕННОЕ КАЗЕННОЕ УЧРЕЖДЕНИЕ", true, 28),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              t("«ЦЕНТР ИНФОРМАЦИОННЫХ ТЕХНОЛОГИЙ КУЗБАССА»", true, 28),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              t("ул. Арочная, 37А, г. Кемерово, 650064, тел: (384-2) 44-26-18, e-mail: citko@ako.ru", false, 22),
            ],
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" }
            }
          }),

          new Paragraph({
            text: "",
            spacing: { before: 200 }
          }),

          new Table({
            width: { size: HEADER_TABLE_WIDTH, type: WidthType.DXA },
            columnWidths: [HEADER_BLOCK_WIDTH, HEADER_BLOCK_WIDTH],
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
                    width: { size: HEADER_BLOCK_WIDTH, type: WidthType.DXA },
                    verticalAlign: VerticalAlign.BOTTOM,
                    children: [
                      new Paragraph({ children: [t("__________ № __________", false, 24)] })
                    ]
                  }),
                  new TableCell({
                    width: { size: HEADER_BLOCK_WIDTH, type: WidthType.DXA },
                    children: vendorInfo.split('\n').map(line =>
                      new Paragraph({ children: [t(line, false, 22)] })
                    ),
                  })
                ]
              })
            ]
          }),

          new Paragraph({
            text: "",
            spacing: { before: 400 }
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              t("Запрос о предоставлении ценовой информации", true, 24),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              t("(коммерческого предложения)", true, 24),
            ],
          }),

          new Paragraph({
            text: "",
            spacing: { before: 200 }
          }),

          new Paragraph({
            indent: { firstLine: 720 },
            alignment: AlignmentType.JUSTIFIED,
            children: [
              t("Государственное казенное учреждение «Центр информационных технологий Кузбасса» планирует осуществить закупку на ", false, 24),
              t(data.subjectIntro, false, 24),
              t(":", false, 24),
            ],
          }),

          new Paragraph({
            text: "",
            spacing: { before: 100 }
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [2338, 7016],
            rows: [
              new TableRow({ children: [createHeaderCell("1.")] }),
              new TableRow({
                children: [
                  createCell("Наименование объекта закупки, включая указание единицы измерения, количества товара, объема работ или услуг.", 1, AlignmentType.LEFT),
                  createCell(data.subjectTable, 1),
                ],
              }),
              new TableRow({ children: [createHeaderCell("2.")] }),
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 2,
                    margins: { top: 0, bottom: 0, left: 100, right: 100 },
                    children: [
                      new Paragraph({
                        children: [t("Основные условия исполнения контракта, заключаемого по результатам закупки, включая:", false, 22)],
                        alignment: AlignmentType.LEFT,
                        spacing: { line: 240, after: 0 }
                      })
                    ]
                  })
                ]
              }),
              new TableRow({
                children: [
                  createCell("- требования к порядку поставки товара, выполнению работ, оказанию услуг;", 1, AlignmentType.LEFT),
                  createCellWithParagraphs(serviceParagraphs),
                ],
              }),
              new TableRow({
                children: [
                  createCell("- предполагаемые сроки проведения закупки;", 1, AlignmentType.LEFT),
                  createCell(data.purchasePeriod),
                ],
              }),
              new TableRow({
                children: [
                  createCell("- порядок формирования цены;", 1, AlignmentType.LEFT),
                  createCellWithParagraphs([
                    new Paragraph({ children: [t("Цена включает в себя все налоги, сборы и другие обязательные платежи, предусмотренные законодательством Российской Федерации, а также все расходы Исполнителя, связанные с оказанием Услуг, в том числе расходы Исполнителя прямо не предусмотренные, но которые могут возникнуть в ходе оказания Услуг.", false, 22)], alignment: AlignmentType.JUSTIFIED, spacing: { line: 240, after: 0 } }),
                    new Paragraph({ children: [t("Цена установлена в рублях Российской Федерации и определяется на весь срок оказания Услуг.", false, 22)], alignment: AlignmentType.JUSTIFIED, spacing: { line: 240, after: 0 } })
                  ])
                ],
              }),
              new TableRow({
                children: [
                  createCell("- порядок оплаты;", 1, AlignmentType.LEFT),
                  createCell("Оплата за оказанные услуги производится в течении 7 (семи) рабочих дней на основании подписанного обеими сторонами документа о приемке. Форма оплаты – безналичный расчет."),
                ],
              }),
              new TableRow({
                children: [
                  createCell("- предполагаемый размер обеспечения исполнения контракта;", 1, AlignmentType.LEFT),
                  createCell("Размер обеспечения исполнения Контракта составляет 10% от начальной (максимальной) цены Контракта."),
                ],
              }),
              new TableRow({
                children: [
                  createCell("- гарантия качества", 1, AlignmentType.LEFT),
                  createCellWithParagraphs([
                    new Paragraph({ children: [t("Исполнитель гарантирует, что оказываемые Услуги соответствуют обязательным нормам, правилам и стандартам, регулирующим данную деятельность, а также иным требованиям законодательства Российской Федерации, действующим на момент оказания Услуг.", false, 22)], alignment: AlignmentType.JUSTIFIED, spacing: { line: 240, after: 0 } }),
                    new Paragraph({ children: [t("Срок предоставления гарантии качества оказанных Услуг составляет 6 месяцев с момента приемки оказанных Услуг и подписания документа о приемке по Контракту.", false, 22)], alignment: AlignmentType.JUSTIFIED, spacing: { line: 240, after: 0 } })
                  ]),
                ],
              }),
              new TableRow({ children: [createHeaderCell("3.")] }),
              new TableRow({
                children: [
                  createCell("Срок предоставления ценовой информации", 1, AlignmentType.LEFT),
                  createCell(data.submissionDeadline),
                ],
              }),
              new TableRow({ children: [createHeaderCell("4.")] }),
              new TableRow({
                children: [
                  createCell("Адрес предоставления ценовой информации", 1, AlignmentType.LEFT),
                  createCell("650064, г. Кемерово, ул. Арочная, 37А"),
                ],
              }),
              new TableRow({ children: [createHeaderCell("5.")] }),
              new TableRow({
                children: [
                  createCell("Адрес электронной почты для предоставления сканированных копий писем", 1, AlignmentType.LEFT),
                  createCell(data.submissionEmail),
                ],
              }),
              new TableRow({ children: [createHeaderCell("6.")] }),
              new TableRow({
                children: [
                  createCell("Контактные лица", 1, AlignmentType.LEFT),
                  createCell(data.contactPerson),
                ],
              }),
            ],
          }),

          new Paragraph({
            text: "",
            spacing: { before: 200 }
          }),

          new Paragraph({
            indent: { firstLine: 720 },
            alignment: AlignmentType.JUSTIFIED,
            children: [
              t("Информируем, что направленные предложения не будут рассматриваться в качестве заявки на участие в закупке и не дают в дальнейшем каких-либо преимуществ для лиц, подавших указанные предложения.", false, 22),
            ],
          }),
          new Paragraph({
            indent: { firstLine: 720 },
            alignment: AlignmentType.JUSTIFIED,
            children: [
              t("Настоящий запрос не является извещением о проведении закупки, офертой или публичной офертой и не влечет возникновения каких-либо обязательств заказчика.", false, 22),
            ],
          }),
          new Paragraph({
            indent: { firstLine: 720 },
            alignment: AlignmentType.JUSTIFIED,
            children: [
              t("В ценовых предложениях просим указывать реквизиты настоящего запроса. Из ответа на запрос должны однозначно определяться цена единицы услуги и общая цена контракта на условиях, указанных в запросе, срок действия предлагаемой цены, расчет цены.", false, 22),
            ],
          }),

          new Paragraph({
            text: "",
            spacing: { before: 400 }
          }),

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
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [t(data.signerPosition, false, 24)],
                        alignment: AlignmentType.LEFT
                      })
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [t(data.signerName, false, 24)],
                        alignment: AlignmentType.RIGHT
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ],
      },
    ],
  });
};

export const generateKpDocx = async (data: KpDocxData) => {
  const normalizedData = normalizeKpState(data);

  await generateDocumentBatchFromScenario(
    normalizedData,
    {
      ...KP_VENDOR_BATCH_SCENARIO,
      getVariants: (state) => state.vendorInfos.filter((vendor) => vendor.trim()),
      getFallbackVariant: () => "",
      getVariantFileName: (vendor, index) => {
        const vendorName = sanitizeFileName(vendor.split('\n')[0].substring(0, 30), "vendor");
        return `${index + 1}_Запрос_КП_${vendorName}.docx`;
      },
    },
    (state, vendor) => buildDocument(state, vendor)
  );
};
