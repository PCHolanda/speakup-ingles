-- Migration 002: Row Level Security (RLS) Policies

-- Habilitar RLS em todas as tabelas
alter table profiles enable row level security;
alter table turmas enable row level security;
alter table turma_alunos enable row level security;
alter table consentimentos enable row level security;
alter table login_tentativas enable row level security;
alter table atividades enable row level security;
alter table perguntas enable row level security;
alter table sessoes enable row level security;
alter table respostas enable row level security;

-- Funções auxiliares para RLS
create or replace function is_teacher()
returns boolean security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and papel = 'teacher'
  );
$$ language sql stable;

create or replace function is_student()
returns boolean security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and papel = 'student'
  );
$$ language sql stable;

-- 1. PROFILES
create policy "Usuário pode ver o próprio perfil"
  on profiles for select
  using (id = auth.uid());

create policy "Professor pode ver perfis dos seus alunos"
  on profiles for select
  using (
    is_teacher() and (
      id = auth.uid() or
      id in (
        select ta.aluno_id from turma_alunos ta
        join turmas t on t.id = ta.turma_id
        where t.professor_id = auth.uid()
      )
    )
  );

create policy "Usuário pode atualizar o próprio perfil"
  on profiles for update
  using (id = auth.uid());

-- 2. TURMAS
create policy "Professor pode gerenciar suas turmas"
  on turmas for all
  using (professor_id = auth.uid());

create policy "Aluno pode ver as turmas em que está matriculado"
  on turmas for select
  using (
    id in (
      select turma_id from turma_alunos
      where aluno_id = auth.uid()
    )
  );

-- Rota pública para buscar turma por código no login do aluno
create or replace function get_turma_por_codigo(codigo_turma text)
returns table (turma_id uuid, turma_nome text, alunos jsonb)
security definer set search_path = public as $$
begin
  return query
  select 
    t.id as turma_id,
    t.nome as turma_nome,
    coalesce(
      jsonb_agg(
        jsonb_build_object('id', p.id, 'nome', p.nome) order by p.nome
      ) filter (where p.id is not null),
      '[]'::jsonb
    ) as alunos
  from turmas t
  left join turma_alunos ta on ta.turma_id = t.id
  left join profiles p on p.id = ta.aluno_id
  where t.codigo = upper(codigo_turma)
  group by t.id, t.nome;
end;
$$ language plpgsql;

-- 3. TURMA_ALUNOS
create policy "Professor pode gerenciar alunos de suas turmas"
  on turma_alunos for all
  using (
    turma_id in (
      select id from turmas where professor_id = auth.uid()
    )
  );

create policy "Aluno pode ver suas matrículas"
  on turma_alunos for select
  using (aluno_id = auth.uid());

-- 4. CONSENTIMENTOS
create policy "Aluno pode ver e criar seu consentimento"
  on consentimentos for select
  using (aluno_id = auth.uid());

create policy "Aluno pode registrar seu consentimento"
  on consentimentos for insert
  with check (aluno_id = auth.uid());

create policy "Professor pode ver consentimentos de seus alunos"
  on consentimentos for select
  using (
    aluno_id in (
      select ta.aluno_id from turma_alunos ta
      join turmas t on t.id = ta.turma_id
      where t.professor_id = auth.uid()
    )
  );

-- 5. ATIVIDADES
create policy "Professor pode gerenciar suas próprias atividades"
  on atividades for all
  using (professor_id = auth.uid());

create policy "Todos autenticados podem ver atividades padrão públicas"
  on atividades for select
  using (professor_id is null and publicada = true);

create policy "Aluno pode ver atividades publicadas de suas turmas"
  on atividades for select
  using (
    publicada = true and (
      professor_id is null or
      id in (
        select s.atividade_id from sessoes s
        join turma_alunos ta on ta.turma_id = s.turma_id
        where ta.aluno_id = auth.uid()
      )
    )
  );

-- 6. PERGUNTAS
create policy "Leitura de perguntas associada à atividade visível"
  on perguntas for select
  using (
    exists (
      select 1 from atividades a
      where a.id = perguntas.atividade_id
      and (
        (a.professor_id is null and a.publicada = true) or
        (a.professor_id = auth.uid()) or
        (a.publicada = true and exists (
          select 1 from turma_alunos ta where ta.aluno_id = auth.uid()
        ))
      )
    )
  );

create policy "Professor gerencia perguntas de suas atividades"
  on perguntas for all
  using (
    exists (
      select 1 from atividades a
      where a.id = perguntas.atividade_id and a.professor_id = auth.uid()
    )
  );

-- 7. SESSOES
create policy "Aluno gerencia suas próprias sessões"
  on sessoes for all
  using (aluno_id = auth.uid())
  with check (aluno_id = auth.uid());

create policy "Professor visualiza sessões dos alunos de suas turmas"
  on sessoes for select
  using (
    turma_id in (
      select id from turmas where professor_id = auth.uid()
    )
  );

-- 8. RESPOSTAS
create policy "Aluno visualiza suas próprias respostas"
  on respostas for select
  using (
    sessao_id in (
      select id from sessoes where aluno_id = auth.uid()
    )
  );

create policy "Aluno pode inserir sua resposta de áudio"
  on respostas for insert
  with check (
    sessao_id in (
      select id from sessoes where aluno_id = auth.uid()
    )
  );

create policy "Professor visualiza respostas de suas turmas"
  on respostas for select
  using (
    sessao_id in (
      select s.id from sessoes s
      join turmas t on t.id = s.turma_id
      where t.professor_id = auth.uid()
    )
  );

create policy "Professor pode atualizar notas e comentários de revisão"
  on respostas for update
  using (
    sessao_id in (
      select s.id from sessoes s
      join turmas t on t.id = s.turma_id
      where t.professor_id = auth.uid()
    )
  )
  with check (
    sessao_id in (
      select s.id from sessoes s
      join turmas t on t.id = s.turma_id
      where t.professor_id = auth.uid()
    )
  );

-- 9. CONFIGURAÇÃO DE BUCKETS DO STORAGE
-- Nota: Executado no Supabase para garantir permissões nos buckets:
-- Bucket 'atividades' (público para leitura)
-- Bucket 'respostas' (privado; upload restrito à pasta do aluno; leitura pelo professor)
insert into storage.buckets (id, name, public)
values ('atividades', 'atividades', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('respostas', 'respostas', false)
on conflict (id) do nothing;

create policy "Imagens e áudios de atividades são públicos para leitura"
  on storage.objects for select
  using (bucket_id = 'atividades');

create policy "Professor pode fazer upload em atividades"
  on storage.objects for insert
  with check (bucket_id = 'atividades' and is_teacher());

create policy "Aluno pode enviar áudios apenas em sua própria pasta"
  on storage.objects for insert
  with check (
    bucket_id = 'respostas' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Aluno pode ler seus próprios áudios"
  on storage.objects for select
  using (
    bucket_id = 'respostas' and
    (storage.foldername(name))[1] = auth.uid()::text
  );
