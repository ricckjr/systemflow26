-- REFACTOR CHAT: Fix RLS and Add RPC for Direct Chat
-- 1. Fix RLS on chat_rooms to ensure INSERT works
DROP POLICY IF EXISTS "Users can create rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.chat_rooms;
DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.chat_rooms;

CREATE POLICY "Authenticated users can create rooms"
ON public.chat_rooms FOR INSERT
TO authenticated
WITH CHECK (
    -- Allow creation if the user sets themselves as creator
    auth.uid() = created_by
);

-- 2. Create RPC function to handle "Get or Create" logic atomically and securely
-- This avoids the complex client-side logic and multiple round-trips.
-- SECURITY DEFINER ensures it runs with privileges to create rooms/members even if RLS is strict.
CREATE OR REPLACE FUNCTION public.get_or_create_direct_chat(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id UUID;
    existing_room_id UUID;
    new_room_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Try to find existing direct room between these two users
    -- We look for a 'direct' room that has exactly these two members.
    SELECT r.id INTO existing_room_id
    FROM chat_rooms r
    WHERE r.type = 'direct'
    AND EXISTS (
        SELECT 1 FROM chat_room_members m 
        WHERE m.room_id = r.id AND m.user_id = current_user_id
    )
    AND EXISTS (
        SELECT 1 FROM chat_room_members m 
        WHERE m.room_id = r.id AND m.user_id = other_user_id
    );

    IF existing_room_id IS NOT NULL THEN
        RETURN existing_room_id;
    END IF;

    -- 2. Create new room
    INSERT INTO chat_rooms (type, created_by)
    VALUES ('direct', current_user_id)
    RETURNING id INTO new_room_id;

    -- 3. Add members
    -- Add creator (owner)
    INSERT INTO chat_room_members (room_id, user_id, role)
    VALUES (new_room_id, current_user_id, 'owner')
    ON CONFLICT (room_id, user_id) DO NOTHING;

    -- Add other user (member)
    INSERT INTO chat_room_members (room_id, user_id, role)
    VALUES (new_room_id, other_user_id, 'member')
    ON CONFLICT (room_id, user_id) DO NOTHING;

    RETURN new_room_id;
END;
$$;
