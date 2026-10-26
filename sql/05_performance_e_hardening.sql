-- ============================================================
-- ESTUDO APP - 05: Performance, hardening e evolução de schema
-- Rode depois de 01, 02, 03 e 04.
-- Este script é idempotente: pode ser executado várias vezes.
-- ============================================================

-- 1. Índices nas FKs e consultas mais frequentes -------------------------

create index if not exists idx_materiais_user        on materiais(user_id);
create index if not exists idx_materiais_materia     on materiais(materia_id);
create index if not exists idx_horarios_materia      on horarios(materia_id);
create index if not exists idx_colecoes_user         on flashcard_colecoes(user_id);
create index if not exists idx_colecoes_materia      on flashcard_colecoes(materia_id);
create index if not exists idx_flashcards_colecao    on flashcards(colecao_id);
create index if not exists idx_tarefas_user_data     on tarefas(user_id, data_entrega);
create index if not exists idx_eventos_user_data     on eventos_calendario(user_id, data);
create index if not exists idx_provas_materia        on provas(materia_id);
create index if not exists idx_tarefas_rotina_user   on tarefas_rotina(user_id);

-- 2. Hardening: search_path fixo nas funções SECURITY DEFINER ------------

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, new.raw_user_meta_data->>'nome');
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- 3. Eventos ligados à prova por id (evita eventos órfãos em update/delete) -

alter table eventos_calendario
  add column if not exists prova_id uuid
  references provas(id) on delete cascade;

-- Backfill: liga eventos existentes às provas correspondentes (melhor esforço)
update eventos_calendario ec
   set prova_id = p.id
  from provas p
 where ec.prova_id is null
   and ec.tipo       = 'prova'
   and ec.materia_id = p.materia_id
   and ec.titulo     = p.titulo
   and ec.data       = p.data
   and ec.user_id    = p.user_id;

create or replace function public.handle_new_prova()
returns trigger as $$
begin
  insert into public.eventos_calendario
    (user_id, materia_id, prova_id, titulo, data, tipo)
  values
    (new.user_id, new.materia_id, new.id, new.titulo, new.data, 'prova');
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.handle_update_prova()
returns trigger as $$
begin
  update public.eventos_calendario
     set titulo     = new.titulo,
         data       = new.data,
         materia_id = new.materia_id
   where prova_id = new.id;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.handle_delete_prova()
returns trigger as $$
begin
  delete from public.eventos_calendario where prova_id = old.id;
  return old;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists on_prova_created on provas;
create trigger on_prova_created
  after insert on provas
  for each row execute procedure public.handle_new_prova();

drop trigger if exists on_prova_updated on provas;
create trigger on_prova_updated
  after update on provas
  for each row execute procedure public.handle_update_prova();

drop trigger if exists on_prova_deleted on provas;
create trigger on_prova_deleted
  after delete on provas
  for each row execute procedure public.handle_delete_prova();

-- 4. updated_at + trigger em todas as tabelas "vivas" ---------------------

alter table profiles             add column if not exists updated_at timestamptz default now();
alter table materias             add column if not exists updated_at timestamptz default now();
alter table horarios             add column if not exists updated_at timestamptz default now();
alter table materiais            add column if not exists updated_at timestamptz default now();
alter table flashcard_colecoes   add column if not exists updated_at timestamptz default now();
alter table flashcards           add column if not exists updated_at timestamptz default now();
alter table eventos_calendario   add column if not exists updated_at timestamptz default now();
alter table provas               add column if not exists updated_at timestamptz default now();
alter table tarefas              add column if not exists updated_at timestamptz default now();
alter table tarefas_rotina       add column if not exists updated_at timestamptz default now();

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public, pg_temp;

drop trigger if exists trg_touch_profiles             on profiles;
drop trigger if exists trg_touch_materias             on materias;
drop trigger if exists trg_touch_horarios             on horarios;
drop trigger if exists trg_touch_materiais            on materiais;
drop trigger if exists trg_touch_flashcard_colecoes   on flashcard_colecoes;
drop trigger if exists trg_touch_flashcards           on flashcards;
drop trigger if exists trg_touch_eventos_calendario   on eventos_calendario;
drop trigger if exists trg_touch_provas               on provas;
drop trigger if exists trg_touch_tarefas              on tarefas;
drop trigger if exists trg_touch_tarefas_rotina       on tarefas_rotina;

create trigger trg_touch_profiles
  before update on profiles for each row
  execute procedure public.touch_updated_at();
create trigger trg_touch_materias
  before update on materias for each row
  execute procedure public.touch_updated_at();
create trigger trg_touch_horarios
  before update on horarios for each row
  execute procedure public.touch_updated_at();
create trigger trg_touch_materiais
  before update on materiais for each row
  execute procedure public.touch_updated_at();
create trigger trg_touch_flashcard_colecoes
  before update on flashcard_colecoes for each row
  execute procedure public.touch_updated_at();
create trigger trg_touch_flashcards
  before update on flashcards for each row
  execute procedure public.touch_updated_at();
create trigger trg_touch_eventos_calendario
  before update on eventos_calendario for each row
  execute procedure public.touch_updated_at();
create trigger trg_touch_provas
  before update on provas for each row
  execute procedure public.touch_updated_at();
create trigger trg_touch_tarefas
  before update on tarefas for each row
  execute procedure public.touch_updated_at();
create trigger trg_touch_tarefas_rotina
  before update on tarefas_rotina for each row
  execute procedure public.touch_updated_at();

-- 5. SM-2 (repetição espaçada) nos flashcards -----------------------------

alter table flashcards add column if not exists intervalo_dias int default 0;
alter table flashcards add column if not exists proximo_review date default current_date;
alter table flashcards add column if not exists acertos        int default 0;
alter table flashcards add column if not exists erros          int default 0;
alter table flashcards add column if not exists ultima_revisao timestamptz;

create index if not exists idx_flashcards_proximo_review on flashcards(proximo_review);

-- 6. Soft delete em matérias (etapa 3 dos fetchers vai filtrar por isso) --

alter table materias add column if not exists deleted_at timestamptz;
create index if not exists idx_materias_user_not_deleted
  on materias(user_id) where deleted_at is null;
