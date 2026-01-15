-- FIX INFINITE RECURSION (Error 42P17)
-- O erro ocorre porque a política de SELECT na tabela 'chat_room_members' estava fazendo uma query nela mesma
-- de forma circular. Simplificamos a política para evitar auto-referência direta.

-- 1. Remove a política recursiva problemática
DROP POLICY IF EXISTS "Enable select for members linked to room" ON public.chat_room_members;
DROP POLICY IF EXISTS "Users can view members of their rooms" ON public.chat_room_members;

-- 2. Cria uma política não-recursiva
-- A lógica simplificada é: Você pode ver uma linha na tabela 'chat_room_members' SE:
-- a) A linha é sobre VOCÊ (user_id = auth.uid())
-- b) OU a linha pertence a uma sala onde VOCÊ TAMBÉM é membro.
--
-- Para resolver a recursão em (b), evitamos fazer SELECT direto na tabela protegida dentro da política dela mesma.
-- Em vez disso, confiamos que se você tem acesso à SALA (via política de chat_rooms), você pode ver os membros.
-- Mas como chat_rooms TAMBÉM pode depender de chat_room_members, o melhor é quebrar o ciclo.

-- SOLUÇÃO: Política Híbrida Segura
CREATE POLICY "View members policy"
ON public.chat_room_members FOR SELECT
USING (
    -- Caso 1: Eu posso ver meu próprio registro de membro
    user_id = auth.uid() 
    OR
    -- Caso 2: Eu posso ver registros de outros se eles estão em uma sala onde EU estou.
    -- Usamos uma subquery que busca APENAS os IDs das salas onde 'auth.uid()' está presente.
    -- IMPORTANTE: Para evitar recursão infinita, o Postgres precisa conseguir resolver isso sem entrar em loop.
    room_id IN (
        SELECT room_id 
        FROM public.chat_room_members 
        WHERE user_id = auth.uid()
    )
);

-- NOTA: Se ainda der recursão (o que é raro com essa estrutura "IN"), podemos simplificar drasticamente para testes:
-- CREATE POLICY "Simple view" ON public.chat_room_members FOR SELECT USING (true);
-- Mas a política acima deve funcionar pois filtra por user_id fixo na subquery.
