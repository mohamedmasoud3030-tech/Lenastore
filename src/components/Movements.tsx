import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { Plus, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

export default function Movements() {
  const { project } = useProject();
  const [movements, setMovements] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [type, setType] = useState<'IN' | 'OUT'>('IN');

  const [form, setForm] = useState({
    material_id: '',
    quantity: '',
    date: new Date().toISOString().split('T')[0],
    reference_number: '',
    receiver_name: '',
    location_used: '',
    notes: ''
  });

  const fetchData = async () => {
    if (!supabase || !project) return;
    try {
      const [movRes, matRes] = await Promise.all([
        supabase.from('stock_movements').select('*, materials(name, unit)').eq('project_id', project.id).order('created_at', { ascending: false }),
        supabase.from('material_stock').select('*').eq('project_id', project.id)
      ]);
      setMovements(movRes.data || []);
      setMaterials(matRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !project) return;

    const qty = Number(form.quantity);
    if (qty <= 0) {
      alert('الكمية يجب أن تكون أكبر من صفر');
      return;
    }

    if (type === 'OUT') {
      const mat = materials.find(m => m.material_id === form.material_id);
      if (!mat || mat.current_stock < qty) {
        alert(`لا يمكن صرف كمية أكبر من المخزون الحالي (${mat?.current_stock || 0} متاح)`);
        return;
      }
    }

    try {
      const { error } = await supabase.from('stock_movements').insert([{
        project_id: project.id,
        type,
        material_id: form.material_id,
        quantity: qty,
        date: form.date,
        reference_number: form.reference_number,
        receiver_name: form.receiver_name,
        location_used: type === 'OUT' ? form.location_used : null,
        notes: form.notes
      }]);

      if (error) throw error;
      
      setShowAddModal(false);
      setForm({ material_id: '', quantity: '', date: new Date().toISOString().split('T')[0], reference_number: '', receiver_name: '', location_used: '', notes: '' });
      fetchData();
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء الحفظ');
    }
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">حركات المخزون</h2>
          <p className="mt-1 text-sm text-gray-500">تسجيل ومتابعة المواد الداخلة والمنصرفة.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-3">
          <button
            onClick={() => { setType('IN'); setShowAddModal(true); }}
            className="inline-flex items-center gap-2 justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700"
          >
            <ArrowDownToLine size={20} />
            دخول مادة (+)
          </button>
          <button
            onClick={() => { setType('OUT'); setShowAddModal(true); }}
            className="inline-flex items-center gap-2 justify-center rounded-md border border-transparent bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700"
          >
            <ArrowUpFromLine size={20} />
            صرف مادة (-)
          </button>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <ul className="divide-y divide-gray-200">
          {loading ? (
            <li className="px-4 py-8 text-center text-gray-500">جاري التحميل...</li>
          ) : movements.length === 0 ? (
            <li className="px-4 py-8 text-center text-gray-500">لا توجد حركات مسجلة.</li>
          ) : (
            movements.map((item) => (
              <li key={item.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {item.type === 'IN' ? (
                      <ArrowDownToLine className="text-green-500 h-6 w-6" />
                    ) : (
                      <ArrowUpFromLine className="text-orange-500 h-6 w-6" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.materials?.name}</p>
                      <p className="text-xs text-gray-500">{item.date}</p>
                    </div>
                  </div>
                  <div className="ms-2 flex-shrink-0 flex items-center gap-4">
                    <p className="text-sm text-gray-500">
                      {item.receiver_name && `المستلم: ${item.receiver_name}`}
                    </p>
                    <p className={`px-2 inline-flex text-sm leading-5 font-bold rounded-full ${item.type === 'IN' ? 'text-green-600 bg-green-100' : 'text-orange-600 bg-orange-100'}`}>
                      {item.type === 'IN' ? '+' : '-'}{item.quantity} {item.materials?.unit}
                    </p>
                  </div>
                </div>
                {item.notes && (
                  <div className="mt-2 text-sm text-gray-500">
                    ملاحظات: {item.notes}
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowAddModal(false)}></div>
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle">&#8203;</span>
            <div className="inline-block transform overflow-hidden rounded-lg bg-white text-right align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                    {type === 'IN' ? 'تسجيل دخول مادة' : 'تسجيل صرف مادة'}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">المادة</label>
                      <select required value={form.material_id} onChange={e => setForm({...form, material_id: e.target.value})}
                        className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm">
                        <option value="">اختر المادة...</option>
                        {materials.map(m => (
                          <option key={m.material_id} value={m.material_id}>
                            {m.name} (المتاح: {m.current_stock} {m.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">الكمية</label>
                        <input type="number" step="0.01" min="0.01" required value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})}
                          className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">التاريخ</label>
                        <input type="date" required value={form.date} onChange={e => setForm({...form, date: e.target.value})}
                          className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">اسم المستلم</label>
                      <input type="text" required value={form.receiver_name} onChange={e => setForm({...form, receiver_name: e.target.value})}
                        className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm" />
                    </div>

                    {type === 'OUT' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">مكان الاستخدام (الجهة)</label>
                        <input type="text" required value={form.location_used} onChange={e => setForm({...form, location_used: e.target.value})}
                          className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm" />
                      </div>
                    )}

                    {type === 'IN' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">رقم الفاتورة / الإرسالية (اختياري)</label>
                        <input type="text" value={form.reference_number} onChange={e => setForm({...form, reference_number: e.target.value})}
                          className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm" />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700">ملاحظات</label>
                      <textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                        className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"></textarea>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <button type="submit" className={`inline-flex w-full justify-center rounded-md border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm sm:ms-3 sm:w-auto sm:text-sm ${type === 'IN' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                    حفظ الحركة
                  </button>
                  <button type="button" onClick={() => setShowAddModal(false)} className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:mt-0 sm:ms-3 sm:w-auto sm:text-sm">
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
