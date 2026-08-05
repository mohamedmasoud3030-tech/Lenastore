import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { Plus, ShoppingCart, Eye } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Purchases() {
  const { project } = useProject();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchPurchases = async () => {
    if (!supabase || !project) return;
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('*, suppliers(name), payments(amount)')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPurchases(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [project]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(val);
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">المشتريات</h2>
          <p className="mt-1 text-sm text-gray-500">إدارة أوامر وعمليات الشراء من الموردين.</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link
            to="/purchases/new"
            className="inline-flex items-center gap-2 justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={20} />
            شراء جديد
          </Link>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <ul className="divide-y divide-gray-200">
          {loading ? (
            <li className="px-4 py-8 text-center text-gray-500">جاري التحميل...</li>
          ) : purchases.length === 0 ? (
            <li className="px-4 py-8 text-center text-gray-500">لا توجد عمليات شراء.</li>
          ) : (
            purchases.map((purchase) => {
              const totalPaid = purchase.payments?.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0) || 0;
              const isPaid = totalPaid >= purchase.total;
              const isPartialPaid = totalPaid > 0 && totalPaid < purchase.total;

              return (
                <li key={purchase.id} className="hover:bg-gray-50">
                  <Link to={`/purchases/${purchase.id}`} className="block px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShoppingCart className="text-gray-400 h-6 w-6" />
                        <div>
                          <p className="text-sm font-bold text-blue-600">{purchase.purchase_number}</p>
                          <p className="text-xs text-gray-500">{purchase.suppliers?.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          purchase.receipt_status === 'FULL' ? 'bg-green-100 text-green-800' :
                          purchase.receipt_status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {purchase.receipt_status === 'FULL' ? 'مستلم' : purchase.receipt_status === 'PARTIAL' ? 'مستلم جزئياً' : 'غير مستلم'}
                        </p>
                        <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          isPaid ? 'bg-green-100 text-green-800' :
                          isPartialPaid ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {isPaid ? 'مدفوع' : isPartialPaid ? 'مدفوع جزئياً' : 'غير مدفوع'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex sm:gap-6 text-sm text-gray-500">
                        <p>الإجمالي: <span className="font-bold text-gray-900">{formatCurrency(purchase.total)}</span></p>
                        <p>المدفوع: <span className="text-green-600">{formatCurrency(totalPaid)}</span></p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                        التاريخ: {purchase.date}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
