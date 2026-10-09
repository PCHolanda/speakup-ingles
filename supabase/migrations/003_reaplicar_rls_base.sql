-- Migration 003: Reaplicar as policies de RLS base (idempotente)
--
-- Diagnóstico (06/10): RLS habilitada mas SEM policies efetivas.
-- Até `atividades` padrão (professor_id null, publicada = true) voltava [] para
-- anon e para usuário autenticado. As policies da 002 não estão no banco.
-- Este script pode ser executado quantas vezes for necessário.

-- Funções auxiliares (security definer: leem profiles sem passar pela RLS,
-- evitando recursão quando usadas dentro de policies de profiles)
create or replace function is_teacher()
returns boolean security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and papel = 'teacher');
$$ language sql stable;

create or replace function is_student()
returns boolean security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and papel = 'student');
$$ language sql stable;

-- Turmas do professor logado (security definer: evita recursão turmas <-> turma_alunos)
create or replace function minhas_turmas_professor()
returns setof uuid security definer set search_path = public as $$
  select id from turmas where professor_id = auth.uid();
$$ language sql stable;

-- Alunos das turmas do professor logado
create or replace function meus_alunos_professor()
returns setof uuid security definer set search_path = public as $$
  select ta.aluno_id from turma_alunos ta
  join turmas t on t.id = ta.turma_id
  where t.professor_id = auth.uid();
$$ language sql stable;

alter table profiles enable row level security;
alter table turmas enable row level security;
alter table turma_alunos enable row level security;
alter table consentimentos enable row level security;
alter table login_tentativas enable row level security;
alter table atividades enable row level security;
alter table perguntas enable row level security;
alter table sessoes enable row level security;
alter table respostas enable row level security;

-- 1. PROFILES
drop policy if exists "Usuário pode ver o próprio perfil" on profiles;
create policy "Usuário pode ver o próprio perfil"
  on profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "Professor pode ver perfis dos seus alunos" on profiles;
create policy "Professor pode ver perfis dos seus alunos"
  on profiles for select to authenticated
  using (id in (select meus_alunos_professor()));

drop policy if exists "Usuário pode atualizar o próprio perfil" on profiles;
create policy "Usuário pode atualizar o próprio perfil"
  on profiles for update to authenticated
  using (id = auth.uid());

-- 2. TURMAS
drop policy if exists "Professor pode gerenciar suas turmas" on turmas;
create policy "Professor pode gerenciar suas turmas"
  on turmas for all to authenticated
  using (professor_id = auth.uid())
  with check (professor_id = auth.uid());

drop policy if exists "Aluno pode ver as turmas em que está matriculado" on turmas;
create policy "Aluno pode ver as turmas em que está matriculado"
  on turmas for select to authenticated
  using (id in (select turma_id from turma_alunos where aluno_id = auth.uid()));

-- 3. TURMA_ALUNOS
drop policy if exists "Professor pode gerenciar alunos de suas turmas" on turma_alunos;
create policy "Professor pode gerenciar alunos de suas turmas"
  on turma_alunos for all to authenticated
  using (turma_id in (select minhas_turmas_professor()))
  with check (turma_id in (select minhas_turmas_professor()));

drop policy if exists "Aluno pode ver suas matrículas" on turma_alunos;
create policy "Aluno pode ver suas matrículas"
  on turma_alunos for select to authenticated
  using (aluno_id = auth.uid());

-- 4. CONSENTIMENTOS
drop policy if exists "Aluno pode ver e criar seu consentimento" on consentimentos;
create policy "Aluno pode ver e criar seu consentimento"
  on consentimentos for select to authenticated
  using (aluno_id = auth.uid());

drop policy if exists "Aluno pode registrar seu consentimento" on consentimentos;
create policy "Aluno pode registrar seu consentimento"
  on consentimentos for insert to authenticated
  with check (aluno_id = auth.uid());

drop policy if exists "Professor pode ver consentimentos de seus alunos" on consentimentos;
create policy "Professor pode ver consentimentos de seus alunos"
  on consentimentos for select to authenticated
  using (aluno_id in (select meus_alunos_professor()));

-- 5. ATIVIDADES
drop policy if exists "Professor pode gerenciar suas próprias atividades" on atividades;
create policy "Professor pode gerenciar suas próprias atividades"
  on atividades for all to authenticated
  using (professor_id = auth.uid())
  with check (professor_id = auth.uid());

drop policy if exists "Todos autenticados podem ver atividades padrão públicas" on atividades;
create policy "Todos autenticados podem ver atividades padrão públicas"
  on atividades for select to authenticated
  using (professor_id is null and publicada = true);

drop policy if exists "Aluno pode ver atividades publicadas de suas turmas" on atividades;
create policy "Aluno pode ver atividades publicadas de suas turmas"
  on atividades for select to authenticated
  using (
    publicada = true and id in (
      select s.atividade_id from sessoes s
      join turma_alunos ta on ta.turma_id = s.turma_id
      where ta.aluno_id = auth.uid()
    )
  );

-- 6. PERGUNTAS
drop policy if exists "Leitura de perguntas associada à atividade visível" on perguntas;
create policy "Leitura de perguntas associada à atividade visível"
  on perguntas for select to authenticated
  using (
    exists (
      select 1 from atividades a
      where a.id = perguntas.atividade_id
        and ((a.professor_id is null and a.publicada = true)
             or a.professor_id = auth.uid()
             or a.publicada = true)
    )
  );

drop policy if exists "Professor gerencia perguntas de suas atividades" on perguntas;
create policy "Professor gerencia perguntas de suas atividades"
  on perguntas for all to authenticated
  using (exists (select 1 from atividades a where a.id = perguntas.atividade_id and a.professor_id = auth.uid()))
  with check (exists (select 1 from atividades a where a.id = perguntas.atividade_id and a.professor_id = auth.uid()));

-- 7. SESSOES
drop policy if exists "Aluno gerencia suas próprias sessões" on sessoes;
create policy "Aluno gerencia suas próprias sessões"
  on sessoes for all to authenticated
  using (aluno_id = auth.uid())
  with check (aluno_id = auth.uid());

drop policy if exists "Professor visualiza sessões dos alunos de suas turmas" on sessoes;
create policy "Professor visualiza sessões dos alunos de suas turmas"
  on sessoes for select to authenticated
  using (turma_id in (select minhas_turmas_professor()));

-- 8. RESPOSTAS
drop policy if exists "Aluno visualiza suas próprias respostas" on respostas;
create policy "Aluno visualiza suas próprias respostas"
  on respostas for select to authenticated
  using (sessao_id in (select id from sessoes where aluno_id = auth.uid()));

drop policy if exists "Aluno pode inserir sua resposta de áudio" on respostas;
create policy "Aluno pode inserir sua resposta de áudio"
  on respostas for insert to authenticated
  with check (sessao_id in (select id from sessoes where aluno_id = auth.uid()));

drop policy if exists "Professor visualiza respostas de suas turmas" on respostas;
create policy "Professor visualiza respostas de suas turmas"
  on respostas for select to authenticated
  using (sessao_id in (select id from sessoes where turma_id in (select minhas_turmas_professor())));

drop policy if exists "Professor pode atualizar notas e comentários de revisão" on respostas;
create policy "Professor pode atualizar notas e comentários de revisão"
  on respostas for update to authenticated
  using (sessao_id in (select id from sessoes where turma_id in (select minhas_turmas_professor())))
  with check (sessao_id in (select id from sessoes where turma_id in (select minhas_turmas_professor())));

-- Conferência: deve listar as policies por tabela
select tablename, count(*) as policies
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;
