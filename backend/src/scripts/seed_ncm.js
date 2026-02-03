const https = require('https');
const { supabaseAdmin } = require('../supabase');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET' }, (res) => {
      const status = res.statusCode || 0;
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        if (status < 200 || status >= 300) {
          return reject(new Error(`HTTP ${status}: ${raw.slice(0, 300)}`));
        }
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function stripHtml(input) {
  return String(input ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatCodigoMask(digits) {
  const raw = String(digits || '').replace(/\D/g, '')
  if (raw.length !== 8) return raw
  return `${raw.slice(0, 4)}.${raw.slice(4, 6)}.${raw.slice(6, 8)}`
}

function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  const url = 'https://brasilapi.com.br/api/ncm/v1';
  console.log(`[seed:ncm] Baixando lista: ${url}`);
  const data = await fetchJson(url);

  if (!Array.isArray(data)) {
    throw new Error('[seed:ncm] Resposta inesperada (esperado array).');
  }

  const rows = data
    .map((item) => {
      const rawCodigo = String(item?.codigo ?? '').trim();
      if (!rawCodigo) return null;

      const digits = rawCodigo.replace(/\D/g, '');
      if (digits.length !== 8) return null;

      const codigo = formatCodigoMask(digits)
      const descricao = stripHtml(item?.descricao ?? '');

      return {
        codigo,
        descricao: descricao || codigo,
        cod_sem_mascara: Number(digits)
      };
    })
    .filter(Boolean);

  console.log(`[seed:ncm] Registros processados: ${rows.length}`);

  const chunks = chunkArray(rows, 500);
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const { error } = await supabaseAdmin.from('ncm').upsert(chunk, { onConflict: 'codigo' });
    if (error) throw error;
    if ((i + 1) % 10 === 0 || i === chunks.length - 1) {
      console.log(`[seed:ncm] Progresso: ${i + 1}/${chunks.length} batches`);
    }
  }

  const { count, error: countError } = await supabaseAdmin
    .from('ncm')
    .select('codigo', { count: 'exact', head: true });

  if (countError) throw countError;

  console.log(`[seed:ncm] OK. Total em public.ncm: ${count ?? 0}`);
}

main().catch((err) => {
  console.error('[seed:ncm] Falha:', err?.message || err);
  process.exit(1);
});
