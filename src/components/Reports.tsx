import React, { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { parseSupabaseError } from '../lib/supabaseErrors';
import { PageHeader } from './common/PageHeader';
import { LoadingSkeleton } from './common/LoadingSkeleton';
import { ErrorState } from './common/ErrorState';
import { formatCurrency, formatDate } from '../lib/formatters';
import { Printer, Download, FileText, Filter, AlertTriangle, Layers, Banknote, Building2 } from 'lucide-react';

type ReportType = 'STOCK' | 'LOW_STOCK' | 'PAYMENTS' | 'SUPPLIERS' | 'PURCHASES';

export default function Reports() {
  const { project } = useProject();

  const [reportType, setReportType] = useState<ReportType>('STOCK');
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = project?.currency || 'SAR';

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

  // Initial load
  React.useEffect(() => {
    void loadReport('STOCK');
  }, [loadReport]);

  const handlePrint = () => {
    window.print();
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

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="مركز التقارير والكشوفات"
          description="استخراج تقارير دقيقة للمخزون، الموردين، والمدفوعات مع دعم الطباعة والتصدير لـ Excel."
        />
      </div>

      {/* Control buttons bar (Hidden on print) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => loadReport('STOCK')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              reportType === 'STOCK' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            جرد المخزون
          </button>
          <button
            onClick={() => loadReport('LOW_STOCK')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              reportType === 'LOW_STOCK' ? 'bg-amber-100 text-amber-950 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            المواد الناقصة
          </button>
          <button
            onClick={() => loadReport('PURCHASES')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              reportType === 'PURCHASES' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ملخص المشتريات
          </button>
          <button
            onClick={() => loadReport('PAYMENTS')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              reportType === 'PAYMENTS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            سجل المدفوعات
          </button>
          <button
            onClick={() => loadReport('SUPPLIERS')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              reportType === 'SUPPLIERS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            كشف الموردين
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={loading || reportData.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> تصدير Excel
          </button>
          <button
            onClick={handlePrint}
            disabled={loading || reportData.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 shadow-2xs disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> طباعة التقرير
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={() => loadReport(reportType)} />}

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : (
        /* Printable Report Sheet */
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-2xs print:shadow-none print:border-none print:p-0">
          {/* Header Branding for Print & View */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-black text-slate-900">{project?.name}</h1>
              <p className="text-xs text-slate-500 mt-0.5">نظام ليناستور لإدارة التوريدات والمخزون الهندسي</p>
            </div>
            <div className="text-left text-xs text-slate-500">
              <p className="font-bold text-slate-900">
                {reportType === 'STOCK'
                  ? 'تقرير جرد المواد المتاحة بالمخزون'
                  : reportType === 'LOW_STOCK'
                  ? 'تقرير تنبيه المواد عند حد إعادة الطلب'
                  : reportType === 'PURCHASES'
                  ? 'تقرير ملخص عقود وأوامر الشراء'
                  : reportType === 'PAYMENTS'
                  ? 'تقرير حركة المدفوعات للموردين'
                  : 'كشف حساب ومستحقات الموردين'}
              </p>
              <p className="mt-1">تاريخ استخراج التقرير: {formatDate(new Date().toISOString().split('T')[0])}</p>
            </div>
          </div>

          {/* Table Content */}
          {reportData.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-medium">
              لا توجد بيانات متاحة لهذا التقرير حالياً.
            </div>
          ) : reportType === 'STOCK' || reportType === 'LOW_STOCK' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">اسم المادة</th>
                    <th className="p-3 text-center">الحد الأدنى</th>
                    <th className="p-3 text-center">إجمالي الوارد (+)</th>
                    <th className="p-3 text-center">إجمالي المنصرف (-)</th>
                    <th className="p-3 text-center">الرصيد المتاح الحالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.map((item, idx) => {
                    const isLow = Number(item.current_stock || 0) <= Number(item.min_stock || 0);
                    return (
                      <tr key={item.material_id} className={isLow ? 'bg-amber-50/60' : 'hover:bg-slate-50'}>
                        <td className="p-3 text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{item.name}</td>
                        <td className="p-3 text-center text-slate-600">{item.min_stock} {item.unit}</td>
                        <td className="p-3 text-center text-emerald-700 font-bold">{item.total_in} {item.unit}</td>
                        <td className="p-3 text-center text-amber-700 font-bold">{item.total_out} {item.unit}</td>
                        <td className="p-3 text-center font-bold text-slate-900">{item.current_stock} {item.unit}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : reportType === 'PAYMENTS' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">تاريخ الدفعة</th>
                    <th className="p-3">اسم المورد</th>
                    <th className="p-3">رقم الشراء</th>
                    <th className="p-3">وسيلة الدفع</th>
                    <th className="p-3">الرقم المرجعي</th>
                    <th className="p-3 text-left">المبلغ المدفوع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-600">{formatDate(item.date)}</td>
                      <td className="p-3 font-bold text-slate-900">{item.purchases?.suppliers?.name || '-'}</td>
                      <td className="p-3 font-mono text-sky-700">{item.purchases?.purchase_number || '-'}</td>
                      <td className="p-3 text-slate-600">{item.method}</td>
                      <td className="p-3 text-slate-500 font-mono">{item.reference_number || '-'}</td>
                      <td className="p-3 text-left font-bold text-emerald-700">{formatCurrency(item.amount, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : reportType === 'SUPPLIERS' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">اسم المورد</th>
                    <th className="p-3 text-center">إجمالي المشتريات</th>
                    <th className="p-3 text-center">إجمالي المدفوع</th>
                    <th className="p-3 text-center">الرصيد المتبقي للمورد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.map((item) => (
                    <tr key={item.supplier_id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{item.name}</td>
                      <td className="p-3 text-center font-bold text-slate-700">{formatCurrency(item.total_purchases, currency)}</td>
                      <td className="p-3 text-center font-bold text-emerald-700">{formatCurrency(item.total_paid, currency)}</td>
                      <td className="p-3 text-center font-bold text-rose-600">{formatCurrency(item.remaining_balance, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : reportType === 'PURCHASES' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">رقم أمر الشراء</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">المورد</th>
                    <th className="p-3 text-center">حالة الاستلام</th>
                    <th className="p-3 text-left">إجمالي القيمة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-sky-700">{item.purchase_number}</td>
                      <td className="p-3 text-slate-600">{formatDate(item.date)}</td>
                      <td className="p-3 font-bold text-slate-900">{item.suppliers?.name || '-'}</td>
                      <td className="p-3 text-center text-slate-600">{item.receipt_status}</td>
                      <td className="p-3 text-left font-bold text-slate-900">{formatCurrency(item.total, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
