-- ============================================================
-- ESTUDO APP - 06: coluna `ease` para o SM-2
-- Rode depois de 05_performance_e_hardening.sql.
-- A função calcularProximoReview em lib/sm2.js devolve `ease`, mas
-- a migration 05 não criava essa coluna. Sem ela, o UPDATE
-- silenciosamente falha e o SM-2 fica preso no ease default (2.5).
-- ============================================================

alter table flashcards add column if not exists ease numeric default 2.5;

-- Opcional: preencher cartões antigos que porventura estejam com NULL
update flashcards set ease = 2.5 where ease is null;
