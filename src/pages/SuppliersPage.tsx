import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText, TrendingUp } from 'lucide-react';
import { getSupplierSummaries } from '../lib/gmailInvoiceService';
import type { SupplierSummary } from '../lib/gmailInvoiceService';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSupplierSummaries()
      .then(setSuppliers)
      .catch(e => console.error('Error loading suppliers:', e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3 mb-1">
            <Link to="/" className="text-gray-400 hover:text-gray-600 no-underline">
              <ArrowRight size={20} />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">ספקים</h1>
          </div>
          <p className="text-gray-500 text-sm">{suppliers.length} ספקים פעילים</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="p-8 text-center text-gray-500">טוען...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {suppliers.map(s => (
              <div key={s.name} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-bold text-gray-900 text-lg mb-3">{s.name}</h3>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <FileText size={14} className="text-blue-500" />
                    <span>{s.invoiceCount} חשבוניות</span>
                  </div>
                  {s.totalAmount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-green-500" />
                      <span>₪{s.totalAmount.toLocaleString()}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  אחרון: {new Date(s.lastDate).toLocaleDateString('he-IL')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
