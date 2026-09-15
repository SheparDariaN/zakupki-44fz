import { constants } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { HttpError } from '../errors';

export const MAX_CONTRACT_FILE_BYTES = 10 * 1024 * 1024;

export type ContractFileKind = 'pdf' | 'docx';

export interface StoredContractFile {
  fileRelPath: string;
  absolutePath: string;
  mime: string;
  fileName: string;
}

const CONTRACT_EXTENSIONS: Record<ContractFileKind, string> = {
  pdf: '.pdf',
  docx: '.docx',
};

function storageRoot(): string {
  return path.resolve(process.env.FILE_STORAGE_DIR || './data/files');
}

function contractDirectory(purchaseId: number): string {
  return path.join(storageRoot(), 'purchases', String(purchaseId));
}

function detectContractFile(buffer: Buffer, originalName: string, mimeType: string): ContractFileKind {
  const lowerName = originalName.toLowerCase();
  if (lowerName.endsWith('.pdf') && buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) {
    return 'pdf';
  }

  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  const isDocxName = lowerName.endsWith('.docx');
  const isDocxMime =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/zip' ||
    mimeType === 'application/octet-stream';
  if (isDocxName && isZip && isDocxMime) {
    return 'docx';
  }

  throw new HttpError(400, 'Контракт должен быть файлом PDF или DOCX');
}

function safeDownloadName(originalName: string, kind: ContractFileKind): string {
  const base = path.basename(originalName).replace(/[^\wа-яА-ЯёЁ(). -]+/g, '_').trim();
  return base || `contract${CONTRACT_EXTENSIONS[kind]}`;
}

export async function saveContractFile(
  purchaseId: number,
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number }
): Promise<StoredContractFile> {
  if (!file.buffer.length || file.size <= 0) {
    throw new HttpError(400, 'Файл контракта пуст');
  }
  if (file.size > MAX_CONTRACT_FILE_BYTES) {
    throw new HttpError(400, 'Файл контракта слишком большой');
  }

  const kind = detectContractFile(file.buffer, file.originalname, file.mimetype);
  const dir = contractDirectory(purchaseId);
  await fs.mkdir(dir, { recursive: true });
  const absolutePath = path.join(dir, `contract${CONTRACT_EXTENSIONS[kind]}`);
  await fs.writeFile(absolutePath, file.buffer, { flag: 'w' });

  return {
    fileRelPath: path.relative(storageRoot(), absolutePath),
    absolutePath,
    mime: kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileName: safeDownloadName(file.originalname, kind),
  };
}

export function resolveStoredFilePath(fileRelPath: string): string {
  const root = storageRoot();
  const resolved = path.resolve(root, fileRelPath);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new HttpError(400, 'Некорректный путь файла');
  }
  return resolved;
}

export async function readStoredFile(fileRelPath: string): Promise<Buffer> {
  const resolved = resolveStoredFilePath(fileRelPath);
  try {
    await fs.access(resolved, constants.R_OK);
    return await fs.readFile(resolved);
  } catch {
    throw new HttpError(404, 'Файл контракта не найден');
  }
}

export async function deleteStoredFile(fileRelPath: string | null | undefined): Promise<void> {
  if (!fileRelPath) return;
  const resolved = resolveStoredFilePath(fileRelPath);
  await fs.rm(resolved, { force: true });
}

export async function deletePurchaseFiles(purchaseId: number): Promise<void> {
  await fs.rm(contractDirectory(purchaseId), { recursive: true, force: true });
}
