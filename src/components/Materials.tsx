import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { Plus, Search, Package2 } from 'lucide-react';

interface MaterialStock {
  material_id: string;
  name: string;
  unit: string;
  min_stock: number;
  total_in: number;
  total_out: number;
  current_stock: number;
}

export default function Materials() {
  const { project } = useProject();
  const [materials, setMaterials] = useState<MaterialStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [newMaterial, setNewMaterial] = useState({
    name: '',
    category: '',
    unit: '',
    min_stock: 0,
    notes: ''
  });

  const fetchMaterials = async () => {
    if (!supabase || !project) return;
    try {
      const { data, error } = await supabase
        .from('material_stock')
        .select('*')
        .eq('project_id', project.id);
      
      if (error) throw error;
      setMaterials(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, [project]);

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !project) return;
    
    try {
      const { error } = await supabase.from('materials').insert([{
        ...newMaterial,
        project_id: project.id
      }]);
      if (error) throw error;
      
      setShowAddModal(false);
      setNewMaterial({ name: '', category: '', unit: '', min_stock: 0, notes: '' });
      fetchMaterials();
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء الإضافة');
    }
  };

  const filtered = materials.filter(m => m.name.includes(search));

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">المواد والمخزون</h2>
          <p className="mt-1 text-sm text-gray-500">إدارة كتالوج المواد والاطلاع على رصيد المخزون الحالي.</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Plus size={20} />
            إضافة مادة جديدة
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <div className="absolute inset-y-0 right-0 flex items-center pe-3 pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full rounded-md border-gray-300 py-2 ps-10 pe-3 text-sm focus:border-blue-500 focus:ring-blue-500 shadow-sm border"
          placeholder="ابحث عن مادة..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {loading ? (
            <li className="px-4 py-8 text-center text-gray-500">جاري التحميل...</li>
          ) : filtered.length === 0 ? (
            <li className="px-4 py-8 text-center text-gray-500">لا توجد مواد مطابقة.</li>
          ) : (
            filtered.map((item) => {
              const isLowStock = item.current_stock <= item.min_stock;
              const isOutOfStock = item.current_stock <= 0;

              return (
                <li key={item.material_id}>
                  <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Package2 className="text-gray-400 h-6 w-6" />
                        <p className="text-sm font-medium text-blue-600 truncate">{item.name}</p>
                      </div>
                      <div className="ms-2 flex-shrink-0 flex">
                        <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          isOutOfStock ? 'bg-red-100 text-red-800' :
                          isLowStock ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {isOutOfStock ? 'نفد' : isLowStock ? 'منخفض' : 'متوفر'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex sm:gap-6 text-sm text-gray-500">
                        <p>الرصيد الحالي: <span className="font-bold text-gray-900">{item.current_stock} {item.unit}</span></p>
                        <p className="mt-2 sm:mt-0">إجمالي الداخل: {item.total_in}</p>
                        <p className="mt-2 sm:mt-0">إجمالي الصرف: {item.total_out}</p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                        الحد الأدنى: {item.min_stock}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowAddModal(false)}></div>
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle">&#8203;</span>
            <div className="inline-block transform overflow-hidden rounded-lg bg-white text-right align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
              <form onSubmit={handleAddMaterial}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">إضافة مادة جديدة</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">اسم المادة</label>
                      <input type="text" required value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})}
                        className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">التصنيف</label>
                      <input type="text" value={newMaterial.category} onChange={e => setNewMaterial({...newMaterial, category: e.target.value})}
                        className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">الوحدة</label>
                        <input type="text" required placeholder="كيس، طن، حبة" value={newMaterial.unit} onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})}
                          className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">الحد الأدنى للتنبيه</label>
                        <input type="number" min="0" required value={newMaterial.min_stock} onChange={e => setNewMaterial({...newMaterial, min_stock: Number(e.target.value)})}
                          className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">ملاحظات</label>
                      <textarea rows={3} value={newMaterial.notes} onChange={e => setNewMaterial({...newMaterial, notes: e.target.value})}
                        className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"></textarea>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <button type="submit" className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 sm:ms-3 sm:w-auto sm:text-sm">
                    حفظ المادة
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
