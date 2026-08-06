import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { useParams, useNavigate } from 'react-router-dom';
import { PurchaseRequest, PurchaseRequestItem } from '../types';
import { parseSupabaseError } from '../lib/supabaseErrors';
import { StatusBadge } from './common/StatusBadge';
import { LoadingSkeleton } from './common/LoadingSkeleton';
import { ErrorState } from './common/ErrorState';
import { formatDate } from '../lib/formatters';
import Attachments from './Attachments';
import {
  ArrowRight,
  ShoppingCart,
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Package2,
} from 'lucide-react';

export default function RequestDetails() {
  const { id } = useParams<{ id: string }>();
  const { project } = useProject();
  const navigate = useNavigate();

  const [request, setRequest] = useState<PurchaseRequest | null>(null);
  const [items, setItems] = useState<PurchaseRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900" dir="ltr">
                {request.request_number}
              </h1>
              <StatusBadge variant={request.status} />
              <StatusBadge variant={request.priority} />
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span>تاريخ الطلب: {formatDate(request.date)}</span>
              {request.needed_date && <span>• تاريخ الاحتياج: {formatDate(request.needed_date)}</span>}
            </p>
          </div>
        </div>

        {request.status !== 'PURCHASED' && request.status !== 'CANCELLED' && (
          <button
            onClick={handleConvertToPurchase}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
          >
            <ShoppingCart className="w-4 h-4" />
            تحويل إلى أمر شراء
          </button>
        )}
      </div>

      {/* Details Grid */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">بيانات الطلب</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 font-medium">سبب / غرض الطلب:</span>
            <div className="font-bold text-slate-900 mt-0.5">{request.reason || '-'}</div>
          </div>
          <div>
            <span className="text-slate-400 font-medium">الأولوية:</span>
            <div className="font-bold text-slate-900 mt-0.5">
              {request.priority === 'URGENT' ? 'عاجل جداً' : 'عادي'}
            </div>
          </div>
          <div>
            <span className="text-slate-400 font-medium">تاريخ الاحتياج بالموقع:</span>
            <div className="font-bold text-slate-900 mt-0.5">{formatDate(request.needed_date)}</div>
          </div>
          <div>
            <span className="text-slate-400 font-medium">حالة الطلب:</span>
            <div className="mt-0.5">
              <StatusBadge variant={request.status} />
            </div>
          </div>
        </div>

        {request.notes && (
          <div className="pt-3 border-t border-slate-100 text-xs text-slate-600">
            <span className="font-bold text-slate-700">ملاحظات:</span> {request.notes}
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">المواد المطلوب توفيرها</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">اسم المادة</th>
                <th className="p-3 text-center">الكمية المطلوبة</th>
                <th className="p-3 text-center">الوحدة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50/80">
                  <td className="p-3 text-slate-400 font-medium">{idx + 1}</td>
                  <td className="p-3 font-bold text-slate-900">{item.materials?.name || 'مادة'}</td>
                  <td className="p-3 text-center font-bold text-sky-700">{item.quantity}</td>
                  <td className="p-3 text-center text-slate-600">{item.materials?.unit || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attachments Section */}
      <Attachments entityType="PURCHASE_REQUEST" entityId={request.id} />
    </div>
  );
}
