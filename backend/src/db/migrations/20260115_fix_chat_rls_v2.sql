-- FIX CHAT RLS V2 (Robust Fix)
-- Este script corrige definitivamente o erro 42501 redefinindo as políticas e triggers
-- para garantir que a criação de salas funcione independentemente de payloads incorretos.

-- 1. Limpar Políticas Antigas da Tabela chat_rooms
DROP POLICY IF EXISTS "Users can create rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.chat_rooms;

-- 2. Criar Trigger para FORÇAR o created_by (Segurança e Consistência)
-- Isso garante que created_by seja sempre o usuário logado, evitando erros de RLS
CREATE OR REPLACE FUNCTION public.force_chat_created_by()
RETURNS TRIGGER AS $$
BEGIN
    NEW.created_by := auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_force_chat_created_by ON public.chat_rooms;
CREATE TRIGGER trg_force_chat_created_by
BEFORE INSERT ON public.chat_rooms
FOR EACH ROW
EXECUTE FUNCTION public.force_chat_created_by();

-- 3. Nova Política de Insert (Mais Permissiva mas Segura pelo Trigger)
-- Como o trigger acima garante o created_by, podemos permitir que qualquer autenticado inicie o insert.
CREATE POLICY "Authenticated users can create rooms"
    ON public.chat_rooms FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 4. Garantir que o Trigger de Adicionar Membro tenha Permissões de Root (SECURITY DEFINER)
-- Isso permite inserir na tabela chat_room_members mesmo sem ser admin ainda.
CREATE OR REPLACE FUNCTION public.add_creator_as_member()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.created_by IS NULL THEN
      RETURN NEW;
    END IF;

    -- SECURITY DEFINER permite ignorar a RLS da tabela chat_room_members aqui
    INSERT INTO public.chat_room_members (room_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (room_id, user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar o trigger pós-insert
DROP TRIGGER IF EXISTS trigger_add_creator_as_member ON public.chat_rooms;
CREATE TRIGGER trigger_add_creator_as_member
AFTER INSERT ON public.chat_rooms
FOR EACH ROW
EXECUTE FUNCTION public.add_creator_as_member();

-- 5. Garantir Permissões de Leitura
DROP POLICY IF EXISTS "Users can view rooms they are members of" ON public.chat_rooms;
CREATE POLICY "Users can view rooms they are members of"
    ON public.chat_rooms FOR SELECT
    USING (public.is_room_member(id));

-- 6. Garantir Permissões de Update
DROP POLICY IF EXISTS "Members can update room metadata" ON public.chat_rooms;
CREATE POLICY "Members can update room metadata"
    ON public.chat_rooms FOR UPDATE
    USING (public.is_room_member(id));
