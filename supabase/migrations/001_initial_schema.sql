-- Migration 001: Schema inicial do SpeakUp A1

-- 1. Enums
create type papel as enum ('teacher', 'student');
create type tipo_pergunta as enum ('oral', 'imagem', 'comparacao');

-- 2. Perfis de usuários (vinculado a auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  papel papel not null,
  nome text not null,
  created_at timestamptz default now()
);

-- 3. Turmas
create table turmas (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references profiles(id) on delete cascade,
  nome text not null,
  codigo char(6) unique not null,          -- código de acesso de 6 caracteres
  created_at timestamptz default now()
);

-- 4. Associação Turma <-> Aluno
create table turma_alunos (
  turma_id uuid references turmas(id) on delete cascade,
  aluno_id uuid references profiles(id) on delete cascade,
  primary key (turma_id, aluno_id)
);

-- 5. LGPD: Consentimento do responsável
create table consentimentos (
  aluno_id uuid primary key references profiles(id) on delete cascade,
  responsavel_nome text not null,
  aceito_em timestamptz not null default now(),
  versao_termo text not null default 'v1.0'
);

-- 6. Rate Limit para login de alunos (5 tentativas a cada 15 minutos)
create table login_tentativas (
  aluno_id uuid not null references profiles(id) on delete cascade,
  ip_address text,
  tentativas int not null default 1,
  primeira_tentativa timestamptz not null default now(),
  bloqueado_ate timestamptz,
  primary key (aluno_id)
);

-- 7. Banco de atividades (editável pelo professor; null = atividade padrão)
create table atividades (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid references profiles(id) on delete set null,
  titulo text not null,
  nivel text default 'A1',
  publicada boolean default false,
  created_at timestamptz default now()
);

-- 8. Perguntas da atividade
create table perguntas (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references atividades(id) on delete cascade,
  secao text not null,                     -- ex.: 'Apresentação pessoal'
  ordem int not null,
  tipo tipo_pergunta not null,
  enunciado text not null,                 -- texto em inglês lido pela IA
  instrucao_pt text,                       -- instrução auxiliar em português
  imagem_path text,                        -- Storage: bucket 'atividades'
  respostas_esperadas text[] not null,     -- modelos de resposta
  texto_referencia text,                   -- frase usada no scripted assessment (opcional)
  foco_avaliacao text[] not null,          -- ex.: {'pronúncia de years','números'}
  dicas text[] not null,                   -- dicas em ordem crescente; NUNCA a resposta pronta
  gabarito jsonb,                          -- para 'comparacao': lista de diferenças
  audio_pergunta_path text                 -- cache do TTS no bucket 'atividades'
);

-- 9. Sessões de aplicação de atividade
create table sessoes (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references profiles(id) on delete cascade,
  turma_id uuid not null references turmas(id) on delete cascade,
  atividade_id uuid not null references atividades(id) on delete cascade,
  iniciada_em timestamptz default now(),
  concluida_em timestamptz
);

-- 10. Respostas das perguntas
create table respostas (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references sessoes(id) on delete cascade,
  pergunta_id uuid not null references perguntas(id) on delete cascade,
  tentativa smallint not null check (tentativa between 1 and 2),
  nivel_dica smallint default 0,           -- 0 nenhuma, 1 repetiu devagar, 2 dica de estrutura
  audio_path text not null,                -- bucket privado 'respostas'
  transcricao text,
  azure_raw jsonb,                         -- resposta bruta do Pronunciation Assessment
  metricas jsonb,                          -- pausas, wpm, hesitações calculadas
  nota_pronuncia smallint check (nota_pronuncia between 1 and 4),
  nota_vocabulario smallint check (nota_vocabulario between 1 and 4),
  nota_fluencia smallint check (nota_fluencia between 1 and 4),
  nota_estrutura smallint check (nota_estrutura between 1 and 4),
  resultado text check (resultado in ('good_job','try_again')),
  feedback jsonb,                          -- {ponto_forte, ponto_melhorar, palavras:[...], diferencas_encontradas:[...]}
  revisado boolean default false,
  notas_professor jsonb,                   -- override do professor
  comentario_professor text,
  created_at timestamptz default now()
);

-- Índices para performance
create index idx_respostas_sessao on respostas (sessao_id);
create index idx_respostas_pergunta on respostas (pergunta_id);
create index idx_sessoes_aluno on sessoes (aluno_id);
create index idx_sessoes_turma on sessoes (turma_id);
create index idx_perguntas_atividade on perguntas (atividade_id, ordem);
create index idx_turmas_codigo on turmas (codigo);
