// Banco local (IndexedDB via Dexie) — base do modo offline.
//
// Guarda uma cópia de cada tabela "viva" do Supabase, o perfil do usuário
// e uma fila de operações pendentes (`sync_outbox`) para sincronizar quando
// a rede voltar.
//
// Não faz filtro por user_id nas leituras — quem filtra é o caller, igual ao
// Supabase. Ao fazer logout, `limparCacheLocal()` apaga tudo.

import Dexie from "dexie";

export const db = new Dexie("simplify-db");

db.version(1).stores({
  profiles: "id",
  materias: "id, user_id, created_at",
  horarios: "id, materia_id",
  materiais: "id, materia_id, user_id",
  flashcard_colecoes: "id, materia_id, user_id, created_at",
  flashcards: "id, colecao_id, proximo_review, ultima_revisao",
  tarefas: "id, user_id, materia_id, data_entrega, concluido",
  tarefas_rotina: "id, user_id, concluido",
  provas: "id, user_id, materia_id, data",
  eventos_calendario: "id, user_id, data, tipo, origem",
  sync_outbox: "++id, tabela, operacao, timestamp",
  meta: "key",
});

/** Apaga TODO o cache local. Chame no logout. */
export async function limparCacheLocal() {
  await Promise.all([
    db.profiles.clear(),
    db.materias.clear(),
    db.horarios.clear(),
    db.materiais.clear(),
    db.flashcard_colecoes.clear(),
    db.flashcards.clear(),
    db.tarefas.clear(),
    db.tarefas_rotina.clear(),
    db.provas.clear(),
    db.eventos_calendario.clear(),
    db.sync_outbox.clear(),
    db.meta.clear(),
  ]);
}

/** Utilitário genérico para substituir o conteúdo de uma tabela de uma vez. */
export async function substituirTabela(nomeTabela, linhas) {
  await db.transaction("rw", db[nomeTabela], async () => {
    await db[nomeTabela].clear();
    if (linhas?.length) await db[nomeTabela].bulkPut(linhas);
  });
}

/** Utilitário genérico para inserir/atualizar várias linhas. */
export async function upsertEm(nomeTabela, linhas) {
  if (!linhas?.length) return;
  await db[nomeTabela].bulkPut(linhas);
}

/** Lê todas as linhas de uma tabela. */
export async function lerTudo(nomeTabela) {
  try {
    return await db[nomeTabela].toArray();
  } catch {
    return [];
  }
}

/** Meta key-value (ex.: `ultima_sync`). */
export async function getMeta(key, fallback = null) {
  const row = await db.meta.get(key);
  return row ? row.value : fallback;
}

export async function setMeta(key, value) {
  await db.meta.put({ key, value });
}
