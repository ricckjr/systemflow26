-- Performance Indexes for Chat System
-- These indexes speed up message loading and room listing

-- 1. Index for fetching messages of a room (Critical for chat load speed)
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON public.chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);

-- 2. Index for listing user's rooms (Critical for sidebar load speed)
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_id ON public.chat_room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_room_id ON public.chat_room_members(room_id);

-- 3. Index for filtering rooms by type
CREATE INDEX IF NOT EXISTS idx_chat_rooms_type ON public.chat_rooms(type);

-- 4. Index for sorting rooms by activity
CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_message_at ON public.chat_rooms(last_message_at DESC);

-- 5. Foreign key indexes (Good practice for joins)
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_created_by ON public.chat_rooms(created_by);
