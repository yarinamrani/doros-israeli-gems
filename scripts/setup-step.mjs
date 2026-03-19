const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = 'vzeowbriddhvhpishmhn';
const url = `https://api.supabase.com/v1/projects/${ref}/database/query`;

async function sql(label, query) {
  console.log(label);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) { console.error('  Error:', text); return; }
  console.log('  OK');
}

async function run() {
  await sql('1/7 suppliers...', `CREATE TABLE IF NOT EXISTS suppliers (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, name TEXT NOT NULL, contact_name TEXT, phone TEXT, email TEXT, address TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());`);

  await sql('2/7 invoices...', `CREATE TABLE IF NOT EXISTS invoices (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE, invoice_number TEXT NOT NULL, invoice_date DATE NOT NULL, received_date DATE DEFAULT CURRENT_DATE, total_amount DECIMAL(10,2) NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'checked', 'disputed', 'paid')), notes TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());`);

  await sql('3/7 invoice_items...', `CREATE TABLE IF NOT EXISTS invoice_items (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE, product_name TEXT NOT NULL, sku TEXT, quantity INTEGER NOT NULL DEFAULT 1, unit_price DECIMAL(10,2) NOT NULL, total_price DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED, category TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT now());`);

  await sql('4/7 price_history...', `CREATE TABLE IF NOT EXISTS price_history (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE, product_name TEXT NOT NULL, sku TEXT, old_price DECIMAL(10,2), new_price DECIMAL(10,2) NOT NULL, price_change_percent DECIMAL(5,2), invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL, recorded_at TIMESTAMPTZ DEFAULT now());`);

  await sql('5/7 indexes...', `CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON invoices(supplier_id); CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date DESC); CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id); CREATE INDEX IF NOT EXISTS idx_price_history_supplier ON price_history(supplier_id); CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_name, supplier_id);`);

  await sql('6/7 enable RLS...', `ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY; ALTER TABLE invoices ENABLE ROW LEVEL SECURITY; ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY; ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;`);

  await sql('7/7 RLS policies...', `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on suppliers') THEN CREATE POLICY "Allow all on suppliers" ON suppliers FOR ALL USING (true) WITH CHECK (true); END IF; IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on invoices') THEN CREATE POLICY "Allow all on invoices" ON invoices FOR ALL USING (true) WITH CHECK (true); END IF; IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on invoice_items') THEN CREATE POLICY "Allow all on invoice_items" ON invoice_items FOR ALL USING (true) WITH CHECK (true); END IF; IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on price_history') THEN CREATE POLICY "Allow all on price_history" ON price_history FOR ALL USING (true) WITH CHECK (true); END IF; END $$;`);

  console.log('Done!');
}
run();
