-- ==============================================================================
-- SpeakUp A1: Gerenciador de Usuários (Admin, Professores, Turmas e Alunos)
-- Execute este script completo de UMA SÓ VEZ no SQL Editor do Supabase.
-- ==============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------------------------
-- 1. FUNÇÃO: criar_admin(nome, email, senha)
-- Cria um Administrador com permissões completas de gestão (Portal Docente)
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

  -- Inserir em auth.users
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

  -- Inserir em auth.identities (id é UUID)
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_user_id, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(p_email))),
    'email', v_user_id::text,
    now(), now(), now()
  );

  -- Inserir perfil com acesso total de gestão (teacher)
  insert into profiles (id, papel, nome)
  values (v_user_id, 'teacher', p_nome);

  return v_user_id;
end;
$$ language plpgsql;


-- ------------------------------------------------------------------------------
-- 2. FUNÇÃO: criar_professor(nome, email, senha)
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

  -- Inserir em auth.users
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

  -- Inserir em auth.identities (id é UUID)
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_user_id, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(p_email))),
    'email', v_user_id::text,
    now(), now(), now()
  );

  -- Inserir perfil
  insert into profiles (id, papel, nome)
  values (v_user_id, 'teacher', p_nome);

  return v_user_id;
end;
$$ language plpgsql;


-- ------------------------------------------------------------------------------
-- 3. FUNÇÃO: criar_turma(email_do_professor, nome_da_turma, codigo_6_digitos)
-- Cria uma Turma vinculada ao professor
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
-- 4. FUNÇÃO: criar_aluno(codigo_da_turma, nome_do_aluno, pin_6_numeros)
-- Cria Aluno com PIN, email sintético e matrícula automática
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

  -- Inserir em auth.users
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

  -- Inserir em auth.identities (id é UUID)
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_aluno_id, v_aluno_id,
    jsonb_build_object('sub', v_aluno_id::text, 'email', v_synthetic_email),
    'email', v_aluno_id::text,
    now(), now(), now()
  );

  -- Inserir em profiles
  insert into profiles (id, papel, nome)
  values (v_aluno_id, 'student', p_nome_aluno);

  -- Matricular na turma
  insert into turma_alunos (turma_id, aluno_id)
  values (v_turma_id, v_aluno_id);

  return v_aluno_id;
end;
$$ language plpgsql;
