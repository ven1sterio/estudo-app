-- ============================================================
-- ESTUDO APP - Setup inicial (Módulos 1 e 2)
-- Rode este script no SQL Editor do seu projeto Supabase
-- ============================================================

-- 1. Tabela de perfis (dados extras do usuário, além do auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  foto_url text,
  faculdade text,
  curso text,
  semestre int,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Usuário vê o próprio perfil"
  on profiles for select
  using (auth.uid() = id);

create policy "Usuário edita o próprio perfil"
  on profiles for update
  using (auth.uid() = id);

create policy "Usuário cria o próprio perfil"
  on profiles for insert
  with check (auth.uid() = id);


-- 2. Tabela de matérias
create table if not exists materias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  nome text not null,
  codigo text,
  professor text,
  email_professor text,
  cor text default '#6C5CE7',
  predio text,
  bloco text,
  sala text,
  created_at timestamptz default now()
);

alter table materias enable row level security;

create policy "Usuário vê as próprias matérias"
  on materias for select
  using (auth.uid() = user_id);

create policy "Usuário cria matérias"
  on materias for insert
  with check (auth.uid() = user_id);

create policy "Usuário edita as próprias matérias"
  on materias for update
  using (auth.uid() = user_id);

create policy "Usuário remove as próprias matérias"
  on materias for delete
  using (auth.uid() = user_id);


-- 3. Tabela de horários (aulas da matéria)
create table if not exists horarios (
  id uuid primary key default gen_random_uuid(),
  materia_id uuid references materias(id) on delete cascade not null,
  dia_semana int not null check (dia_semana between 0 and 6), -- 0=Domingo ... 6=Sábado
  hora_inicio time not null,
  hora_fim time not null,
  created_at timestamptz default now()
);

alter table horarios enable row level security;

-- Política via join: só acessa horários de matérias que são do próprio usuário
create policy "Usuário vê horários das próprias matérias"
  on horarios for select
  using (
    exists (
      select 1 from materias
      where materias.id = horarios.materia_id
      and materias.user_id = auth.uid()
    )
  );

create policy "Usuário cria horários nas próprias matérias"
  on horarios for insert
  with check (
    exists (
      select 1 from materias
      where materias.id = horarios.materia_id
      and materias.user_id = auth.uid()
    )
  );

create policy "Usuário edita horários das próprias matérias"
  on horarios for update
  using (
    exists (
      select 1 from materias
      where materias.id = horarios.materia_id
      and materias.user_id = auth.uid()
    )
  );

create policy "Usuário remove horários das próprias matérias"
  on horarios for delete
  using (
    exists (
      select 1 from materias
      where materias.id = horarios.materia_id
      and materias.user_id = auth.uid()
    )
  );


-- 4. Tabela de materiais (PDFs, imagens, slides)
create table if not exists materiais (
  id uuid primary key default gen_random_uuid(),
  materia_id uuid references materias(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  titulo text not null,
  arquivo_url text not null,
  topico text default 'Geral',
  created_at timestamptz default now()
);

alter table materiais enable row level security;

create policy "Usuário vê os próprios materiais"
  on materiais for select
  using (auth.uid() = user_id);

create policy "Usuário envia materiais"
  on materiais for insert
  with check (auth.uid() = user_id);

create policy "Usuário remove os próprios materiais"
  on materiais for delete
  using (auth.uid() = user_id);


-- 5. Trigger: cria o registro em "profiles" automaticamente ao cadastrar
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, new.raw_user_meta_data->>'nome');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- STORAGE: Bucket "materiais"
-- ============================================================
-- Crie o bucket manualmente em Storage > New bucket > nome: materiais
-- Marque como "Public bucket" (para facilitar o acesso aos links de PDFs)
-- Depois rode as políticas abaixo:

insert into storage.buckets (id, name, public)
values ('materiais', 'materiais', true)
on conflict (id) do nothing;

create policy "Usuário faz upload nos próprios arquivos"
  on storage.objects for insert
  with check (
    bucket_id = 'materiais'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Usuário vê os próprios arquivos"
  on storage.objects for select
  using (
    bucket_id = 'materiais'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Usuário remove os próprios arquivos"
  on storage.objects for delete
  using (
    bucket_id = 'materiais'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
