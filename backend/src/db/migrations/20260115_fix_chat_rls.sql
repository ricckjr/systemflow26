-- FIX RLS ERROR 42501 on Chat Creation
-- This script fixes the "new row violates row-level security policy for table chat_rooms" error
-- by ensuring the trigger that adds the creator as a member runs with elevated privileges.

-- 1. Redefine the Trigger Function with SECURITY DEFINER
-- This is critical: it allows the function to bypass the RLS policy on 'chat_room_members'
-- which otherwise blocks the insert because the user is not yet a member/admin.
CREATE OR REPLACE FUNCTION public.add_creator_as_member()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if created_by is set
    IF NEW.created_by IS NULL THEN
      RETURN NEW;
    END IF;

    -- Insert the creator as the owner of the room
    -- SECURITY DEFINER allows this INSERT even if the user doesn't pass the RLS check for 'chat_room_members'
    INSERT INTO public.chat_room_members (room_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (room_id, user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Reset Chat Rooms Insert Policy
-- Ensure the policy strictly checks that the user is claiming to be themselves
DROP POLICY IF EXISTS "Users can create rooms" ON public.chat_rooms;
CREATE POLICY "Users can create rooms"
    ON public.chat_rooms FOR INSERT
    WITH CHECK (auth.uid() = created_by);

-- 3. Reset Chat Room Members Insert Policy
-- This policy governs manual inserts (like adding OTHER users).
-- The self-add via trigger is handled by step 1.
DROP POLICY IF EXISTS "Room admins can add members" ON public.chat_room_members;
CREATE POLICY "Room admins can add members"
    ON public.chat_room_members FOR INSERT
    WITH CHECK (
        -- Only admins can add people
        public.is_room_admin(room_id)
        -- OR allows the creator (who is made admin by trigger) to add others immediately
        OR (
            auth.uid() = user_id -- If this was a self-join (not used currently but good backup)
        )
    );

-- 4. Verify/Recreate Trigger
DROP TRIGGER IF EXISTS trigger_add_creator_as_member ON public.chat_rooms;
CREATE TRIGGER trigger_add_creator_as_member
AFTER INSERT ON public.chat_rooms
FOR EACH ROW
EXECUTE FUNCTION public.add_creator_as_member();
