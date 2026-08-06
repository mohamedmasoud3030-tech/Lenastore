import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Ban,
  ClipboardCheck,
  History,
  RefreshCw,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { parseSupabaseError } from '../lib/supabaseErrors';
import { formatCurrency, formatDate } from '../lib/formatters';
import { useToast } from './common/ToastProvider';
import { PageHeader } from './common/PageHeader';
import { ErrorState } from './common/ErrorState';
import { LoadingSkeleton } from './common/LoadingSkeleton';

type Tab = 'actions' | 'returns' | 'audit';

type PurchaseRelation = { purchase_number: string };
type MaterialRelation = { name: string; unit: string };

interface PaymentRow {
  id: string;
  amount: number | string;
  date: string;
  method: string;
  reference_number: string | null;
  purchases: PurchaseRelation | PurchaseRelation[] | null;
}

interface ReceiptRow {
  id: string;
  receipt_number: string;
  date: string;
  purchases: PurchaseRelation | PurchaseRelation[] | null;
}

interface IssueRow {
  id: string;
  issue_number: string;
  date: string;
  receiver_name: string;
  destination: string | null;
}

interface RequestRow {
  id: string;
  request_number: string;
  date: string;
  reason: string | null;
}

interface PurchaseItemRow {
  id: string;
  received_quantity: number | string;
  unit_price: number | string;
  materials: MaterialRelation | MaterialRelation[] | null;
}

interface PurchaseRow {
  id: string;
  purchase_number: string;
  date: string;
  total: number | string;
  purchase_items: PurchaseItemRow[] | null;
}

interface ReturnRow {
  id: string;
  return_number: string;
  date: string;
  total: number | string;
  reason: string;
  purchases: PurchaseRelation | PurchaseRelation[] | null;
}

interface AuditRow {
  id: string;
  event_type: string;
  entity_type: string;
  reason: string | null;
  created_at: string;
}

interface Attempt {
  key: string;
  reason: string;
}

