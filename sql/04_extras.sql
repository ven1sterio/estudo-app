-- ============================================================
-- ESTUDO APP - Ajustes: descrições, cores, tipo de tarefa,
-- eventos manuais no calendário
-- Rode depois de 01, 02 e 03
-- ============================================================

-- Matérias: descrição opcional
alter table materias add column if not exists descricao text;

-- Baralhos de flashcards: descrição, cor própria e data da última revisão
alter table flashcard_colecoes add column if not exists descricao text;
alter table flashcard_colecoes add column if not exists cor text default '#8B85F0';
alter table flashcard_colecoes add column if not exists ultima_revisao timestamptz;

-- Tarefas acadêmicas: tipo, descrição e cor (herda da matéria se não definida)
alter table tarefas add column if not exists tipo text default 'atividade';
alter table tarefas add column if not exists descricao text;
alter table tarefas add column if not exists cor text;

alter table tarefas drop constraint if exists tarefas_tipo_check;
alter table tarefas add constraint tarefas_tipo_check
  check (tipo in ('prova', 'atividade', 'trabalho', 'seminario', 'lista', 'outro'));

-- Eventos do calendário: agora também podem ser criados manualmente
-- (não só pela trigger de provas), por isso ganham descrição, cor e mais tipos
alter table eventos_calendario add column if not exists descricao text;
alter table eventos_calendario add column if not exists cor text;

alter table eventos_calendario drop constraint if exists eventos_calendario_tipo_check;
alter table eventos_calendario add constraint eventos_calendario_tipo_check
  check (tipo in ('prova', 'trabalho', 'atividade', 'outro'));

-- materia_id passa a ser opcional (eventos "Outros" podem não ter matéria)
alter table eventos_calendario alter column materia_id drop not null;
