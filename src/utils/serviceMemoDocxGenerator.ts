import {
  AlignmentType,
  BorderStyle,
  Document,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { ServiceMemoData } from "../types";
import { normalizeMemoState } from "../documents/templateNormalization";
import { applyTemplateTransforms, formatListItems } from "../documents/templateTransforms";
import { generateDocumentBatch } from "./documentBatch";
import { formatDateRu } from "./morphology";

/** 14 см от левого края листа минус левое поле 3 см. */
const HEADER_INDENT_TWIPS = 14 * 567 - 1701;

export const DEFAULT_MEMO_ADDRESSEE = "Руководителю контрактной службы";

export function formatServiceMemoDate(value: string) {
  return formatDateRu(value);
}

function splitMemoLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getMemoRequesterNameInflection(snapshot?: ServiceMemoData["requesterNameInflection"]) {
  const nominative = typeof snapshot?.nominative === "string" ? snapshot.nominative.trim() : "";
  const genitive = typeof snapshot?.genitive === "string" ? snapshot.genitive.trim() : "";
  if (!nominative || !genitive) return null;

  return { nominative, genitive };
}

export function formatServiceMemoHeaderRequester(
  requester: string,
  requesterNameInflection?: ServiceMemoData["requesterNameInflection"]
) {
  const lines = splitMemoLines(requester);
  const snapshot = getMemoRequesterNameInflection(requesterNameInflection);

  if (snapshot && lines[lines.length - 1] === snapshot.nominative) {
    const head = lines.slice(0, -1).join("\n");
    const declinedHead = applyTemplateTransforms(head, ["toGenitiveCase"]);
    return [
      typeof declinedHead === "string" ? declinedHead : head,
      snapshot.genitive,
    ].filter(Boolean).join("\n");
  }

  const declined = applyTemplateTransforms(requester, ["toGenitiveCase"]);
  return typeof declined === "string" ? declined : requester;
}

export function getServiceMemoAddressee(data: ServiceMemoData) {
  const addressee = typeof data.addressee === "string" ? data.addressee.trim() : "";
  return addressee || DEFAULT_MEMO_ADDRESSEE;
}

export function getServiceMemoHeaderLines(data: ServiceMemoData) {
  return [
    getServiceMemoAddressee(data),
    ...splitMemoLines(data.contractServiceHead),
    ...splitMemoLines(formatServiceMemoHeaderRequester(data.requester, data.requesterNameInflection)),
  ];
}

export function getServiceMemoSubjectItems(value: string) {
  const formatted = formatListItems(value);
  return formatted ? formatted.split("\n") : [];
}

export function getServiceMemoBodyText(data: ServiceMemoData) {
  return [data.purpose.trim(), data.subjectIntro.trim()].filter(Boolean).join(" ");
}

export function getServiceMemoSignatureParts(requester: string) {
  const lines = requester.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    return { left: requester.trim(), right: "" };
  }
  return {
    left: lines.slice(0, -1).join("\n"),
    right: lines[lines.length - 1],
  };
}

export function getServiceMemoSignatureBlock(data: ServiceMemoData) {
  const parts = getServiceMemoSignatureParts(data.requester);
  const date = formatServiceMemoDate(data.date);
  return {
    leftLines: [...splitMemoLines(parts.left), ...(date ? [date] : [])],
    right: parts.right,
  };
}

const buildServiceMemoDocument = (data: ServiceMemoData) => {
  const TIMES = "Times New Roman";
  const bodyText = getServiceMemoBodyText(data);
  const subjectItems = getServiceMemoSubjectItems(data.subjectTable);
  const signature = getServiceMemoSignatureBlock(data);

  const t = (text: string, bold = false, size = 24) =>
    new TextRun({ text, font: TIMES, bold, size });

  const emptyParagraph = (before = 200) =>
    new Paragraph({ text: "", spacing: { before } });

  const noBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: "auto" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
    left: { style: BorderStyle.NONE, size: 0, color: "auto" },
    right: { style: BorderStyle.NONE, size: 0, color: "auto" },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
  };

  const tableCell = (children: Paragraph[], width = 50) =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.TOP,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      children,
    });

  const headerLines = getServiceMemoHeaderLines(data);

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1134,
              right: 1134,
              bottom: 1134,
              left: 1701,
            },
          },
        },
        children: [
          ...headerLines.map(
            (line) =>
              new Paragraph({
                indent: { left: HEADER_INDENT_TWIPS },
                children: [t(line, false, 24)],
                alignment: AlignmentType.LEFT,
                spacing: { after: 80 },
              })
          ),

          emptyParagraph(420),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [t("СЛУЖЕБНАЯ ЗАПИСКА", false, 24)],
          }),

          new Paragraph({
            indent: { firstLine: 720 },
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 360, after: 80 },
            children: [t(bodyText, false, 24)],
          }),

          ...subjectItems.map(
            (item) =>
              new Paragraph({
                indent: { left: 1080, hanging: 360 },
                alignment: AlignmentType.JUSTIFIED,
                spacing: { line: 300, after: 0 },
                children: [t("•", false, 24), t(`\t${item}`, false, 24)],
              })
          ),

          emptyParagraph(360),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders,
            rows: [
              new TableRow({
                children: [
                  tableCell(
                    (signature.leftLines.length ? signature.leftLines : [""]).map(
                      (line) =>
                        new Paragraph({
                          children: [t(line, false, 24)],
                          spacing: { after: 0 },
                        })
                    )
                  ),
                  tableCell(
                    [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [t(signature.right, false, 24)],
                      }),
                    ]
                  ),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });
};

export const generateServiceMemoDocx = async (data: ServiceMemoData) => {
  const normalizedData = normalizeMemoState(data);
  const doc = buildServiceMemoDocument(normalizedData);
  await generateDocumentBatch(
    [{ document: doc, filename: "Служебная_записка_на_закупку.docx" }],
    { singleFileName: "Служебная_записка_на_закупку.docx", zipFileName: "Служебные_записки.zip" }
  );
};
