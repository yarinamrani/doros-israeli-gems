import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = resolve(import.meta.dirname || '.', '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const { data: invoices, error } = await supabase
  .from('invoices')
  .select('id, invoice_number, total_amount, items:invoice_items(quantity, unit_price, total_price)');

if (error) { console.error('Error:', error.message); process.exit(1); }

console.log('Total invoices:', invoices.length);
let fixed = 0;
const stillZero = [];

for (const inv of invoices) {
  const cur = Number(inv.total_amount) || 0;
  if (cur === 0 && inv.items && inv.items.length > 0) {
    const total = inv.items.reduce((s, it) => s + (Number(it.total_price) || (Number(it.quantity) * Number(it.unit_price))), 0);
    if (total > 0) {
      await supabase.from('invoices').update({ total_amount: total }).eq('id', inv.id);
      console.log('  Fixed #' + inv.invoice_number + ' -> ' + total);
      fixed++;
    } else { stillZero.push(inv.invoice_number); }
  } else if (cur === 0) { stillZero.push(inv.invoice_number); }
}

console.log('\nFixed:', fixed);
if (stillZero.length > 0) {
  console.log('Still 0 (no items):', stillZero.map(n => '#' + n).join(', '));
  console.log('These need re-scanning from original invoice files.');
}
