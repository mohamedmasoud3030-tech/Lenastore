// Supabase & Database Error Formatter in Arabic

export function parseSupabaseError(error: any, fallbackMessage: string = 'حدث خطأ في النظام'): string {
  if (!error) return fallbackMessage;

  const msg = typeof error === 'string' ? error : error.message || error.details || '';

  if (msg.includes('unauthorized') || error.code === '42501') {
    return 'غير مصرح لك بإجراء هذه العملية.';
  }
  if (msg.includes('unique constraint') || msg.includes('duplicate key') || error.code === '23505') {
    if (msg.includes('materials_project_id_name_key')) {
      return 'توجد مادة أخرى بنفس الاسم في هذا المشروع.';
    }
    if (msg.includes('purchase_requests_project_id_request_number_key')) {
      return 'رقم طلب الشراء مستخدم بالفعل.';
    }
    if (msg.includes('purchases_project_id_purchase_number_key')) {
      return 'رقم أمر الشراء مستخدم بالفعل.';
    }
    if (msg.includes('goods_receipts_project_id_receipt_number_key')) {
      return 'رقم سند الاستلام مستخدم بالفعل.';
    }
    if (msg.includes('stock_issues_project_id_issue_number_key')) {
      return 'رقم سند الصرف مستخدم بالفعل.';
    }
    return 'البيانات المخلة مكررة وموجودة بالفعل.';
  }
  if (msg.includes('insufficient stock')) {
    const match = msg.match(/available: ([0-9.]+), requested: ([0-9.]+)/i);
    if (match) {
      return `المخزون غير كافٍ. الكمية المتاحة: ${match[1]}، المطلوبة: ${match[2]}`;
    }
    return 'المخزون المتاح غير كافٍ لإتمام عملية الصرف.';
  }
  if (msg.includes('Cannot receive more than ordered')) {
    return 'لا يمكن استلام كمية أكبر من الكمية المطلوبة في امر الشراء.';
  }
  if (msg.includes('Payment amount exceeds remaining balance')) {
    return 'مبلغ الدفعة يتجاوز المبلغ المتبقي لأمر الشراء.';
  }
  if (msg.includes('foreign key constraint') || error.code === '23503') {
    return 'لا يمكن إتمام العملية لوجود بيانات مرتبطة بسجلات أخرى.';
  }

  return msg || fallbackMessage;
}
