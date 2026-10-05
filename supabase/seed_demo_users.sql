-- Seed: Usuários de Demonstração (Professor e Aluno) para Testes Locais
-- Execute este script no SQL Editor do Supabase após rodar 001_initial_schema.sql e 002_rls_policies.sql.

create extension if not exists pgcrypto;

-- 1. Professor Demo no Supabase Auth
-- Login: professor@demo.com / Senha: password123
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  'e0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'professor@demo.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"nome":"Professor Demo"}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

-- 2. Perfil do Professor
insert into profiles (id, papel, nome)
values (
  'e0000000-0000-0000-0000-000000000001',
  'teacher',
  'Professor Demo'
)
on conflict (id) do nothing;

-- 3. Turma Demo (Código: DEMO01) - UUID válido usando caracteres hexadecimais (0-9, a-f)
insert into turmas (id, professor_id, nome, codigo)
values (
  'c0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001',
  'Turma A1 - Iniciante',
  'DEMO01'
)
on conflict (id) do nothing;

-- 4. Aluno Demo no Supabase Auth
-- Email sintético: aluno-d3b07384-d113-44f2-9014-a1e4a64ef0f9@speakup.local
-- PIN: 123456
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  'd3b07384-d113-44f2-9014-a1e4a64ef0f9',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'aluno-d3b07384-d113-44f2-9014-a1e4a64ef0f9@speakup.local',
  crypt('123456', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"nome":"Lucas Silva"}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

-- 5. Perfil do Aluno
insert into profiles (id, papel, nome)
values (
  'd3b07384-d113-44f2-9014-a1e4a64ef0f9',
  'student',
  'Lucas Silva'
)
on conflict (id) do nothing;

-- 6. Matrícula do Aluno Lucas Silva na Turma DEMO01
insert into turma_alunos (turma_id, aluno_id)
values (
  'c0000000-0000-0000-0000-000000000001',
  'd3b07384-d113-44f2-9014-a1e4a64ef0f9'
)
on conflict do nothing;
