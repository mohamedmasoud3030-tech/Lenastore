import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { Package2, ArrowRightLeft, ShoppingCart, Users, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const { project } = useProject();
  const [stats, setStats] = useState({
    totalPurchases: 0,
    totalPaid: 0,
    lowStock: 0,
    openRequests: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);

  useEffect(() => {
    if (!supabase || !project) return;

    const fetchDashboard = async () => {
      try {
        // Since we don't have all views locally without setup, we will use basic queries.
        // For actual robust stats, Supabase Views (like the ones in schema.sql) are better.
        // Here we'll do simple queries.

        const [purchasesRes, paymentsRes, materialsRes, movementsRes] = await Promise.all([
          supabase.from('purchases').select('total').eq('project_id', project.id),
          supabase.from('payments').select('amount').eq('project_id', project.id),
          supabase.from('material_stock').select('*').eq('project_id', project.id),
          supabase.from('stock_movements')
            .select('*, materials(name, unit)')
            .eq('project_id', project.id)
            .order('created_at', { ascending: false })
            .limit(5)
        ]);

        const totalPurchases = purchasesRes.data?.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0) || 0;
        const totalPaid = paymentsRes.data?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0;
        
        const lowStockCount = materialsRes.data?.filter(m => (m.current_stock || 0) <= (m.min_stock || 0)).length || 0;

        setStats({
          totalPurchases,
          totalPaid,
          lowStock: lowStockCount,
          openRequests: 0 // Mock for now, would count from purchase_requests
        });

        if (movementsRes.data) {
          setRecentMovements(movementsRes.data);
        }

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [project]);

  if (loading) {
    return <div className="flex justify-center p-8">جاري التحميل...</div>;
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(val);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">نظرة عامة</h2>
        <p className="mt-1 text-sm text-gray-500">ملخص حالة المشروع الإنشائي.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Stat Cards */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ShoppingCart className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ms-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">إجمالي المشتريات</dt>
                  <dd className="text-lg font-bold text-gray-900">{formatCurrency(stats.totalPurchases)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-6 w-6 text-green-400" />
              </div>
              <div className="ms-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">المدفوع للموردين</dt>
                  <dd className="text-lg font-bold text-gray-900">{formatCurrency(stats.totalPaid)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <div className="ms-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">المتبقي</dt>
                  <dd className="text-lg font-bold text-red-600">{formatCurrency(stats.totalPurchases - stats.totalPaid)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Package2 className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="ms-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">مواد ناقصة أو منخفضة</dt>
                  <dd className="text-lg font-bold text-gray-900">{stats.lowStock}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">آخر حركات المخزون</h3>
        </div>
        <ul className="divide-y divide-gray-200">
          {recentMovements.length === 0 ? (
            <li className="px-4 py-5 sm:px-6 text-center text-sm text-gray-500">لا توجد حركات بعد</li>
          ) : (
            recentMovements.map((movement) => (
              <li key={movement.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={movement.type === 'IN' ? 'text-green-500' : 'text-orange-500'}>
                      {movement.type === 'IN' ? 'دخول (+)' : 'صرف (-)'}
                    </span>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {movement.materials?.name}
                    </p>
                  </div>
                  <div className="ms-2 flex-shrink-0 flex">
                    <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      {movement.quantity} {movement.materials?.unit}
                    </p>
                  </div>
                </div>
                <div className="mt-2 sm:flex sm:justify-between">
                  <div className="sm:flex">
                    <p className="flex items-center text-sm text-gray-500">
                      {movement.date}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                    {movement.type === 'OUT' ? `إلى: ${movement.location_used}` : `مرجع: ${movement.reference_number || 'بدون'}`}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
