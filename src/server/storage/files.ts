import { randomUUID } from 'node:crypto';
import { constants } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { HttpError } from '../errors';

export const MAX_CONTRACT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_OFFER_FILE_BYTES = MAX_CONTRACT_FILE_BYTES;

export type ContractFileKind = 'pdf' | 'docx';
export type OfferFileKind = 'pdf' | 'jpeg' | 'png' | 'webp';

export interface StoredContractFile {
  fileRelPath: string;
  absolutePath: string;
  mime: string;
  fileName: string;
}

export interface StoredOfferFile {
  fileRelPath: string;
  absolutePath: string;
  mime: string;
  fileName: string;
}

const CONTRACT_EXTENSIONS: Record<ContractFileKind, string> = {
  pdf: '.pdf',
  docx: '.docx',
};

const OFFER_EXTENSIONS: Record<OfferFileKind, string> = {
  pdf: '.pdf',
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
};

const OFFER_MIME: Record<OfferFileKind, string> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function storageRoot(): string {
  return path.resolve(process.env.FILE_STORAGE_DIR || './data/files');
}

function purchaseDirectory(purchaseId: number): string {
  return path.join(storageRoot(), 'purchases', String(purchaseId));
}

function offerDirectory(purchaseId: number): string {
  return path.join(purchaseDirectory(purchaseId), 'offers');
}

function hasPrefix(buffer: Buffer, bytes: readonly number[]): boolean {
  return buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);
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

function mimeAllowed(mimeType: string, expected: string): boolean {
  return mimeType === expected || mimeType === '' || mimeType === 'application/octet-stream';
}

export function detectOfferFile(buffer: Buffer, originalName: string, mimeType: string): OfferFileKind {
  const lowerName = originalName.toLowerCase();
  const isJpeg = hasPrefix(buffer, [0xff, 0xd8, 0xff]);
  const isPng = hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isWebp = buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  const isPdf = buffer.subarray(0, 4).equals(Buffer.from('%PDF'));

  if (lowerName.endsWith('.pdf') && isPdf && mimeAllowed(mimeType, 'application/pdf')) {
    return 'pdf';
  }
  if ((lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) && isJpeg && mimeAllowed(mimeType, 'image/jpeg')) {
    return 'jpeg';
  }
  if (lowerName.endsWith('.png') && isPng && mimeAllowed(mimeType, 'image/png')) {
    return 'png';
  }
  if (lowerName.endsWith('.webp') && isWebp && mimeAllowed(mimeType, 'image/webp')) {
    return 'webp';
  }

  throw new HttpError(400, 'КП должно быть файлом PDF, JPEG, PNG или WEBP');
}

function safeDownloadName(originalName: string, extension: string, fallback: string): string {
  const base = path.basename(originalName).replace(/[^\wа-яА-ЯёЁ(). -]+/g, '_').trim();
  return base || `${fallback}${extension}`;
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
  const dir = purchaseDirectory(purchaseId);
  await fs.mkdir(dir, { recursive: true });
  const absolutePath = path.join(dir, `contract${CONTRACT_EXTENSIONS[kind]}`);
  await fs.writeFile(absolutePath, file.buffer, { flag: 'w' });

  return {
    fileRelPath: path.relative(storageRoot(), absolutePath),
    absolutePath,
    mime: kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileName: safeDownloadName(file.originalname, CONTRACT_EXTENSIONS[kind], 'contract'),
  };
}

export async function saveOfferFile(
  purchaseId: number,
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number }
): Promise<StoredOfferFile> {
  if (!file.buffer.length || file.size <= 0) {
    throw new HttpError(400, 'Файл КП пуст');
  }
  if (file.size > MAX_OFFER_FILE_BYTES) {
    throw new HttpError(400, 'Файл КП слишком большой');
  }

  const kind = detectOfferFile(file.buffer, file.originalname, file.mimetype);
  const dir = offerDirectory(purchaseId);
  await fs.mkdir(dir, { recursive: true });
  const absolutePath = path.join(dir, `${randomUUID()}${OFFER_EXTENSIONS[kind]}`);
  await fs.writeFile(absolutePath, file.buffer, { flag: 'wx' });

  return {
    fileRelPath: path.relative(storageRoot(), absolutePath),
    absolutePath,
    mime: OFFER_MIME[kind],
    fileName: safeDownloadName(file.originalname, OFFER_EXTENSIONS[kind], 'kp'),
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
    throw new HttpError(404, 'Файл не найден');
  }
}

export async function deleteStoredFile(fileRelPath: string | null | undefined): Promise<void> {
  if (!fileRelPath) return;
  const resolved = resolveStoredFilePath(fileRelPath);
  await fs.rm(resolved, { force: true });
}

export async function deletePurchaseFiles(purchaseId: number): Promise<void> {
  await fs.rm(purchaseDirectory(purchaseId), { recursive: true, force: true });
}
