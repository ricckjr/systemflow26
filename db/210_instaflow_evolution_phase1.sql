-- InstaFlow Evolution - Phase 1 (Reações, Threads, Menções, Moderação)

ALTER TABLE public.instaflow_likes
ADD COLUMN IF NOT EXISTS reaction text NOT NULL DEFAULT '❤️';

UPDATE public.instaflow_likes
SET reaction = '❤️'
WHERE reaction IS NULL OR reaction = '';

ALTER TABLE public.instaflow_comments
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.instaflow_comments(id) ON DELETE CASCADE;

ALTER TABLE public.instaflow_comments
ADD COLUMN IF NOT EXISTS mention_user_ids uuid[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.instaflow_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.instaflow_posts(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('EDIT_POST', 'DELETE_POST')),
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.instaflow_moderation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instaflow_moderation_log_select ON public.instaflow_moderation_log;
CREATE POLICY instaflow_moderation_log_select ON public.instaflow_moderation_log
FOR SELECT USING (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION public.instaflow_log_post_update() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content OR NEW.media_url IS DISTINCT FROM OLD.media_url THEN
    INSERT INTO public.instaflow_moderation_log (post_id, action, performed_by)
    VALUES (NEW.id, 'EDIT_POST', auth.uid());
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.instaflow_log_post_delete() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.instaflow_moderation_log (post_id, action, performed_by)
  VALUES (OLD.id, 'DELETE_POST', auth.uid());
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS instaflow_post_log_update ON public.instaflow_posts;
CREATE TRIGGER instaflow_post_log_update
AFTER UPDATE ON public.instaflow_posts
FOR EACH ROW EXECUTE FUNCTION public.instaflow_log_post_update();

DROP TRIGGER IF EXISTS instaflow_post_log_delete ON public.instaflow_posts;
CREATE TRIGGER instaflow_post_log_delete
AFTER DELETE ON public.instaflow_posts
FOR EACH ROW EXECUTE FUNCTION public.instaflow_log_post_delete();

CREATE OR REPLACE FUNCTION public.notify_instaflow_comment() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  post_author uuid;
BEGIN
  SELECT created_by INTO post_author
  FROM public.instaflow_posts
  WHERE id = NEW.post_id;

  INSERT INTO public.notifications (user_id, title, content, link, type)
  SELECT u.user_id,
         'Novo comentário no InstaFlow',
         NEW.content,
         '/comunidade/instaflow',
         'instaflow_comment'
  FROM (
    SELECT post_author AS user_id
    UNION
    SELECT DISTINCT c.created_by AS user_id
    FROM public.instaflow_comments c
    WHERE c.post_id = NEW.post_id
    UNION
    SELECT unnest(NEW.mention_user_ids) AS user_id
  ) u
  WHERE u.user_id IS NOT NULL
    AND u.user_id <> NEW.created_by;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS instaflow_comments_notify ON public.instaflow_comments;
CREATE TRIGGER instaflow_comments_notify
AFTER INSERT ON public.instaflow_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_instaflow_comment();

