import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { useParams, useNavigate } from 'react-router-dom';
import { PurchaseRequest, PurchaseRequestItem } from '../types';
import { parseSupabaseError } from '../lib/supabaseErrors';
import { PageHeader } from './common/PageHeader';
import { StatusBadge } from './common/StatusBadge';
import { LoadingSkeleton } from './common/LoadingSkeleton';
import { ErrorState } from './common/ErrorState';
import { formatDate } from '../lib/formatters';
import Attachments from './Attachments';
import PrintDocumentModal from './common/PrintDocumentModal';
import {
  ShoppingCart,
  FileText,
  Printer,
} from 'lucide-react';

export default function RequestDetails() {
  const { id } = useParams<{ id: string }>();
  const { project } = useProject();
  const navigate = useNavigate();

  const [request, setRequest] = useState<PurchaseRequest | null>(null);
  const [items, setItems] = useState<PurchaseRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const fetchData = useCallback(async () => {
    if (!supabase || !project || !id) return;
    setLoading(true);
    setError(null);

    try {
      const [reqRes, itemsRes] = await Promise.all([
        supabase.from('purchase_requests').select('*').eq('id', id).eq('project_id', project.id).single(),
        supabase.from('purchase_request_items').select('*, materials(name, unit)').eq('request_id', id),
      ]);

      if (reqRes.error) throw reqRes.error;
      if (itemsRes.error) throw itemsRes.error;

      setRequest(reqRes.data as PurchaseRequest);
      setItems((itemsRes.data as any) || []);
    } catch (err: any) {
      console.error(err);
      setError(parseSupabaseError(err, 'حدث خطأ أثناء تحميل تفاصيل طلب الشراء'));
    } finally {
      setLoading(false);
    }
  }, [id, project]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleConvertToPurchase = () => {
    if (!request) return;
    navigate('/purchases/new', { state: { request, items } });
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <LoadingSkeleton rows={4} />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <ErrorState message={error || 'لم يتم العثور على طلب الشراء'} onRetry={fetchData} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto print:space-y-4 print:p-0">
      {/* Printable Header Branding */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black text-slate-900">{project?.name || 'مشروع إنشائي'}</h1>
            <p className="text-xs text-slate-500 mt-1">نظام ليناستور لإدارة التوريدات والمخزون الهندسي</p>
          </div>
          <div className="text-left text-xs text-slate-600">
            <h2 className="text-base font-bold text-slate-900">سند طلب شراء مواد</h2>
            <p className="font-mono text-sky-800 font-bold mt-0.5" dir="ltr">{request.request_number}</p>
            <p className="mt-1">تاريخ الإصدار: {formatDate(request.date)}</p>
          </div>
        </div>
      </div>

      {/* Standardized PageHeader */}
      <PageHeader
        title={request.request_number}
        description={`تاريخ الطلب: ${formatDate(request.date)} ${request.needed_date ? `• تاريخ الاحتياج: ${formatDate(request.needed_date)}` : ''}`}
        onBack={() => navigate(-1)}
        icon={FileText}
        badge={
          <div className="flex items-center gap-1.5">
            <StatusBadge variant={request.status} />
            <StatusBadge variant={request.priority} />
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPrintModal(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors shadow-2xs"
            >
              <Printer className="w-4 h-4" />
              طباعة ومعاينة A4
            </button>

            {request.status !== 'PURCHASED' && request.status !== 'CANCELLED' && (
              <button
                onClick={handleConvertToPurchase}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors shadow-2xs"
              >
                <ShoppingCart className="w-4 h-4" />
                تحويل إلى أمر شراء
              </button>
            )}
          </div>
        }
      />

      {/* Details Grid */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4 print:shadow-none print:border print:p-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">بيانات الطلب</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400 font-semibold">سبب / غرض الطلب:</span>
            <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">{request.reason || '-'}</div>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 font-semibold">الأولوية:</span>
            <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {request.priority === 'URGENT' ? 'عاجل جداً' : 'عادي'}
            </div>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 font-semibold">تاريخ الاحتياج بالموقع:</span>
            <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">{formatDate(request.needed_date)}</div>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 font-semibold">حالة الطلب:</span>
            <div className="mt-0.5">
              <StatusBadge variant={request.status} />
            </div>
          </div>
        </div>

        {request.notes && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-bold text-slate-900 dark:text-slate-100">ملاحظات:</span> {request.notes}
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4 print:shadow-none print:border print:p-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">المواد المطلوب توفيرها</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">اسم المادة</th>
                <th className="p-3 text-center">الكمية المطلوبة</th>
                <th className="p-3 text-center">الوحدة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                  <td className="p-3 text-slate-400 font-medium">{idx + 1}</td>
                  <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{item.materials?.name || 'مادة'}</td>
                  <td className="p-3 text-center font-bold text-sky-700 dark:text-sky-400">{item.quantity}</td>
                  <td className="p-3 text-center text-slate-600 dark:text-slate-400">{item.materials?.unit || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Signatures Block */}
      <div className="hidden print:grid grid-cols-3 gap-6 pt-12 text-center text-xs text-slate-700">
        <div className="border-t border-slate-300 pt-2 font-bold">معد الطلب (مهندس الموقع)</div>
        <div className="border-t border-slate-300 pt-2 font-bold">أمين المستودع</div>
        <div className="border-t border-slate-300 pt-2 font-bold">اعتماد مدير المشروع</div>
      </div>

      {/* Attachments Section (Hidden on Print) */}
      <div className="print:hidden">
        <Attachments entityType="PURCHASE_REQUEST" entityId={request.id} />
      </div>

      {/* Printable A4 Document Modal */}
      {request && (
        <PrintDocumentModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          documentType="REQUEST"
          title="سند طلب شراء مواد رسمية"
          docNumber={request.request_number}
          date={formatDate(request.date)}
          projectName={project?.name || 'مشروع إنشائي'}
          projectLocation={project?.location}
          partyName={request.reason || 'إدارة الموقع الإنشائي'}
          partyTitle="غرض الاستخدام"
          items={items.map((i) => {
            const mat = Array.isArray(i.materials) ? i.materials[0] : i.materials;
            return {
              id: i.id,
              material_name: mat?.name || 'مادة مطلوب توريدها',
              unit: mat?.unit || '',
              quantity: Number(i.quantity) || 0,
            };
          })}
          notes={request.notes || undefined}
        />
      )}
    </div>
  );
}

