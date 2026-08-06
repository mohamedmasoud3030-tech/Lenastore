import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { MaterialStock, StockMovement } from '../types';
import { StatusBadge } from './common/StatusBadge';
import { formatDate } from '../lib/formatters';
import { X, Package2, ArrowDownToLine, ArrowUpFromLine, Calendar, AlertTriangle } from 'lucide-react';

interface MaterialDetailsDrawerProps {
  material: MaterialStock | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (mat: MaterialStock) => void;
}

export const MaterialDetailsDrawer: React.FC<MaterialDetailsDrawerProps> = ({
  material,
  isOpen,
  onClose,
  onEdit,
}) => {
  const { project } = useProject();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !material || !project || !supabase) return;
    const fetchMaterialHistory = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('stock_movements')
          .select('*, suppliers(name), purchases(purchase_number)')
          .eq('project_id', project.id)
          .eq('material_id', material.material_id)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false });

        if (!error && data) {
          setMovements(data as any);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    void fetchMaterialHistory();
  }, [isOpen, material, project]);

  if (!isOpen || !material) return null;

  const isLowStock = material.current_stock <= material.min_stock && material.current_stock > 0;
  const isOutOfStock = material.current_stock <= 0;
  const badgeVariant = isOutOfStock ? 'out_of_stock' : isLowStock ? 'low' : 'available';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 left-0 max-w-full flex">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-r border-slate-200">
          {/* Header */}
          <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-800 rounded-xl text-sky-400">
                <Package2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{material.name}</h2>
                <p className="text-xs text-slate-400">{material.category || 'بدون تصنيف'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats Bar */}
          <div className="p-6 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-4">
            <div className="p-3.5 bg-white rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium">الرصيد الحالي</span>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {material.current_stock} <span className="text-xs font-normal text-slate-500">{material.unit}</span>
              </div>
              <div className="mt-2">
                <StatusBadge variant={badgeVariant} />
              </div>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium">الحد الأدنى</span>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {material.min_stock} <span className="text-xs font-normal text-slate-500">{material.unit}</span>
              </div>
              {isLowStock && (
                <div className="mt-2 flex items-center gap-1 text-xs text-amber-700 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> تحذير انخفاض الرصيد
                </div>
              )}
            </div>

            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
              <span className="text-xs text-emerald-800 font-medium">إجمالي الوارد</span>
              <div className="text-base font-bold text-emerald-950 mt-0.5">
                +{material.total_in} {material.unit}
              </div>
            </div>

            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
              <span className="text-xs text-amber-800 font-medium">إجمالي المنصرف</span>
              <div className="text-base font-bold text-amber-950 mt-0.5">
                -{material.total_out} {material.unit}
              </div>
            </div>
          </div>

          {/* History Ledger */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">سجل حركات المادة</h3>
              <span className="text-xs text-slate-500">{movements.length} حركة</span>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-500">جاري تحميل السجل...</div>
            ) : movements.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">لا توجد حركات سابقة لهذه المادة</div>
            ) : (
              <div className="space-y-3">
                {movements.map((mov) => (
                  <div key={mov.id} className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {mov.type === 'IN' ? (
                          <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                            <ArrowDownToLine className="w-4 h-4" />
                          </span>
                        ) : (
                          <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                            <ArrowUpFromLine className="w-4 h-4" />
                          </span>
                        )}
                        <div>
                          <span className="text-xs font-bold text-slate-900">
                            {mov.type === 'IN' ? 'وارد مخزني' : 'صرف مخزني'}
                          </span>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {formatDate(mov.date)}
                          </div>
                        </div>
                      </div>
                      <span className={`text-sm font-bold ${mov.type === 'IN' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {mov.type === 'IN' ? '+' : '-'}{mov.quantity} {material.unit}
                      </span>
                    </div>

                    {(mov.receiver_name || mov.location_used || mov.suppliers?.name || mov.reference_number) && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600 space-y-0.5">
                        {mov.receiver_name && <div>المستلم: <span className="font-semibold text-slate-800">{mov.receiver_name}</span></div>}
                        {mov.location_used && <div>الجهة / الموقع: <span className="font-semibold text-slate-800">{mov.location_used}</span></div>}
                        {mov.suppliers?.name && <div>المورد: <span className="font-semibold text-slate-800">{mov.suppliers.name}</span></div>}
                        {mov.reference_number && <div>المرجع: <span className="font-semibold text-slate-800" dir="ltr">{mov.reference_number}</span></div>}
                        {mov.notes && <div className="text-slate-500 italic">"{mov.notes}"</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer actions */}
          {onEdit && (
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => {
                  onClose();
                  onEdit(material);
                }}
                className="w-full py-2.5 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs"
              >
                تعديل بيانات المادة
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
