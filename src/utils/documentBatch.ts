import { Packer } from "docx";
import type { Document } from "docx";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import type { DocumentBatchScenario } from "../documents/templateTypes";

export type DocumentBatchItem = {
  document: Document;
  filename: string;
};

export type RuntimeDocumentBatchScenario<TState, TVariant> = DocumentBatchScenario & {
  getVariants: (state: TState) => TVariant[];
  getFallbackVariant: (state: TState) => TVariant;
  getVariantFileName: (variant: TVariant, index: number, state: TState) => string;
};

const RESERVED_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

export function sanitizeFileName(value: string, fallback = "document") {
  const cleanName = value.replace(RESERVED_FILENAME_CHARS, "").replace(/\s+/g, " ").trim();
  return cleanName || fallback;
}

function makeUniqueFileName(filename: string, usedNames: Set<string>) {
  if (!usedNames.has(filename)) {
    usedNames.add(filename);
    return filename;
  }

  const extensionStart = filename.lastIndexOf(".");
  const baseName = extensionStart > 0 ? filename.slice(0, extensionStart) : filename;
  const extension = extensionStart > 0 ? filename.slice(extensionStart) : "";
  let index = 2;
  let nextName = `${baseName}_${index}${extension}`;

  while (usedNames.has(nextName)) {
    index += 1;
    nextName = `${baseName}_${index}${extension}`;
  }

  usedNames.add(nextName);
  return nextName;
}

export async function generateDocumentBatch(
  items: DocumentBatchItem[],
  options: { singleFileName: string; zipFileName: string }
) {
  if (items.length === 0) {
    throw new Error("Нет документов для генерации");
  }

  if (items.length === 1) {
    const blob = await Packer.toBlob(items[0].document);
    saveAs(blob, sanitizeFileName(options.singleFileName, "document.docx"));
    return;
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const item of items) {
    const filename = makeUniqueFileName(sanitizeFileName(item.filename, "document.docx"), usedNames);
    const blob = await Packer.toBlob(item.document);
    zip.file(filename, blob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  saveAs(zipBlob, sanitizeFileName(options.zipFileName, "documents.zip"));
}

export async function generateDocumentBatchFromScenario<TState, TVariant>(
  state: TState,
  scenario: RuntimeDocumentBatchScenario<TState, TVariant>,
  buildDocument: (state: TState, variant: TVariant, index: number) => Document
) {
  const variants = scenario.getVariants(state);
  const batchVariants = variants.length > 0 ? variants : [scenario.getFallbackVariant(state)];
  const items = batchVariants.map((variant, index) => ({
    document: buildDocument(state, variant, index),
    filename: scenario.getVariantFileName(variant, index, state),
  }));

  await generateDocumentBatch(items, {
    singleFileName: scenario.singleFileName,
    zipFileName: scenario.zipFileName,
  });
}
