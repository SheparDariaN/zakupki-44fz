import { describe, expect, it } from 'vitest';
import { HttpError } from '../errors';
import { detectOfferFile } from './files';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const pdf = Buffer.from('%PDF-1.7\n');
const webp = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x10, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
]);

describe('detectOfferFile', () => {
  it('принимает PDF, JPEG, PNG и WEBP по расширению и magic bytes', () => {
    expect(detectOfferFile(pdf, 'kp.pdf', 'application/pdf')).toBe('pdf');
    expect(detectOfferFile(jpeg, 'scan.jpg', 'image/jpeg')).toBe('jpeg');
    expect(detectOfferFile(jpeg, 'scan.jpeg', 'application/octet-stream')).toBe('jpeg');
    expect(detectOfferFile(png, 'photo.png', 'image/png')).toBe('png');
    expect(detectOfferFile(webp, 'offer.webp', 'image/webp')).toBe('webp');
  });

  it('отклоняет несовпадение расширения и содержимого', () => {
    expect(() => detectOfferFile(jpeg, 'kp.pdf', 'application/pdf')).toThrow(HttpError);
    expect(() => detectOfferFile(pdf, 'kp.docx', 'application/pdf')).toThrow('КП должно быть файлом PDF, JPEG, PNG или WEBP');
    expect(() => detectOfferFile(Buffer.from('hello'), 'kp.pdf', 'application/pdf')).toThrow(HttpError);
  });
});
