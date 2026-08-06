import React, { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { parseSupabaseError } from '../lib/supabaseErrors';
import { PageHeader } from './common/PageHeader';
import { LoadingSkeleton } from './common/LoadingSkeleton';
import { ErrorState } from './common/ErrorState';
import { formatCurrency, formatDate } from '../lib/formatters';
import AnalyticsCharts from './AnalyticsCharts';
import { exportElementToPdf, printElementContent } from '../lib/pdfExport';
import {
  Printer,
  Download,
  FileText,
  Eye,
  X,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

type ReportType = 'STOCK' | 'LOW_STOCK' | 'PAYMENTS' | 'SUPPLIERS' | 'PURCHASES';

const reportTitles: Record<ReportType, string> = {
  STOCK: 'تقرير جرد أرصيد المواد المتاحة بالمخزون',
  LOW_STOCK: 'تقرير تنبيه المواد عند حد إعادة الطلب',
  PURCHASES: 'تقرير ملخص عقود وأوامر الشراء',
  PAYMENTS: 'تقرير حركة المدفوعات والمسدد للموردين',
  SUPPLIERS: 'كشف حساب ومستحقات الموردين',
};

export default function Reports() {
  const { project } = useProject();

  const [reportType, setReportType] = useState<ReportType>('STOCK');
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const currency = project?.currency || 'EGP';

  const loadReport = useCallback(
    async (type: ReportType) => {
      if (!supabase || !project) return;
      setReportType(type);
      setLoading(true);
      setError(null);

      try {
        let resData: any[] = [];

        if (type === 'STOCK' || type === 'LOW_STOCK') {
          const { data, error: err } = await supabase
            .from('material_stock')
            .select('*')
            .eq('project_id', project.id)
            .order('name');
          if (err) throw err;
          resData = data || [];
          if (type === 'LOW_STOCK') {
            resData = resData.filter((i) => Number(i.current_stock || 0) <= Number(i.min_stock || 0));
          }
        } else if (type === 'PAYMENTS') {
          const { data, error: err } = await supabase
            .from('payments')
            .select('*, purchases(purchase_number, suppliers(name))')
            .eq('project_id', project.id)
            .order('date', { ascending: false });
          if (err) throw err;
          resData = data || [];
        } else if (type === 'SUPPLIERS') {
          const { data, error: err } = await supabase
            .from('supplier_balances')
            .select('*')
            .eq('project_id', project.id)
            .order('name');
          if (err) throw err;
          resData = data || [];
        } else if (type === 'PURCHASES') {
          const { data, error: err } = await supabase
            .from('purchases')
            .select('*, suppliers(name)')
            .eq('project_id', project.id)
            .order('date', { ascending: false });
          if (err) throw err;
          resData = data || [];
        }

        setReportData(resData);
      } catch (err: any) {
        console.error(err);
        setError(parseSupabaseError(err, 'حدث خطأ أثناء تحميل بيانات التقرير'));
      } finally {
        setLoading(false);
      }
    },
    [project]
  );

  React.useEffect(() => {
    void loadReport('STOCK');
  }, [loadReport]);

  const handlePrint = (elementId: string = 'printable-report-sheet') => {
    printElementContent(elementId, reportTitles[reportType]);
  };

  const handleDownloadPdf = async (elementId: string = 'printable-report-sheet') => {
    setExportingPdf(true);
    try {
      await exportElementToPdf(elementId, `report_${reportType.toLowerCase()}_${new Date().toISOString().split('T')[0]}`);
    } catch (err) {
      console.error(err);
      printElementContent(elementId, reportTitles[reportType]);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportCSV = () => {
    if (!reportData || reportData.length === 0) return;

    let csvContent = '\uFEFF'; // UTF-8 BOM for Arabic Excel

    if (reportType === 'STOCK' || reportType === 'LOW_STOCK') {
      csvContent += 'اسم المادة,الوحدة,الحد الأدنى,إجمالي الداخل,إجمالي الصرف,الرصيد المتاح\n';
      reportData.forEach((row) => {
        csvContent += `"${row.name}","${row.unit}","${row.min_stock}","${row.total_in}","${row.total_out}","${row.current_stock}"\n`;
      });
    } else if (reportType === 'PAYMENTS') {
      csvContent += 'تاريخ الدفعة,اسم المورد,رقم أمر الشراء,طريقة الدفع,الرقم المرجعي,المبلغ\n';
      reportData.forEach((row) => {
        csvContent += `"${row.date}","${row.purchases?.suppliers?.name || '-'}","${row.purchases?.purchase_number || '-'}","${row.method}","${row.reference_number || '-'}","${row.amount}"\n`;
      });
    } else if (reportType === 'SUPPLIERS') {
      csvContent += 'اسم المورد,إجمالي المشتريات,إجمالي المدفوع,المتبقي للمورد\n';
      reportData.forEach((row) => {
        csvContent += `"${row.name}","${row.total_purchases}","${row.total_paid}","${row.remaining_balance}"\n`;
      });
    } else if (reportType === 'PURCHASES') {
      csvContent += 'رقم امر الشراء,التاريخ,اسم المورد,حالة الاستلام,إجمالي المبلغ\n';
      reportData.forEach((row) => {
        csvContent += `"${row.purchase_number}","${row.date}","${row.suppliers?.name || '-'}","${row.receipt_status}","${row.total}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `report_${reportType.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderTableContent = () => {
    if (reportData.length === 0) {
      return (
        <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs font-medium">
          لا توجد بيانات متاحة لهذا التقرير حالياً.
        </div>
      );
    }

    if (reportType === 'STOCK' || reportType === 'LOW_STOCK') {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">اسم المادة</th>
                <th className="p-3 text-center">الحد الأدنى</th>
                <th className="p-3 text-center">إجمالي الوارد (+)</th>
                <th className="p-3 text-center">إجمالي المنصرف (-)</th>
                <th className="p-3 text-center">الرصيد المتاح الحالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {reportData.map((item, idx) => {
                const isLow = Number(item.current_stock || 0) <= Number(item.min_stock || 0);
                return (
                  <tr key={item.material_id || idx} className={isLow ? 'bg-amber-50/60 dark:bg-amber-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}>
                    <td className="p-3 text-slate-400 dark:text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{item.name}</td>
                    <td className="p-3 text-center text-slate-600 dark:text-slate-400">{item.min_stock} {item.unit}</td>
                    <td className="p-3 text-center text-emerald-700 dark:text-emerald-400 font-bold">{item.total_in} {item.unit}</td>
                    <td className="p-3 text-center text-amber-700 dark:text-amber-400 font-bold">{item.total_out} {item.unit}</td>
                    <td className="p-3 text-center font-bold text-slate-900 dark:text-slate-100">{item.current_stock} {item.unit}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    if (reportType === 'PAYMENTS') {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">تاريخ الدفعة</th>
                <th className="p-3">اسم المورد</th>
                <th className="p-3">رقم الشراء</th>
                <th className="p-3">وسيلة الدفع</th>
                <th className="p-3">الرقم المرجعي</th>
                <th className="p-3 text-left">المبلغ المدفوع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {reportData.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-3 text-slate-600 dark:text-slate-400">{formatDate(item.date)}</td>
                  <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{item.purchases?.suppliers?.name || '-'}</td>
                  <td className="p-3 font-mono text-sky-700 dark:text-sky-400">{item.purchases?.purchase_number || '-'}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">{item.method}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400 font-mono">{item.reference_number || '-'}</td>
                  <td className="p-3 text-left font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(item.amount, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (reportType === 'SUPPLIERS') {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">اسم المورد</th>
                <th className="p-3 text-center">إجمالي المشتريات</th>
                <th className="p-3 text-center">إجمالي المدفوع</th>
                <th className="p-3 text-center">الرصيد المتبقي للمورد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {reportData.map((item, idx) => (
                <tr key={item.supplier_id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{item.name}</td>
                  <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">{formatCurrency(item.total_purchases, currency)}</td>
                  <td className="p-3 text-center font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(item.total_paid, currency)}</td>
                  <td className="p-3 text-center font-bold text-rose-600 dark:text-rose-400">{formatCurrency(item.remaining_balance, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (reportType === 'PURCHASES') {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">رقم أمر الشراء</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">المورد</th>
                <th className="p-3 text-center">حالة الاستلام</th>
                <th className="p-3 text-left">إجمالي القيمة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {reportData.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-bold text-sky-700 dark:text-sky-400">{item.purchase_number}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">{formatDate(item.date)}</td>
                  <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{item.suppliers?.name || '-'}</td>
                  <td className="p-3 text-center text-slate-600 dark:text-slate-400">{item.receipt_status}</td>
                  <td className="p-3 text-left font-bold text-slate-900 dark:text-slate-100">{formatCurrency(item.total, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="مركز التقارير والتحليلات البيانية"
          description="استخراج تقارير دقيقة للمخزون، الموردين، والمدفوعات مع الرسوم البيانية التفاعلية ودعم الطباعة والتصدير المباشر PDF / Excel."
        />
      </div>

      {/* Embedded Visual Analytics Section */}
      <div className="print:hidden">
        <AnalyticsCharts />
      </div>

      {/* Control buttons bar (Hidden on print) */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            onClick={() => loadReport('STOCK')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              reportType === 'STOCK' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            جرد المخزون
          </button>
          <button
            onClick={() => loadReport('LOW_STOCK')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              reportType === 'LOW_STOCK' ? 'bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-300 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            المواد الناقصة
          </button>
          <button
            onClick={() => loadReport('PURCHASES')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              reportType === 'PURCHASES' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            ملخص المشتريات
          </button>
          <button
            onClick={() => loadReport('PAYMENTS')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              reportType === 'PAYMENTS' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            سجل المدفوعات
          </button>
          <button
            onClick={() => loadReport('SUPPLIERS')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              reportType === 'SUPPLIERS' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            كشف الموردين
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={loading || reportData.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> تصدير Excel
          </button>

          <button
            onClick={() => handleDownloadPdf('printable-report-sheet')}
            disabled={loading || reportData.length === 0 || exportingPdf}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-800 text-amber-300 border border-slate-700 hover:bg-slate-700 shadow-2xs disabled:opacity-50"
          >
            {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Download className="w-4 h-4" />}
            {exportingPdf ? 'جاري التحميل...' : 'تحميل PDF'}
          </button>

          <button
            onClick={() => setShowPreviewModal(true)}
            disabled={loading || reportData.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-2xs disabled:opacity-50"
          >
            <Eye className="w-4 h-4" /> معاينة وطباعة A4
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={() => loadReport(reportType)} />}

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : (
        /* Inline Report Sheet Preview */
        <div
          id="printable-report-sheet"
          className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs print:shadow-none print:border-none print:p-0 print:bg-white print:text-black"
        >
          {/* Header Branding */}
          <div className="border-b-2 border-slate-900 dark:border-slate-700 print:border-black pb-4 mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 print:text-black">{project?.name}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 print:text-slate-600 mt-0.5">نظام إدارة التوريدات والمخزون الهندسي</p>
            </div>
            <div className="text-left text-xs text-slate-500 dark:text-slate-400 print:text-slate-600">
              <p className="font-bold text-slate-900 dark:text-slate-100 print:text-black">
                {reportTitles[reportType]}
              </p>
              <p className="mt-1">تاريخ استخراج التقرير: {formatDate(new Date().toISOString().split('T')[0])}</p>
            </div>
          </div>

          {renderTableContent()}

          {/* Official Signatures Footnote */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-4 text-center text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-700">
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200 print:text-black">مُعد التقرير</p>
              <div className="h-8 border-b border-dashed border-slate-300 dark:border-slate-700 my-1" />
              <p className="text-[10px]">التوقيع والتاريخ</p>
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200 print:text-black">أمين المخزن / المشتريات</p>
              <div className="h-8 border-b border-dashed border-slate-300 dark:border-slate-700 my-1" />
              <p className="text-[10px]">التوقيع والتاريخ</p>
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200 print:text-black">اعتماد مدير المشروع</p>
              <div className="h-8 border-b border-dashed border-slate-300 dark:border-slate-700 my-1" />
              <p className="text-[10px]">التوقيع والختم</p>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Interactive Printable Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 my-auto flex flex-col max-h-[95vh]">
            {/* Modal Controls Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-sm font-bold">{reportTitles[reportType]}</h2>
                  <p className="text-[11px] text-slate-400">معاينة الطباعة والمستند الرسمي A4</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrint('modal-printable-report')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs hover:bg-amber-300 transition-colors shadow-xs"
                >
                  <Printer className="w-4 h-4" /> طباعة المستند A4
                </button>
                <button
                  onClick={() => handleDownloadPdf('modal-printable-report')}
                  disabled={exportingPdf}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Download className="w-4 h-4" />}
                  {exportingPdf ? 'جاري التصدير...' : 'تحميل PDF'}
                </button>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body Printable Paper Preview */}
            <div className="p-6 sm:p-10 overflow-y-auto flex-1 bg-slate-100 dark:bg-slate-950">
              <div
                id="modal-printable-report"
                className="mx-auto bg-white text-slate-900 p-8 sm:p-12 shadow-xl border border-slate-200 rounded-xl max-w-[210mm] min-h-[285mm] flex flex-col justify-between font-sans"
              >
                <div>
                  <div className="border-b-2 border-slate-900 pb-5 mb-6 flex items-start justify-between">
                    <div>
                      <h1 className="text-xl font-black tracking-tight text-slate-950">{project?.name}</h1>
                      <p className="text-xs text-slate-500 mt-1">الموقع: {project?.location || 'غير محدد'}</p>
                    </div>
                    <div className="text-left text-xs">
                      <span className="inline-block px-3 py-1 bg-slate-900 text-amber-300 font-bold rounded text-[11px] mb-1">
                        مستند رسمي معتمد
                      </span>
                      <p className="font-bold text-slate-900 text-xs">{reportTitles[reportType]}</p>
                      <p className="text-slate-500 mt-1">تاريخ الاستخراج: {formatDate(new Date().toISOString().split('T')[0])}</p>
                    </div>
                  </div>

                  <div className="my-4">{renderTableContent()}</div>
                </div>

                <div className="pt-8 border-t border-slate-300 grid grid-cols-3 gap-4 text-center text-[11px] text-slate-700 mt-auto">
                  <div>
                    <p className="font-bold text-slate-900">مُعد التقرير</p>
                    <div className="h-10 border-b border-dashed border-slate-300 my-1" />
                    <p className="text-[10px] text-slate-400">التوقيع والتاريخ</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">أمين المستودع</p>
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
      )}
    </div>
  );
}
