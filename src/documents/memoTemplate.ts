import type { DocumentTemplateSchema } from './templateTypes';

export const MEMO_TEMPLATE = {
  kind: 'memo',
  title: 'Служебная записка',
  fields: [
    {
      documentKind: 'memo',
      fieldKey: 'contractServiceHead',
      label: 'Руководитель контрактной службы',
      statePath: 'contractServiceHead',
      valueType: 'multilineText',
      required: true,
      sources: [
        {
          kind: 'userSettings',
          label: 'Профиль пользователя',
          path: 'executorPosition,executorName',
          transforms: ['toDativeCase', 'joinLines', 'trim'],
        },
        { kind: 'documentState', label: 'Поле документа', path: 'contractServiceHead', transforms: ['trim'] },
      ],
      transforms: ['formatSignatureName'],
    },
    {
      documentKind: 'memo',
      fieldKey: 'requester',
      label: 'Составитель запроса',
      statePath: 'requester',
      valueType: 'multilineText',
      required: true,
      sources: [
        {
          kind: 'userSettings',
          label: 'Профиль пользователя',
          path: 'executorPosition,executorName',
          transforms: ['joinLines', 'trim'],
        },
        { kind: 'documentState', label: 'Поле документа', path: 'requester', transforms: ['trim'] },
      ],
      transforms: ['formatSignatureName'],
    },
    {
      documentKind: 'memo',
      fieldKey: 'date',
      label: 'Дата',
      statePath: 'date',
      valueType: 'date',
      required: true,
      sources: [
        { kind: 'currentDate', label: 'Текущая дата', transforms: ['formatDateRu'] },
        { kind: 'documentState', label: 'Поле документа', path: 'date' },
      ],
      transforms: ['formatDateRu'],
    },
    {
      documentKind: 'memo',
      fieldKey: 'purpose',
      label: 'Цель закупки',
      statePath: 'purpose',
      valueType: 'multilineText',
      required: true,
      sources: [
        { kind: 'currentPurchase', label: 'Цель текущей закупки', path: 'purpose', transforms: ['trim'] },
        { kind: 'documentState', label: 'Поле документа', path: 'purpose', transforms: ['trim'] },
      ],
    },
    {
      documentKind: 'memo',
      fieldKey: 'subjectIntro',
      label: 'Предмет закупки во вводном тексте',
      statePath: 'subjectIntro',
      valueType: 'text',
      required: true,
      sources: [
        { kind: 'currentPurchase', label: 'Объект закупки НМЦК', path: 'requisites.subject', transforms: ['trim'] },
        { kind: 'documentState', label: 'Поле документа', path: 'subjectIntro', transforms: ['trim'] },
      ],
    },
    {
      documentKind: 'memo',
      fieldKey: 'subjectTable',
      label: 'Перечень объектов закупки',
      statePath: 'subjectTable',
      valueType: 'list',
      required: true,
      sources: [
        {
          kind: 'currentPurchase',
          label: 'Позиции закупки НМЦК',
          path: 'positions[].name',
          transforms: ['joinLines'],
        },
        { kind: 'documentState', label: 'Поле документа', path: 'subjectTable', transforms: ['trim'] },
      ],
      repeatable: { statePath: 'subjectTable', itemLabel: 'Пункт перечня', minItems: 1 },
    },
  ],
} satisfies DocumentTemplateSchema<'memo'>;
