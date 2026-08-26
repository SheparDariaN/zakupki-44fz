import type { Document } from 'docx';
import { Packer } from 'docx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateDocumentBatch, generateDocumentBatchFromScenario, sanitizeFileName } from './documentBatch';

const mocks = vi.hoisted(() => ({
  toBlob: vi.fn(),
  saveAs: vi.fn(),
  zipFile: vi.fn(),
  zipGenerateAsync: vi.fn(),
  JSZip: vi.fn(),
}));

vi.mock('docx', () => ({
  Packer: {
    toBlob: mocks.toBlob,
  },
}));

vi.mock('file-saver', () => ({
  saveAs: mocks.saveAs,
}));

vi.mock('jszip', () => ({
  default: mocks.JSZip,
}));

function fakeDocument(id: string) {
  return { id } as unknown as Document;
}

describe('sanitizeFileName', () => {
  it('удаляет запрещённые символы из имени файла', () => {
    expect(sanitizeFileName(' ООО "Ромашка" / КП: 1?.docx ')).toBe('ООО Ромашка КП 1.docx');
  });

  it('использует fallback для пустого имени', () => {
    expect(sanitizeFileName(' <>:"/\\|?* ', 'vendor.docx')).toBe('vendor.docx');
  });
});

describe('generateDocumentBatch', () => {
  beforeEach(() => {
    mocks.toBlob.mockReset();
    mocks.saveAs.mockReset();
    mocks.zipFile.mockReset();
    mocks.zipGenerateAsync.mockReset();
    mocks.JSZip.mockReset();

    mocks.toBlob.mockImplementation(async (document: unknown) => new Blob([JSON.stringify(document)]));
    mocks.zipGenerateAsync.mockResolvedValue(new Blob(['zip']));
    mocks.JSZip.mockImplementation(() => ({
      file: mocks.zipFile,
      generateAsync: mocks.zipGenerateAsync,
    }));
  });

  it('отклоняет пустую пачку документов', async () => {
    await expect(generateDocumentBatch([], {
      singleFileName: 'document.docx',
      zipFileName: 'documents.zip',
    })).rejects.toThrow('Нет документов для генерации');
  });

  it('скачивает один документ как DOCX с безопасным именем', async () => {
    const document = fakeDocument('single');

    await generateDocumentBatch([{ document, filename: 'ignored.docx' }], {
      singleFileName: ' /КП: ООО "Ромашка"?.docx ',
      zipFileName: 'documents.zip',
    });

    expect(Packer.toBlob).toHaveBeenCalledTimes(1);
    expect(Packer.toBlob).toHaveBeenCalledWith(document);
    expect(saveAs).toHaveBeenCalledTimes(1);
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'КП ООО Ромашка.docx');
    expect(JSZip).not.toHaveBeenCalled();
  });

  it('собирает несколько документов в ZIP и делает имена внутри архива уникальными', async () => {
    const first = fakeDocument('first');
    const second = fakeDocument('second');

    await generateDocumentBatch([
      { document: first, filename: 'КП: ООО "Ромашка"?.docx' },
      { document: second, filename: 'КП ООО Ромашка.docx' },
    ], {
      singleFileName: 'single.docx',
      zipFileName: ' /Запросы: КП?.zip ',
    });

    expect(Packer.toBlob).toHaveBeenCalledTimes(2);
    expect(Packer.toBlob).toHaveBeenNthCalledWith(1, first);
    expect(Packer.toBlob).toHaveBeenNthCalledWith(2, second);
    expect(mocks.zipFile).toHaveBeenNthCalledWith(1, 'КП ООО Ромашка.docx', expect.any(Blob));
    expect(mocks.zipFile).toHaveBeenNthCalledWith(2, 'КП ООО Ромашка_2.docx', expect.any(Blob));
    expect(mocks.zipGenerateAsync).toHaveBeenCalledWith({ type: 'blob' });
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'Запросы КП.zip');
  });

  it('строит пачку документов по описанному сценарию', async () => {
    await generateDocumentBatchFromScenario(
      { vendors: ['ООО «Ромашка»', 'ООО «Ромашка»'] },
      {
        documentKind: 'kp',
        id: 'vendors',
        label: 'Запросы КП',
        description: 'Один предмет закупки, меняется адресат.',
        status: 'implemented',
        batchKey: 'vendors',
        variantLabel: 'Адресат',
        repeatableStatePath: 'vendors',
        varyingFields: ['vendors[]'],
        singleFileName: 'single.docx',
        zipFileName: 'vendors.zip',
        getVariants: (state) => state.vendors,
        getFallbackVariant: () => '',
        getVariantFileName: (vendor) => `${vendor}.docx`,
      },
      (_state, vendor) => fakeDocument(vendor)
    );

    expect(Packer.toBlob).toHaveBeenCalledTimes(2);
    expect(mocks.zipFile).toHaveBeenNthCalledWith(1, 'ООО «Ромашка».docx', expect.any(Blob));
    expect(mocks.zipFile).toHaveBeenNthCalledWith(2, 'ООО «Ромашка»_2.docx', expect.any(Blob));
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'vendors.zip');
  });
});
