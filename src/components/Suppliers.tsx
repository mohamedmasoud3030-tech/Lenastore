import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { Plus, Building2 } from 'lucide-react';

export default function Suppliers() {
  const { project } = useProject();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const [form, setForm] = useState({
    name: '',
    company: '',
    phone: '',
    tax_id: '',
    notes: ''
  });

  const fetchSuppliers = async () => {
    if (!supabase || !project) return;
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('project_id', project.id);
      
      if (error) throw error;
      setSuppliers(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !project) return;
    
    try {
      const { error } = await supabase.from('suppliers').insert([{ ...form, project_id: project.id }]);
      if (error) throw error;
      
      setShowAddModal(false);
      setForm({ name: '', company: '', phone: '', tax_id: '', notes: '' });
      fetchSuppliers();
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء الحفظ');
    }
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">الموردون</h2>
          <p className="mt-1 text-sm text-gray-500">قائمة موردي المواد للمشروع.</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={20} />
            إضافة مورد
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="text-gray-500">جاري التحميل...</p>
        ) : suppliers.length === 0 ? (
          <p className="text-gray-500">لا يوجد موردين.</p>
        ) : (
          suppliers.map((supplier) => (
            <div key={supplier.id} className="bg-white overflow-hidden shadow rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-3 mb-3">
                <Building2 className="text-gray-400" size={24} />
                <h3 className="text-lg font-bold text-gray-900 truncate">{supplier.name}</h3>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <p><span className="font-medium text-gray-700">الشركة:</span> {supplier.company || '-'}</p>
                <p><span className="font-medium text-gray-700">الهاتف:</span> <span dir="ltr">{supplier.phone || '-'}</span></p>
                <p><span className="font-medium text-gray-700">الرقم الضريبي:</span> {supplier.tax_id || '-'}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowAddModal(false)}></div>
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle">&#8203;</span>
            <div className="inline-block transform overflow-hidden rounded-lg bg-white text-right align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">إضافة مورد جديد</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">اسم المورد</label>
                      <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                        className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">الشركة</label>
                      <input type="text" value={form.company} onChange={e => setForm({...form, company: e.target.value})}
                        className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">الهاتف</label>
                        <input type="tel" dir="ltr" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                          className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">الرقم الضريبي</label>
                        <input type="text" value={form.tax_id} onChange={e => setForm({...form, tax_id: e.target.value})}
                          className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <button type="submit" className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 sm:ms-3 sm:w-auto sm:text-sm">
                    حفظ المورد
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
