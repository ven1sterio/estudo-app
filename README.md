# Estudo App — SIMPLIFY

App de estudos pessoal: matérias, materiais (PDF/DOCX/imagens), flashcards com
repetição espaçada, tarefas, lembretes de rotina e calendário mensal.

## Módulos implementados

- **Autenticação e onboarding**: cadastro, login, recuperação de senha, onboarding.
- **Disciplinas**: cadastro de matérias (nome, código, professor, cor), horários
  (com prédio/bloco/sala), upload de materiais por tópico/playlist e edição
  completa da matéria e horários.
- **Flashcards**: baralhos por matéria, cartões (Lado A / Lado B), modo de estudo
  com repetição espaçada (SM-2), **import/export CSV** e contagem de cartões
  para revisar hoje.
- **Checklists, tarefas e rotina**: agora **estilo Notion** — views (Tudo / Hoje /
  Esta semana / Feitas), grupos por matéria colapsáveis, checkbox circular, edição
  inline ao clicar no título, menu contextual (renomear/remover), subtítulo
  discreto (data relativa · prioridade · tipo) e criação inline.
- **Calendário inteligente**: visão mensal, filtros por tipo, painel do dia
  selecionado, eventos manuais e form rápido de prova dentro da matéria
  (trigger do banco cria o evento no calendário automaticamente).
- **Assistente (IA)**: upload de plano de ensino (extrai avaliações) e de
  comprovante de matrícula do SIGAA (cria matérias e horários).
- **Grade semanal**: terceira visualização em `/materias`.
- **Streak**: contador de dias consecutivos com revisão de flashcard no dashboard.
- **Modo escuro**: toggle na sidebar/header mobile, persistência em
  `localStorage`, detecção automática de `prefers-color-scheme` e anti-FOUC
  (script inline no `_app` aplica a classe antes do React montar).
- **PWA básico**: manifest + ícone SVG, instalável no navegador.

## Como rodar

### 1. Configurar o Supabase
No **SQL Editor**, rode na ordem:

1. `sql/01_setup.sql` — `profiles`, `materias`, `horarios`, `materiais`, RLS,
   bucket `materiais`, trigger de criação de perfil.
2. `sql/02_flashcards.sql` — `flashcard_colecoes`, `flashcards`, RLS.
3. `sql/03_calendario_tarefas.sql` — `eventos_calendario`, `provas` (com trigger
   que gera o evento), `tarefas`, `tarefas_rotina`.
4. `sql/04_extras.sql` — descrições, cores, tipo em tarefas, eventos manuais.
5. `sql/05_performance_e_hardening.sql` — índices, `search_path` seguro nas
   funções `SECURITY DEFINER`, `updated_at` + trigger, `prova_id` em
   `eventos_calendario`, colunas SM-2 nos flashcards, `deleted_at` em matérias.
6. `sql/06_flashcards_ease.sql` — coluna `ease` que o SM-2 usa.

Em **Authentication > Providers** o Email já vem habilitado. Em
**Authentication > URL Configuration**, adicione `http://localhost:3000` e a URL
de deploy em Redirect URLs (necessário para o fluxo de nova senha).

### 2. Variáveis de ambiente
Crie um `.env.local` na raiz:
