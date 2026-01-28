-- InstaFlow - Phase 2 (fixes: deletar/editar posts + reações em comentários)

-- 1) Moderation log: permitir INSERT via trigger (e também manualmente de forma restrita)
DROP POLICY IF EXISTS instaflow_moderation_log_insert ON public.instaflow_moderation_log;
CREATE POLICY instaflow_moderation_log_insert ON public.instaflow_moderation_log
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND performed_by = auth.uid()
);

-- 2) Fix: log de DELETE não pode ser AFTER DELETE com FK para posts
CREATE OR REPLACE FUNCTION public.instaflow_log_post_delete() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.instaflow_moderation_log (post_id, action, performed_by)
  VALUES (OLD.id, 'DELETE_POST', auth.uid());
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS instaflow_post_log_delete ON public.instaflow_posts;
CREATE TRIGGER instaflow_post_log_delete
BEFORE DELETE ON public.instaflow_posts
FOR EACH ROW EXECUTE FUNCTION public.instaflow_log_post_delete();

-- 3) Ajuste de policy para DELETE em comentários/likes: permitir moderação pelo autor do post
DROP POLICY IF EXISTS instaflow_comments_delete ON public.instaflow_comments;
CREATE POLICY instaflow_comments_delete ON public.instaflow_comments
FOR DELETE USING (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.cargo = 'ADMIN')
  OR EXISTS(SELECT 1 FROM public.instaflow_posts ip WHERE ip.id = instaflow_comments.post_id AND ip.created_by = auth.uid())
);

DROP POLICY IF EXISTS instaflow_likes_delete ON public.instaflow_likes;
CREATE POLICY instaflow_likes_delete ON public.instaflow_likes
FOR DELETE USING (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.cargo = 'ADMIN')
  OR EXISTS(SELECT 1 FROM public.instaflow_posts ip WHERE ip.id = instaflow_likes.post_id AND ip.created_by = auth.uid())
);

-- 4) Reações em comentários
CREATE TABLE IF NOT EXISTS public.instaflow_comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.instaflow_posts(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES public.instaflow_comments(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction text NOT NULL DEFAULT '❤️',
  created_at timestamptz DEFAULT now(),
  UNIQUE (comment_id, created_by)
);

CREATE INDEX IF NOT EXISTS instaflow_comment_likes_comment_idx ON public.instaflow_comment_likes(comment_id, created_at);
CREATE INDEX IF NOT EXISTS instaflow_comment_likes_post_idx ON public.instaflow_comment_likes(post_id, created_at);

ALTER TABLE public.instaflow_comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instaflow_comment_likes_select ON public.instaflow_comment_likes;
DROP POLICY IF EXISTS instaflow_comment_likes_insert ON public.instaflow_comment_likes;
DROP POLICY IF EXISTS instaflow_comment_likes_update ON public.instaflow_comment_likes;
DROP POLICY IF EXISTS instaflow_comment_likes_delete ON public.instaflow_comment_likes;

CREATE POLICY instaflow_comment_likes_select ON public.instaflow_comment_likes
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY instaflow_comment_likes_insert ON public.instaflow_comment_likes
FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY instaflow_comment_likes_update ON public.instaflow_comment_likes
FOR UPDATE USING (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.cargo = 'ADMIN')
) WITH CHECK (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.cargo = 'ADMIN')
);

CREATE POLICY instaflow_comment_likes_delete ON public.instaflow_comment_likes
FOR DELETE USING (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.cargo = 'ADMIN')
  OR EXISTS(SELECT 1 FROM public.instaflow_posts ip WHERE ip.id = instaflow_comment_likes.post_id AND ip.created_by = auth.uid())
);

-- 5) Realtime publication
DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.instaflow_comment_likes';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

