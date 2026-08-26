import type { DocumentBatchScenario } from './templateTypes';

export const NMCK_BATCH_SCENARIOS = [
  {
    documentKind: 'nmck',
    id: 'supplier-price-sources',
    label: 'Пакет обоснований по источникам ценовой информации',
    description: 'Один объект закупки и позиции, меняются состав поставщиков и реквизиты входящих КП.',
    status: 'prepared',
    batchKey: 'suppliers',
    variantLabel: 'Источник ценовой информации',
    repeatableStatePath: 'suppliers',
    varyingFields: ['suppliers', 'prices'],
    singleFileName: 'Обоснование_НМЦК.docx',
    zipFileName: 'Обоснования_НМЦК.zip',
  },
] satisfies readonly DocumentBatchScenario<'nmck'>[];

export const KP_VENDOR_BATCH_SCENARIO = {
  documentKind: 'kp',
  id: 'vendor-infos',
  label: 'Запросы КП по адресатам',
  description: 'Один предмет закупки и условия письма, меняется адресат запроса.',
  status: 'implemented',
  batchKey: 'vendorInfos',
  variantLabel: 'Адресат запроса',
  repeatableStatePath: 'vendorInfos',
  varyingFields: ['vendorInfos[]'],
  singleFileName: 'Запрос_КП.docx',
  zipFileName: 'Запросы_КП.zip',
} satisfies DocumentBatchScenario<'kp'>;

export const MEMO_BATCH_SCENARIOS = [
  {
    documentKind: 'memo',
    id: 'memo-recipients-and-dates',
    label: 'Пакет служебных записок по адресатам и датам',
    description: 'Один предмет закупки, меняются адресат, составитель или дата служебной записки.',
    status: 'prepared',
    batchKey: 'memoRecipients',
    variantLabel: 'Вариант служебной записки',
    varyingFields: ['contractServiceHead', 'requester', 'date'],
    singleFileName: 'Служебная_записка_на_закупку.docx',
    zipFileName: 'Служебные_записки.zip',
  },
] satisfies readonly DocumentBatchScenario<'memo'>[];
