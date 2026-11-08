# Estado do projeto

_Atualizado em 2026-11-08T00:40:32.924Z_

## Objetivo
Schema: criar migration 07 com ALTER TABLE materias ADD COLUMN email_professor text; e ALTER TABLE horarios ADD COLUMN predio/bloco/sala text; — sem isso, o app perde dados em produção silenciosamente.

Offline: trocar as chamadas diretas do PlanoEnsinoAssistente por insertLocal e criar o evento_calendario local em handleAddProva.

IA: corrigir o nome do modelo Gemini.

TWA: alinhar package_name do public/manifest.json ao pacote Android real.

Refatoração: extrair <CalendarioView> para components/ (resolve a duplicação de uma vez).

.gitignore: ignorar public/sw.js, public/workbox-*.js, public/swe-worker-*.js.

adicionar arquivos: arquivos com acento ou c cedilha nao estao sendo aceitos

implemente todas as mudancas da melhor forma possivel

## Plano
(vazio)

## Funciona
- Etapa 1 aplicada e build OK (35.9s)

## Quebrado
(vazio)

## Decisões
(vazio)

## Rollbacks
(vazio)

## Última falha
Timeout aguardando a resposta do DeepSeek.

## Arquivos tocados
- sql/07_ajustes_schema.sql
- .gitignore
- pages/api/extrair-plano.js
- pages/api/extrair-matricula.js
- public/manifest.json
- components/PlanoEnsinoAssistente.js
- pages/materias/[id].js
