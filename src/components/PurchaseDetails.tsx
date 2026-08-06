import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { useParams, useNavigate } from 'react-router-dom';
import { Purchase, PurchaseItem, Payment, GoodsReceipt } from '../types';
import { parseSupabaseError } from '../lib/supabaseErrors';
import { useToast } from './common/ToastProvider';
import { StatusBadge } from './common/StatusBadge';
import { LoadingSkeleton } from './common/LoadingSkeleton';
import { ErrorState } from './common/ErrorState';
import { formatCurrency, formatDate } from '../lib/formatters';
import Attachments from './Attachments';
import {
  ArrowRight,
  PackageCheck,
  Banknote,
  FileText,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  X,
  History,
  AlertTriangle,
} from 'lucide-react';

export default function PurchaseDetails() {
  const { id } = useParams<{ id: string }>();
  const { project } = useProject();
  const navigate = useNavigate();
  const toast = useToast();

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [submittingReceipt, setSubmittingReceipt] = useState(false);

  const [receiptForm, setReceiptForm] = useState<
    { id: string; material_id: string; max_qty: number; receive_qty: string }[]
  >([]);

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    method: 'TRANSFER' as 'CASH' | 'TRANSFER' | 'CHEQUE' | 'OTHER',
    reference_number: '',
    notes: '',
  });

  const currency = project?.currency || 'SAR';

  const fetchData = useCallback(async () => {
    if (!supabase || !project || !id) return;
    setLoading(true);
    setError(null);

    try {
      const [purRes, itemsRes, payRes, grRes] = await Promise.all([
        supabase.from('purchases').select('*, suppliers(name, company, phone)').eq('id', id).eq('project_id', project.id).single(),
        supabase.from('purchase_items').select('*, materials(name, unit)').eq('purchase_id', id),
        supabase.from('payments').select('*').eq('purchase_id', id).order('date', { ascending: false }),
        supabase.from('goods_receipts').select('*, goods_receipt_items(*, materials(name, unit))').eq('purchase_id', id).order('date', { ascending: false }),
      ]);

      if (purRes.error) throw purRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (payRes.error) throw payRes.error;

      setPurchase(purRes.data as Purchase);
      setItems((itemsRes.data as any) || []);
      setPayments((payRes.data as any) || []);
      setGoodsReceipts((grRes.data as any) || []);

      setReceiptForm(
        (itemsRes.data || []).map((i: any) => {
          const max = Math.max(0, Number(i.quantity) - Number(i.received_quantity || 0));
          return {
            id: i.id,
            material_id: i.material_id,
            max_qty: max,
            receive_qty: String(max),
          };
        })
      );
    } catch (err: any) {
      console.error(err);
      setError(parseSupabaseError(err, 'حدث خطأ أثناء تحميل بيانات امر الشراء'));
    } finally {
      setLoading(false);
    }
  }, [id, project]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <ErrorState message={error || 'لم يتم العثور على أمر الشراء'} onRetry={fetchData} />
      </div>
    );
  }

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const remaining = Math.max(0, Number(purchase.total) - totalPaid);
  const isFullyPaid = remaining <= 0;

  // Add Payment handler with register_payment RPC
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !project) return;

    const amount = Number(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('مبلغ الدفعة يجب أن يكون أكبر من صفر');
      return;
    }
    if (amount > remaining) {
      toast.error(`لا يمكن أن يتجاوز مبلغ الدفعة المبلغ المتبقي (${formatCurrency(remaining, currency)})`);
      return;
    }

    setSubmittingPayment(true);

    try {
      const { error: payErr } = await supabase.rpc('register_payment', {
        p_project_id: project.id,
        p_purchase_id: purchase.id,
        p_amount: amount,
        p_date: paymentForm.date,
        p_method: paymentForm.method,
        p_reference_number: paymentForm.reference_number.trim() || null,
        p_notes: paymentForm.notes.trim() || null,
      });

      if (payErr) {
        toast.error(parseSupabaseError(payErr, 'حدث خطأ أثناء حفظ الدفعة'));
        return;
      }

      toast.success(`تم تسجيل دفعة بقيمة ${formatCurrency(amount, currency)} بنجاح`);
      setShowPaymentModal(false);
      setPaymentForm({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        method: 'TRANSFER',
        reference_number: '',
        notes: '',
      });
      void fetchData();
    } catch (err: any) {
      toast.error(parseSupabaseError(err));
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Receive Items handler with receive_goods RPC
  const handleReceiveItems = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !project) return;

    const validItemsToReceive = receiptForm
      .map((r) => ({
        purchase_item_id: r.id,
        quantity: Number(r.receive_qty) || 0,
        max_qty: r.max_qty,
      }))
      .filter((r) => r.quantity > 0);

    if (validItemsToReceive.length === 0) {
      toast.error('يرجى تحديد كميات استلام أكبر من صفر');
      return;
    }

    for (const item of validItemsToReceive) {
      if (item.quantity > item.max_qty) {
        toast.error('إحدى الكميات المدخلة تتجاوز المتبقي للطلب');
        return;
      }
    }

    setSubmittingReceipt(true);
    const receiptDate = new Date().toISOString().split('T')[0];
    const receiptRef = `GR-${purchase.purchase_number.replace('PO-', '')}-${Date.now().toString().slice(-4)}`;
    const idempotencyKey = `rec-${purchase.id}-${Date.now()}`;

    const payloadItems = validItemsToReceive.map((item) => ({
      purchase_item_id: item.purchase_item_id,
      quantity: item.quantity,
    }));

    try {
      const { error: grErr } = await supabase.rpc('receive_goods', {
        p_project_id: project.id,
        p_purchase_id: purchase.id,
        p_receipt_number: receiptRef,
        p_receipt_date: receiptDate,
        p_notes: 'استلام مواد موقعي',
        p_items: payloadItems,
        p_idempotency_key: idempotencyKey,
      });

      if (grErr) {
        toast.error(parseSupabaseError(grErr, 'حدث خطأ أثناء تسجيل استلام المواد'));
        return;
      }

      toast.success(`تم إثبات استلام المواد بنجاح (سند: ${receiptRef})`);
      setShowReceiptModal(false);
      void fetchData();
    } catch (err: any) {
      toast.error(parseSupabaseError(err));
    } finally {
      setSubmittingReceipt(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900" dir="ltr">
                {purchase.purchase_number}
              </h1>
              <StatusBadge variant={purchase.receipt_status} />
              <StatusBadge variant={isFullyPaid ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid'} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              المورد: <span className="font-bold text-slate-800">{purchase.suppliers?.name}</span> • تاريخ أمر الشراء: {formatDate(purchase.date)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {purchase.receipt_status !== 'FULL' && (
            <button
              onClick={() => setShowReceiptModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
            >
              <PackageCheck className="w-4 h-4" /> تسجيل استلام مواد
            </button>
          )}

          {!isFullyPaid && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-xs"
            >
              <Banknote className="w-4 h-4" /> تسجيل دفعة جديدة
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Items & Financial breakdown) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">بنود أوردر الشراء ونسب الاستلام</h3>
              <span className="text-xs text-slate-500">{items.length} بنود</span>
            </div>

            <div className="divide-y divide-slate-100">
              {items.map((item) => {
                const isItemFull = Number(item.received_quantity || 0) >= Number(item.quantity);
                return (
                  <div key={item.id} className="p-4 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{item.materials?.name || 'مادة'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        الكمية المطلوبة: <span className="font-semibold text-slate-800">{item.quantity} {item.materials?.unit}</span> × سعر الوحدة: {formatCurrency(item.unit_price, currency)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold">
                        <span className={isItemFull ? 'text-emerald-700' : 'text-amber-700'}>
                          تم استلام: {item.received_quantity || 0} من {item.quantity} {item.materials?.unit}
                        </span>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-sm font-bold text-slate-900">{formatCurrency(item.total, currency)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Financial breakdown */}
            <div className="bg-slate-50 p-5 border-t border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">المجموع الفرعي:</span>
                <span className="font-bold text-slate-900">{formatCurrency(purchase.subtotal, currency)}</span>
              </div>
              {purchase.discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>الخصم:</span>
                  <span>-{formatCurrency(purchase.discount, currency)}</span>
                </div>
              )}
              {purchase.tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">الضريبة:</span>
                  <span>+{formatCurrency(purchase.tax, currency)}</span>
                </div>
              )}
              {purchase.transport_cost > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">مصاريف نقل وتفريغ:</span>
                  <span>+{formatCurrency(purchase.transport_cost, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>الإجمالي النهائي:</span>
                <span className="text-sky-700">{formatCurrency(purchase.total, currency)}</span>
              </div>
            </div>
          </div>

          {/* Goods Receipt History Timeline */}
          {goodsReceipts.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-600" /> سجل سندات الاستلام المقترنة
              </h3>

              <div className="space-y-3">
                {goodsReceipts.map((gr) => (
                  <div key={gr.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900" dir="ltr">{gr.receipt_number}</span>
                      <span className="text-slate-500">{formatDate(gr.date)}</span>
                    </div>

                    <div className="space-y-1 pt-1 border-t border-slate-200/60">
                      {gr.goods_receipt_items?.map((gri) => (
                        <div key={gri.id} className="flex justify-between text-slate-700">
                          <span>{gri.materials?.name}:</span>
                          <span className="font-bold text-emerald-700">+{gri.received_quantity} {gri.materials?.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments Section */}
          <Attachments entityType="PURCHASE" entityId={purchase.id} />
        </div>

        {/* Right Column (Supplier Details & Payments Ledger) */}
        <div className="space-y-6">
          {/* Supplier Info */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-500" /> بيانات المورد
            </h3>
            <div>
              <p className="font-bold text-slate-900 text-sm">{purchase.suppliers?.name}</p>
              {purchase.suppliers?.company && <p className="text-xs text-slate-500 mt-0.5">{purchase.suppliers.company}</p>}
              {purchase.suppliers?.phone && (
                <p className="text-xs text-slate-600 mt-1" dir="ltr">
                  هاتف: {purchase.suppliers.phone}
                </p>
              )}
            </div>
          </div>

          {/* Financial Balances & Payments */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">سجل المدفوعات</h3>
              {!isFullyPaid && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="text-xs font-bold text-sky-600 hover:text-sky-700"
                >
                  + إضافة دفعة
                </button>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">المبلغ المتبقي:</span>
              <span className={`font-bold text-sm ${isFullyPaid ? 'text-emerald-700' : 'text-rose-600'}`}>
                {formatCurrency(remaining, currency)}
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {payments.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">لا توجد دفعات مسجلة لهذا الأمر</div>
              ) : (
                payments.map((pay) => (
                  <div key={pay.id} className="p-4 space-y-1 text-xs hover:bg-slate-50/80 transition-colors">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-emerald-700 text-sm">
                        {formatCurrency(pay.amount, currency)}
                      </span>
                      <span className="text-slate-400">{formatDate(pay.date)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500">
                      <span>
                        {pay.method === 'CASH'
                          ? 'نقدي'
                          : pay.method === 'TRANSFER'
                          ? 'تحويل بنكي'
                          : pay.method === 'CHEQUE'
                          ? 'شيك'
                          : 'أخرى'}
                      </span>
                      {pay.reference_number && <span dir="ltr">مرجع: {pay.reference_number}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Receiving Items */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={() => setShowReceiptModal(false)} />
            <div className="relative transform overflow-hidden rounded-2xl bg-white text-right shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl border border-slate-200">
              <form onSubmit={handleReceiveItems}>
                <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PackageCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-base font-bold">تسجيل استلام مواد بالمستودع</h3>
                  </div>
                  <button type="button" onClick={() => setShowReceiptModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-right text-xs border border-slate-200 rounded-xl overflow-hidden">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3">اسم المادة</th>
                        <th className="p-3 text-center">المطلوب</th>
                        <th className="p-3 text-center">المستلم سابقاً</th>
                        <th className="p-3 text-center">الكمية المستلمة الآن</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item) => {
                        const rFormItem = receiptForm.find((r) => r.id === item.id);
                        if (!rFormItem || rFormItem.max_qty <= 0) return null;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-900">{item.materials?.name}</td>
                            <td className="p-3 text-center text-slate-600">{item.quantity} {item.materials?.unit}</td>
                            <td className="p-3 text-center text-emerald-700 font-bold">{item.received_quantity || 0}</td>
                            <td className="p-3 text-center w-36">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={rFormItem.max_qty}
                                value={rFormItem.receive_qty}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setReceiptForm((prev) =>
                                    prev.map((p) => (p.id === item.id ? { ...p, receive_qty: val } : p))
                                  );
                                }}
                                className="w-full px-2 py-1 text-center border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50 px-6 py-4 flex flex-row-reverse gap-3 border-t border-slate-200">
                  <button
                    type="submit"
                    disabled={submittingReceipt}
                    className="px-5 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50"
                  >
                    {submittingReceipt ? 'جاري الاستلام الذري...' : 'تأكيد وحفظ الاستلام'}
                  </button>
                  <button
                    type="button"
                    disabled={submittingReceipt}
                    onClick={() => setShowReceiptModal(false)}
                    className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shadow-xs"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Adding Payment */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={() => setShowPaymentModal(false)} />
            <div className="relative transform overflow-hidden rounded-2xl bg-white text-right shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-slate-200">
              <form onSubmit={handleAddPayment}>
                <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-sky-400" />
                    <h3 className="text-base font-bold">تسجيل دفعة جديدة للمورد</h3>
                  </div>
                  <button type="button" onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4 text-xs">
                  <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex justify-between items-center text-sky-950 font-medium">
                    <span>المبلغ المتبقي للسداد:</span>
                    <span className="font-bold text-sm">{formatCurrency(remaining, currency)}</span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">المبلغ المدفوع *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={remaining}
                      required
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">تاريخ الدفعة *</label>
                    <input
                      type="date"
                      required
                      value={paymentForm.date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">وسيلة الدفع *</label>
                    <select
                      value={paymentForm.method}
                      onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    >
                      <option value="TRANSFER">حوالة بنكية</option>
                      <option value="CASH">نقدي</option>
                      <option value="CHEQUE">شيك</option>
                      <option value="OTHER">طريقة أخرى</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">رقم المرجع / الحوالة</label>
                    <input
                      type="text"
                      placeholder="مثال: REF-99401"
                      value={paymentForm.reference_number}
                      onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 px-6 py-4 flex flex-row-reverse gap-3 border-t border-slate-200">
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="px-5 py-2.5 text-xs font-bold rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-xs disabled:opacity-50"
                  >
                    {submittingPayment ? 'جاري حفظ الدفعة...' : 'حفظ وتأكيد الدفعة'}
                  </button>
                  <button
                    type="button"
                    disabled={submittingPayment}
                    onClick={() => setShowPaymentModal(false)}
                    className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shadow-xs"
                  >
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
