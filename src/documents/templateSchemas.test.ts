import { describe, expect, it } from 'vitest';
import { DOCUMENT_KINDS } from '../types';
import { DOCUMENT_TEMPLATE_SCHEMAS } from './templateSchemas';

describe('DOCUMENT_TEMPLATE_SCHEMAS', () => {
  it('описывает поля и источники автозаполнения для всех типов документов', () => {
    expect(Object.keys(DOCUMENT_TEMPLATE_SCHEMAS).sort()).toEqual([...DOCUMENT_KINDS].sort());

    for (const kind of DOCUMENT_KINDS) {
      const schema = DOCUMENT_TEMPLATE_SCHEMAS[kind];

      expect(schema.kind).toBe(kind);
      expect(schema.fields.length).toBeGreaterThan(0);
      expect(schema.fields.every((field) => field.documentKind === kind)).toBe(true);
      expect(schema.fields.every((field) => field.fieldKey && field.label && field.statePath)).toBe(true);
      expect(schema.fields.every((field) => field.sources.length > 0)).toBe(true);
    }
  });

  it('отмечает адресатов КП как пакетное поле', () => {
    const batchFields = DOCUMENT_TEMPLATE_SCHEMAS.kp.fields.filter((field) => field.batchKey === 'vendorInfos');

    expect(batchFields.map((field) => field.fieldKey)).toEqual(['vendorInfos', 'vendorInfo']);
    expect(batchFields.every((field) => field.repeatable?.statePath === 'vendorInfos')).toBe(true);
  });

  it('связывает контакты КП и подписанта в группы из профиля', () => {
    const contactFields = DOCUMENT_TEMPLATE_SCHEMAS.kp.fields.filter((field) => (
      'linkedGroup' in field && field.linkedGroup?.key === 'kpContacts'
    ));
    const signerFields = DOCUMENT_TEMPLATE_SCHEMAS.kp.fields.filter((field) => (
      'linkedGroup' in field && field.linkedGroup?.key === 'kpSigner'
    ));

    expect(contactFields.map((field) => field.fieldKey)).toEqual(['submissionEmail', 'contactPerson']);
    expect(contactFields.every((field) => field.linkedGroup?.label === 'Контакты для приема КП')).toBe(true);
    expect(signerFields.map((field) => field.fieldKey)).toEqual(['signerPosition', 'signerName']);
    expect(signerFields.every((field) => field.sources.some((source) => source.kind === 'userSettings'))).toBe(true);
  });

  it('связывает адресата служебной записки и ФИО руководителя контрактной службы', () => {
    const headFields = DOCUMENT_TEMPLATE_SCHEMAS.memo.fields.filter((field) => (
      'linkedGroup' in field && field.linkedGroup?.key === 'memoContractServiceHead'
    ));

    expect(headFields.map((field) => field.fieldKey)).toEqual(['addressee', 'contractServiceHead']);
    expect(headFields[0].sources.some((source) => source.transforms?.includes('toDativeCase'))).toBe(true);
  });
});
