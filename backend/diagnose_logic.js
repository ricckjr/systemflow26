const dotenv = require('dotenv');
dotenv.config();

const { supabaseAdmin } = require('./src/supabase');

// --- Frontend Logic Simulation ---

const parseValorProposta = (val) => {
  if (!val) return 0;
  // Regex original do frontend
  const clean = val.replace(/[R$\.\s]/g, '').replace(',', '.');
  const parsed = parseFloat(clean);
  console.log(`[Parse] Input: "${val}" | Clean: "${clean}" | Output: ${parsed}`);
  return parsed || 0;
};

const isVenda = (s) => {
  const clean = (s || '').toUpperCase();
  const match = ['CONQUISTADO', 'FATURADO', 'GANHO', 'VENDIDO'].includes(clean);
  console.log(`[Status] Input: "${s}" | Normalized: "${clean}" | IsVenda: ${match}`);
  return match;
};

// --- Diagnosis ---

async function diagnose() {
  console.log('--- Starting Diagnosis ---');
  
  const { data, error } = await supabaseAdmin
    .from('crm_oportunidades')
    .select('*')
    .limit(20);

  if (error) {
    console.error('Database Error:', error);
    return;
  }

  console.log(`Fetched ${data.length} rows.`);

  let totalVendas = 0;

  data.forEach((row, index) => {
    console.log(`\nRow #${index + 1} (ID: ${row.id_oportunidade})`);
    
    const valor = parseValorProposta(row.valor_proposta);
    const venda = isVenda(row.status);

    if (venda) {
      totalVendas += valor;
    }
  });

  console.log(`\n--- Result ---`);
  console.log(`Total Vendas Calculated: ${totalVendas}`);
}

diagnose();
