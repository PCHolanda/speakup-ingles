-- Migration 004: Tabela de configurações do sistema (Modelo de IA, etc.)
create table if not exists configuracoes (
  chave text primary key,
  valor text not null,
  descricao text,
  updated_at timestamptz default now()
);

-- Habilitar RLS
alter table configuracoes enable row level security;

-- Política para service_role (Admin API tem acesso total)
create policy "Acesso total para service_role em configuracoes"
  on configuracoes
  for all
  to service_role
  using (true)
  with check (true);

-- Política de leitura pública/autenticada
create policy "Leitura de configuracoes para autenticados"
  on configuracoes
  for select
  to authenticated
  using (true);

-- Inserir valor padrão do modelo Gemini
insert into configuracoes (chave, valor, descricao)
values ('gemini_model', 'gemini-3.8-flash', 'Modelo do Google Gemini utilizado para avaliação de pronúncia')
on conflict (chave) do nothing;
