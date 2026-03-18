import { Link } from 'react-router-dom';
import { ShoppingBag, Search, User, Heart, Menu, X, FileText, LayoutDashboard, Users, BarChart3 } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '../../context/CartContext';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { totalItems } = useCart();

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <button className="md:hidden bg-transparent border-none p-1" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <Link to="/" className="flex items-center no-underline">
          <h1 className="text-3xl font-black tracking-wider text-pink-primary" style={{ fontFamily: 'Heebo' }}>DORO</h1>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          <Link to="/shop" className="text-text-primary no-underline hover:text-pink-primary transition-colors font-medium text-sm">חנות</Link>
          <a href="#about" className="text-text-primary no-underline hover:text-pink-primary transition-colors font-medium text-sm">מי אנחנו</a>
          <a href="#contact" className="text-text-primary no-underline hover:text-pink-primary transition-colors font-medium text-sm">יצירת קשר</a>
          <span className="w-px h-5 bg-gray-200" />
          <Link to="/" className="flex items-center gap-1.5 text-text-primary no-underline hover:text-pink-primary transition-colors font-medium text-sm">
            <LayoutDashboard size={16} /> דשבורד
          </Link>
          <Link to="/invoices" className="flex items-center gap-1.5 text-text-primary no-underline hover:text-pink-primary transition-colors font-medium text-sm">
            <FileText size={16} /> חשבוניות
          </Link>
          <Link to="/suppliers" className="flex items-center gap-1.5 text-text-primary no-underline hover:text-pink-primary transition-colors font-medium text-sm">
            <Users size={16} /> ספקים
          </Link>
          <Link to="/analytics" className="flex items-center gap-1.5 text-text-primary no-underline hover:text-pink-primary transition-colors font-medium text-sm">
            <BarChart3 size={16} /> ניתוח
          </Link>
        </nav>
        <div className="flex items-center gap-5">
          <button className="bg-transparent border-none p-0 cursor-pointer text-text-primary hover:text-pink-primary transition-colors"><Search size={20} /></button>
          <button className="bg-transparent border-none p-0 cursor-pointer text-text-primary hover:text-pink-primary transition-colors"><User size={20} /></button>
          <button className="bg-transparent border-none p-0 cursor-pointer text-text-primary hover:text-pink-primary transition-colors"><Heart size={20} /></button>
          <Link to="/cart" className="relative text-text-primary hover:text-pink-primary transition-colors">
            <ShoppingBag size={20} />
            {totalItems > 0 && <span className="absolute -top-2 -right-2 bg-pink-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{totalItems}</span>}
          </Link>
        </div>
      </div>
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4">
          <nav className="flex flex-col gap-4">
            <Link to="/shop" onClick={() => setMenuOpen(false)} className="text-text-primary no-underline hover:text-pink-primary font-medium py-2">חנות</Link>
            <a href="#about" onClick={() => setMenuOpen(false)} className="text-text-primary no-underline hover:text-pink-primary font-medium py-2">מי אנחנו</a>
            <a href="#contact" onClick={() => setMenuOpen(false)} className="text-text-primary no-underline hover:text-pink-primary font-medium py-2">יצירת קשר</a>
            <div className="border-t border-gray-100 pt-2 mt-1">
              <p className="text-xs text-gray-400 mb-2">ניהול חשבוניות</p>
              <Link to="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 text-text-primary no-underline hover:text-pink-primary font-medium py-2">
                <LayoutDashboard size={16} /> דשבורד
              </Link>
              <Link to="/invoices" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 text-text-primary no-underline hover:text-pink-primary font-medium py-2">
                <FileText size={16} /> חשבוניות
              </Link>
              <Link to="/suppliers" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 text-text-primary no-underline hover:text-pink-primary font-medium py-2">
                <Users size={16} /> ספקים
              </Link>
              <Link to="/analytics" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 text-text-primary no-underline hover:text-pink-primary font-medium py-2">
                <BarChart3 size={16} /> ניתוח
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
