import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Users, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, ShoppingBag, RefreshCw, Search, BarChart3 } from 'lucide-react';
import { getDashboardStats, getPriceAlerts, getInvoices } from '../lib/gmailInvoiceService';
import type { GmailInvoice, PriceAlert } from '../lib/gmailInvoiceService';

export default function InvoiceDashboard() {
  const [stats, setStats] = useState({ totalInvoices: 0, totalSuppliers: 0, monthInvoices: 0, lastMonthInvoices: 0, monthTotal: 0, priceAlerts: 0, lastSync: '' });
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<GmailInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GmailInvoice[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSearchQuery('');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Search invoices
  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    const results = await getInvoices({ search: q });
    setSearchResults(results.slice(0, 8));
    setSearchOpen(true);
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [s, pa, recent] = await Promise.all([
        getDashboardStats(),
        getPriceAlerts(),
        getInvoices(),
      ]);
      setStats(s);
      setPriceAlerts(pa);
      setRecentInvoices(recent.slice(0, 10));
    } catch (e) {
      console.error('Error loading dashboard:', e);
    } finally {
      setLoading(false);
    }
  }

  // Month comparison
  const monthChange = stats.lastMonthInvoices > 0
    ? ((stats.monthInvoices - stats.lastMonthInvoices) / stats.lastMonthInvoices) * 100
    : null;

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <RefreshCw size={32} className="text-gray-400 animate-spin mx-auto mb-3" />
        <p className="text-gray-500">טוען דשבורד...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">דשבורד חשבוניות</h1>
            <p className="text-gray-500 text-sm mt-0.5">סקירה כללית - גג על הים</p>
          </div>
          <div className="text-left text-xs text-gray-400">
            סנכרון אחרון: {stats.lastSync}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Quick Search */}
        <div ref={searchRef} className="relative mb-6">
          <div className="relative">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="חיפוש ספק או חשבונית..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              onFocus={() => searchQuery.trim().length >= 2 && setSearchOpen(true)}
              className="w-full bg-white border border-gray-200 rounded-xl py-3 pr-10 pl-20 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-300 bg-gray-100 px-2 py-1 rounded font-mono">
              Ctrl+K
            </span>
          </div>
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
              {searchResults.map(inv => (
                <button
                  key={inv.id}
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery('');
                    navigate(`/invoices?search=${encodeURIComponent(inv.supplier)}`);
                  }}
                  className="w-full text-right px-4 py-3 hover:bg-gray-50 flex items-center justify-between border-b border-gray-50 last:border-0 bg-transparent cursor-pointer"
                >
                  <div>
                    <span className="font-medium text-sm text-gray-900">{inv.supplier}</span>
                    <span className="text-xs text-gray-400 mr-2">{inv.invoice_number || ''}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">{inv.amount ? `₪${inv.amount.toLocaleString()}` : ''}</span>
                    <span className="text-xs text-gray-400">{new Date(inv.date).toLocaleDateString('he-IL')}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
              <FileText size={20} className="text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalInvoices}</p>
            <p className="text-sm text-gray-500">סה״כ חשבוניות</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mb-3">
              <Users size={20} className="text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalSuppliers}</p>
            <p className="text-sm text-gray-500">ספקים</p>
          </div>
          <Link to="/invoices" className="no-underline">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <ShoppingBag size={20} className="text-green-600" />
                </div>
                {monthChange !== null && (
                  <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-full ${
                    monthChange > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                  }`}>
                    {monthChange > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(monthChange).toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.monthInvoices}</p>
              <p className="text-sm text-gray-500">חשבוניות החודש</p>
            </div>
          </Link>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center mb-3">
              <AlertTriangle size={20} className="text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.priceAlerts}</p>
            <p className="text-sm text-gray-500">התראות מחיר</p>
          </div>
        </div>

        {/* Analytics Link Card */}
        <Link to="/analytics" className="no-underline block mb-8">
          <div className="bg-gradient-to-l from-blue-50 to-indigo-50 rounded-xl p-5 shadow-sm border border-blue-100 hover:shadow-md hover:border-blue-200 transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <BarChart3 size={24} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">ניתוח נתונים</h3>
                <p className="text-sm text-gray-500 mt-0.5">צפה בגרפים ומגמות</p>
              </div>
              <ArrowUpRight size={20} className="text-gray-400 mr-auto group-hover:text-blue-600 transition-colors" />
            </div>
          </div>
        </Link>

        <div className="grid md:grid-cols-[1fr_380px] gap-6">
          {/* Recent Invoices */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">חשבוניות אחרונות</h2>
              <Link to="/invoices" className="text-blue-600 text-sm font-medium no-underline hover:underline">
                הצג הכל
              </Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-right px-4 py-3 font-medium text-gray-600">ספק</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">מספר</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">תאריך</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">סכום</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">סוג</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map(inv => (
                    <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{inv.supplier}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{inv.invoice_number || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{new Date(inv.date).toLocaleDateString('he-IL')}</td>
                      <td className="px-4 py-3 text-gray-900 font-medium">
                        {inv.amount ? `₪${inv.amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          inv.doc_type === 'חשבונית מס' ? 'bg-blue-50 text-blue-700' :
                          inv.doc_type === 'קבלה' ? 'bg-green-50 text-green-700' :
                          'bg-gray-50 text-gray-700'
                        }`}>
                          {inv.doc_type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Price Alerts */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-amber-500" />
              שינויי מחירים
            </h2>
            {priceAlerts.length === 0 ? (
              <div className="bg-white rounded-xl p-6 text-center border border-gray-100">
                <p className="text-gray-500 text-sm">אין שינויי מחירים</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto">
                {priceAlerts.slice(0, 15).map((alert, i) => {
                  const isUp = alert.changePercent > 0;
                  return (
                    <div key={i} className={`rounded-xl p-4 border ${
                      isUp ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm text-gray-900">{alert.supplier}</span>
                        <span className={`flex items-center gap-1 text-sm font-bold ${
                          isUp ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          {Math.abs(alert.changePercent).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>₪{alert.previousAmount.toLocaleString()}</span>
                        <span>←</span>
                        <span className={`font-medium ${isUp ? 'text-red-600' : 'text-green-600'}`}>
                          ₪{alert.currentAmount.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(alert.date).toLocaleDateString('he-IL')}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
