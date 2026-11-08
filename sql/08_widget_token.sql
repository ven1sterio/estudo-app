-- Adiciona o ID do aparelho para o widget buscar os dados sem precisar de token
alter table profiles add column if not exists device_id text;
create index if not exists idx_profiles_device_id on profiles(device_id);

-- Limpa a coluna antiga de token (caso já tenha rodado antes)
alter table profiles drop column if exists widget_token;
