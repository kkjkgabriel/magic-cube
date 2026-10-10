APROVA ICET — V25

Nesta versão a tela de Simulados foi melhorada:
- Cadastro com data do Dia 1 e data do Dia 2.
- Edição do nome e das datas de simulados já cadastrados.
- Código do simulado permanece fixo para preservar as questões vinculadas.
- Correção da geração automática de IDs para novos simulados, alunos e questões.
- Mantém os dados já existentes no Supabase.

ANTES DE TESTAR:
1. Abra o Supabase > SQL Editor.
2. Execute o arquivo sql_melhorias_v4.sql.
3. Abra a nova versão pelo Live Server.

IMPORTANTE:
As políticas continuam públicas temporariamente, conforme combinado. Antes do uso definitivo, implemente autenticação da equipe.


V25 — FREQUÊNCIA / SUPABASE
- Mantém o sistema existente de alunos, simulados, questões e respostas.
- A frequência histórica é lida diretamente da tabela public.frequencias no Supabase.
- A tela Frequência permite carregar e editar dias históricos.
- A tela individual do aluno mostra resumo e histórico diário por mês.
- Esta versão inclui diagnóstico visual da conexão e da quantidade de registros de frequência carregados.


V26: consulte README-V26.txt para as novas funções de Documentos e relatórios exportáveis.
