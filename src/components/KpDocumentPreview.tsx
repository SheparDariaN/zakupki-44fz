import React from 'react';
import { KpDocxData } from '../types';
import { normalizeKpState } from '../documents/templateNormalization';

interface PreviewProps {
  data: KpDocxData;
  vendorIndex: number;
}

export default function KpDocumentPreview({ data, vendorIndex }: PreviewProps) {
  const normalizedData = React.useMemo(() => normalizeKpState(data), [data]);

  return (
    <div className="animate-in fade-in duration-300 w-[210mm] min-w-[210mm] min-h-[297mm] mx-auto bg-white shadow-[0_10px_30px_rgba(0,0,0,0.1)] pt-[20mm] pr-[15mm] pb-[20mm] pl-[30mm] text-[10pt] font-serif leading-tight">
      <div className="text-center font-bold text-[14pt] mb-1 leading-tight">
        <p>ГОСУДАРСТВЕННОЕ КАЗЕННОЕ УЧРЕЖДЕНИЕ</p>
        <p>«ЦЕНТР ИНФОРМАЦИОННЫХ ТЕХНОЛОГИЙ КУЗБАССА»</p>
      </div>
      <div className="text-center border-b border-black pb-2 mb-8 text-[11pt]">
        <p>ул. Арочная, 37А, г. Кемерово, 650064, тел: (384-2) 44-26-18, e-mail: citko@ako.ru</p>
      </div>

      <div className="grid grid-cols-[82mm_82mm] justify-between w-full mb-8 items-end">
        <div className="text-[12pt] pb-[2px] whitespace-nowrap">
          __________ № __________
        </div>
        <div className="whitespace-pre-wrap text-[11pt]">
          {normalizedData.vendorInfos[vendorIndex] || ""}
        </div>
      </div>

      <div className="text-center font-bold text-[12pt] mb-4">
        <p>Запрос о предоставлении ценовой информации</p>
        <p>(коммерческого предложения)</p>
      </div>

      <div className="indent-8 text-justify mb-4 text-[12pt]">
        Государственное казенное учреждение «Центр информационных технологий Кузбасса» планирует осуществить закупку на {normalizedData.subjectIntro}:
      </div>

      <table className="w-full border-collapse border border-black mb-6 text-[11pt] leading-[1.15]">
        <tbody>
          <tr>
            <td colSpan={2} className="border border-black text-center font-bold p-0 leading-tight">1.</td>
          </tr>
          <tr>
            <td className="border border-black px-1 py-0 align-top w-[25%] text-left">Наименование объекта закупки, включая указание единицы измерения, количества товара, объема работ или услуг.</td>
            <td className="border border-black px-1 py-0 align-top w-[75%] whitespace-pre-wrap text-justify">{normalizedData.subjectTable}</td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-black text-center font-bold p-0 leading-tight">2.</td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-black px-1 py-0 align-top">Основные условия исполнения контракта, заключаемого по результатам закупки, включая:</td>
          </tr>
          <tr>
            <td className="border border-black px-1 py-0 align-top text-left w-[25%]">- требования к порядку поставки товара, выполнению работ, оказанию услуг;</td>
            <td className="border border-black px-1 py-0 align-top whitespace-pre-wrap w-[75%] text-justify">
              1. Место оказания услуг: 650064, г. Кемерово, ул. Арочная, 37А, Государственное казенное учреждение «Центр информационных технологий Кузбасса».<br/>
              {normalizedData.serviceConditions.map((cond, idx) => (
                <React.Fragment key={idx}>
                  {idx + 2}. {cond}<br/>
                </React.Fragment>
              ))}
            </td>
          </tr>
          <tr>
            <td className="border border-black px-1 py-0 align-top text-left w-[25%]">- предполагаемые сроки проведения закупки;</td>
            <td className="border border-black px-1 py-0 align-top w-[75%] text-justify">{normalizedData.purchasePeriod}</td>
          </tr>
          <tr>
            <td className="border border-black px-1 py-0 align-top text-left w-[25%]">- порядок формирования цены;</td>
            <td className="border border-black px-1 py-0 align-top w-[75%] text-justify">
              Цена включает в себя все налоги, сборы и другие обязательные платежи, предусмотренные законодательством Российской Федерации, а также все расходы Исполнителя, связанные с оказанием Услуг, в том числе расходы Исполнителя прямо не предусмотренные, но которые могут возникнуть в ходе оказания Услуг.<br/>
              Цена установлена в рублях Российской Федерации и определяется на весь срок оказания Услуг.
            </td>
          </tr>
          <tr>
            <td className="border border-black px-1 py-0 align-top text-left w-[25%]">- порядок оплаты;</td>
            <td className="border border-black px-1 py-0 align-top w-[75%] text-justify">
              Оплата за оказанные услуги производится в течении 7 (семи) рабочих дней на основании подписанного обеими сторонами документа о приемке. Форма оплаты – безналичный расчет.
            </td>
          </tr>
          <tr>
            <td className="border border-black px-1 py-0 align-top text-left w-[25%]">- предполагаемый размер обеспечения исполнения контракта;</td>
            <td className="border border-black px-1 py-0 align-top w-[75%] text-justify">Размер обеспечения исполнения Контракта составляет 10% от начальной (максимальной) цены Контракта.</td>
          </tr>
          <tr>
            <td className="border border-black px-1 py-0 align-top text-left w-[25%]">- гарантия качества</td>
            <td className="border border-black px-1 py-0 align-top w-[75%] text-justify">
              Исполнитель гарантирует, что оказываемые Услуги соответствуют обязательным нормам, правилам и стандартам, регулирующим данную деятельность, а также иным требованиям законодательства Российской Федерации, действующим на момент оказания Услуг.<br/>
              Срок предоставления гарантии качества оказанных Услуг составляет 6 месяцев с момента приемки оказанных Услуг и подписания документа о приемке по Контракту.
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-black text-center font-bold p-0 leading-tight">3.</td>
          </tr>
          <tr>
            <td className="border border-black px-1 py-0 align-top text-left w-[25%]">Срок предоставления ценовой информации</td>
            <td className="border border-black px-1 py-0 align-top w-[75%] text-justify">{normalizedData.submissionDeadline}</td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-black text-center font-bold p-0 leading-tight">4.</td>
          </tr>
          <tr>
            <td className="border border-black px-1 py-0 align-top text-left w-[25%]">Адрес предоставления ценовой информации</td>
            <td className="border border-black px-1 py-0 align-top w-[75%] text-justify">650064, г. Кемерово, ул. Арочная, 37А</td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-black text-center font-bold p-0 leading-tight">5.</td>
          </tr>
          <tr>
            <td className="border border-black px-1 py-0 align-top text-left w-[25%]">Адрес электронной почты для предоставления сканированных копий писем</td>
            <td className="border border-black px-1 py-0 align-top w-[75%] text-justify">{normalizedData.submissionEmail}</td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-black text-center font-bold p-0 leading-tight">6.</td>
          </tr>
          <tr>
            <td className="border border-black px-1 py-0 align-top text-left w-[25%]">Контактные лица</td>
            <td className="border border-black px-1 py-0 align-top w-[75%] text-justify">{normalizedData.contactPerson}</td>
          </tr>
        </tbody>
      </table>

      <p className="indent-8 text-justify mb-2 text-[11pt]">
        Информируем, что направленные предложения не будут рассматриваться в качестве заявки на участие в закупке и не дают в дальнейшем каких-либо преимуществ для лиц, подавших указанные предложения.
      </p>
      <p className="indent-8 text-justify mb-2 text-[11pt]">
        Настоящий запрос не является извещением о проведении закупки, офертой или публичной офертой и не влечет возникновения каких-либо обязательств заказчика.
      </p>
      <p className="indent-8 text-justify mb-12 text-[11pt]">
        В ценовых предложениях просим указывать реквизиты настоящего запроса. Из ответа на запрос должны однозначно определяться цена единицы услуги и общая цена контракта на условиях, указанных в запросе, срок действия предлагаемой цены, расчет цены.
      </p>

      <div className="flex justify-between items-end px-4 text-[12pt]">
        <div>И. о. директора</div>
        <div>С.Ш. Шайкомалов</div>
      </div>
    </div>
  );
}
