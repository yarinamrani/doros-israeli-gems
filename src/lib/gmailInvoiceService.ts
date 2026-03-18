export interface GmailInvoice {
  id: string;
  supplier: string;
  invoice_number: string;
  date: string;
  amount: number | null;
  doc_type: string;
  subject: string;
  from_email: string;
  status: string;
}

interface InvoiceData {
  last_sync: string;
  total: number;
  invoices: GmailInvoice[];
}

export interface SupplierSummary {
  name: string;
  invoiceCount: number;
  totalAmount: number;
  lastDate: string;
  amounts: { date: string; amount: number }[];
}

export interface PriceAlert {
  supplier: string;
  previousAmount: number;
  currentAmount: number;
  changePercent: number;
  date: string;
}

let cachedData: InvoiceData | null = null;

export async function loadInvoices(): Promise<InvoiceData> {
  if (cachedData) return cachedData;
  const res = await fetch('/data/invoices.json');
  cachedData = await res.json();
  return cachedData!;
}

export function clearCache() {
  cachedData = null;
}

export async function getInvoices(filters?: {
  supplier?: string;
  dateFrom?: string;
  dateTo?: string;
  docType?: string;
  search?: string;
}): Promise<GmailInvoice[]> {
  const data = await loadInvoices();
  let invoices = data.invoices;

  if (filters?.supplier) {
    invoices = invoices.filter(i => i.supplier === filters.supplier);
  }
  if (filters?.dateFrom) {
    invoices = invoices.filter(i => i.date >= filters.dateFrom!);
  }
  if (filters?.dateTo) {
    invoices = invoices.filter(i => i.date <= filters.dateTo!);
  }
  if (filters?.docType) {
    invoices = invoices.filter(i => i.doc_type === filters.docType);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    invoices = invoices.filter(i =>
      i.supplier.toLowerCase().includes(q) ||
      i.invoice_number.toLowerCase().includes(q) ||
      i.subject.toLowerCase().includes(q)
    );
  }

  return invoices;
}

export async function getSuppliers(): Promise<string[]> {
  const data = await loadInvoices();
  const suppliers = new Set(data.invoices.map(i => i.supplier));
  return Array.from(suppliers).sort();
}

export async function getSupplierSummaries(): Promise<SupplierSummary[]> {
  const data = await loadInvoices();
  const map = new Map<string, SupplierSummary>();

  for (const inv of data.invoices) {
    let s = map.get(inv.supplier);
    if (!s) {
      s = { name: inv.supplier, invoiceCount: 0, totalAmount: 0, lastDate: '', amounts: [] };
      map.set(inv.supplier, s);
    }
    s.invoiceCount++;
    if (inv.amount) {
      s.totalAmount += inv.amount;
      s.amounts.push({ date: inv.date, amount: inv.amount });
    }
    if (!s.lastDate || inv.date > s.lastDate) {
      s.lastDate = inv.date;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.invoiceCount - a.invoiceCount);
}

export async function getPriceAlerts(): Promise<PriceAlert[]> {
  const data = await loadInvoices();
  // Group invoices by supplier, only those with amounts
  const bySupplier = new Map<string, { date: string; amount: number }[]>();

  for (const inv of data.invoices) {
    if (!inv.amount) continue;
    let arr = bySupplier.get(inv.supplier);
    if (!arr) {
      arr = [];
      bySupplier.set(inv.supplier, arr);
    }
    arr.push({ date: inv.date, amount: inv.amount });
  }

  const alerts: PriceAlert[] = [];

  for (const [supplier, entries] of bySupplier) {
    if (entries.length < 2) continue;
    // Sort by date ascending
    entries.sort((a, b) => a.date.localeCompare(b.date));

    // Compare consecutive invoices
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1];
      const curr = entries[i];
      if (prev.amount === 0) continue;

      const changePercent = ((curr.amount - prev.amount) / prev.amount) * 100;
      // Only flag significant changes (>5%)
      if (Math.abs(changePercent) > 5) {
        alerts.push({
          supplier,
          previousAmount: prev.amount,
          currentAmount: curr.amount,
          changePercent,
          date: curr.date,
        });
      }
    }
  }

  // Sort by date descending, price increases first
  alerts.sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return b.changePercent - a.changePercent;
  });

  return alerts;
}

export async function getDashboardStats() {
  const data = await loadInvoices();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);

  const monthInvoices = data.invoices.filter(i => i.date >= monthStart);
  const lastMonthInvoices = data.invoices.filter(i => i.date >= lastMonthStart && i.date < monthStart);
  const suppliers = new Set(data.invoices.map(i => i.supplier));
  const monthTotal = monthInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
  const priceAlerts = await getPriceAlerts();
  const priceIncreases = priceAlerts.filter(a => a.changePercent > 0);

  return {
    totalInvoices: data.total,
    totalSuppliers: suppliers.size,
    monthInvoices: monthInvoices.length,
    lastMonthInvoices: lastMonthInvoices.length,
    monthTotal,
    priceAlerts: priceIncreases.length,
    lastSync: data.last_sync,
  };
}
