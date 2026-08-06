import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { MaterialStock } from '../types';
import { parseSupabaseError } from '../lib/supabaseErrors';
import { useToast } from './common/ToastProvider';
import { X, Plus, Trash2, ArrowUpFromLine } from 'lucide-react';

interface CreateIssueVoucherModalProps {
  isOpen: boolean;
  materials: MaterialStock[];
  onClose: () => void;
  onSuccess: () => void;
}

interface IssueItemInput {
  material_id: string;
  quantity: string;
}

export const CreateIssueVoucherModal: React.FC<CreateIssueVoucherModalProps> = ({
  isOpen,
  materials,
  onClose,
  onSuccess,
}) => {
  const { project } = useProject();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    issue_number: `IS-${Date.now().toString().slice(-5)}`,
    date: new Date().toISOString().split('T')[0],
    receiver_name: '',
    destination: '',
    reference_number: '',
    notes: '',
  });

  const [items, setItems] = useState<IssueItemInput[]>([
    { material_id: '', quantity: '1' },
  ]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems((prev) => [...prev, { material_id: '', quantity: '1' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !project) return;

    if (!form.receiver_name.trim()) {
      toast.error('يرجى إدخال اسم المستلم');
      return;
    }

    // Validate items
    const validItemsPayload = [];
    for (const item of items) {
      if (!item.material_id) {
        toast.error('يرجى اختيار المادة لجميع البنود');
        return;
      }
      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        toast.error('الكمية يجب أن تكون أكبر من صفر');
        return;
      }
      const mat = materials.find((m) => m.material_id === item.material_id);
      if (mat && qty > mat.current_stock) {
        toast.error(`المخزون غير كافٍ للمادة (${mat.name}). المتاح: ${mat.current_stock}`);
        return;
      }
      validItemsPayload.push({
        material_id: item.material_id,
        quantity: qty,
      });
    }

    setLoading(true);
    const idempotencyKey = `issue-${project.id}-${Date.now()}`;

    try {
      const { data: issueId, error } = await supabase.rpc('issue_stock', {
        p_project_id: project.id,
        p_issue_number: form.issue_number.trim(),
        p_issue_date: form.date,
        p_receiver_name: form.receiver_name.trim(),
        p_destination: form.destination.trim() || null,
        p_reference_number: form.reference_number.trim() || null,
        p_notes: form.notes.trim() || null,
        p_items: validItemsPayload,
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        toast.error(parseSupabaseError(error, 'حدث خطأ أثناء حفظ سند الصرف'));
        return;
      }

      toast.success(`تم إنشاء سند الصرف بنجاح (${form.issue_number})`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(parseSupabaseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />
        <div className="relative transform overflow-hidden rounded-2xl bg-white text-right shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl border border-slate-200">
          <form onSubmit={handleSubmit}>
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                  <ArrowUpFromLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">إنشاء سند صرف مخزني جديد</h3>
                  <p className="text-xs text-slate-400">صرف مواد موقعي مع مراقبة الرصيد الذرية</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Top metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">رقم السند</label>
                  <input
                    type="text"
                    required
                    value={form.issue_number}
                    onChange={(e) => setForm({ ...form, issue_number: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">تاريخ الصرف</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">اسم المستلم *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: المهندس أحمد / المقاول علي"
                    value={form.receiver_name}
                    onChange={(e) => setForm({ ...form, receiver_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">جهة / مكان الاستخدام</label>
                  <input
                    type="text"
                    placeholder="مثال: صبة القواعد - المبنى B"
                    value={form.destination}
                    onChange={(e) => setForm({ ...form, destination: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-900">بنود المواد المنصرفة</h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700"
                  >
                    <Plus className="w-4 h-4" /> إضافة مادة أخرى
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const selectedMat = materials.find((m) => m.material_id === item.material_id);
                    return (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row gap-3 items-end">
                        <div className="flex-1 w-full">
                          <label className="block text-xs text-slate-600 mb-1">المادة</label>
                          <select
                            required
                            value={item.material_id}
                            onChange={(e) => {
                              const next = [...items];
                              next[idx].material_id = e.target.value;
                              setItems(next);
                            }}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                          >
                            <option value="">اختر المادة...</option>
                            {materials.map((m) => (
                              <option key={m.material_id} value={m.material_id}>
                                {m.name} (المتاح: {m.current_stock} {m.unit})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="w-full sm:w-36">
                          <label className="block text-xs text-slate-600 mb-1">الكمية المنصرفة</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            value={item.quantity}
                            onChange={(e) => {
                              const next = [...items];
                              next[idx].quantity = e.target.value;
                              setItems(next);
                            }}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                          />
                        </div>

                        {selectedMat && (
                          <div className="text-xs text-slate-500 py-2.5 px-2 bg-white rounded-lg border border-slate-200 whitespace-nowrap">
                            الرصيد: <span className="font-bold text-slate-900">{selectedMat.current_stock}</span> {selectedMat.unit}
                          </div>
                        )}

                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Extra details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">رقم المرجع / الاذن المكتوب</label>
                  <input
                    type="text"
                    value={form.reference_number}
                    onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات إضافية</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex flex-row-reverse gap-3 border-t border-slate-200">
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-xs disabled:opacity-50"
              >
                {loading ? 'جاري الصرف الذري...' : 'إصدار سند الصرف'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shadow-xs"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
