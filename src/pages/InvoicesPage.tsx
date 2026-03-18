import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, Filter, Download } from 'lucide-react';
import { getInvoices, getSuppliers } from '../lib/gmailInvoiceService';
import type { GmailInvoice } from '../lib/gmailInvoiceService';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<GmailInvoice[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    getSuppliers().then(setAllSuppliers);
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [supplierFilter, docTypeFilter, dateFrom, dateTo, search]);

  async function loadInvoices() {
    try {
      setLoading(true);
      const data = await getInvoices({
        supplier: supplierFilter || undefined,
        docType: docTypeFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search || undefined,
      });
      setInvoices(data);
    } catch (e) {
      console.error('Error loading invoices:', e);
    } finally {
      setLoading(false);
    }
  }

  const totalAmount = invoices.reduce((sum, i) => sum + (i.amount || 0), 0);

  function exportCSV() {
    const headers = ['ספק', 'מספר חשבונית', 'תאריך', 'סכום', 'סוג', 'נושא'];
    const rows = invoices.map(i => [
      i.supplier,
      i.invoice_number,
      i.date,
      i.amount?.toString() || '',
      i.doc_type,
      i.subject,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3 mb-1">
            <Link to="/" className="text-gray-400 hover:text-gray-600 no-underline">
              <ArrowRight size={20} />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">כל החשבוניות</h1>
          </div>
          <p className="text-gray-500 text-sm">{invoices.length} חשבוניות | סה״כ ₪{totalAmount.toLocaleString()}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search & Filters */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="חיפוש לפי ספק, מספר חשבונית..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
                showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter size={16} />
              סינון
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <Download size={16} />
              CSV
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">ספק</label>
                <select
                  value={supplierFilter}
                  onChange={e => setSupplierFilter(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                >
                  <option value="">כל הספקים</option>
                  {allSuppliers.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">סוג מסמך</label>
                <select
                  value={docTypeFilter}
                  onChange={e => setDocTypeFilter(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                >
                  <option value="">הכל</option>
                  <option value="חשבונית מס">חשבונית מס</option>
                  <option value="חשבונית">חשבונית</option>
                  <option value="קבלה">קבלה</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">מתאריך</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">עד תאריך</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">טוען...</div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">לא נמצאו חשבוניות</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">ספק</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">מספר חשבונית</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">תאריך</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">סכום</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">סוג</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">נושא</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{inv.supplier}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{inv.invoice_number || '-'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {new Date(inv.date).toLocaleDateString('he-IL')}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {inv.amount ? `₪${inv.amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          inv.doc_type === 'חשבונית מס' ? 'bg-blue-50 text-blue-700' :
                          inv.doc_type === 'קבלה' ? 'bg-green-50 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {inv.doc_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[250px] truncate">
                        {inv.subject}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
