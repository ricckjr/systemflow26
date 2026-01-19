const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Endpoint de emergência para corrigir/criar board
router.post('/fix-board', async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. Verifica se já existe board
    const { data: existing } = await supabaseAdmin
      .from('taskflow_boards')
      .select('id')
      .eq('created_by', userId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return res.json({ message: 'Board já existe', boardId: existing.id });
    }

    // 2. Cria board usando Admin (bypass RLS)
    const { data: newBoard, error: boardError } = await supabaseAdmin
      .from('taskflow_boards')
      .insert([{ name: 'Meu Board', created_by: userId }])
      .select()
      .single();

    if (boardError) throw boardError;

    // 3. Cria colunas padrão
    const REQUIRED_COLUMNS = [
      { name: 'ENTRADA', order_index: 0 },
      { name: 'EM ANÁLISE', order_index: 1 },
      { name: 'PENDENTE', order_index: 2 },
      { name: 'EM ANDAMENTO', order_index: 3 },
      { name: 'CONCLUÍDO', order_index: 4 },
    ];

    const newCols = REQUIRED_COLUMNS.map(c => ({
      ...c,
      board_id: newBoard.id,
      created_by: userId
    }));

    const { error: colsError } = await supabaseAdmin
      .from('taskflow_columns')
      .insert(newCols);

    if (colsError) throw colsError;

    res.json({ message: 'Board criado com sucesso', board: newBoard });

  } catch (err) {
    console.error('Fix Board Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
