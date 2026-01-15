-- FIX INFINITE RECURSION (Definitive Solution: SECURITY DEFINER View)
-- Quando RLS recursiva falha (mesmo com subqueries), a solução padrão "enterprise"
-- é usar uma VIEW ou FUNÇÃO com SECURITY DEFINER para encapsular a lógica de "minhas salas".

-- 1. Removemos a política recursiva problemática
DROP POLICY IF EXISTS "View members policy" ON public.chat_room_members;
DROP POLICY IF EXISTS "Enable select for members linked to room" ON public.chat_room_members;
DROP POLICY IF EXISTS "Users can view members of their rooms" ON public.chat_room_members;

-- 2. Criamos uma função helper SEGURA (SECURITY DEFINER)
-- Esta função roda como superusuário e retorna os IDs das salas do usuário atual.
-- Como ela é SECURITY DEFINER, ela não dispara a RLS da tabela chat_room_members ao ser executada.
CREATE OR REPLACE FUNCTION get_my_room_ids()
RETURNS TABLE (room_id UUID) 
LANGUAGE sql 
SECURITY DEFINER 
STABLE
AS $$
  SELECT room_id 
  FROM public.chat_room_members 
  WHERE user_id = auth.uid();
$$;

-- 3. Criamos a política usando a função helper
-- Agora a política não consulta a tabela diretamente (o que causava loop), 
-- mas sim chama a função que consulta a tabela com privilégios de root (bypass RLS).
CREATE POLICY "View members safe"
ON public.chat_room_members FOR SELECT
USING (
    room_id IN ( SELECT get_my_room_ids() )
);

-- Bônus: Se ainda houver problemas, podemos simplificar temporariamente para depuração:
-- CREATE POLICY "Debug View" ON public.chat_room_members FOR SELECT USING (true);
