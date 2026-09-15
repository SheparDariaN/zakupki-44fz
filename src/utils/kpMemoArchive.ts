import type { KpDocxData, ServiceMemoData } from "../types";
import { generateDocumentBatch } from "./documentBatch";
import { buildKpDocumentItems } from "./kpDocxGenerator";
import { buildServiceMemoDocumentItem } from "./serviceMemoDocxGenerator";

export async function generateKpMemoArchive(kp: KpDocxData, memo: ServiceMemoData) {
  const items = [
    buildServiceMemoDocumentItem({ ...memo, date: "" }),
    ...buildKpDocumentItems(kp),
  ];

  await generateDocumentBatch(items, {
    singleFileName: "Запрос_КП.docx",
    zipFileName: "Запросы_КП.zip",
  });
}
