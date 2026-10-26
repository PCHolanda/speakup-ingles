-- ==============================================================================
-- SpeakUp: Corrige usuários criados via SQL que não conseguem logar
-- Erro corrigido: "Database error querying schema" / "Database error finding users"
-- Execute este script completo de UMA SÓ VEZ no SQL Editor do Supabase.
-- ==============================================================================

update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change               = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '');

-- Conferência: deve listar os usuários sem nenhum "NULL" nas colunas abaixo
select email, confirmation_token, recovery_token, email_change
from auth.users
order by created_at;
