// Fila de sincronização (outbox) — implementa o "escreve local primeiro,
// envia depois".
//
// Fluxo:
//  1. `enfileirar(tabela, operacao, payload)` grava a intenção no Dexie.
//  2. `processarFila()` é chamada quando o app fica online (e também pode
//     ser chamada manualmente no botão "Sincronizar agora").
//  3. Cada operação é aplicada no Supabase; se falhar, incrementa `tentativas`
//     e, após `MAX_TENTATIVAS`, descarta para não travar a fila.
//
// Regras de conflito: como o app é single-user, usamos Last-Write-Wins
// baseado em `updated_at`. Operações são aplicadas em ordem de `timestamp`.

import { db } from "./db";
import { supabase } from "./supabaseClient";
import { isOnline } from "./network";

const MAX_TENTATIVAS = 5;

/**
 * @param {string} tabela   — nome da tabela no Supabase
 * @param {"insert"|"update"|"delete"|"upsert"} operacao
 * @param {object} payload  — para update/delete inclui `id`
 * @param {string} [idLocal] — id temporário usado no Dexie (para insert)
 */
export async function enfileirar(tabela, operacao, payload, idLocal = null) {
  return db.sync_outbox.add({
    tabela,
    operacao,
    payload,
    idLocal,
    timestamp: Date.now(),
    tentativas: 0,
  });
}

export async function tamanhoFila() {
  return db.sync_outbox.count();
}

/** Aplica uma operação no Supabase. Lança em caso de erro. */
async function aplicarNoSupabase(op) {
  const { tabela, operacao, payload } = op;

  if (operacao === "insert") {
    const { error } = await supabase.from(tabela).insert(payload);
    if (error) throw error;
    return;
  }
  if (operacao === "upsert") {
    const { error } = await supabase.from(tabela).upsert(payload);
    if (error) throw error;
    return;
  }
  if (operacao === "update") {
    const { id, ...rest } = payload;
    if (!id) throw new Error(`update sem id em ${tabela}`);
    const { error } = await supabase.from(tabela).update(rest).eq("id", id);
    if (error) throw error;
    return;
  }
  if (operacao === "delete") {
    if (!payload?.id) throw new Error(`delete sem id em ${tabela}`);
    const { error } = await supabase.from(tabela).delete().eq("id", payload.id);
    if (error) throw error;
    return;
  }
  throw new Error(`Operação desconhecida: ${operacao}`);
}

let processando = false;

/**
 * Processa a fila inteira em ordem. Retorna um relatório.
 * Chame quando `navigator.onLine` for verdadeiro.
 */
export async function processarFila() {
  if (processando) return { ok: true, processadas: 0, erros: 0, ignorado: true };
  if (!isOnline()) return { ok: false, motivo: "offline", processadas: 0, erros: 0 };

  processando = true;
  try {
    const ops = await db.sync_outbox.orderBy("timestamp").toArray();
    let processadas = 0;
    let erros = 0;

    for (const op of ops) {
      try {
        await aplicarNoSupabase(op);
        await db.sync_outbox.delete(op.id);
        processadas++;
      } catch (e) {
        const tentativas = (op.tentativas || 0) + 1;
        if (tentativas >= MAX_TENTATIVAS) {
          // Descartar para não travar. O erro real vai para o console.
          console.warn(
            `[sync] descartando operação após ${tentativas} tentativas`,
            op,
            e
          );
          await db.sync_outbox.delete(op.id);
        } else {
          await db.sync_outbox.update(op.id, { tentativas });
        }
        erros++;
      }
    }

    return { ok: erros === 0, processadas, erros };
  } finally {
    processando = false;
  }
}

/**
 * Atalho usado pelas páginas: só processa se estiver online.
 * Retorna silenciosamente quando offline — o `useSyncOutbox` fará o flush
 * automático assim que a conexão voltar.
 */
export async function sincronizarAgoraSeOnline() {
  if (!isOnline()) return { ok: false, offline: true, processadas: 0, erros: 0 };
  return processarFila();
}

/** Remove uma operação específica (ex.: usuário cancelou). */
export async function cancelarOperacao(id) {
  await db.sync_outbox.delete(id);
}

/** Lista a fila (debug / UI). */
export async function listarFila() {
  return db.sync_outbox.orderBy("timestamp").toArray();
}
