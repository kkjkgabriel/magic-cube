-- APROVA ICET V9 — Lançamento e edição de resultados
-- Execute uma vez no SQL Editor do Supabase.
ALTER TABLE public.respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_respostas" ON public.respostas;
CREATE POLICY "public_insert_respostas"
ON public.respostas FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_respostas" ON public.respostas;
CREATE POLICY "public_update_respostas"
ON public.respostas FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_delete_respostas" ON public.respostas;
CREATE POLICY "public_delete_respostas"
ON public.respostas FOR DELETE TO anon USING (true);

CREATE INDEX IF NOT EXISTS idx_respostas_aluno_simulado_dia
ON public.respostas(aluno_id, simulado, dia);
