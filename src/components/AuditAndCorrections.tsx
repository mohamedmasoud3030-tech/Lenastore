import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Ban,
  ClipboardCheck,
  History,
  RefreshCw,
  RotateCcw,
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

interface PurchaseRelation {
  purchase_number: string;
}

interface PaymentRow {
  id: string;
  purchase_id: string;
  amount: number | string;
  date: string;
  method: string;
  reference_number: string | null;
  status: 'POSTED' | 'REVERSED';
  purchases: PurchaseRelation | PurchaseRelation[] | null;
}

interface ReceiptRow {
  id: string;
  purchase_id: string;
  receipt_number: string;
  date: string;
  status: 'COMPLETED' | 'CANCELLED';
  purchases: PurchaseRelation | PurchaseRelation[] | null;
}

interface IssueRow {
  id: string;
  issue_number: string;
  date: string;
  receiver_name: string;
  destination: string | null;
  status: 'COMPLETED' | 'CANCELLED';
}

interface RequestRow {
  id: string;
  request_number: string;
  date: string;
  reason: string | null;
  status: string;
}

interface PurchaseItemRelation {
  id: string;
  material_id: string;
  quantity: number | string;
  received_quantity: number | string;
  unit_price: number | string;
  materials: { name: string; unit: string } | { name: string; unit: string }[] | null;
}

interface PurchaseRow {
  id: string;
  purchase_number: string;
  date: string;
  total: number | string;
  status: 'ACTIVE' | 'CANCELLED';
  purchase_items: PurchaseItemRelation[] | null;
}

interface ReturnRow {
  id: string;
  return_number: string;
  date: string;
  total: number | string;
  reason: string;
  status: string;
  purchases: PurchaseRelation | PurchaseRelation[] | null;
}

