// Helpers de persistência local (Dexie) + enfileiramento no outbox.
//
// Dois grupos:
//  - "salvar*Cache": usados pelos fetchers quando a rede responde. Apenas
//    espelham o servidor no Dexie (sem outbox).
//  - "insertLocal / updateLocal / deleteLocal / deleteMateriaLocal": usados
//    pelos componentes para escrita offline — gravam no Dexie E enfileiram
//    no outbox. O UUID é gerado no cliente para que o servidor use o MESMO
//    id; assim o `bulkPut` do fetcher não duplica linhas após sincronizar.

import { db } from "./db";
import { enfileirar } from "./sync";

/* ------------------------- Espelhamento de cache ------------------------- */

export async function salvarCache(tabela, linhas) {
  if (!linhas?.length) return;
  await db[tabela].bulkPut(linhas);
}

/**
 * Salva matérias + horários aninhados. Substitui os horários daquelas
 * matérias antes (uma edição de horário pode remover entradas antigas).
 */
export async function salvarMateriasCache(materias) {
  if (!materias?.length) return;
  const ids = materias.map((m) => m.id);
  const semNested = [];
  const todosHorarios = [];
  for (const m of materias) {
    const { horarios, ...resto } = m;
    semNested.push(resto);
    if (Array.isArray(horarios)) {
      for (const h of horarios) todosHorarios.push({ ...h, materia_id: m.id });
    }
  }
  await db.transaction("rw", db.materias, db.horarios, async () => {
    await db.materias.bulkPut(semNested);
    for (const id of ids) {
      await db.horarios.where("materia_id").equals(id).delete();
    }
    if (todosHorarios.length) await db.horarios.bulkPut(todosHorarios);
  });
}

/**
 * Salva coleções. Extrai `materias: { nome, cor }` para a tabela `materias`
 * (para o join offline funcionar mesmo em telas que só carregam coleções).
 * O `flashcards: [{ count }]` é derivado na leitura.
 */
export async function salvarColecoesCache(colecoes) {
  if (!colecoes?.length) return;
  const semNested = [];
  const materiasPorId = new Map();
  for (const c of colecoes) {
    const { materias, flashcards, ...resto } = c;
    semNested.push(resto);
    if (materias && c.materia_id) {
      materiasPorId.set(c.materia_id, {
        nome: materias.nome,
        ...(materias.cor ? { cor: materias.cor } : {}),
      });
    }
  }
  await db.flashcard_colecoes.bulkPut(semNested);
  for (const [id, patch] of materiasPorId) {
    const exist = await db.materias.get(id);
    if (exist) await db.materias.update(id, patch);
    else await db.materias.put({ id, ...patch });
  }
}

/**
 * Salva uma lista qualquer que tenha `materias` aninhado (tarefas, provas,
 * eventos). Guarda a linha principal e faz upsert do `nome/cor` da matéria.
 */
export async function salvarListaComMaterias(tabela, linhas) {
  if (!linhas?.length) return;
  const semNested = [];
  const materiasPorId = new Map();
  for (const item of linhas) {
    const { materias, ...resto } = item;
    semNested.push(resto);
    if (materias && item.materia_id) {
      const atual = materiasPorId.get(item.materia_id) || {};
      materiasPorId.set(item.materia_id, { ...atual, ...materias });
    }
  }
  await db[tabela].bulkPut(semNested);
  for (const [id, patch] of materiasPorId) {
    const exist = await db.materias.get(id);
    if (exist) await db.materias.update(id, patch);
    else await db.materias.put({ id, ...patch });
  }
}

/* --------------------------- Escrita offline ---------------------------- */

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 (evita payloads com formato inválido)
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += "-";
    else if (i === 14) s += "4";
    else if (i === 19) s += hex[(Math.floor(Math.random() * 4) + 8)];
    else s += hex[Math.floor(Math.random() * 16)];
  }
  return s;
}

export async function insertLocal(tabela, linha) {
  const id = linha.id || uuid();
  const completa = { ...linha, id };
  await db[tabela].put(completa);
  await enfileirar(tabela, "insert", completa, id);
  return completa;
}

export async function updateLocal(tabela, id, patch) {
  await db[tabela].update(id, patch);
  await enfileirar(tabela, "update", { id, ...patch });
  return db[tabela].get(id);
}

export async function deleteLocal(tabela, id) {
  await db[tabela].delete(id);
  await enfileirar(tabela, "delete", { id });
}

/**
 * Exclusão de matéria com cascata local + enfileiramento único.
 * O servidor tem `on delete cascade` — basta enfileirar o delete da matéria
 * que todas as linhas filhas (horários, materiais, coleções, cartões,
 * tarefas, provas, eventos) são removidas lá também.
 *
 * Localmente limpamos as tabelas filhas para o join offline não devolver
 * "fantasmas" enquanto a sincronização não acontece.
 */
export async function deleteMateriaLocal(materiaId) {
  // Flashcards ficam nas coleções; apaga antes das coleções
  const colecoes = await db.flashcard_colecoes
    .where("materia_id")
    .equals(materiaId)
    .toArray();
  for (const c of colecoes) {
    await db.flashcards.where("colecao_id").equals(c.id).delete();
  }

  await db.flashcard_colecoes.where("materia_id").equals(materiaId).delete();
  await db.materiais.where("materia_id").equals(materiaId).delete();
  await db.horarios.where("materia_id").equals(materiaId).delete();
  await db.tarefas.where("materia_id").equals(materiaId).delete();
  await db.provas.where("materia_id").equals(materiaId).delete();
  await db.eventos_calendario.where("materia_id").equals(materiaId).delete();
  await db.materias.delete(materiaId);

  await enfileirar("materias", "delete", { id: materiaId });
}
