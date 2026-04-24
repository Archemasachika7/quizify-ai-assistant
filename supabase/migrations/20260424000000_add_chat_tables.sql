
-- Chat sessions — one per bot type per user conversation thread
CREATE TABLE public.chat_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_type    TEXT        NOT NULL CHECK (bot_type IN ('helper', 'cluebot')),
  title       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own chat sessions select" ON public.chat_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own chat sessions insert" ON public.chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own chat sessions update" ON public.chat_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Own chat sessions delete" ON public.chat_sessions FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_chat_sessions_updated
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Chat messages — individual turns stored per session
CREATE TABLE public.chat_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id, created_at);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chat messages select via session" ON public.chat_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.chat_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));
CREATE POLICY "Chat messages insert via session" ON public.chat_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.chat_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));
CREATE POLICY "Chat messages delete via session" ON public.chat_messages FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.chat_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));