interface AuditEventRow {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  reason: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface PendingAttempt {
  key: string;
  reason: string;
}

type WorkspaceTab = 'actions' | 'returns' | 'audit';

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function createAttemptKey(prefix: string): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomPart}`;
}

function eventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    PAYMENT_REVERSED: 'عكس دفعة مورد',
    GOODS_RECEIPT_CANCELLED: 'إلغاء سند استلام',
    STOCK_ISSUE_CANCELLED: 'إلغاء سند صرف',
    PURCHASE_RETURN_CREATED: 'إنشاء مرتجع مورد',
    PURCHASE_REQUEST_CANCELLED: 'إلغاء طلب شراء',
    PURCHASE_CANCELLED: 'إلغاء أمر شراء',
  };
  return labels[eventType] || eventType.replaceAll('_', ' ');
}

export default function AuditAndCorrections() {
  const { project } = useProject();
  const toast = useToast();
  const [tab, setTab] = useState<WorkspaceTab>('actions');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventRow[]>([]);
  const attemptsRef = useRef<Record<string, PendingAttempt>>({});

  const [returnForm, setReturnForm] = useState({
    purchase_id: '',
    purchase_item_id: '',
    quantity: '',
    reason: '',
    return_number: `RET-${Date.now().toString().slice(-6)}`,
  });
  const [returnAttemptKey, setReturnAttemptKey] = useState(() => createAttemptKey('return'));

  const currency = project?.currency || 'EGP';

  const fetchData = useCallback(async () => {
    if (!supabase || !project) return;
    setLoading(true);
    setError(null);

    try {
      const [paymentResult, receiptResult, issueResult, requestResult, purchaseResult, returnResult, auditResult] =
        await Promise.all([
          supabase
            .from('payments')
            .select('id,purchase_id,amount,date,method,reference_number,status,purchases(purchase_number)')
            .eq('project_id', project.id)
            .eq('status', 'POSTED')
            .order('date', { ascending: false }),
          supabase
            .from('goods_receipts')
            .select('id,purchase_id,receipt_number,date,status,purchases(purchase_number)')
            .eq('project_id', project.id)
            .eq('status', 'COMPLETED')
            .order('date', { ascending: false }),
          supabase
            .from('stock_issues')
            .select('id,issue_number,date,receiver_name,destination,status')
            .eq('project_id', project.id)
            .eq('status', 'COMPLETED')
            .order('date', { ascending: false }),
          supabase
            .from('purchase_requests')
            .select('id,request_number,date,reason,status')
            .eq('project_id', project.id)
            .in('status', ['DRAFT', 'REQUESTED', 'PURCHASING'])
            .order('date', { ascending: false }),
          supabase
            .from('purchases')
            .select('id,purchase_number,date,total,status,purchase_items(id,material_id,quantity,received_quantity,unit_price,materials(name,unit))')
            .eq('project_id', project.id)
            .eq('status', 'ACTIVE')
            .order('date', { ascending: false }),
          supabase
            .from('purchase_returns')
            .select('id,return_number,date,total,reason,status,purchases(purchase_number)')
            .eq('project_id', project.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('audit_events')
            .select('id,event_type,entity_type,entity_id,reason,payload,created_at')
            .eq('project_id', project.id)
            .order('created_at', { ascending: false })
            .limit(100),
        ]);

      const results = [
        paymentResult,
        receiptResult,
        issueResult,
        requestResult,
        purchaseResult,
        returnResult,
        auditResult,
      ];
      const firstError = results.find((result) => result.error)?.error;
      if (firstError) throw firstError;

      setPayments((paymentResult.data as unknown as PaymentRow[]) || []);
      setReceipts((receiptResult.data as unknown as ReceiptRow[]) || []);
      setIssues((issueResult.data as unknown as IssueRow[]) || []);
      setRequests((requestResult.data as unknown as RequestRow[]) || []);
      setPurchases((purchaseResult.data as unknown as PurchaseRow[]) || []);
      setReturns((returnResult.data as unknown as ReturnRow[]) || []);
      setAuditEvents((auditResult.data as unknown as AuditEventRow[]) || []);
    } catch (fetchError) {
      console.error(fetchError);
      setError(parseSupabaseError(fetchError, 'تعذر تحميل مركز التدقيق والتصحيحات'));
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const selectedPurchase = useMemo(
    () => purchases.find((purchase) => purchase.id === returnForm.purchase_id) || null,
    [purchases, returnForm.purchase_id]
  );

  const selectedPurchaseItem = useMemo(
    () => selectedPurchase?.purchase_items?.find((item) => item.id === returnForm.purchase_item_id) || null,
    [selectedPurchase, returnForm.purchase_item_id]
  );

  const requestReason = (actionKey: string, promptLabel: string): PendingAttempt | null => {
    const existing = attemptsRef.current[actionKey];
    if (existing) return existing;

    const reason = window.prompt(promptLabel)?.trim();
    if (!reason) return null;
    const attempt = { key: createAttemptKey(actionKey), reason };
    attemptsRef.current[actionKey] = attempt;
    return attempt;
  };

  const runCorrection = async (
    actionKey: string,
    promptLabel: string,
    rpcName: string,
    buildPayload: (attempt: PendingAttempt) => Record<string, unknown>,
    successMessage: string
  ) => {
    if (!supabase) return;
    const attempt = requestReason(actionKey, promptLabel);
    if (!attempt) return;

    setSubmitting(actionKey);
    try {
      const { error: rpcError } = await supabase.rpc(rpcName, buildPayload(attempt));
      if (rpcError) throw rpcError;
      delete attemptsRef.current[actionKey];
      toast.success(successMessage);
      await fetchData();
    } catch (actionError) {
      toast.error(parseSupabaseError(actionError, 'تعذر تنفيذ التصحيح'));
    } finally {
      setSubmitting(null);
    }
  };

  const handleReturn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !project || !selectedPurchase || !selectedPurchaseItem) return;

    const quantity = Number(returnForm.quantity);
    const receivedQuantity = Number(selectedPurchaseItem.received_quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('كمية المرتجع يجب أن تكون أكبر من صفر');
      return;
    }
    if (quantity > receivedQuantity) {
      toast.error('كمية المرتجع أكبر من الكمية المستلمة لهذا البند');
      return;
    }
    if (!returnForm.reason.trim()) {
      toast.error('سبب المرتجع إلزامي');
      return;
    }

    setSubmitting('purchase-return');
    try {
      const { error: rpcError } = await supabase.rpc('create_purchase_return', {
        p_project_id: project.id,
        p_purchase_id: selectedPurchase.id,
        p_return_number: returnForm.return_number.trim(),
        p_return_date: new Date().toISOString().split('T')[0],
        p_reason: returnForm.reason.trim(),
        p_items: [{ purchase_item_id: selectedPurchaseItem.id, quantity }],
        p_idempotency_key: returnAttemptKey,
      });
      if (rpcError) throw rpcError;

      toast.success('تم إنشاء مرتجع المورد وعكس المخزون والمستحق تلقائيًا');
      setReturnForm({
        purchase_id: '',
        purchase_item_id: '',
        quantity: '',
        reason: '',
        return_number: `RET-${Date.now().toString().slice(-6)}`,
      });
      setReturnAttemptKey(createAttemptKey('return'));
      await fetchData();
    } catch (returnError) {
      toast.error(parseSupabaseError(returnError, 'تعذر إنشاء مرتجع المورد'));
    } finally {
      setSubmitting(null);
    }
  };

  if (loading && auditEvents.length === 0) {
    return <LoadingSkeleton rows={7} />;
  }

  if (error && auditEvents.length === 0) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="التدقيق والتصحيحات"
        description="تصحيح العمليات بالمستندات العكسية مع الاحتفاظ بالأصل وسجل كامل لمن نفّذ ومتى ولماذا."
        icon={ShieldCheck}
        actions={
          <button
            type="button"
            onClick={() => void fetchData()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> تحديث
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        {([
          ['actions', 'عمليات التصحيح', Undo2],
          ['returns', 'مرتجعات المورد', ArrowUpFromLine],
          ['audit', 'سجل التدقيق', History],
        ] as const).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black transition ${
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
          <CorrectionSection
            title="دفعات الموردين القابلة للعكس"
            description="العكس لا يحذف الدفعة؛ يوقف أثرها في الرصيد ويحفظ سبب التصحيح."
            icon={<RotateCcw className="h-5 w-5" />}
            empty={payments.length === 0}
          >
            {payments.map((payment) => {
              const purchase = one(payment.purchases);
              const actionKey = `payment-${payment.id}`;
              return (
                <CorrectionRow
                  key={payment.id}
                  title={`${purchase?.purchase_number || 'أمر شراء'} • ${formatCurrency(Number(payment.amount), currency)}`}
                  subtitle={`${formatDate(payment.date)} • ${payment.method}${payment.reference_number ? ` • ${payment.reference_number}` : ''}`}
                  actionLabel="عكس الدفعة"
                  danger
                  busy={submitting === actionKey}
                  onAction={() =>
                    void runCorrection(
                      actionKey,
                      'اكتب سبب عكس الدفعة (إلزامي):',
                      'reverse_payment',
                      (attempt) => ({
                        p_project_id: project?.id,
                        p_payment_id: payment.id,
                        p_reason: attempt.reason,
                        p_idempotency_key: attempt.key,
                      }),
                      'تم عكس الدفعة وإعادة احتساب رصيد المورد'
                    )
                  }
                />
              );
            })}
          </CorrectionSection>

          <CorrectionSection
            title="سندات الاستلام القابلة للإلغاء"
            description="لن يُلغى الاستلام إذا كانت كمياته قد صُرفت أو أُعيدت للمورد."
            icon={<ArrowDownToLine className="h-5 w-5" />}
            empty={receipts.length === 0}
          >
            {receipts.map((receipt) => {
              const purchase = one(receipt.purchases);
              const actionKey = `receipt-${receipt.id}`;
              return (
                <CorrectionRow
                  key={receipt.id}
                  title={`${receipt.receipt_number} • ${purchase?.purchase_number || 'أمر شراء'}`}
                  subtitle={formatDate(receipt.date)}
                  actionLabel="إلغاء الاستلام"
                  danger
                  busy={submitting === actionKey}
                  onAction={() =>
                    void runCorrection(
                      actionKey,
                      'اكتب سبب إلغاء سند الاستلام (إلزامي):',
                      'cancel_goods_receipt',
                      (attempt) => ({
                        p_project_id: project?.id,
                        p_receipt_id: receipt.id,
                        p_reversal_date: today,
                        p_reason: attempt.reason,
                        p_idempotency_key: attempt.key,
                      }),
                      'تم إلغاء الاستلام وعكس حركة المخزون'
                    )
                  }
                />
              );
            })}
          </CorrectionSection>

          <CorrectionSection
            title="سندات الصرف القابلة للإلغاء"
            description="يُنشئ الإلغاء حركة إدخال مقابلة مرتبطة بالسند الأصلي."
            icon={<Undo2 className="h-5 w-5" />}
            empty={issues.length === 0}
          >
            {issues.map((issue) => {
              const actionKey = `issue-${issue.id}`;
              return (
                <CorrectionRow
                  key={issue.id}
                  title={`${issue.issue_number} • ${issue.receiver_name}`}
                  subtitle={`${formatDate(issue.date)}${issue.destination ? ` • ${issue.destination}` : ''}`}
                  actionLabel="إلغاء الصرف"
                  danger
                  busy={submitting === actionKey}
                  onAction={() =>
                    void runCorrection(
                      actionKey,
                      'اكتب سبب إلغاء سند الصرف (إلزامي):',
                      'cancel_stock_issue',
                      (attempt) => ({
                        p_project_id: project?.id,
                        p_issue_id: issue.id,
                        p_reversal_date: today,
                        p_reason: attempt.reason,
                        p_idempotency_key: attempt.key,
                      }),
                      'تم إلغاء سند الصرف وإعادة الكمية للمخزون'
                    )
                  }
                />
              );
            })}
          </CorrectionSection>

          <CorrectionSection
            title="طلبات شراء غير محوّلة"
            description="يمكن إلغاء الطلب فقط قبل تحويله إلى أمر شراء."
            icon={<Ban className="h-5 w-5" />}
            empty={requests.length === 0}
          >
            {requests.map((request) => {
              const actionKey = `request-${request.id}`;
              return (
                <CorrectionRow
                  key={request.id}
                  title={request.request_number}
                  subtitle={`${formatDate(request.date)}${request.reason ? ` • ${request.reason}` : ''}`}
                  actionLabel="إلغاء الطلب"
                  danger
                  busy={submitting === actionKey}
                  onAction={() =>
                    void runCorrection(
                      actionKey,
                      'اكتب سبب إلغاء طلب الشراء (إلزامي):',
                      'cancel_purchase_request',
                      (attempt) => ({
                        p_project_id: project?.id,
                        p_request_id: request.id,
                        p_reason: attempt.reason,
                        p_idempotency_key: attempt.key,
                      }),
                      'تم إلغاء طلب الشراء'
                    )
                  }
                />
              );
            })}
          </CorrectionSection>

          <CorrectionSection
            title="أوامر الشراء القابلة للإلغاء"
            description="قاعدة البيانات سترفض الإلغاء عند وجود استلام أو دفعة أو مرتجع فعّال."
            icon={<AlertTriangle className="h-5 w-5" />}
            empty={purchases.length === 0}
          >
            {purchases.map((purchase) => {
              const actionKey = `purchase-${purchase.id}`;
              return (
                <CorrectionRow
                  key={purchase.id}
                  title={`${purchase.purchase_number} • ${formatCurrency(Number(purchase.total), currency)}`}
                  subtitle={formatDate(purchase.date)}
                  actionLabel="إلغاء أمر الشراء"
                  danger
                  busy={submitting === actionKey}
                  onAction={() =>
                    void runCorrection(
                      actionKey,
                      'اكتب سبب إلغاء أمر الشراء (إلزامي):',
                      'cancel_purchase',
                      (attempt) => ({
                        p_project_id: project?.id,
                        p_purchase_id: purchase.id,
                        p_reason: attempt.reason,
                        p_idempotency_key: attempt.key,
                      }),
                      'تم إلغاء أمر الشراء'
                    )
                  }
                />
              );
            })}
          </CorrectionSection>
        </div>
      )}

      {tab === 'returns' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)]">
          <form
            onSubmit={handleReturn}
            className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">إنشاء مرتجع مورد</h3>
              <p className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">
                يخفض المخزون والمستحق للمورد في معاملة واحدة. سيُرفض إذا كانت الكمية غير متاحة أو المدفوع أكبر من المستحق بعد المرتجع.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="أمر الشراء">
                <select
                  required
                  value={returnForm.purchase_id}
                  onChange={(event) =>
                    setReturnForm((previous) => ({
                      ...previous,
                      purchase_id: event.target.value,
                      purchase_item_id: '',
                      quantity: '',
                    }))
                  }
                  className="input-control"
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
                  value={returnForm.purchase_item_id}
                  onChange={(event) =>
                    setReturnForm((previous) => ({ ...previous, purchase_item_id: event.target.value, quantity: '' }))
                  }
                  className="input-control"
                  disabled={!selectedPurchase}
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
                  className="input-control"
                />
              </Field>

              <Field label="الكمية المرتجعة">
                <input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={returnForm.quantity}
                  onChange={(event) => setReturnForm((previous) => ({ ...previous, quantity: event.target.value }))}
                  className="input-control"
                />
              </Field>
            </div>

            <Field label="سبب المرتجع">
              <textarea
                required
                rows={3}
                value={returnForm.reason}
                onChange={(event) => setReturnForm((previous) => ({ ...previous, reason: event.target.value }))}
                className="input-control"
                placeholder="مثال: تلف بالموقع أو عدم مطابقة المواصفات"
              />
            </Field>

            {selectedPurchaseItem && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                الحد الأقصى الظاهر من الكمية المستلمة: <strong>{Number(selectedPurchaseItem.received_quantity)}</strong>. السعر المرجعي للوحدة:{' '}
                <strong>{formatCurrency(Number(selectedPurchaseItem.unit_price), currency)}</strong>.
              </div>
            )}

            <button
              type="submit"
              disabled={submitting === 'purchase-return'}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-xs font-black text-slate-950 hover:bg-amber-300 disabled:opacity-50"
            >
              <ArrowUpFromLine className="h-4 w-4" />
              {submitting === 'purchase-return' ? 'جاري إنشاء المرتجع...' : 'إنشاء المرتجع وعكس الأثر'}
            </button>
          </form>

          <CorrectionSection
            title="المرتجعات المسجلة"
            description="كل مرتجع مرتبط بأمر الشراء ويخفض صافي المستحق للمورد."
            icon={<ClipboardCheck className="h-5 w-5" />}
            empty={returns.length === 0}
          >
            {returns.map((purchaseReturn) => {
              const purchase = one(purchaseReturn.purchases);
              return (
                <div key={purchaseReturn.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-slate-100">{purchaseReturn.return_number}</p>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {purchase?.purchase_number || 'أمر شراء'} • {formatDate(purchaseReturn.date)}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {formatCurrency(Number(purchaseReturn.total), currency)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-300">{purchaseReturn.reason}</p>
                </div>
              );
            })}
          </CorrectionSection>
        </div>
      )}

      {tab === 'audit' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">سجل التدقيق غير القابل للحذف من الواجهة</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">آخر 100 عملية تصحيح مرتبة من الأحدث.</p>
          </div>
          {auditEvents.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">لا توجد عمليات تصحيح مسجلة بعد.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {auditEvents.map((auditEvent) => (
                <div key={auditEvent.id} className="grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <History className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-slate-100">{eventLabel(auditEvent.event_type)}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                      {auditEvent.reason || 'بدون سبب مسجل'} • {auditEvent.entity_type}
                    </p>
                  </div>
                  <time className="text-[11px] font-semibold text-slate-400" dateTime={auditEvent.created_at}>
                    {new Date(auditEvent.created_at).toLocaleString('ar-EG')}
                  </time>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        .input-control {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(203 213 225);
          background: white;
          padding: 0.625rem 0.75rem;
          font-size: 0.75rem;
          color: rgb(15 23 42);
          outline: none;
        }
        .input-control:focus { box-shadow: 0 0 0 2px rgb(14 165 233 / 0.25); border-color: rgb(14 165 233); }
        .dark .input-control { border-color: rgb(51 65 85); background: rgb(15 23 42); color: rgb(226 232 240); }
        .input-control:disabled { opacity: 0.55; }
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

function CorrectionSection({
  title,
  description,
  icon,
  empty,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3 border-b border-slate-200 p-5 dark:border-slate-800">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {icon}
        </span>
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        {empty ? <p className="py-6 text-center text-xs text-slate-500">لا توجد سجلات قابلة للتصحيح هنا.</p> : children}
      </div>
    </section>
  );
}

function CorrectionRow({
  title,
  subtitle,
  actionLabel,
  danger,
  busy,
  onAction,
}: {
  title: string;
  subtitle: string;
  actionLabel: string;
  danger?: boolean;
  busy: boolean;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
      <div className="min-w-0">
        <p className="truncate text-xs font-black text-slate-900 dark:text-slate-100">{title}</p>
        <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        disabled={busy}
        className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition disabled:opacity-50 ${
          danger
            ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-300'
            : 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/30 dark:text-sky-300'
        }`}
      >
        <Undo2 className="h-4 w-4" /> {busy ? 'جاري التنفيذ...' : actionLabel}
      </button>
    </div>
  );
}
