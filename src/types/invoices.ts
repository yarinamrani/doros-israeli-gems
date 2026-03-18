export interface Supplier {
  id: string;
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = 'received' | 'checked' | 'disputed' | 'paid';

export interface Invoice {
  id: string;
  supplier_id: string;
  invoice_number: string;
  invoice_date: string;
  received_date: string;
  total_amount: number;
  status: InvoiceStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category?: string;
  notes?: string;
  created_at: string;
}

export interface PriceChange {
  id: string;
  supplier_id: string;
  product_name: string;
  sku?: string;
  old_price: number;
  new_price: number;
  price_change_percent: number;
  invoice_id?: string;
  recorded_at: string;
  supplier?: Supplier;
}

export type AlertType = 'new_invoice' | 'price_increase' | 'price_decrease' | 'new_product';

export interface DashboardAlert {
  id: string;
  type: AlertType;
  title: string;
  description: string;
  date: string;
  supplier_name: string;
  severity: 'info' | 'warning' | 'success';
}

export interface SupplierFormData {
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface InvoiceFormData {
  supplier_id: string;
  invoice_number: string;
  invoice_date: string;
  received_date: string;
  total_amount: number;
  status: InvoiceStatus;
  notes?: string;
  items: InvoiceItemFormData[];
}

export interface InvoiceItemFormData {
  product_name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  category?: string;
  notes?: string;
}
