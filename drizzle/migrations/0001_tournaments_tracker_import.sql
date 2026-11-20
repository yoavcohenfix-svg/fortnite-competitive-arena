ALTER TABLE public.tournaments ADD COLUMN source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.tournaments ADD COLUMN source_event_id text;
ALTER TABLE public.tournaments ADD COLUMN wins integer;
CREATE UNIQUE INDEX tournaments_user_source_event ON public.tournaments(user_id, source_event_id);