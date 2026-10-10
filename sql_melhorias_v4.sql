-- APROVA ICET V4 — melhorias para simulados
-- Execute este arquivo no SQL Editor do Supabase ANTES de usar a nova tela de Simulados.

-- 1) Datas separadas para o Dia 1 e o Dia 2.
ALTER TABLE public.simulados
  ADD COLUMN IF NOT EXISTS data_dia1 DATE,
  ADD COLUMN IF NOT EXISTS data_dia2 DATE;

-- Mantém a coluna antiga para compatibilidade com a V3.

-- 2) Corrige a geração automática dos IDs dos simulados.
-- A tabela foi importada com IDs manuais; agora novos simulados precisam receber IDs automaticamente.
CREATE SEQUENCE IF NOT EXISTS public.simulados_id_seq;
SELECT setval(
  'public.simulados_id_seq',
  COALESCE((SELECT MAX(id) FROM public.simulados), 0) + 1,
  false
);
ALTER SEQUENCE public.simulados_id_seq OWNED BY public.simulados.id;
ALTER TABLE public.simulados ALTER COLUMN id SET DEFAULT nextval('public.simulados_id_seq');

-- 3) Prepara geração automática de IDs para novos alunos.
CREATE SEQUENCE IF NOT EXISTS public.alunos_id_seq;
SELECT setval(
  'public.alunos_id_seq',
  COALESCE((SELECT MAX(id) FROM public.alunos), 0) + 1,
  false
);
ALTER SEQUENCE public.alunos_id_seq OWNED BY public.alunos.id;
ALTER TABLE public.alunos ALTER COLUMN id SET DEFAULT nextval('public.alunos_id_seq');

-- 4) Prepara geração automática de IDs para novas questões.
CREATE SEQUENCE IF NOT EXISTS public.questoes_id_seq;
SELECT setval(
  'public.questoes_id_seq',
  COALESCE((SELECT MAX(id) FROM public.questoes), 0) + 1,
  false
);
ALTER SEQUENCE public.questoes_id_seq OWNED BY public.questoes.id;
ALTER TABLE public.questoes ALTER COLUMN id SET DEFAULT nextval('public.questoes_id_seq');

-- 5) Garante que as políticas de gestão necessárias continuem disponíveis.
DROP POLICY IF EXISTS "public_insert_simulados" ON public.simulados;
CREATE POLICY "public_insert_simulados"
ON public.simulados FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_simulados" ON public.simulados;
CREATE POLICY "public_update_simulados"
ON public.simulados FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_delete_simulados" ON public.simulados;
CREATE POLICY "public_delete_simulados"
ON public.simulados FOR DELETE TO anon USING (true);
