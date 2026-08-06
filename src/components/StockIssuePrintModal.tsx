import React, { useState } from 'react';
import { useProject } from '../lib/ProjectContext';
import { StockIssue } from '../types';
import { formatDate } from '../lib/formatters';
import { X, Printer, Download, Loader2 } from 'lucide-react';
import { exportElementToPdf, printElementContent } from '../lib/pdfExport';

interface StockIssuePrintModalProps {
  issue: StockIssue | null;
  isOpen: boolean;
  onClose: () => void;
}

export const StockIssuePrintModal: React.FC<StockIssuePrintModalProps> = ({ issue, isOpen, onClose }) => {
  const { project } = useProject();
  const [exporting, setExporting] = useState(false);

  if (!isOpen || !issue) return null;

  const handlePrint = () => {
    printElementContent('stock-issue-print-content', `سند صرف مخزني - ${issue.issue_number}`);
  };

  const handlePdfDownload = async () => {
    setExporting(true);
    try {
      await exportElementToPdf('stock-issue-print-content', `سند_صرف_${issue.issue_number}`);
    } catch (err) {
      console.error(err);
      window.print();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity print:hidden" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-2xl bg-white text-right shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-2xl border border-slate-200 print:shadow-none print:border-none print:m-0 print:w-full print:max-w-none">
          {/* Action bar (hidden in print) */}
          <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between print:hidden">
            <h3 className="text-base font-bold">معاينة سند الصرف المخزني</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors"
              >
                <Printer className="w-4 h-4" /> طباعة السند (A4)
              </button>
              <button
                onClick={handlePdfDownload}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Download className="w-4 h-4" />}
                {exporting ? 'جاري التحميل...' : 'تصدير PDF'}
              </button>
              <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Voucher Document */}
          <div id="stock-issue-print-content" className="p-8 space-y-6 text-slate-900 bg-white print:p-0">
            {/* Document Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900">{project?.name || 'مشروع إنشائي'}</h1>
                <p className="text-xs text-slate-500 mt-1">الموقع / الجهة: {project?.location || '-'}</p>
                <p className="text-xs text-slate-500">مدير المشروع: {project?.manager_name || '-'}</p>
              </div>
              <div className="text-left">
                <div className="inline-block px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-lg text-sm mb-1">
                  سند صرف مخزني
                </div>
                <div className="text-xs text-slate-600 font-bold" dir="ltr">{issue.issue_number}</div>
                <div className="text-xs text-slate-500">{formatDate(issue.date)}</div>
              </div>
            </div>

            {/* Voucher Metadata */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 font-medium">اسم المستلم:</span>
                <span className="font-bold text-slate-900 ms-2">{issue.receiver_name}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">جهة الاستخدام:</span>
                <span className="font-bold text-slate-900 ms-2">{issue.destination || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">رقم الإذن / المرجع:</span>
                <span className="font-bold text-slate-900 ms-2" dir="ltr">{issue.reference_number || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">تاريخ التسجيل:</span>
                <span className="font-bold text-slate-900 ms-2">{formatDate(issue.created_at)}</span>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">بيان المواد المنصرفة</h4>
              <table className="w-full text-right text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">اسم المادة</th>
                    <th className="p-2.5 text-center">الكمية المنصرفة</th>
                    <th className="p-2.5 text-center">الوحدة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {issue.stock_issue_items?.map((item, index) => (
                    <tr key={item.id || index}>
                      <td className="p-2.5 text-slate-400 font-medium">{index + 1}</td>
                      <td className="p-2.5 font-bold text-slate-900">{item.materials?.name || 'مادة مخزنية'}</td>
                      <td className="p-2.5 text-center font-bold text-amber-800">{item.quantity}</td>
                      <td className="p-2.5 text-center text-slate-600">{item.materials?.unit || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {issue.notes && (
              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="font-bold">ملاحظات:</span> {issue.notes}
              </div>
            )}

            {/* Signatures */}
            <div className="pt-8 border-t border-slate-200 grid grid-cols-3 gap-4 text-center text-xs">
              <div>
                <div className="text-slate-500 mb-8 font-medium">أمين المخزن</div>
                <div className="border-b border-slate-300 w-32 mx-auto"></div>
                <div className="mt-1 text-slate-400">التوقيع والتاريخ</div>
              </div>
              <div>
                <div className="text-slate-500 mb-8 font-medium">المستلم الموقعي</div>
                <div className="border-b border-slate-300 w-32 mx-auto"></div>
                <div className="mt-1 text-slate-400">{issue.receiver_name}</div>
              </div>
              <div>
                <div className="text-slate-500 mb-8 font-medium">اعتماد مدير الموقع</div>
                <div className="border-b border-slate-300 w-32 mx-auto"></div>
                <div className="mt-1 text-slate-400">التوقيع والتاريخ</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
