-- ==============================================================================
-- SpeakUp A1: Gerenciador Oficial de Usuários (Admin, Professores, Turmas, Alunos)
-- Execute este script no SQL Editor do Supabase.
-- ==============================================================================

-- 1. Habilitar suporte a Admin no enum de perfis
alter type papel add value if not exists 'admin';

-- 2. Garantir extensão pgcrypto no schema extensions
create extension if not exists pgcrypto with schema extensions;

-- 3. Atualizar função RLS para que Administradores também tenham acesso total
create or replace function is_teacher()
returns boolean security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and (papel = 'teacher' or papel = 'admin')
  );
$$ language sql stable;


-- ------------------------------------------------------------------------------
-- FUNÇÃO 1: criar_admin(nome, email, senha)
-- Cria um Administrador Geral do sistema (acesso a tudo)
-- ------------------------------------------------------------------------------
create or replace function criar_admin(
  p_nome text,
  p_email text,
  p_senha text
) returns uuid security definer set search_path = public, extensions, auth as $$
declare
  v_user_id uuid := gen_random_uuid();
  v_encrypted_pw text;
begin
  if exists (select 1 from auth.users where email = lower(trim(p_email))) then
    raise exception 'O e-mail % já está cadastrado!', p_email;
  end if;

  v_encrypted_pw := extensions.crypt(p_senha, extensions.gen_salt('bf'));

  -- 1. Inserir em auth.users
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    lower(trim(p_email)), v_encrypted_pw, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', p_nome),
    now(), now()
  );

  -- 2. Inserir em auth.identities (obrigatório para login no Supabase)
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_user_id::text, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(p_email))),
    'email', v_user_id::text,
    now(), now(), now()
  );

  -- 3. Inserir perfil com papel 'admin'
  insert into profiles (id, papel, nome)
  values (v_user_id, 'admin', p_nome);

  return v_user_id;
end;
$$ language plpgsql;


-- ------------------------------------------------------------------------------
-- FUNÇÃO 2: criar_professor(nome, email, senha)
-- Cria um Professor vinculado ao Portal Docente
-- ------------------------------------------------------------------------------
create or replace function criar_professor(
  p_nome text,
  p_email text,
  p_senha text
) returns uuid security definer set search_path = public, extensions, auth as $$
declare
  v_user_id uuid := gen_random_uuid();
  v_encrypted_pw text;
begin
  if exists (select 1 from auth.users where email = lower(trim(p_email))) then
    raise exception 'O e-mail % já está cadastrado!', p_email;
  end if;

  v_encrypted_pw := extensions.crypt(p_senha, extensions.gen_salt('bf'));

  -- 1. Inserir em auth.users
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    lower(trim(p_email)), v_encrypted_pw, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', p_nome),
    now(), now()
  );

  -- 2. Inserir em auth.identities
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_user_id::text, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(p_email))),
    'email', v_user_id::text,
    now(), now(), now()
  );

  -- 3. Inserir perfil com papel 'teacher'
  insert into profiles (id, papel, nome)
  values (v_user_id, 'teacher', p_nome);

  return v_user_id;
end;
$$ language plpgsql;


-- ------------------------------------------------------------------------------
-- FUNÇÃO 3: criar_turma(email_do_professor, nome_da_turma, codigo_6_digitos)
-- Cria uma Turma vinculada ao e-mail do professor informado
-- ------------------------------------------------------------------------------
create or replace function criar_turma(
  p_professor_email text,
  p_nome_turma text,
  p_codigo text
) returns uuid security definer set search_path = public, extensions, auth as $$
declare
  v_prof_id uuid;
  v_turma_id uuid := gen_random_uuid();
  v_cod text := upper(trim(p_codigo));
begin
  if length(v_cod) != 6 then
    raise exception 'O código da turma deve ter exatamente 6 caracteres (ex: TURMB2)!';
  end if;

  select id into v_prof_id from auth.users where email = lower(trim(p_professor_email));
  if v_prof_id is null then
    raise exception 'Professor com e-mail % não foi encontrado!', p_professor_email;
  end if;

  insert into turmas (id, professor_id, nome, codigo)
  values (v_turma_id, v_prof_id, p_nome_turma, v_cod);

  return v_turma_id;
end;
$$ language plpgsql;


-- ------------------------------------------------------------------------------
-- FUNÇÃO 4: criar_aluno(codigo_da_turma, nome_do_aluno, pin_6_numeros)
-- Cria um Aluno com PIN, e-mail sintético e matrícula automática na turma
-- ------------------------------------------------------------------------------
create or replace function criar_aluno(
  p_codigo_turma text,
  p_nome_aluno text,
  p_pin text
) returns uuid security definer set search_path = public, extensions, auth as $$
declare
  v_aluno_id uuid := gen_random_uuid();
  v_turma_id uuid;
  v_synthetic_email text;
  v_encrypted_pw text;
begin
  if length(trim(p_pin)) != 6 then
    raise exception 'O PIN do aluno deve conter exatamente 6 dígitos numéricos (ex: 112233)!';
  end if;

  select id into v_turma_id from turmas where codigo = upper(trim(p_codigo_turma));
  if v_turma_id is null then
    raise exception 'Turma com código % não foi encontrada!', p_codigo_turma;
  end if;

  v_synthetic_email := 'aluno-' || v_aluno_id || '@speakup.local';
  v_encrypted_pw := extensions.crypt(trim(p_pin), extensions.gen_salt('bf'));

  -- 1. Inserir em auth.users
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    v_aluno_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    v_synthetic_email, v_encrypted_pw, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', p_nome_aluno),
    now(), now()
  );

  -- 2. Inserir em auth.identities
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_aluno_id::text, v_aluno_id,
    jsonb_build_object('sub', v_aluno_id::text, 'email', v_synthetic_email),
    'email', v_aluno_id::text,
    now(), now(), now()
  );

  -- 3. Inserir em profiles
  insert into profiles (id, papel, nome)
  values (v_aluno_id, 'student', p_nome_aluno);

  -- 4. Matricular na turma
  insert into turma_alunos (turma_id, aluno_id)
  values (v_turma_id, v_aluno_id);

  return v_aluno_id;
end;
$$ language plpgsql;
