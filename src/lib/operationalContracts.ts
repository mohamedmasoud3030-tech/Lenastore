export const REQUIRED_OPERATIONAL_RPCS = [
  'create_purchase_request_atomic',
  'create_purchase_atomic',
  'receive_goods',
  'register_payment',
  'issue_stock',
  'reverse_payment',
  'cancel_goods_receipt',
  'cancel_stock_issue',
  'create_purchase_return',
  'cancel_purchase_request',
  'cancel_purchase',
  'system_integrity_report',
  'export_project_snapshot',
  'report_client_error',
  'seed_demo_project_if_empty',
] as const;

export type OperationalRpcName = (typeof REQUIRED_OPERATIONAL_RPCS)[number];
