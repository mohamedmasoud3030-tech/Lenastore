import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, CheckCircle2, ChevronLeft, Clock, Package, ShoppingCart, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useProject } from '../../lib/ProjectContext';

export interface AlertItem {
  id: string;
  type: 'stock' | 'request' | 'receipt' | 'payment';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'info';
  link: string;
  timestamp: string;
}

export default function NotificationCenter() {
  const { project } = useProject();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!project) return;

    const fetchAlerts = async () => {
      setLoading(true);
      try {
        const [materialsRes, requestsRes, purchasesRes] = await Promise.all([
          supabase
            .from('material_stock')
            .select('id,name,current_stock,min_stock,unit')
            .eq('project_id', project.id),
          supabase
            .from('purchase_requests')
            .select('id,request_number,date,status')
            .eq('project_id', project.id)
            .not('status', 'in', '(PURCHASED,CANCELLED)'),
          supabase
            .from('purchases')
            .select('id,purchase_number,total,receipt_status,payment_status')
            .eq('project_id', project.id),
        ]);

        const items: AlertItem[] = [];

        // 1. Check Low Stock
        materialsRes.data?.forEach((m) => {
          if (Number(m.current_stock || 0) <= Number(m.min_stock || 0)) {
            items.push({
              id: `stock-${m.id}`,
              type: 'stock',
              title: `تنبيه رصيد منخفض: ${m.name}`,
              description: `الرصيد الحالي (${m.current_stock} ${m.unit}) عند أو أقل من حد الطلب (${m.min_stock} ${m.unit}).`,
              severity: 'high',
              link: '/materials',
              timestamp: 'الآن',
            });
          }
        });

        // 2. Check Open Requests
        requestsRes.data?.forEach((r) => {
          items.push({
            id: `req-${r.id}`,
            type: 'request',
            title: `طلب شراء بانتظار الشراء: ${r.request_number}`,
            description: `تمت الموافقة على الطلب ويحتاج إنشاء أمر شراء وتوريد.`,
            severity: 'medium',
            link: `/requests/${r.id}`,
            timestamp: r.date || 'اليوم',
          });
        });

        // 3. Check Purchases (Unfinished Receipts & Payments)
        purchasesRes.data?.forEach((p) => {
          if (p.receipt_status !== 'FULL') {
            items.push({
              id: `receipt-${p.id}`,
              type: 'receipt',
              title: `استلام غير مكتمل: ${p.purchase_number}`,
              description: `حالة الاستلام (${p.receipt_status === 'PARTIAL' ? 'جزئي' : 'لم يستلم'}).`,
              severity: 'medium',
              link: `/purchases/${p.id}`,
              timestamp: 'معلق',
            });
          }

          if (p.payment_status === 'UNPAID' || p.payment_status === 'PARTIAL') {
            items.push({
              id: `pay-${p.id}`,
              type: 'payment',
              title: `مستحقات معلقة: ${p.purchase_number}`,
              description: `حالة السداد للمورد (${p.payment_status === 'PARTIAL' ? 'سداد جزئي' : 'غير مسدد'}).`,
              severity: 'info',
              link: `/purchases/${p.id}`,
              timestamp: 'مستحق',
            });
          }
        });

        setAlerts(items);
      } catch (err) {
        console.error('Error fetching alerts:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchAlerts();
  }, [project]);

  const activeAlerts = alerts.filter((a) => !dismissedIds.includes(a.id));

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDismissedIds((prev) => [...prev, id]);
  };

  const getSeverityStyle = (severity: AlertItem['severity']) => {
    switch (severity) {
      case 'high':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50';
      case 'medium':
        return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50';
      default:
        return 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900/50';
    }
  };

  const getIcon = (type: AlertItem['type']) => {
    switch (type) {
      case 'stock':
        return <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />;
      case 'request':
        return <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />;
      case 'receipt':
        return <Package className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />;
      case 'payment':
        return <ShoppingCart className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        title="التنبيهات والتذكيرات التشغيلية"
      >
        <Bell size={18} />
        {activeAlerts.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white shadow-xs animate-pulse">
            {activeAlerts.length}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-2 z-50 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-black">التنبيهات والتذكيرات ({activeAlerts.length})</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2 space-y-1">
              {loading ? (
                <div className="p-6 text-center text-xs text-slate-400">جاري فحص التنبيهات...</div>
              ) : activeAlerts.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">لا توجد تنبيهات حرج حالياً</p>
                  <p className="text-[11px] text-slate-400">المخزون والطلبات والمدفوعات في حالة مستقرة.</p>
                </div>
              ) : (
                activeAlerts.map((alert) => (
                  <Link
                    key={alert.id}
                    to={alert.link}
                    onClick={() => setIsOpen(false)}
                    className={`group block p-3 rounded-xl border text-xs transition-all hover:shadow-xs ${getSeverityStyle(alert.severity)}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        {getIcon(alert.type)}
                        <div>
                          <p className="font-bold">{alert.title}</p>
                          <p className="mt-1 text-[11px] opacity-90 leading-relaxed">{alert.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDismiss(alert.id, e)}
                        className="opacity-60 hover:opacity-100 p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
                        title="تجاهل التنبيه"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
