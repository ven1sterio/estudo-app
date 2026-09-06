# Estudo App — Módulos 1 e 2

Implementado até aqui:
- **Módulo 1 — Autenticação e Onboarding**: cadastro, login, recuperação de senha, onboarding.
- **Módulo 2 — Disciplinas**: cadastro de matérias (nome, código, professor, cor), local e horário, upload de materiais (PDFs/imagens) por tópico.
- **Módulo 3 — Flashcards**: baralhos por matéria, cartões (Lado A/Lado B), modo de estudo interativo (virar cartão, marcar "sabia"/"não sabia", placar final).
- **Módulo 5 — Checklists, Tarefas e Rotina**: duas categorias, como combinado —
  - **Lembretes de rotina**: checkbox que risca (strikethrough) o item ao marcar como feito, sem matéria nem prazo.
  - **Tarefas acadêmicas**: associadas a uma matéria, com data de entrega e prioridade (Alta/Média/Baixa), também com checkbox de conclusão.
- **Módulo 4 — Calendário Inteligente**: visão mensal com navegação entre meses, eventos automáticos (provas cadastradas na matéria e tarefas com data de entrega aparecem coloridas por matéria), filtros para ocultar/exibir Provas, Trabalhos e Hábitos, e painel lateral com o detalhe do dia selecionado.
- **Automação de provas (fechando o Módulo 2)**: formulário rápido dentro da matéria para cadastrar provas — ao salvar, uma trigger no banco cria automaticamente o evento no calendário.

## Como rodar

### 1. Configurar o Supabase
No **SQL Editor** do seu projeto Supabase, rode nesta ordem:
1. `sql/01_setup.sql` — cria `profiles`, `materias`, `horarios`, `materiais`, políticas de RLS, o bucket `materiais` e o trigger de criação de perfil.
2. `sql/02_flashcards.sql` — cria `flashcard_colecoes` e `flashcards`, com as políticas de RLS.
3. `sql/03_calendario_tarefas.sql` — cria `eventos_calendario`, `provas` (com trigger que gera o evento automaticamente), `tarefas` e `tarefas_rotina`, todas com RLS.
4. `sql/04_extras.sql` — adiciona descrição em matérias/baralhos, cor e "última revisão" nos baralhos, campo `tipo` e `cor` em tarefas, e permite eventos manuais no calendário.

Depois, confira em **Authentication > Providers** se "Email" está habilitado (já vem por padrão).

Em **Authentication > URL Configuration**, adicione a URL do seu app (ex: `http://localhost:3000` em dev) em "Redirect URLs" — necessário para o fluxo de recuperação de senha.

### 2. Configurar as variáveis de ambiente
```bash
cp .env.local.example .env.local
```
Preencha com a URL e a chave anon do seu projeto (Project Settings > API).

### 3. Instalar e rodar
```bash
npm install
npm run dev
```
Acesse `http://localhost:3000`.

## Estrutura de páginas
```
pages/
  index.js          → Landing / Welcome
  login.js          → Login
  cadastro.js        → Cadastro
  recuperar-senha.js → Solicitar reset de senha
  nova-senha.js       → Definir nova senha (link do email)
  onboarding.js       → Questionário do primeiro acesso
  dashboard.js        → Dashboard principal (protegida)
  materias/
    index.js          → Lista + criação de matérias (protegida)
    [id].js            → Detalhe da matéria + upload de materiais (protegida)
    [id]/flashcards/
      index.js                    → Lista de baralhos da matéria
      [colecaoId]/index.js         → Gerenciar cartões (Lado A / Lado B) de um baralho
      [colecaoId]/estudar.js       → Modo de estudo (player de flashcards)
  calendario.js        → Calendário mensal (protegida)
  tarefas.js            → Lembretes de rotina + tarefas acadêmicas (protegida)
```

## Todos os módulos do projeto original estão implementados 🎉
Sugestões de próximos passos, se quiser evoluir o app:
- Visões de semana/dia no calendário (hoje só tem visão mensal).
- Notificações/lembretes por email para provas e entregas próximas.
- Edição de matérias, horários e cartões existentes (hoje dá para criar/remover, editar só existe em flashcards).

## Deploy na Vercel
1. Suba este projeto para um repositório privado no GitHub.
2. Conecte o repositório na Vercel.
3. Configure as mesmas variáveis de `.env.local` no painel da Vercel (Settings > Environment Variables).
4. Deploy automático a cada push.
