-- Migration 005: Estrutura Multiescolar Hierárquica
-- Hierarquia: Cliente (Rede/Mantenedora) -> Escola (Unidade) -> Turmas / Professores / Alunos

-- 1. Tabela de Clientes (Rede de Ensino, Franquia, Município, Mantenedora)
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,                          -- CNPJ, código corporativo ou identificador
  email_contato text,
  telefone_contato text,
  ativo boolean default true,
  created_at timestamptz default now()
);

-- 2. Tabela de Escolas (Unidades de Ensino vinculadas ao Cliente)
create table if not exists escolas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  nome text not null,
  codigo_inep text,                       -- Código INEP/MEC ou código interno
  cidade text,
  estado varchar(2),
  ativo boolean default true,
  created_at timestamptz default now()
);

-- 3. Vincular Turmas à Escola
alter table turmas 
  add column if not exists escola_id uuid references escolas(id) on delete set null;

-- 4. Associação de Professores com Escolas (um professor pode atuar em uma ou mais escolas)
create table if not exists escola_professores (
  escola_id uuid not null references escolas(id) on delete cascade,
  professor_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (escola_id, professor_id)
);

-- 5. Índices para consultas eficientes
create index if not exists idx_escolas_cliente on escolas(cliente_id);
create index if not exists idx_turmas_escola on turmas(escola_id);
create index if not exists idx_escola_professores_prof on escola_professores(professor_id);

-- 6. Habilitar RLS
alter table clientes enable row level security;
alter table escolas enable row level security;
alter table escola_professores enable row level security;

-- 7. Políticas de acesso seguro (RLS)
-- Service Role tem acesso total (Admin API)
create policy "Acesso total service_role clientes" on clientes for all to service_role using (true) with check (true);
create policy "Acesso total service_role escolas" on escolas for all to service_role using (true) with check (true);
create policy "Acesso total service_role escola_professores" on escola_professores for all to service_role using (true) with check (true);

-- Leitura para usuários autenticados
create policy "Leitura autenticada clientes" on clientes for select to authenticated using (true);
create policy "Leitura autenticada escolas" on escolas for select to authenticated using (true);
create policy "Leitura autenticada escola_professores" on escola_professores for select to authenticated using (true);

-- 8. Migração de dados legados:
-- Cria um Cliente e uma Escola padrão para as turmas existentes não ficarem sem associação
do $$
declare
  v_cliente_id uuid;
  v_escola_id uuid;
begin
  if not exists (select 1 from clientes limit 1) then
    insert into clientes (nome, documento, email_contato)
    values ('Rede SpeakUp Oficial', '00.000.000/0001-00', 'contato@speakup.local')
    returning id into v_cliente_id;

    insert into escolas (cliente_id, nome, cidade, estado)
    values (v_cliente_id, 'Escola Principal (Matriz)', 'São Paulo', 'SP')
    returning id into v_escola_id;

    -- Associar turmas existentes sem escola
    update turmas set escola_id = v_escola_id where escola_id is null;

    -- Associar professores existentes à escola matriz
    insert into escola_professores (escola_id, professor_id)
    select v_escola_id, id from profiles where papel = 'teacher'
    on conflict do nothing;
  end if;
end $$;
