APROVA ICET — V26

Base: APROVA-ICET-v25

O V26 mantém as funções do V25 e acrescenta uma área DOCUMENTOS para reproduzir as saídas de relatório do programa Python usando os dados atuais do Supabase.

NOVO:
- Relatório individual em Word compatível (.doc).
- Relatório da turma em Word compatível (.doc).
- Relatório geral com todos os alunos ativos em Word compatível (.doc).
- Relatório por Área Aprova em Word compatível (.doc).
- Comparativo de uma Área Aprova entre simulados em Word compatível (.doc).
- Exportação do desempenho por disciplina em CSV.
- Pré-visualização antes da impressão/PDF.
- Frequência incluída no relatório individual.
- Desempenho por área, disciplina, simulado/dia e questões críticas incluído nos relatórios.
- Novo menu DOCUMENTOS em todas as telas principais.

IMPORTANTE:
- Os documentos usam os dados do Supabase; não dependem da planilha histórica.
- O relatório da turma e o geral consideram alunos ativos (presente_na_aba_alunos = true).
- O arquivo .doc é HTML compatível com Microsoft Word e pode ser aberto pelo Word/LibreOffice.
- Para gerar PDF, use "Imprimir / salvar em PDF" na tela de Documentos.
- Não é necessário executar SQL novo para as funções de relatório.
