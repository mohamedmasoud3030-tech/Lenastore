import React, { useState } from 'react';
import { Download, Printer, X, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import BrandMark from '../BrandMark';
import { exportElementToPdf, printElementContent } from '../../lib/pdfExport';

export interface DocumentItem {
  id: string;
  material_name: string;
  unit: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  notes?: string;
}

export interface PrintDocumentProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: 'REQUEST' | 'PURCHASE' | 'ISSUE' | 'INVENTORY';
  title: string;
  docNumber: string;
  date: string;
  projectName: string;
  projectLocation?: string;
  partyName?: string; // Supplier name or Receiver/Engineer name
  partyTitle?: string; // "المورد" or "الجهة الطالبة / المستلم"
  items: DocumentItem[];
  totals?: {
    subtotal?: number;
    paid?: number;
    remaining?: number;
    currency?: string;
  };
  notes?: string;
}

export default function PrintDocumentModal({
  isOpen,
  onClose,
  documentType,
  title,
  docNumber,
  date,
  projectName,
  projectLocation,
  partyName,
  partyTitle = 'المورد / المستلم',
  items,
  totals,
  notes,
}: PrintDocumentProps) {
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    printElementContent('printable-document-content', title);
  };

  const handlePdfDownload = async () => {
    setExporting(true);
    try {
      await exportElementToPdf('printable-document-content', `${docNumber || 'doc'}_${title}`);
    } catch (err) {
      console.error('PDF generation error:', err);
      window.print();
    } finally {
      setExporting(false);
    }
  };

  const getDocBadge = () => {
    switch (documentType) {
      case 'REQUEST':
        return 'سند طلب شراء مواد - رسمية';
      case 'PURCHASE':
        return 'سند أمر توريد وشراء';
      case 'ISSUE':
        return 'سند صرف مواد موقعي';
      case 'INVENTORY':
        return 'تقرير جرد أرصيد المخزون';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      {/* Modal Container */}
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 my-auto flex flex-col max-h-[95vh]">
        {/* Modal Controls Header (Hidden during print) */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white print:hidden border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold">{title}</h2>
              <p className="text-[11px] text-slate-400">معاينة المستند الرسمي للطباعة والتصدير A4</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs hover:bg-amber-300 transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4" /> طباعة المستند A4
            </button>
            <button
              onClick={handlePdfDownload}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs hover:bg-slate-700 transition-colors disabled:opacity-50"
              title="تصدير كملف PDF"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Download className="w-4 h-4" />}
              {exporting ? 'جاري إنشاء PDF...' : 'تحميل PDF'}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable A4 Preview Box */}
        <div className="p-6 sm:p-10 overflow-y-auto flex-1 bg-slate-100 dark:bg-slate-950 print:p-0 print:bg-white print:overflow-visible">
          <div
            id="printable-document-content"
            className="mx-auto bg-white text-slate-900 p-8 sm:p-12 shadow-xl border border-slate-200 rounded-xl print:shadow-none print:border-none print:p-0 max-w-[210mm] min-h-[285mm] flex flex-col justify-between font-sans"
          >
            <div>
              {/* Official Enterprise Printable Header */}
              <div className="border-b-2 border-slate-900 pb-5 mb-6 flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <BrandMark />
                  </div>
                  <h1 className="text-xl font-black tracking-tight text-slate-950">{projectName}</h1>
                  <p className="text-xs text-slate-500">{projectLocation || 'موقع المشروع الإنشائي'}</p>
                </div>

                <div className="text-left space-y-1 text-xs">
                  <span className="inline-block px-3 py-1 bg-slate-900 text-amber-300 font-bold rounded text-[11px] mb-1">
                    {getDocBadge()}
                  </span>
                  <p className="font-mono font-bold text-slate-900 text-sm" dir="ltr"># {docNumber}</p>
                  <p className="text-slate-600">التاريخ: {date}</p>
                </div>
              </div>

              {/* Document Sub-Header / Metadata Grid */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="block text-[10px] text-slate-500 font-bold uppercase">{partyTitle}</span>
                  <span className="font-bold text-slate-900">{partyName || 'غير محدد'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 font-bold uppercase">نوع المستند</span>
                  <span className="font-bold text-slate-900">{title}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 font-bold uppercase">حالة المراجعة</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                    <CheckCircle2 size={12} /> موثق ومنفذ
                  </span>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="mb-6">
                <table className="w-full text-right text-xs border-collapse border border-slate-300">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <tr>
                      <th className="p-2.5 border border-slate-300 text-center w-12">م</th>
                      <th className="p-2.5 border border-slate-300">اسم المادة / البند</th>
                      <th className="p-2.5 border border-slate-300 text-center">الوحدة</th>
                      <th className="p-2.5 border border-slate-300 text-center">الكمية</th>
                      {totals && (
                        <>
                          <th className="p-2.5 border border-slate-300 text-center">سعر الوحدة</th>
                          <th className="p-2.5 border border-slate-300 text-center">الإجمالي</th>
                        </>
                      )}
                      <th className="p-2.5 border border-slate-300">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50">
                        <td className="p-2.5 border border-slate-300 text-center font-bold">{idx + 1}</td>
                        <td className="p-2.5 border border-slate-300 font-bold text-slate-900">{item.material_name}</td>
                        <td className="p-2.5 border border-slate-300 text-center text-slate-600">{item.unit}</td>
                        <td className="p-2.5 border border-slate-300 text-center font-mono font-bold text-slate-900">
                          {item.quantity}
                        </td>
                        {totals && (
                          <>
                            <td className="p-2.5 border border-slate-300 text-center font-mono text-slate-700">
                              {item.unit_price ? item.unit_price.toFixed(2) : '-'}
                            </td>
                            <td className="p-2.5 border border-slate-300 text-center font-mono font-bold text-slate-900">
                              {item.total_price ? item.total_price.toFixed(2) : '-'}
                            </td>
                          </>
                        )}
                        <td className="p-2.5 border border-slate-300 text-slate-500 text-[11px]">{item.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary (If Financial) */}
              {totals && (
                <div className="flex justify-end mb-6">
                  <div className="w-64 bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs space-y-1.5">
                    <div className="flex justify-between font-bold text-slate-700">
                      <span>إجمالي القيمة:</span>
                      <span className="font-mono">{totals.subtotal?.toFixed(2)} {totals.currency || 'OMR'}</span>
                    </div>
                    {totals.paid !== undefined && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>المسدد:</span>
                        <span className="font-mono">{totals.paid?.toFixed(2)} {totals.currency || 'OMR'}</span>
                      </div>
                    )}
                    {totals.remaining !== undefined && (
                      <div className="flex justify-between text-amber-800 font-black border-t border-slate-300 pt-1.5 mt-1">
                        <span>المتبقي:</span>
                        <span className="font-mono">{totals.remaining?.toFixed(2)} {totals.currency || 'OMR'}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {notes && (
                <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 mb-6 text-xs">
                  <span className="font-bold text-amber-900 block mb-1">ملاحظات والتوجيهات الفنية:</span>
                  <p className="text-amber-800 leading-relaxed">{notes}</p>
                </div>
              )}
            </div>

            {/* Official Signatures Block */}
            <div className="pt-8 border-t border-slate-300 grid grid-cols-4 gap-4 text-center text-[11px] text-slate-700 mt-auto">
              <div>
                <p className="font-bold text-slate-900">معد المستند / المهندس</p>
                <div className="h-10 border-b border-dashed border-slate-300 my-1" />
                <p className="text-[10px] text-slate-400">التوقيع والتاريخ</p>
              </div>
              <div>
                <p className="font-bold text-slate-900">أمين المستودع</p>
                <div className="h-10 border-b border-dashed border-slate-300 my-1" />
                <p className="text-[10px] text-slate-400">التوقيع والتاريخ</p>
              </div>
              <div>
                <p className="font-bold text-slate-900">المراجعة والحسابات</p>
                <div className="h-10 border-b border-dashed border-slate-300 my-1" />
                <p className="text-[10px] text-slate-400">التوقيع والتاريخ</p>
              </div>
              <div>
                <p className="font-bold text-slate-900">اعتماد مدير المشروع</p>
                <div className="h-10 border-b border-dashed border-slate-300 my-1" />
                <p className="text-[10px] text-slate-400">الختم والتوقيع</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
