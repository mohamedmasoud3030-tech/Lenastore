import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { Printer, Download } from 'lucide-react';

export default function Reports() {
  const { project } = useProject();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [reportType, setReportType] = useState('STOCK');

  const fetchStockReport = async () => {
    if (!supabase || !project) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('material_stock').select('*').eq('project_id', project.id);
      if (error) throw error;
      setReportData({ type: 'STOCK', data });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentsReport = async () => {
    if (!supabase || !project) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*, purchases(purchase_number, suppliers(name))')
        .eq('project_id', project.id)
        .order('date', { ascending: false });
      if (error) throw error;
      setReportData({ type: 'PAYMENTS', data });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchSupplierStatement = async () => {
    if (!supabase || !project) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('supplier_balances')
        .select('*')
        .eq('project_id', project.id);
      if (error) throw error;
      setReportData({ type: 'SUPPLIERS', data });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
      if (!reportData || !reportData.data) return;
      
      let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
      
      if (reportData.type === 'STOCK') {
          csvContent += "المادة,إجمالي الداخل,إجمالي الصرف,الرصيد المتاح\n";
          reportData.data.forEach((row: any) => {
              csvContent += `"${row.name}","${row.total_in} ${row.unit}","${row.total_out} ${row.unit}","${row.current_stock} ${row.unit}"\n`;
          });
      } else if (reportData.type === 'PAYMENTS') {
          csvContent += "التاريخ,المورد,رقم الشراء,المبلغ\n";
          reportData.data.forEach((row: any) => {
              csvContent += `"${row.date}","${row.purchases?.suppliers?.name}","${row.purchases?.purchase_number}",${row.amount}\n`;
          });
      } else if (reportData.type === 'SUPPLIERS') {
          csvContent += "المورد,إجمالي المشتريات,المدفوع,المتبقي\n";
          reportData.data.forEach((row: any) => {
              csvContent += `"${row.name}",${row.total_purchases},${row.total_paid},${row.remaining_balance}\n`;
          });
      }
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `report_${reportData.type}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">التقارير والطباعة</h2>
          <p className="mt-1 text-sm text-gray-500">استخراج تقارير المشروع وطباعتها وتصديرها.</p>
        </div>
      </div>

      <div className="bg-white shadow sm:rounded-lg p-4 print:hidden flex flex-wrap gap-4 items-center">
        <button onClick={() => { setReportType('STOCK'); fetchStockReport(); }} className={`px-4 py-2 rounded-md font-medium text-sm border ${reportType === 'STOCK' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
          تقرير المخزون
        </button>
        <button onClick={() => { setReportType('LOW_STOCK'); fetchStockReport(); }} className={`px-4 py-2 rounded-md font-medium text-sm border ${reportType === 'LOW_STOCK' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
          المواد الناقصة
        </button>
        <button onClick={() => { setReportType('PAYMENTS'); fetchPaymentsReport(); }} className={`px-4 py-2 rounded-md font-medium text-sm border ${reportType === 'PAYMENTS' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
          تقرير المدفوعات
        </button>
        <button onClick={() => { setReportType('SUPPLIERS'); fetchSupplierStatement(); }} className={`px-4 py-2 rounded-md font-medium text-sm border ${reportType === 'SUPPLIERS' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
          كشف الموردين
        </button>
        
        <div className="mr-auto flex gap-2">
          <button onClick={handleExportCSV} disabled={!reportData} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
            <Download size={18} /> CSV
          </button>
          <button onClick={handlePrint} disabled={!reportData} className="inline-flex items-center gap-2 px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-900 disabled:opacity-50">
            <Printer size={18} /> طباعة
          </button>
        </div>
      </div>

      {loading && <div className="p-8 text-center print:hidden">جاري استخراج التقرير...</div>}

      {/* Printable Area */}
      {reportData && !loading && (
        <div className="bg-white shadow sm:rounded-lg p-8 print:shadow-none print:p-0 print:block">
          <div className="text-center mb-8 border-b-2 border-gray-800 pb-4">
            <h1 className="text-2xl font-bold">{project?.name}</h1>
            <h2 className="text-xl mt-2 text-gray-600">
              {reportData.type === 'STOCK' ? 'تقرير المخزون الحالي' : reportData.type === 'PAYMENTS' ? 'تقرير المدفوعات للموردين' : 'كشف حسابات الموردين'}
            </h2>
            <p className="text-sm mt-2 text-gray-500">تاريخ الطباعة: {new Date().toLocaleDateString('ar-SA')}</p>
          </div>

          {reportData.type === 'STOCK' || reportData.type === 'LOW_STOCK' ? (
            <table className="min-w-full divide-y divide-gray-200 border">
              <thead className="bg-gray-100">
                <tr>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">المادة</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">الحد الأدنى</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">إجمالي الداخل</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">إجمالي الصرف</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">الرصيد المتاح</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.data
                  .filter((item: any) => reportData.type === 'STOCK' || item.current_stock <= item.min_stock)
                  .map((item: any) => (
                  <tr key={item.material_id} className={item.current_stock <= item.min_stock ? 'bg-red-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">{item.min_stock} {item.unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">{item.total_in} {item.unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">{item.total_out} {item.unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-gray-900">{item.current_stock} {item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : reportData.type === 'PAYMENTS' ? (
            <table className="min-w-full divide-y divide-gray-200 border">
              <thead className="bg-gray-100">
                <tr>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">التاريخ</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">المورد</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">رقم الشراء</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">المبلغ</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.data.map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.purchases?.suppliers?.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.purchases?.purchase_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : reportData.type === 'SUPPLIERS' ? (
            <table className="min-w-full divide-y divide-gray-200 border">
              <thead className="bg-gray-100">
                <tr>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">المورد</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">إجمالي المشتريات</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">المدفوع</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">المتبقي</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.data.map((item: any) => (
                  <tr key={item.supplier_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                      {new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(item.total_purchases)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-green-600 font-bold">
                      {new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(item.total_paid)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-red-600 font-bold">
                      {new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(item.remaining_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      )}
    </div>
  );
}