interface CorrectionItem {
  id: string;
  title: string;
  subtitle: string;
  action: string;
  rpc: string;
  prompt: string;
  payload: (attempt: Attempt) => Record<string, unknown>;
  success: string;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function attemptKey(prefix: string): string {
  const token =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${token}`;
}

function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    PAYMENT_REVERSED: 'عكس دفعة مورد',
    GOODS_RECEIPT_CANCELLED: 'إلغاء سند استلام',
    STOCK_ISSUE_CANCELLED: 'إلغاء سند صرف',
    PURCHASE_RETURN_CREATED: 'إنشاء مرتجع مورد',
    PURCHASE_REQUEST_CANCELLED: 'إلغاء طلب شراء',
    PURCHASE_CANCELLED: 'إلغاء أمر شراء',
  };
  return labels[type] || type.replaceAll('_', ' ');
}

export default function AuditAndCorrections() {
  const { project } = useProject();
  const toast = useToast();
  const attempts = useRef<Record<string, Attempt>>({});
  const [tab, setTab] = useState<Tab>('actions');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [returnKey, setReturnKey] = useState(() => attemptKey('return'));
  const [returnForm, setReturnForm] = useState({
    purchase_id: '',
    purchase_item_id: '',
    quantity: '',
    reason: '',
    return_number: `RET-${Date.now().toString().slice(-6)}`,
  });

  const currency = project?.currency || 'EGP';
  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    if (!supabase || !project) return;
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all([
        supabase
          .from('payments')
          .select('id,amount,date,method,reference_number,purchases(purchase_number)')
          .eq('project_id', project.id)
          .eq('status', 'POSTED')
          .order('date', { ascending: false }),
        supabase
          .from('goods_receipts')
          .select('id,receipt_number,date,purchases(purchase_number)')
          .eq('project_id', project.id)
          .eq('status', 'COMPLETED')
          .order('date', { ascending: false }),
        supabase
          .from('stock_issues')
          .select('id,issue_number,date,receiver_name,destination')
          .eq('project_id', project.id)
          .eq('status', 'COMPLETED')
          .order('date', { ascending: false }),
        supabase
          .from('purchase_requests')
          .select('id,request_number,date,reason')
          .eq('project_id', project.id)
          .in('status', ['DRAFT', 'REQUESTED', 'PURCHASING'])
          .order('date', { ascending: false }),
        supabase
          .from('purchases')
          .select('id,purchase_number,date,total,purchase_items(id,received_quantity,unit_price,materials(name,unit))')
          .eq('project_id', project.id)
          .eq('status', 'ACTIVE')
          .order('date', { ascending: false }),
        supabase
          .from('purchase_returns')
          .select('id,return_number,date,total,reason,purchases(purchase_number)')
          .eq('project_id', project.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('audit_events')
          .select('id,event_type,entity_type,reason,created_at')
          .eq('project_id', project.id)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      const failed = results.find((result) => result.error)?.error;
      if (failed) throw failed;

      setPayments((results[0].data as unknown as PaymentRow[]) || []);
      setReceipts((results[1].data as unknown as ReceiptRow[]) || []);
      setIssues((results[2].data as unknown as IssueRow[]) || []);
      setRequests((results[3].data as unknown as RequestRow[]) || []);
      setPurchases((results[4].data as unknown as PurchaseRow[]) || []);
      setReturns((results[5].data as unknown as ReturnRow[]) || []);
      setAudit((results[6].data as unknown as AuditRow[]) || []);
    } catch (loadError) {
      console.error(loadError);
      setError(parseSupabaseError(loadError, 'تعذر تحميل مركز التدقيق والتصحيحات'));
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedPurchase = useMemo(
    () => purchases.find((purchase) => purchase.id === returnForm.purchase_id) || null,
    [purchases, returnForm.purchase_id]
  );
  const selectedItem = useMemo(
    () => selectedPurchase?.purchase_items?.find((item) => item.id === returnForm.purchase_item_id) || null,
    [selectedPurchase, returnForm.purchase_item_id]
  );

  const actionGroups = useMemo(() => {
    if (!project) return [];

    const paymentItems: CorrectionItem[] = payments.map((payment) => ({
      id: `payment-${payment.id}`,
      title: `${one(payment.purchases)?.purchase_number || 'أمر شراء'} • ${formatCurrency(Number(payment.amount), currency)}`,
      subtitle: `${formatDate(payment.date)} • ${payment.method}${payment.reference_number ? ` • ${payment.reference_number}` : ''}`,
      action: 'عكس الدفعة',
      rpc: 'reverse_payment',
      prompt: 'اكتب سبب عكس الدفعة (إلزامي):',
      payload: (attempt) => ({
        p_project_id: project.id,
        p_payment_id: payment.id,
        p_reason: attempt.reason,
        p_idempotency_key: attempt.key,
      }),
      success: 'تم عكس الدفعة وإعادة احتساب رصيد المورد',
    }));

    const receiptItems: CorrectionItem[] = receipts.map((receipt) => ({
      id: `receipt-${receipt.id}`,
      title: `${receipt.receipt_number} • ${one(receipt.purchases)?.purchase_number || 'أمر شراء'}`,
      subtitle: formatDate(receipt.date),
      action: 'إلغاء الاستلام',
      rpc: 'cancel_goods_receipt',
      prompt: 'اكتب سبب إلغاء سند الاستلام (إلزامي):',
      payload: (attempt) => ({
        p_project_id: project.id,
        p_receipt_id: receipt.id,
        p_reversal_date: today,
        p_reason: attempt.reason,
        p_idempotency_key: attempt.key,
      }),
      success: 'تم إلغاء الاستلام وعكس حركة المخزون',
    }));

    const issueItems: CorrectionItem[] = issues.map((issue) => ({
      id: `issue-${issue.id}`,
      title: `${issue.issue_number} • ${issue.receiver_name}`,
      subtitle: `${formatDate(issue.date)}${issue.destination ? ` • ${issue.destination}` : ''}`,
      action: 'إلغاء الصرف',
      rpc: 'cancel_stock_issue',
      prompt: 'اكتب سبب إلغاء سند الصرف (إلزامي):',
      payload: (attempt) => ({
        p_project_id: project.id,
        p_issue_id: issue.id,
        p_reversal_date: today,
        p_reason: attempt.reason,
        p_idempotency_key: attempt.key,
      }),
      success: 'تم إلغاء سند الصرف وإعادة الكمية للمخزون',
    }));

    const requestItems: CorrectionItem[] = requests.map((request) => ({
      id: `request-${request.id}`,
      title: request.request_number,
      subtitle: `${formatDate(request.date)}${request.reason ? ` • ${request.reason}` : ''}`,
      action: 'إلغاء الطلب',
      rpc: 'cancel_purchase_request',
      prompt: 'اكتب سبب إلغاء طلب الشراء (إلزامي):',
      payload: (attempt) => ({
        p_project_id: project.id,
        p_request_id: request.id,
        p_reason: attempt.reason,
        p_idempotency_key: attempt.key,
      }),
      success: 'تم إلغاء طلب الشراء',
    }));

    const purchaseItems: CorrectionItem[] = purchases.map((purchase) => ({
      id: `purchase-${purchase.id}`,
      title: `${purchase.purchase_number} • ${formatCurrency(Number(purchase.total), currency)}`,
      subtitle: formatDate(purchase.date),
      action: 'إلغاء أمر الشراء',
      rpc: 'cancel_purchase',
      prompt: 'اكتب سبب إلغاء أمر الشراء (إلزامي):',
      payload: (attempt) => ({
        p_project_id: project.id,
        p_purchase_id: purchase.id,
        p_reason: attempt.reason,
        p_idempotency_key: attempt.key,
      }),
      success: 'تم إلغاء أمر الشراء',
    }));

    return [
      { title: 'دفعات الموردين', note: 'العكس يحفظ الدفعة الأصلية ويزيل أثرها من الرصيد.', icon: <Undo2 className="h-5 w-5" />, items: paymentItems },
      { title: 'سندات الاستلام', note: 'يُرفض الإلغاء إذا كانت الكمية قد صُرفت أو أُعيدت.', icon: <ArrowDownToLine className="h-5 w-5" />, items: receiptItems },
      { title: 'سندات الصرف', note: 'الإلغاء ينشئ حركة إدخال مرتبطة بالسند الأصلي.', icon: <Undo2 className="h-5 w-5" />, items: issueItems },
      { title: 'طلبات الشراء', note: 'لا يُلغى الطلب بعد تحويله إلى أمر شراء.', icon: <Ban className="h-5 w-5" />, items: requestItems },
      { title: 'أوامر الشراء', note: 'تُرفض العملية عند وجود دفع أو استلام أو مرتجع فعّال.', icon: <Ban className="h-5 w-5" />, items: purchaseItems },
    ];
  }, [currency, issues, payments, project, purchases, receipts, requests, today]);

  const runAction = async (item: CorrectionItem) => {
    if (!supabase) return;
    let attempt = attempts.current[item.id];
    if (!attempt) {
      const reason = window.prompt(item.prompt)?.trim();
      if (!reason) return;
      attempt = { key: attemptKey(item.id), reason };
      attempts.current[item.id] = attempt;
    }

    setBusy(item.id);
    try {
      const { error: rpcError } = await supabase.rpc(item.rpc, item.payload(attempt));
      if (rpcError) throw rpcError;
      delete attempts.current[item.id];
      toast.success(item.success);
      await load();
    } catch (actionError) {
      toast.error(parseSupabaseError(actionError, 'تعذر تنفيذ التصحيح'));
    } finally {
      setBusy(null);
    }
  };

  const submitReturn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !project || !selectedPurchase || !selectedItem) return;
    const quantity = Number(returnForm.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('كمية المرتجع يجب أن تكون أكبر من صفر');
      return;
    }
    if (quantity > Number(selectedItem.received_quantity || 0)) {
      toast.error('كمية المرتجع أكبر من الكمية المستلمة');
      return;
    }
    if (!returnForm.reason.trim()) {
      toast.error('سبب المرتجع إلزامي');
      return;
    }

    setBusy('return');
    try {
      const { error: rpcError } = await supabase.rpc('create_purchase_return', {
        p_project_id: project.id,
        p_purchase_id: selectedPurchase.id,
        p_return_number: returnForm.return_number.trim(),
        p_return_date: today,
        p_reason: returnForm.reason.trim(),
        p_items: [{ purchase_item_id: selectedItem.id, quantity }],
        p_idempotency_key: returnKey,
      });
      if (rpcError) throw rpcError;
      toast.success('تم إنشاء المرتجع وعكس المخزون والمستحق');
      setReturnForm({
        purchase_id: '',
        purchase_item_id: '',
        quantity: '',
        reason: '',
        return_number: `RET-${Date.now().toString().slice(-6)}`,
      });
      setReturnKey(attemptKey('return'));
      await load();
    } catch (returnError) {
      toast.error(parseSupabaseError(returnError, 'تعذر إنشاء مرتجع المورد'));
    } finally {
      setBusy(null);
    }
  };

  if (loading && audit.length === 0) return <LoadingSkeleton rows={7} />;
  if (error && audit.length === 0) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="التدقيق والتصحيحات"
        description="تصحيح العمليات بمستندات عكسية مع الاحتفاظ بالأصل والسبب والتوقيت."
        icon={ShieldCheck}
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> تحديث
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        {([
          ['actions', 'التصحيحات', Undo2],
          ['returns', 'المرتجعات', ArrowUpFromLine],
          ['audit', 'سجل التدقيق', History],
        ] as const).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black ${
              tab === value
                ? 'bg-slate-950 text-white dark:bg-amber-400 dark:text-slate-950'
                : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'actions' && (
        <div className="grid gap-5 xl:grid-cols-2">
          {actionGroups.map((group) => (
            <section key={group.title} className="rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex gap-3 border-b border-slate-200 p-5 dark:border-slate-800">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {group.icon}
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">{group.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{group.note}</p>
                </div>
              </div>
              <div className="space-y-3 p-4">
                {group.items.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">لا توجد سجلات قابلة للتصحيح.</p>
                ) : (
                  group.items.map((item) => (
                    <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-slate-900 dark:text-slate-100">{item.title}</p>
                        <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                      </div>
                      <button
                        type="button"
                        disabled={busy === item.id}
                        onClick={() => void runAction(item)}
                        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-950/30 dark:text-rose-300"
                      >
                        <Undo2 className="h-4 w-4" /> {busy === item.id ? 'جاري التنفيذ...' : item.action}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === 'returns' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.7fr)]">
          <form onSubmit={submitReturn} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">إنشاء مرتجع مورد</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                يخفض المخزون وصافي المستحق في معاملة واحدة، ويُرفض عند كسر رصيد المخزون أو المدفوعات.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="أمر الشراء">
                <select
                  required
                  value={returnForm.purchase_id}
                  onChange={(event) =>
                    setReturnForm((previous) => ({ ...previous, purchase_id: event.target.value, purchase_item_id: '', quantity: '' }))
                  }
                  className="control"
                >
                  <option value="">اختر أمر الشراء...</option>
                  {purchases.map((purchase) => (
                    <option key={purchase.id} value={purchase.id}>
                      {purchase.purchase_number} — {formatCurrency(Number(purchase.total), currency)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="بند المادة">
                <select
                  required
                  disabled={!selectedPurchase}
                  value={returnForm.purchase_item_id}
                  onChange={(event) => setReturnForm((previous) => ({ ...previous, purchase_item_id: event.target.value, quantity: '' }))}
                  className="control"
                >
                  <option value="">اختر البند...</option>
                  {(selectedPurchase?.purchase_items || []).map((item) => {
                    const material = one(item.materials);
                    return (
                      <option key={item.id} value={item.id}>
                        {material?.name || 'مادة'} — مستلم {Number(item.received_quantity)} {material?.unit || ''}
                      </option>
                    );
                  })}
                </select>
              </Field>
              <Field label="رقم المرتجع">
                <input
                  required
                  value={returnForm.return_number}
                  onChange={(event) => setReturnForm((previous) => ({ ...previous, return_number: event.target.value }))}
                  className="control"
                />
              </Field>
              <Field label="الكمية">
                <input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={returnForm.quantity}
                  onChange={(event) => setReturnForm((previous) => ({ ...previous, quantity: event.target.value }))}
                  className="control"
                />
              </Field>
            </div>
            <Field label="سبب المرتجع">
              <textarea
                required
                rows={3}
                value={returnForm.reason}
                onChange={(event) => setReturnForm((previous) => ({ ...previous, reason: event.target.value }))}
                className="control"
                placeholder="تلف، عدم مطابقة، أو سبب آخر"
              />
            </Field>
            {selectedItem && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                المستلم: <strong>{Number(selectedItem.received_quantity)}</strong> — سعر الوحدة: <strong>{formatCurrency(Number(selectedItem.unit_price), currency)}</strong>
              </p>
            )}
            <button
              type="submit"
              disabled={busy === 'return'}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 text-xs font-black text-slate-950 hover:bg-amber-300 disabled:opacity-50"
            >
              <ArrowUpFromLine className="h-4 w-4" /> {busy === 'return' ? 'جاري الإنشاء...' : 'إنشاء المرتجع وعكس الأثر'}
            </button>
          </form>

          <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex gap-3 border-b border-slate-200 p-5 dark:border-slate-800">
              <ClipboardCheck className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">المرتجعات المسجلة</h3>
            </div>
            <div className="space-y-3 p-4">
              {returns.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">لا توجد مرتجعات.</p>
              ) : (
                returns.map((purchaseReturn) => (
                  <div key={purchaseReturn.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-slate-100">{purchaseReturn.return_number}</p>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {one(purchaseReturn.purchases)?.purchase_number || 'أمر شراء'} • {formatDate(purchaseReturn.date)}
                        </p>
                      </div>
                      <strong className="text-xs text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(Number(purchaseReturn.total), currency)}
                      </strong>
                    </div>
                    <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">{purchaseReturn.reason}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {tab === 'audit' && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">آخر 100 عملية تصحيح</h3>
          </div>
          {audit.length === 0 ? (
            <p className="p-10 text-center text-xs text-slate-500">لا توجد عمليات تصحيح مسجلة.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {audit.map((event) => (
                <div key={event.id} className="grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <History className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-slate-100">{eventLabel(event.event_type)}</p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{event.reason || 'بدون سبب'} • {event.entity_type}</p>
                  </div>
                  <time className="text-[11px] text-slate-400" dateTime={event.created_at}>
                    {new Date(event.created_at).toLocaleString('ar-EG')}
                  </time>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <style>{`
        .control { width: 100%; border-radius: .75rem; border: 1px solid rgb(203 213 225); background: white; padding: .625rem .75rem; font-size: .75rem; color: rgb(15 23 42); outline: none; }
        .control:focus { border-color: rgb(14 165 233); box-shadow: 0 0 0 2px rgb(14 165 233 / .2); }
        .control:disabled { opacity: .55; }
        .dark .control { border-color: rgb(51 65 85); background: rgb(15 23 42); color: rgb(226 232 240); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}
