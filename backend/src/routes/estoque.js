const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(requirePermission('COMPRAS_E_ESTOQUE', 'EDIT'));

router.post('/movimentar', async (req, res) => {
  const {
    prod_id,
    tipo_movimentacao,
    quantidade,
    local_estoque,
    motivo,
    local_estoque_destino,
    valor_compra_unit,
    data_movimentacao,
  } = req.body || {};

  if (!prod_id) return res.status(400).json({ error: 'prod_id é obrigatório' });
  if (!tipo_movimentacao) return res.status(400).json({ error: 'tipo_movimentacao é obrigatório' });

  const quant = Number(quantidade);
  if (!Number.isFinite(quant) || quant === 0) return res.status(400).json({ error: 'quantidade inválida' });

  const tipo = String(tipo_movimentacao);
  const localOrigem = String(local_estoque || '').trim();
  const localDestino = String(local_estoque_destino || '').trim();

  if (!localOrigem) return res.status(400).json({ error: 'local_estoque é obrigatório' });
  if (tipo === 'Transferencia' && !localDestino) {
    return res.status(400).json({ error: 'local_estoque_destino é obrigatório para Transferencia' });
  }

  const isoDate = data_movimentacao ? new Date(data_movimentacao).toISOString() : null;
  const valorCompraUnit = valor_compra_unit === null || valor_compra_unit === undefined ? null : Number(valor_compra_unit);
  if (valorCompraUnit !== null && (!Number.isFinite(valorCompraUnit) || valorCompraUnit < 0)) {
    return res.status(400).json({ error: 'valor_compra_unit inválido' });
  }

  try {
    const rpcArgs = {
      p_prod_id: prod_id,
      p_tipo_movimentacao: tipo,
      p_quantidade: quant,
      p_local_origem: localOrigem,
      p_motivo: motivo ?? null,
      p_user_id: req.user.id,
      p_local_destino: tipo === 'Transferencia' ? localDestino : null,
      p_data_movimentacao: isoDate ?? null,
    };
    if (valorCompraUnit !== null) rpcArgs.p_valor_compra_unit = valorCompraUnit;

    let { data, error } = await supabaseAdmin.rpc('crm_movimentar_estoque_admin', rpcArgs);

    if (error && valorCompraUnit !== null) {
      const msg = String(error.message || '');
      const retryable =
        msg.includes('p_valor_compra_unit') ||
        msg.toLowerCase().includes('could not find the function') ||
        msg.toLowerCase().includes('function') ||
        msg.toLowerCase().includes('not exist');

      if (retryable) {
        const { p_valor_compra_unit: _ignored, ...fallbackArgs } = rpcArgs;
        const retry = await supabaseAdmin.rpc('crm_movimentar_estoque_admin', fallbackArgs);
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      const msg = error.message || 'Falha ao movimentar estoque';
      const status = msg.toLowerCase().includes('saldo insuficiente') ? 400 : 500;
      return res.status(status).json({ error: msg });
    }

    return res.status(201).json({ movimentacoes: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Erro interno' });
  }
});

module.exports = router;
