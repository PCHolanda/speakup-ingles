-- Migration 008: Gestão de Avaliações pelo Professor, Tempo de Gravação por Pergunta, Áudio Modelo do Professor e Avaliação Geral Final por IA

-- 1. Adicionar tempo máximo de gravação (5s, 10s, 20s) e caminho do áudio gravado pelo professor na tabela perguntas
ALTER TABLE perguntas
  ADD COLUMN IF NOT EXISTS tempo_gravacao_s smallint DEFAULT 10 CHECK (tempo_gravacao_s IN (5, 10, 20)),
  ADD COLUMN IF NOT EXISTS audio_modelo_professor_path text;

-- 2. Adicionar coluna avaliacao_geral na tabela sessoes para armazenar o diagnóstico consolidado da IA ao final da atividade
ALTER TABLE sessoes
  ADD COLUMN IF NOT EXISTS avaliacao_geral jsonb;

-- 3. Configurar tempo longo (20s) para a questão 10 (Comparação de imagens) e médio (10s) para as demais questões padrão
UPDATE perguntas
SET tempo_gravacao_s = 20
WHERE id = 'b0000000-0000-0000-0000-000000000010' OR tipo = 'comparacao';

UPDATE perguntas
SET tempo_gravacao_s = 10
WHERE tempo_gravacao_s IS NULL;
