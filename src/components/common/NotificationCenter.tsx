import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, CheckCircle2, Clock, Package, ShoppingCart, X } from 'lucide-react';
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

interface MaterialStockRow {
  material_id: string;
  name: string;
  current_stock: number | string | null;
  min_stock: number | string | null;
  unit: string | null;
}

interface PurchaseRequestRow {
  id: string;
  request_number: string;
  date: string | null;
}

interface PurchaseRow {
  id: string;
  purchase_number: string;
  receipt_status: string | null;
}

interface PurchaseBalanceRow {
  purchase_id: string;
  payment_status: string | null;
}

export default function NotificationCenter() {
  const { project } = useProject();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!project) {
      setAlerts([]);
      return;
    }

    let cancelled = false;

    const fetchAlerts = async () => {
      setLoading(true);
      setLoadFailed(false);

      try {
        const [materialsRes, requestsRes, purchasesRes, balancesRes] = await Promise.all([
          supabase
            .from('material_stock')
            .select('material_id,name,current_stock,min_stock,unit')
            .eq('project_id', project.id),
          supabase
            .from('purchase_requests')
            .select('id,request_number,date,status')
            .eq('project_id', project.id)
            .not('status', 'in', '(PURCHASED,CANCELLED)'),
          supabase
            .from('purchases')
            .select('id,purchase_number,receipt_status')
            .eq('project_id', project.id),
          supabase
            .from('purchase_balances')
            .select('purchase_id,payment_status')
            .eq('project_id', project.id),
        ]);

        const queryError = materialsRes.error ?? requestsRes.error ?? purchasesRes.error ?? balancesRes.error;
        if (queryError) throw queryError;

        const materials = (materialsRes.data ?? []) as MaterialStockRow[];
        const requests = (requestsRes.data ?? []) as PurchaseRequestRow[];
        const purchases = (purchasesRes.data ?? []) as PurchaseRow[];
        const balances = (balancesRes.data ?? []) as PurchaseBalanceRow[];
        const paymentStatusByPurchase = new Map(
          balances.map((balance) => [balance.purchase_id, balance.payment_status])
        );
        const items: AlertItem[] = [];

        materials.forEach((material) => {
          if (Number(material.current_stock ?? 0) <= Number(material.min_stock ?? 0)) {
            items.push({
              id: `stock-${material.material_id}`,
              type: 'stock',
              title: `تنبيه رصيد منخفض: ${material.name}`,
              description: `الرصيد الحالي (${material.current_stock ?? 0} ${material.unit ?? ''}) عند أو أقل من حد الطلب (${material.min_stock ?? 0} ${material.unit ?? ''}).`,
              severity: 'high',
              link: '/materials',
              timestamp: 'الآن',
            });
          }
        });

        requests.forEach((request) => {
          items.push({
            id: `req-${request.id}`,
            type: 'request',
            title: `طلب شراء بانتظار الشراء: ${request.request_number}`,
            description: 'الطلب مفتوح ويحتاج متابعة إنشاء أمر الشراء والتوريد.',
            severity: 'medium',
            link: `/requests/${request.id}`,
            timestamp: request.date || 'اليوم',
          });
        });

        purchases.forEach((purchase) => {
          if (purchase.receipt_status !== 'FULL') {
            items.push({
              id: `receipt-${purchase.id}`,
              type: 'receipt',
              title: `استلام غير مكتمل: ${purchase.purchase_number}`,
              description: `حالة الاستلام (${purchase.receipt_status === 'PARTIAL' ? 'جزئي' : 'لم يستلم'}).`,
              severity: 'medium',
              link: `/purchases/${purchase.id}`,
              timestamp: 'معلق',
            });
          }

          const paymentStatus = paymentStatusByPurchase.get(purchase.id);
          if (paymentStatus === 'UNPAID' || paymentStatus === 'PARTIAL') {
            items.push({
              id: `pay-${purchase.id}`,
              type: 'payment',
              title: `مستحقات معلقة: ${purchase.purchase_number}`,
              description: `حالة السداد للمورد (${paymentStatus === 'PARTIAL' ? 'سداد جزئي' : 'غير مسدد'}).`,
              severity: 'info',
              link: `/purchases/${purchase.id}`,
              timestamp: 'مستحق',
            });
          }
        });

        if (!cancelled) setAlerts(items);
      } catch (error) {
        console.error('Notification queries failed', error);
        if (!cancelled) {
          setAlerts([]);
          setLoadFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchAlerts();
    return () => {
      cancelled = true;
    };
  }, [project]);

  const activeAlerts = alerts.filter((alert) => !dismissedIds.includes(alert.id));

  const handleDismiss = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setDismissedIds((current) => [...current, id]);
  };

  const severityStyle = (severity: AlertItem['severity']) => {
    if (severity === 'high') {
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400';
    }
    if (severity === 'medium') {
      return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400';
    }
    return 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-400';
  };

  const alertIcon = (type: AlertItem['type']) => {
    if (type === 'stock') return <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />;
    if (type === 'request') return <Clock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />;
    if (type === 'receipt') return <Package className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />;
    return <ShoppingCart className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />;
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="relative grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        aria-label="فتح التنبيهات والتذكيرات التشغيلية"
        aria-expanded={isOpen}
      >
        <Bell size={18} aria-hidden="true" />
        {activeAlerts.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white shadow-xs">
            {activeAlerts.length}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setIsOpen(false)}
            aria-label="إغلاق التنبيهات"
          />
          <section className="absolute left-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
            <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" aria-hidden="true" />
                <h3 className="text-xs font-black">التنبيهات والتذكيرات ({activeAlerts.length})</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="إغلاق"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </header>

            <div className="max-h-96 space-y-1 overflow-y-auto p-2">
              {loading ? (
                <div className="p-6 text-center text-xs text-slate-400">جاري فحص التنبيهات...</div>
              ) : loadFailed ? (
                <div role="alert" className="p-6 text-center text-xs font-semibold text-red-600 dark:text-red-400">
                  تعذر تحميل التنبيهات من قاعدة البيانات.
                </div>
              ) : activeAlerts.length === 0 ? (
                <div className="space-y-2 p-8 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" aria-hidden="true" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">لا توجد تنبيهات حرجة حاليًا</p>
                  <p className="text-[11px] text-slate-400">المخزون والطلبات والمدفوعات في حالة مستقرة.</p>
                </div>
              ) : (
                activeAlerts.map((alert) => (
                  <Link
                    key={alert.id}
                    to={alert.link}
                    onClick={() => setIsOpen(false)}
                    className={`group block rounded-xl border p-3 text-xs transition-all hover:shadow-xs ${severityStyle(alert.severity)}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2.5">
                        {alertIcon(alert.type)}
                        <div className="min-w-0">
                          <p className="font-bold">{alert.title}</p>
                          <p className="mt-1 text-[11px] leading-relaxed opacity-90">{alert.description}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => handleDismiss(alert.id, event)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                        aria-label={`تجاهل التنبيه: ${alert.title}`}
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
