DO $$
DECLARE
  b RECORD;
  review_col_id uuid;
  target_col_id uuid;
BEGIN
  FOR b IN
    SELECT id FROM public.taskflow_boards
  LOOP
    SELECT c.id
      INTO review_col_id
    FROM public.taskflow_columns c
    WHERE c.board_id = b.id
      AND upper(c.name) IN ('EM REVISÃO', 'EM REVISAO')
    LIMIT 1;

    IF review_col_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT c.id
      INTO target_col_id
    FROM public.taskflow_columns c
    WHERE c.board_id = b.id
      AND c.id <> review_col_id
      AND upper(c.name) IN ('EM ANDAMENTO', 'PENDENTE', 'EM ANÁLISE', 'EM ANALISE', 'ENTRADA', 'CONCLUÍDO', 'CONCLUIDO')
    ORDER BY
      CASE upper(c.name)
        WHEN 'EM ANDAMENTO' THEN 1
        WHEN 'PENDENTE' THEN 2
        WHEN 'EM ANÁLISE' THEN 3
        WHEN 'EM ANALISE' THEN 3
        WHEN 'ENTRADA' THEN 4
        WHEN 'CONCLUÍDO' THEN 5
        WHEN 'CONCLUIDO' THEN 5
        ELSE 99
      END,
      c.order_index ASC
    LIMIT 1;

    IF target_col_id IS NULL THEN
      SELECT c.id
        INTO target_col_id
      FROM public.taskflow_columns c
      WHERE c.board_id = b.id
        AND c.id <> review_col_id
      ORDER BY c.order_index ASC
      LIMIT 1;
    END IF;

    IF target_col_id IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.taskflow_tasks t
       SET column_id = target_col_id
     WHERE t.column_id = review_col_id;

    DELETE FROM public.taskflow_columns
     WHERE id = review_col_id;
  END LOOP;
END $$;

