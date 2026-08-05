import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, PackageCheck, Banknote, FileText } from 'lucide-react';

import Attachments from './Attachments';

export default function PurchaseDetails() {
  const { id } = useParams<{ id: string }>();
  const { project } = useProject();
  const navigate = useNavigate();
  
  const [purchase, setPurchase] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  
  const [receiptForm, setReceiptForm] = useState<any[]>([]);

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    method: 'TRANSFER',
    reference_number: '',
    notes: ''
  });

  const fetchData = async () => {
    if (!supabase || !project || !id) return;
    try {
      const [purRes, itemsRes, payRes] = await Promise.all([
        supabase.from('purchases').select('*, suppliers(name, company)').eq('id', id).single(),
        supabase.from('purchase_items').select('*, materials(name, unit)').eq('purchase_id', id),
        supabase.from('payments').select('*').eq('purchase_id', id).order('date', { ascending: false })
      ]);
      setPurchase(purRes.data);
      setItems(itemsRes.data || []);
      setPayments(payRes.data || []);
      
      setReceiptForm(itemsRes.data?.map(i => ({
          id: i.id,
          material_id: i.material_id,
          max_qty: Number(i.quantity) - Number(i.received_quantity || 0),
          receive_qty: Number(i.quantity) - Number(i.received_quantity || 0)
      })) || []);
      
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, project]);

  if (loading) return <div className="p-8 text-center text-gray-500">جاري التحميل...</div>;
  if (!purchase) return <div className="p-8 text-center text-red-500">لم يتم العثور على العملية</div>;

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = purchase.total - totalPaid;
  const isFullyPaid = remaining <= 0;

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !project) return;
    
    const amount = Number(paymentForm.amount);
    if (amount <= 0) {
      alert('مبلغ الدفعة يجب أن يكون أكبر من صفر');
      return;
    }
    if (amount > remaining) {
      alert(`لا يمكن أن يتجاوز مبلغ الدفعة المبلغ المتبقي (${remaining})`);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('register_payment', {
        p_project_id: project.id,
        p_purchase_id: purchase.id,
        p_amount: amount,
        p_date: paymentForm.date,
        p_method: paymentForm.method,
        p_reference_number: paymentForm.reference_number,
        p_notes: paymentForm.notes
      });
      
      if (error) {
          if (error.message.includes('exceeds')) {
              alert('المبلغ يتجاوز الرصيد المتبقي');
          } else {
              throw error;
          }
          return;
      }
      
      setShowPaymentModal(false);
      setPaymentForm({ ...paymentForm, amount: '', reference_number: '', notes: '' });
      fetchData();
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء حفظ الدفعة');
    }
  };

  const handleReceiveItems = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !project) return;
    
    const validItemsToReceive = receiptForm.filter(r => r.receive_qty > 0 && r.receive_qty <= r.max_qty);
    if (validItemsToReceive.length === 0) {
        alert('يرجى تحديد كميات صحيحة للاستلام');
        return;
    }

    try {
      const receiptDate = new Date().toISOString().split('T')[0];
      const receiptRef = `REC-${purchase.purchase_number}-${Date.now().toString().slice(-4)}`;
      const idempotencyKey = `rec-${purchase.id}-${Date.now()}`;
      
      const payloadItems = validItemsToReceive.map(item => ({
          purchase_item_id: item.id,
          quantity: item.receive_qty
      }));

      const { error } = await supabase.rpc('receive_goods', {
          p_project_id: project.id,
          p_purchase_id: purchase.id,
          p_receipt_number: receiptRef,
          p_receipt_date: receiptDate,
          p_notes: 'استلام مواد',
          p_items: payloadItems,
          p_idempotency_key: idempotencyKey
      });

      if (error) {
          if (error.message.includes('Cannot receive more')) {
              alert('لا يمكن استلام كمية أكبر من المتبقية');
          } else {
              throw error;
          }
          return;
      }

      setShowReceiptModal(false);
      fetchData();
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء تسجيل الاستلام');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(val);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-200">
          <ArrowRight size={20} className="text-gray-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            تفاصيل الشراء: <span className="text-blue-600" dir="ltr">{purchase.purchase_number}</span>
          </h2>
          <p className="text-sm text-gray-500">التاريخ: {purchase.date}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Main Info & Items) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">المواد المطلوبة</h3>
              {purchase.receipt_status !== 'FULL' && (
                <button onClick={() => setShowReceiptModal(true)} className="inline-flex items-center gap-2 px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700">
                  <PackageCheck size={16} /> تسجيل استلام
                </button>
              )}
            </div>
            <ul className="divide-y divide-gray-200">
              {items.map((item) => (
                <li key={item.id} className="px-4 py-4 sm:px-6 flex justify-between items-center hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.materials?.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      الكمية: {item.quantity} {item.materials?.unit} × السعر: {formatCurrency(item.unit_price)}
                    </p>
                    <p className="text-xs font-bold text-green-700 mt-1">
                      تم استلام: {item.received_quantity || 0} من {item.quantity}
                    </p>
                  </div>
                  <div className="text-sm font-bold text-gray-900">
                    {formatCurrency(item.total)}
                  </div>
                </li>
              ))}
            </ul>
            <div className="bg-gray-50 px-4 py-4 sm:px-6">
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between"><p>المجموع الفرعي:</p><p>{formatCurrency(purchase.subtotal)}</p></div>
                {purchase.discount > 0 && <div className="flex justify-between text-red-600"><p>الخصم:</p><p>-{formatCurrency(purchase.discount)}</p></div>}
                {purchase.tax > 0 && <div className="flex justify-between"><p>الضريبة:</p><p>{formatCurrency(purchase.tax)}</p></div>}
                {purchase.transport_cost > 0 && <div className="flex justify-between"><p>مصاريف نقل:</p><p>{formatCurrency(purchase.transport_cost)}</p></div>}
                <div className="flex justify-between font-bold text-lg text-gray-900 pt-2 border-t border-gray-200"><p>الإجمالي النهائي:</p><p>{formatCurrency(purchase.total)}</p></div>
              </div>
            </div>
          </div>
          
          <Attachments entityType="PURCHASE" entityId={purchase.id} />
        </div>

        {/* Right Column (Supplier & Payments) */}
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-5">
            <h3 className="text-md font-medium text-gray-900 border-b border-gray-200 pb-3 mb-3">بيانات المورد</h3>
            <p className="font-bold text-gray-800">{purchase.suppliers?.name}</p>
            {purchase.suppliers?.company && <p className="text-sm text-gray-500">{purchase.suppliers.company}</p>}
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-md font-medium text-gray-900">المدفوعات</h3>
              {!isFullyPaid && (
                <button onClick={() => setShowPaymentModal(true)} className="inline-flex items-center gap-1 px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200">
                  <Banknote size={14} /> إضافة دفعة
                </button>
              )}
            </div>
            
            <div className="p-4 bg-gray-50 flex justify-between text-sm border-b border-gray-200">
              <span className="text-gray-500">المتبقي:</span>
              <span className={`font-bold ${isFullyPaid ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(remaining)}
              </span>
            </div>

            <ul className="divide-y divide-gray-200 max-h-60 overflow-y-auto">
              {payments.length === 0 ? (
                <li className="px-4 py-4 text-center text-sm text-gray-500">لا توجد دفعات</li>
              ) : (
                payments.map(pay => (
                  <li key={pay.id} className="px-4 py-3">
                    <div className="flex justify-between">
                      <span className="text-sm font-bold text-green-600">{formatCurrency(pay.amount)}</span>
                      <span className="text-xs text-gray-500">{pay.date}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{pay.method === 'CASH' ? 'نقدي' : pay.method === 'TRANSFER' ? 'تحويل' : 'شيك'} {pay.reference_number && `- ${pay.reference_number}`}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>

      {showReceiptModal && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowReceiptModal(false)}></div>
            <div className="relative transform overflow-hidden rounded-lg bg-white text-right align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:align-middle">
              <form onSubmit={handleReceiveItems}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">تسجيل استلام مواد</h3>
                  <div className="space-y-4">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">المادة</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">المطلوب</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">مستلم سابقاً</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">الكمية المستلمة الآن</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {items.map((item, idx) => {
                                const rFormItem = receiptForm.find(r => r.id === item.id);
                                if (!rFormItem || rFormItem.max_qty <= 0) return null;
                                
                                return (
                                <tr key={item.id}>
                                    <td className="px-3 py-3 text-sm text-gray-900">{item.materials?.name}</td>
                                    <td className="px-3 py-3 text-sm text-center text-gray-500">{item.quantity}</td>
                                    <td className="px-3 py-3 text-sm text-center text-green-600 font-bold">{item.received_quantity || 0}</td>
                                    <td className="px-3 py-3 text-center w-32">
                                        <input type="number" min="0" max={rFormItem.max_qty} step="0.01" 
                                            value={rFormItem.receive_qty}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setReceiptForm(prev => prev.map(p => p.id === item.id ? {...p, receive_qty: val} : p));
                                            }}
                                            className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm text-center focus:border-green-500 focus:outline-none" />
                                    </td>
                                </tr>
                                )
                            })}
                        </tbody>
                    </table>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 flex gap-3 flex-row-reverse">
                  <button type="submit" className="inline-flex w-full justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 sm:w-auto">
                    تأكيد الاستلام
                  </button>
                  <button type="button" onClick={() => setShowReceiptModal(false)} className="inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:w-auto">
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowPaymentModal(false)}></div>
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle">&#8203;</span>
            <div className="inline-block transform overflow-hidden rounded-lg bg-white text-right align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:align-middle">
              <form onSubmit={handleAddPayment}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">تسجيل دفعة جديدة</h3>
                  <div className="space-y-4">
                    <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-800 flex justify-between">
                      <span>المبلغ المتبقي:</span>
                      <span className="font-bold">{remaining.toFixed(2)}</span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">المبلغ</label>
                      <input type="number" required min="0.01" max={remaining} step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
                        className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">التاريخ</label>
                      <input type="date" required value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})}
                        className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">طريقة الدفع</label>
                      <select required value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method: e.target.value})}
                        className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none">
                        <option value="CASH">نقدي</option>
                        <option value="TRANSFER">حوالة بنكية</option>
                        <option value="CHEQUE">شيك</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">رقم المرجع (اختياري)</label>
                      <input type="text" value={paymentForm.reference_number} onChange={e => setPaymentForm({...paymentForm, reference_number: e.target.value})}
                        className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none" />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <button type="submit" className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 sm:ms-3 sm:w-auto sm:text-sm">
                    حفظ الدفعة
                  </button>
                  <button type="button" onClick={() => setShowPaymentModal(false)} className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:mt-0 sm:ms-3 sm:w-auto sm:text-sm">
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
