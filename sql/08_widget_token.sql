-- Adiciona um token seguro para o widget buscar os dados
alter table profiles add column if not exists widget_token text default replace(gen_random_uuid()::text, '-', '');

-- Gera token para usuários existentes
update profiles set widget_token = replace(gen_random_uuid()::text, '-', '') where widget_token is null;
