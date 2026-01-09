-- Tables
CREATE TABLE IF NOT EXISTS public.instaflow_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  media_url text,
  likes_count int NOT NULL DEFAULT 0,
  comments_count int NOT NULL DEFAULT 0,
  company_id text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.instaflow_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.instaflow_posts(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.instaflow_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.instaflow_posts(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (post_id, created_by)
);

CREATE TABLE IF NOT EXISTS public.instaflow_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.instaflow_posts(id) ON DELETE CASCADE,
  url text NOT NULL,
  type text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.instaflow_recognitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS instaflow_posts_created_idx ON public.instaflow_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS instaflow_comments_post_idx ON public.instaflow_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS instaflow_likes_post_idx ON public.instaflow_likes(post_id, created_at);
CREATE INDEX IF NOT EXISTS instaflow_media_post_idx ON public.instaflow_media(post_id, created_at);
CREATE INDEX IF NOT EXISTS instaflow_recognitions_user_idx ON public.instaflow_recognitions(user_id, created_at);

-- Triggers: maintain counters
CREATE OR REPLACE FUNCTION public.instaflow_update_comments_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.instaflow_posts SET comments_count = comments_count + 1, updated_at = now() WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.instaflow_posts SET comments_count = GREATEST(comments_count - 1, 0), updated_at = now() WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.instaflow_update_likes_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.instaflow_posts SET likes_count = likes_count + 1, updated_at = now() WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.instaflow_posts SET likes_count = GREATEST(likes_count - 1, 0), updated_at = now() WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS instaflow_comments_count_ins ON public.instaflow_comments;
DROP TRIGGER IF EXISTS instaflow_comments_count_del ON public.instaflow_comments;
CREATE TRIGGER instaflow_comments_count_ins AFTER INSERT ON public.instaflow_comments
FOR EACH ROW EXECUTE FUNCTION public.instaflow_update_comments_count();
CREATE TRIGGER instaflow_comments_count_del AFTER DELETE ON public.instaflow_comments
FOR EACH ROW EXECUTE FUNCTION public.instaflow_update_comments_count();

DROP TRIGGER IF EXISTS instaflow_likes_count_ins ON public.instaflow_likes;
DROP TRIGGER IF EXISTS instaflow_likes_count_del ON public.instaflow_likes;
CREATE TRIGGER instaflow_likes_count_ins AFTER INSERT ON public.instaflow_likes
FOR EACH ROW EXECUTE FUNCTION public.instaflow_update_likes_count();
CREATE TRIGGER instaflow_likes_count_del AFTER DELETE ON public.instaflow_likes
FOR EACH ROW EXECUTE FUNCTION public.instaflow_update_likes_count();

-- RLS & Policies (idempotent)
ALTER TABLE public.instaflow_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instaflow_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instaflow_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instaflow_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instaflow_recognitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instaflow_posts_select ON public.instaflow_posts;
DROP POLICY IF EXISTS instaflow_posts_insert ON public.instaflow_posts;
DROP POLICY IF EXISTS instaflow_posts_update ON public.instaflow_posts;
DROP POLICY IF EXISTS instaflow_posts_delete ON public.instaflow_posts;
DROP POLICY IF EXISTS instaflow_comments_select ON public.instaflow_comments;
DROP POLICY IF EXISTS instaflow_comments_insert ON public.instaflow_comments;
DROP POLICY IF EXISTS instaflow_comments_update ON public.instaflow_comments;
DROP POLICY IF EXISTS instaflow_comments_delete ON public.instaflow_comments;
DROP POLICY IF EXISTS instaflow_likes_select ON public.instaflow_likes;
DROP POLICY IF EXISTS instaflow_likes_insert ON public.instaflow_likes;
DROP POLICY IF EXISTS instaflow_likes_delete ON public.instaflow_likes;
DROP POLICY IF EXISTS instaflow_media_select ON public.instaflow_media;
DROP POLICY IF EXISTS instaflow_media_insert ON public.instaflow_media;
DROP POLICY IF EXISTS instaflow_media_delete ON public.instaflow_media;
DROP POLICY IF EXISTS instaflow_recognitions_select ON public.instaflow_recognitions;
DROP POLICY IF EXISTS instaflow_recognitions_insert ON public.instaflow_recognitions;
DROP POLICY IF EXISTS instaflow_recognitions_delete ON public.instaflow_recognitions;

CREATE POLICY instaflow_posts_select ON public.instaflow_posts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY instaflow_posts_insert ON public.instaflow_posts FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY instaflow_posts_update ON public.instaflow_posts FOR UPDATE USING (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.cargo = 'ADMIN')
) WITH CHECK (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.cargo = 'ADMIN')
);
CREATE POLICY instaflow_posts_delete ON public.instaflow_posts FOR DELETE USING (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.cargo = 'ADMIN')
);

CREATE POLICY instaflow_comments_select ON public.instaflow_comments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY instaflow_comments_insert ON public.instaflow_comments FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY instaflow_comments_update ON public.instaflow_comments FOR UPDATE USING (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.cargo = 'ADMIN')
) WITH CHECK (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.cargo = 'ADMIN')
);
CREATE POLICY instaflow_comments_delete ON public.instaflow_comments FOR DELETE USING (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.cargo = 'ADMIN')
);

CREATE POLICY instaflow_likes_select ON public.instaflow_likes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY instaflow_likes_insert ON public.instaflow_likes FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY instaflow_likes_delete ON public.instaflow_likes FOR DELETE USING (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.cargo = 'ADMIN')
);

CREATE POLICY instaflow_media_select ON public.instaflow_media FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY instaflow_media_insert ON public.instaflow_media FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY instaflow_media_delete ON public.instaflow_media FOR DELETE USING (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.cargo = 'ADMIN')
);

CREATE POLICY instaflow_recognitions_select ON public.instaflow_recognitions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY instaflow_recognitions_insert ON public.instaflow_recognitions FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY instaflow_recognitions_delete ON public.instaflow_recognitions FOR DELETE USING (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.cargo = 'ADMIN')
);

-- Feed view
CREATE OR REPLACE VIEW public.instaflow_feed AS
SELECT p.* FROM public.instaflow_posts p ORDER BY p.created_at DESC;
