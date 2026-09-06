-- ============================================================
-- ESTUDO APP - Módulo 3: Coleções de Flashcards
-- Rode este script no SQL Editor do seu projeto Supabase
-- (depois de já ter rodado o 01_setup.sql)
-- ============================================================

-- 1. Tabela de coleções (baralhos) de flashcards
create table if not exists flashcard_colecoes (
  id uuid primary key default gen_random_uuid(),
  materia_id uuid references materias(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  nome_colecao text not null,
  created_at timestamptz default now()
);

alter table flashcard_colecoes enable row level security;

create policy "Usuário vê as próprias coleções"
  on flashcard_colecoes for select
  using (auth.uid() = user_id);

create policy "Usuário cria coleções"
  on flashcard_colecoes for insert
  with check (auth.uid() = user_id);

create policy "Usuário edita as próprias coleções"
  on flashcard_colecoes for update
  using (auth.uid() = user_id);

create policy "Usuário remove as próprias coleções"
  on flashcard_colecoes for delete
  using (auth.uid() = user_id);


-- 2. Tabela de flashcards (cartões dentro de uma coleção)
create table if not exists flashcards (
  id uuid primary key default gen_random_uuid(),
  colecao_id uuid references flashcard_colecoes(id) on delete cascade not null,
  frente text not null,
  verso text not null,
  created_at timestamptz default now()
);

alter table flashcards enable row level security;

-- Acesso via join: só mexe em cards de coleções que são do próprio usuário
create policy "Usuário vê os próprios flashcards"
  on flashcards for select
  using (
    exists (
      select 1 from flashcard_colecoes
      where flashcard_colecoes.id = flashcards.colecao_id
      and flashcard_colecoes.user_id = auth.uid()
    )
  );

create policy "Usuário cria flashcards nas próprias coleções"
  on flashcards for insert
  with check (
    exists (
      select 1 from flashcard_colecoes
      where flashcard_colecoes.id = flashcards.colecao_id
      and flashcard_colecoes.user_id = auth.uid()
    )
  );

create policy "Usuário edita os próprios flashcards"
  on flashcards for update
  using (
    exists (
      select 1 from flashcard_colecoes
      where flashcard_colecoes.id = flashcards.colecao_id
      and flashcard_colecoes.user_id = auth.uid()
    )
  );

create policy "Usuário remove os próprios flashcards"
  on flashcards for delete
  using (
    exists (
      select 1 from flashcard_colecoes
      where flashcard_colecoes.id = flashcards.colecao_id
      and flashcard_colecoes.user_id = auth.uid()
    )
  );
