// Lenastore Construction PWA Domain Types

export interface Project {
  id: string;
  user_id: string;
  name: string;
  location: string | null;
  manager_name: string | null;
  phone: string | null;
  start_date: string;
  owner_name: string | null;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Material {
  id: string;
  project_id: string;
  name: string;
  category: string | null;
  unit: string;
  min_stock: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialStock {
  material_id: string;
  project_id: string;
  name: string;
  min_stock: number;
  unit: string;
  total_in: number;
  total_out: number;
  current_stock: number;
  category: string | null;
  notes: string | null;
}

export interface Supplier {
  id: string;
  project_id: string;
  name: string;
  company: string | null;
  phone: string | null;
  tax_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierBalance {
  supplier_id: string;
  project_id: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  tax_id?: string | null;
  total_purchases: number;
  total_paid: number;
  remaining_balance: number;
}

export type PriorityType = 'NORMAL' | 'URGENT';
export type RequestStatusType = 'DRAFT' | 'REQUESTED' | 'PURCHASING' | 'PURCHASED' | 'CANCELLED';

export interface PurchaseRequestItem {
  id: string;
  request_id: string;
  material_id: string;
  quantity: number;
  materials?: {
    name: string;
    unit: string;
  };
}

export interface PurchaseRequest {
  id: string;
  project_id: string;
  request_number: string;
  date: string;
  reason: string | null;
  priority: PriorityType;
  needed_date: string | null;
  status: RequestStatusType;
  notes: string | null;
  created_at: string;
  updated_at: string;
  purchase_request_items?: PurchaseRequestItem[];
}

export type ReceiptStatusType = 'UNRECEIVED' | 'PARTIAL' | 'FULL';
export type PaymentStatusType = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  material_id: string;
  quantity: number;
  unit_price: number;
  total: number;
  received_quantity: number;
  materials?: {
    name: string;
    unit: string;
  };
}

export interface Purchase {
  id: string;
  project_id: string;
  request_id: string | null;
  purchase_number: string;
  supplier_id: string;
  date: string;
  subtotal: number;
  discount: number;
  tax: number;
  transport_cost: number;
  total: number;
  receipt_status: ReceiptStatusType;
  invoice_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  suppliers?: {
    name: string;
    company?: string | null;
  };
  purchase_items?: PurchaseItem[];
  payments?: Payment[];
  purchase_balances?: PurchaseBalance[];
}

export interface PurchaseBalance {
  purchase_id: string;
  project_id: string;
  purchase_total: number;
  total_paid: number;
  remaining_balance: number;
  payment_status: PaymentStatusType;
}

export interface GoodsReceiptItem {
  id: string;
  goods_receipt_id: string;
  purchase_item_id: string;
  material_id: string;
  received_quantity: number;
  materials?: {
    name: string;
    unit: string;
  };
}

export interface GoodsReceipt {
  id: string;
  project_id: string;
  purchase_id: string;
  supplier_id: string;
  receipt_number: string;
  date: string;
  status: 'COMPLETED' | 'CANCELLED';
  notes: string | null;
  idempotency_key: string;
  created_by: string;
  created_at: string;
  goods_receipt_items?: GoodsReceiptItem[];
  purchases?: {
    purchase_number: string;
  };
  suppliers?: {
    name: string;
  };
}

export interface StockIssueItem {
  id: string;
  stock_issue_id: string;
  material_id: string;
  quantity: number;
  materials?: {
    name: string;
    unit: string;
  };
}

export interface StockIssue {
  id: string;
  project_id: string;
  issue_number: string;
  date: string;
  receiver_name: string;
  destination: string | null;
  reference_number: string | null;
  notes: string | null;
  idempotency_key: string;
  created_by: string;
  created_at: string;
  stock_issue_items?: StockIssueItem[];
}

export type StockMovementType = 'IN' | 'OUT';

export interface StockMovement {
  id: string;
  project_id: string;
  type: StockMovementType;
  material_id: string;
  quantity: number;
  date: string;
  reference_number: string | null;
  receiver_name: string | null;
  location_used: string | null;
  purchase_id: string | null;
  supplier_id: string | null;
  source_receipt_item_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  materials?: {
    name: string;
    unit: string;
  };
  suppliers?: {
    name: string;
  };
  purchases?: {
    purchase_number: string;
  };
}

export type PaymentMethodType = 'CASH' | 'TRANSFER' | 'CHEQUE' | 'OTHER';

export interface Payment {
  id: string;
  project_id: string;
  purchase_id: string;
  amount: number;
  date: string;
  method: PaymentMethodType;
  reference_number: string | null;
  receiver_name: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  purchases?: {
    purchase_number: string;
    suppliers?: {
      name: string;
    };
  };
}

export interface Attachment {
  id: string;
  project_id: string;
  file_name: string;
  file_type: 'image/jpeg' | 'image/png' | 'application/pdf';
  file_size: number;
  file_path: string;
  entity_type: 'PROJECT' | 'SUPPLIER' | 'MATERIAL' | 'PURCHASE_REQUEST' | 'PURCHASE' | 'PAYMENT' | 'MOVEMENT';
  entity_id: string;
  notes: string | null;
  created_by: string;
  created_at: string;
}
