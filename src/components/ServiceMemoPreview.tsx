import React from 'react';
import { ServiceMemoData } from '../types';
import {
  formatServiceMemoDate,
  getServiceMemoBodyText,
  getServiceMemoSignatureParts,
  getServiceMemoSubjectItems
} from '../utils/serviceMemoDocxGenerator';

interface PreviewProps {
  data: ServiceMemoData;
}

export default function ServiceMemoPreview({ data }: PreviewProps) {
  const subjectItems = getServiceMemoSubjectItems(data.subjectTable);
  const signature = getServiceMemoSignatureParts(data.requester);

  return (
    <div className="animate-in fade-in duration-300 w-[210mm] min-w-[210mm] min-h-[297mm] mx-auto bg-white shadow-[0_10px_30px_rgba(0,0,0,0.1)] pt-[20mm] pr-[20mm] pb-[20mm] pl-[30mm] text-[12pt] font-serif leading-normal">
      <div className="grid grid-cols-2 mb-12">
        <div />
        <div className="text-left">
          <p>Руководителю</p>
          <p>контрактной службы</p>
          <p className="whitespace-pre-wrap">{data.contractServiceHead}</p>
          <p className="whitespace-pre-wrap">{data.requester}</p>
        </div>
      </div>

      <h2 className="text-center text-[12pt] mb-6">СЛУЖЕБНАЯ ЗАПИСКА</h2>

      <p className="indent-8 text-justify mb-1 whitespace-pre-wrap">
        {getServiceMemoBodyText(data)}
      </p>

      <ul className="list-disc pl-[22mm] mb-8 text-justify">
        {subjectItems.map((item, index) => (
          <li key={index} className="pl-1">
            {item}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 mb-1">
        <div className="whitespace-pre-wrap">{signature.left}</div>
        <div className="text-center whitespace-pre-wrap">{signature.right}</div>
      </div>
      <p>{formatServiceMemoDate(data.date)}</p>
    </div>
  );
}
