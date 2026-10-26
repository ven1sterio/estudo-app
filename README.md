# Estudo App — SIMPLIFY

App de estudos pessoal: matérias, materiais (PDF/DOCX/imagens), flashcards com
repetição espaçada, tarefas, lembretes de rotina e calendário mensal.

Funciona como **PWA offline-first** e está pronto para ser empacotado como
**app Android** (via TWA/Bubblewrap) e publicado na Play Store.

## Módulos implementados

- **Autenticação e onboarding**: cadastro, login, recuperação de senha, onboarding.
- **Disciplinas**: cadastro de matérias (nome, código, professor, cor), horários
  (com prédio/bloco/sala), upload de materiais por tópico/playlist e edição
  completa da matéria e horários.
- **Flashcards**: baralhos por matéria, cartões (Lado A / Lado B), modo de estudo
  com repetição espaçada (SM-2), **import/export CSV** e contagem de cartões
  para revisar hoje.
- **Checklists, tarefas e rotina**: views (Tudo / Hoje / Esta semana / Feitas),
  grupos por matéria colapsáveis, checkbox circular, edição inline ao clicar
  no título, menu contextual (renomear/remover), subtítulo discreto e criação
  inline.
- **Calendário inteligente**: visão mensal, filtros por tipo, painel do dia
  selecionado, eventos manuais e form rápido de prova dentro da matéria
  (trigger do banco cria o evento no calendário automaticamente).
- **Assistente (IA)**: upload de plano de ensino (extrai avaliações) e de
  comprovante de matrícula do SIGAA (cria matérias e horários).
- **Grade semanal**: terceira visualização em `/materias`.
- **Streak**: contador de dias consecutivos com revisão de flashcard no dashboard.
- **Modo escuro**: toggle na sidebar/header mobile, persistência em
  `localStorage`, detecção automática de `prefers-color-scheme` e anti-FOUC.
- **PWA offline-first** (ver abaixo).

---

## Modo offline

O app detecta automaticamente `navigator.onLine` e o evento `online`/`offline`.
Toda leitura passa por uma camada **Dexie (IndexedDB)** e toda escrita é
**enfileirada em um outbox** para sincronizar quando a rede voltar.

### Arquitetura
