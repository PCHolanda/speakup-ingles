-- Migration 006: Configuração de Chave de API e Modelo Gemini por Cliente
alter table clientes
  add column if not exists gemini_api_key text,
  add column if not exists gemini_model text default 'gemini-3.6-flash';

