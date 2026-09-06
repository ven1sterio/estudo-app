-- ============================================================
-- ESTUDO APP - Módulos 4 e 5: Calendário, Tarefas e Rotina
-- Rode depois de 01_setup.sql e 02_flashcards.sql
-- ============================================================

-- 1. Eventos do calendário (alimentada automaticamente por triggers)
create table if not exists eventos_calendario (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  materia_id uuid references materias(id) on delete cascade,
  titulo text not null,
  data date not null,
  tipo text not null check (tipo in ('prova', 'trabalho')),
  created_at timestamptz default now()
);

alter table eventos_calendario enable row level security;

create policy "Usuário vê os próprios eventos"
  on eventos_calendario for select
  using (auth.uid() = user_id);

create policy "Usuário cria os próprios eventos"
  on eventos_calendario for insert
  with check (auth.uid() = user_id);

create policy "Usuário remove os próprios eventos"
  on eventos_calendario for delete
  using (auth.uid() = user_id);


-- 2. Provas (cadastradas dentro da matéria)
create table if not exists provas (
  id uuid primary key default gen_random_uuid(),
  materia_id uuid references materias(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  titulo text not null,
  data date not null,
  created_at timestamptz default now()
);

alter table provas enable row level security;

create policy "Usuário vê as próprias provas"
  on provas for select
  using (auth.uid() = user_id);

create policy "Usuário cria provas"
  on provas for insert
  with check (auth.uid() = user_id);

create policy "Usuário remove as próprias provas"
  on provas for delete
  using (auth.uid() = user_id);

-- Trigger: ao salvar uma prova, cria automaticamente o evento no calendário
create or replace function public.handle_new_prova()
returns trigger as $$
begin
  insert into public.eventos_calendario (user_id, materia_id, titulo, data, tipo)
  values (new.user_id, new.materia_id, new.titulo, new.data, 'prova');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_prova_created on provas;
create trigger on_prova_created
  after insert on provas
  for each row execute procedure public.handle_new_prova();

-- Se a prova for removida, remove o evento correspondente
create or replace function public.handle_delete_prova()
returns trigger as $$
begin
  delete from public.eventos_calendario
  where tipo = 'prova'
    and materia_id = old.materia_id
    and titulo = old.titulo
    and data = old.data
    and user_id = old.user_id;
  return old;
end;
$$ language plpgsql security definer;

drop trigger if exists on_prova_deleted on provas;
create trigger on_prova_deleted
  after delete on provas
  for each row execute procedure public.handle_delete_prova();


-- 3. Tarefas acadêmicas (associadas a uma matéria, com prazo e prioridade)
create table if not exists tarefas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  materia_id uuid references materias(id) on delete cascade not null,
  titulo text not null,
  data_entrega date not null,
  prioridade text not null default 'media' check (prioridade in ('alta', 'media', 'baixa')),
  concluido boolean default false,
  created_at timestamptz default now()
);

alter table tarefas enable row level security;

create policy "Usuário vê as próprias tarefas"
  on tarefas for select
  using (auth.uid() = user_id);

create policy "Usuário cria tarefas"
  on tarefas for insert
  with check (auth.uid() = user_id);

create policy "Usuário edita as próprias tarefas"
  on tarefas for update
  using (auth.uid() = user_id);

create policy "Usuário remove as próprias tarefas"
  on tarefas for delete
  using (auth.uid() = user_id);


-- 4. Checklist de rotina diária (lembretes soltos, sem matéria e sem prazo)
create table if not exists tarefas_rotina (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  titulo text not null,
  concluido boolean default false,
  data date, -- opcional: usado apenas se o usuário quiser fixar um dia
  created_at timestamptz default now()
);

alter table tarefas_rotina enable row level security;

create policy "Usuário vê os próprios lembretes"
  on tarefas_rotina for select
  using (auth.uid() = user_id);

create policy "Usuário cria lembretes"
  on tarefas_rotina for insert
  with check (auth.uid() = user_id);

create policy "Usuário edita os próprios lembretes"
  on tarefas_rotina for update
  using (auth.uid() = user_id);

create policy "Usuário remove os próprios lembretes"
  on tarefas_rotina for delete
  using (auth.uid() = user_id);
