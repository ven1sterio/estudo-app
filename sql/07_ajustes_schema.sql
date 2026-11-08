-- ============================================================
-- ESTUDO APP - 07: Ajustes de Schema (email, locais e auditoria)
-- Rode depois de 01 a 06.
-- ============================================================

-- Matérias: adiciona e-mail do professor (usado nos formulários)
alter table materias add column if not exists email_professor text;

-- Horários: adiciona campos de local (prédio, bloco, sala)
alter table horarios add column if not exists predio text;
alter table horarios add column if not exists bloco text;
alter table horarios add column if not exists sala text;
