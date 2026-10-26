// Fetchers offline-first.
//
// Cada fetcher segue o padrão:
//   - Se `navigator.onLine` for falso: lê do Dexie imediatamente.
//   - Senão: tenta rede; no sucesso, espelha no Dexie e devolve o dado
//     "joineado" do Supabase; na falha (rede caiu no meio), cai para Dexie.
//
// A forma pública dos retornos é idêntica à versão anterior — nenhuma
// página precisa mudar por causa desta etapa.

import { supabase } from "./supabaseClient";
import { db } from "./db";
import { isOnline } from "./network";
import {
  salvarCache,
  salvarMateriasCache,
  salvarColecoesCache,
  salvarListaComMaterias,
} from "./cacheWrite";

export function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function colunaAusente(error, nomeColuna) {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  return msg.includes(nomeColuna.toLowerCase()) && msg.includes("does not exist");
}

const DEV = process.env.NODE_ENV === "development";

async function onlineOuCache(ctx, fnRede, fnCache) {
  if (!isOnline()) return fnCache();
  try {
    return await fnRede();
  } catch (e) {
    if (DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[fetchers:${ctx}] rede falhou, caindo para cache:`, e?.message || e);
    }
    return fnCache();
  }
}

/* ---------------------------- Helpers de leitura ---------------------------- */

async function lerMateriasDoCache(userId) {
  const materias = await db.materias.where("user_id").equals(userId).toArray();
  materias.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  const horarios = await db.horarios.toArray();
  const porMateria = {};
  for (const h of horarios) {
    (porMateria[h.materia_id] = porMateria[h.materia_id] || []).push(h);
  }
  return materias.map((m) => ({ ...m, horarios: porMateria[m.id] || [] }));
}

async function lerColecoesDoCache(userId) {
  const colecoes = await db.flashcard_colecoes
    .where("user_id")
    .equals(userId)
    .toArray();
  colecoes.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  const materias = await db.materias.toArray();
  const porId = Object.fromEntries(materias.map((m) => [m.id, m]));
  const flashcards = await db.flashcards.toArray();
  const count = {};
  for (const c of flashcards) count[c.colecao_id] = (count[c.colecao_id] || 0) + 1;
  return colecoes.map((c) => {
    const mat = porId[c.materia_id];
    return {
      ...c,
      materias: mat ? { nome: mat.nome, cor: mat.cor } : null,
      flashcards: [{ count: count[c.id] || 0 }],
    };
  });
}

async function lerListaComMateria(tabela) {
  const linhas = await db[tabela].toArray();
  const materias = await db.materias.toArray();
  const porId = Object.fromEntries(materias.map((m) => [m.id, m]));
  return linhas.map((l) => {
    const mat = porId[l.materia_id];
    return {
      ...l,
      materias: mat ? { nome: mat.nome, cor: mat.cor } : null,
    };
  });
}

/* --------------------------- Fetchers globais --------------------------- */

export async function fetchProfile(userId) {
  return onlineOuCache(
    "profile",
    async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("nome, foto_url")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      if (data) await db.profiles.put({ id: userId, ...data });
      return data;
    },
    async () => {
      const row = await db.profiles.get(userId);
      return row ? { nome: row.nome, foto_url: row.foto_url } : null;
    }
  );
}

export async function fetchMaterias(userId) {
  return onlineOuCache(
    "materias",
    async () => {
      const base = () =>
        supabase
          .from("materias")
          .select(
            "id, nome, cor, professor, descricao, codigo, sala, created_at, user_id, horarios(*)"
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
      let resp = await base().is("deleted_at", null);
      if (colunaAusente(resp.error, "deleted_at")) {
        resp = await base();
      }
      if (resp.error) throw resp.error;
      await salvarMateriasCache(resp.data || []);
      return resp.data || [];
    },
    () => lerMateriasDoCache(userId)
  );
}

export async function fetchColecoes(userId) {
  const colsCompletas =
    "id, nome_colecao, materia_id, cor, descricao, ultima_revisao, user_id, materias(nome, cor), flashcards(count), created_at";
  const colsMinimas =
    "id, nome_colecao, materia_id, cor, user_id, materias(nome, cor), flashcards(count), created_at";

  return onlineOuCache(
    "colecoes",
    async () => {
      const base = (cols) =>
        supabase
          .from("flashcard_colecoes")
          .select(cols)
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

      let resp = await base(colsCompletas);
      if (
        colunaAusente(resp.error, "descricao") ||
        colunaAusente(resp.error, "ultima_revisao")
      ) {
        resp = await base(colsMinimas);
      }
      if (resp.error) throw resp.error;
      await salvarColecoesCache(resp.data || []);
      return resp.data || [];
    },
    () => lerColecoesDoCache(userId)
  );
}

export async function fetchTarefas(userId) {
  return onlineOuCache(
    "tarefas",
    async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select("*, materias(nome, cor)")
        .eq("user_id", userId)
        .order("data_entrega", { ascending: true });
      if (error) throw error;
      await salvarListaComMaterias("tarefas", data || []);
      return data || [];
    },
    async () => {
      const lista = await lerListaComMateria("tarefas");
      lista.sort((a, b) =>
        (a.data_entrega || "").localeCompare(b.data_entrega || "")
      );
      return lista;
    }
  );
}

export async function fetchLembretes(userId) {
  return onlineOuCache(
    "lembretes",
    async () => {
      const { data, error } = await supabase
        .from("tarefas_rotina")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      await salvarCache("tarefas_rotina", data || []);
      return data || [];
    },
    async () => {
      const lista = await db.tarefas_rotina
        .where("user_id")
        .equals(userId)
        .toArray();
      lista.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
      return lista;
    }
  );
}

export async function fetchProvas(userId) {
  return onlineOuCache(
    "provas",
    async () => {
      const { data, error } = await supabase
        .from("provas")
        .select("*, materias(nome, cor)")
        .eq("user_id", userId)
        .order("data", { ascending: true });
      if (error) throw error;
      await salvarListaComMaterias("provas", data || []);
      return data || [];
    },
    async () => {
      const lista = await lerListaComMateria("provas");
      lista.sort((a, b) => (a.data || "").localeCompare(b.data || ""));
      return lista;
    }
  );
}

export async function fetchEventosManuais(userId) {
  return onlineOuCache(
    "eventosManuais",
    async () => {
      const { data, error } = await supabase
        .from("eventos_calendario")
        .select("*, materias(nome)")
        .eq("user_id", userId)
        .eq("origem", "manual")
        .order("data", { ascending: true });
      if (error) throw error;
      await salvarListaComMaterias("eventos_calendario", data || []);
      return data || [];
    },
    async () => {
      const todos = await db.eventos_calendario
        .where("user_id")
        .equals(userId)
        .toArray();
      const manuais = todos.filter((e) => e.origem === "manual");
      const materias = await db.materias.toArray();
      const porId = Object.fromEntries(materias.map((m) => [m.id, m]));
      manuais.sort((a, b) => (a.data || "").localeCompare(b.data || ""));
      return manuais.map((e) => ({
        ...e,
        materias: e.materia_id && porId[e.materia_id]
          ? { nome: porId[e.materia_id].nome }
          : null,
      }));
    }
  );
}

export async function fetchEventosProximos(userId) {
  const hoje = ymd(new Date());
  return onlineOuCache(
    "eventosProximos",
    async () => {
      const { data, error } = await supabase
        .from("eventos_calendario")
        .select("id, titulo, data, tipo, materias(nome)")
        .eq("user_id", userId)
        .gte("data", hoje)
        .order("data", { ascending: true })
        .limit(4);
      if (error) throw error;
      await salvarListaComMaterias("eventos_calendario", data || []);
      return data || [];
    },
    async () => {
      const todos = await db.eventos_calendario
        .where("user_id")
        .equals(userId)
        .toArray();
      const materias = await db.materias.toArray();
      const porId = Object.fromEntries(materias.map((m) => [m.id, m]));
      return todos
        .filter((e) => (e.data || "") >= hoje)
        .sort((a, b) => (a.data || "").localeCompare(b.data || ""))
        .slice(0, 4)
        .map((e) => ({
          id: e.id,
          titulo: e.titulo,
          data: e.data,
          tipo: e.tipo,
          materias: e.materia_id && porId[e.materia_id]
            ? { nome: porId[e.materia_id].nome }
            : null,
        }));
    }
  );
}

export async function fetchEventosRange(userId, inicio, fim) {
  return onlineOuCache(
    "eventosRange",
    async () => {
      const eventosQ = supabase
        .from("eventos_calendario")
        .select("*, materias(nome, cor)")
        .eq("user_id", userId)
        .gte("data", inicio)
        .lte("data", fim);
      const tarefasQ = supabase
        .from("tarefas")
        .select("*, materias(nome, cor)")
        .eq("user_id", userId)
        .gte("data_entrega", inicio)
        .lte("data_entrega", fim);
      const [eventos, tarefas] = await Promise.all([eventosQ, tarefasQ]);
      if (eventos.error) throw eventos.error;
      if (tarefas.error) throw tarefas.error;
      await salvarListaComMaterias("eventos_calendario", eventos.data || []);
      await salvarListaComMaterias("tarefas", tarefas.data || []);
      return { eventos: eventos.data || [], tarefas: tarefas.data || [] };
    },
    async () => {
      const [eventosCache, tarefasCache, materias] = await Promise.all([
        db.eventos_calendario.where("user_id").equals(userId).toArray(),
        db.tarefas.where("user_id").equals(userId).toArray(),
        db.materias.toArray(),
      ]);
      const porId = Object.fromEntries(materias.map((m) => [m.id, m]));
      const eventos = eventosCache
        .filter((e) => e.data >= inicio && e.data <= fim)
        .map((e) => ({
          ...e,
          materias: porId[e.materia_id]
            ? { nome: porId[e.materia_id].nome, cor: porId[e.materia_id].cor }
            : null,
        }));
      const tarefas = tarefasCache
        .filter((t) => t.data_entrega >= inicio && t.data_entrega <= fim)
        .map((t) => ({
          ...t,
          materias: porId[t.materia_id]
            ? { nome: porId[t.materia_id].nome, cor: porId[t.materia_id].cor }
            : null,
        }));
      return { eventos, tarefas };
    }
  );
}

export async function fetchDiasRevisao() {
  const limite = new Date();
  limite.setDate(limite.getDate() - 60);
  const limiteIso = limite.toISOString();

  return onlineOuCache(
    "diasRevisao",
    async () => {
      const resp = await supabase
        .from("flashcards")
        .select("ultima_revisao")
        .not("ultima_revisao", "is", null)
        .gte("ultima_revisao", limiteIso);
      if (colunaAusente(resp.error, "ultima_revisao")) return [];
      if (resp.error) throw resp.error;
      const dias = new Set();
      for (const row of resp.data || []) {
        if (row.ultima_revisao) dias.add(row.ultima_revisao.slice(0, 10));
      }
      return Array.from(dias).sort();
    },
    async () => {
      const flashcards = await db.flashcards.toArray();
      const dias = new Set();
      for (const c of flashcards) {
        if (c.ultima_revisao && c.ultima_revisao >= limiteIso) {
          dias.add(c.ultima_revisao.slice(0, 10));
        }
      }
      return Array.from(dias).sort();
    }
  );
}

/* ------------------------ Fetchers por matéria ------------------------ */

export async function fetchMateriaDetalhe(id) {
  return onlineOuCache(
    "materiaDetalhe",
    async () => {
      const base = () =>
        supabase
          .from("materias")
          .select("*, horarios(*)")
          .eq("id", id)
          .order("dia_semana", { foreignTable: "horarios", ascending: true });

      let resp = await base().is("deleted_at", null).maybeSingle();
      if (colunaAusente(resp.error, "deleted_at")) {
        resp = await base().maybeSingle();
      }
      if (resp.error) throw resp.error;
      if (resp.data) {
        await db.materias.put({
          ...resp.data,
          horarios: undefined,
        });
        const horarios = resp.data.horarios || [];
        await db.horarios.where("materia_id").equals(id).delete();
        if (horarios.length) {
          await db.horarios.bulkPut(horarios.map((h) => ({ ...h, materia_id: id })));
        }
      }
      return resp.data;
    },
    async () => {
      const materia = await db.materias.get(id);
      if (!materia) return null;
      const horarios = await db.horarios
        .where("materia_id")
        .equals(id)
        .toArray();
      horarios.sort((a, b) => Number(a.dia_semana) - Number(b.dia_semana));
      return { ...materia, horarios };
    }
  );
}

export async function fetchMateriaisDaMateria(id) {
  return onlineOuCache(
    "materiaisMateria",
    async () => {
      const { data, error } = await supabase
        .from("materiais")
        .select("id, titulo, arquivo_url, topico, created_at, materia_id")
        .eq("materia_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      await salvarCache("materiais", data || []);
      return data || [];
    },
    async () => {
      const lista = await db.materiais
        .where("materia_id")
        .equals(id)
        .toArray();
      lista.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      return lista;
    }
  );
}

export async function fetchColecoesDaMateria(id) {
  return onlineOuCache(
    "colecoesMateria",
    async () => {
      const { data, error } = await supabase
        .from("flashcard_colecoes")
        .select("*, flashcards(count)")
        .eq("materia_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const semCount = (data || []).map(({ flashcards, ...resto }) => resto);
      await db.flashcard_colecoes.bulkPut(semCount);
      return data || [];
    },
    async () => {
      const colecoes = await db.flashcard_colecoes
        .where("materia_id")
        .equals(id)
        .toArray();
      colecoes.sort((a, b) =>
        (b.created_at || "").localeCompare(a.created_at || "")
      );
      const flashcards = await db.flashcards.toArray();
      const count = {};
      for (const c of flashcards) count[c.colecao_id] = (count[c.colecao_id] || 0) + 1;
      return colecoes.map((c) => ({
        ...c,
        flashcards: [{ count: count[c.id] || 0 }],
      }));
    }
  );
}

export async function fetchTarefasDaMateria(id) {
  return onlineOuCache(
    "tarefasMateria",
    async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select("*")
        .eq("materia_id", id)
        .order("data_entrega", { ascending: true });
      if (error) throw error;
      await salvarCache("tarefas", data || []);
      return data || [];
    },
    async () => {
      const lista = await db.tarefas.where("materia_id").equals(id).toArray();
      lista.sort((a, b) =>
        (a.data_entrega || "").localeCompare(b.data_entrega || "")
      );
      return lista;
    }
  );
}

export async function fetchProvasDaMateria(id) {
  return onlineOuCache(
    "provasMateria",
    async () => {
      const { data, error } = await supabase
        .from("provas")
        .select("*")
        .eq("materia_id", id)
        .order("data", { ascending: true });
      if (error) throw error;
      await salvarCache("provas", data || []);
      return data || [];
    },
    async () => {
      const lista = await db.provas.where("materia_id").equals(id).toArray();
      lista.sort((a, b) => (a.data || "").localeCompare(b.data || ""));
      return lista;
    }
  );
}

/* ------------------------ Chaves canônicas do SWR ------------------------ */

export const swrKeys = {
  profile: (userId) => ["profile", userId],
  materias: (userId) => ["materias", userId],
  colecoes: (userId) => ["flashcard_colecoes", userId],
  tarefas: (userId) => ["tarefas", userId],
  lembretes: (userId) => ["lembretes_rotina", userId],
  provas: (userId) => ["provas", userId],
  eventosManuais: (userId) => ["eventos_manuais", userId],
  eventosProximos: (userId) => ["eventos_proximos", userId],
  eventosRange: (userId, inicio, fim) => ["eventos_range", userId, inicio, fim],
  diasRevisao: (userId) => ["dias_revisao", userId],

  materiaDetalhe: (id) => ["materia", id],
  materiaisMateria: (id) => ["materiais_materia", id],
  colecoesMateria: (id) => ["colecoes_materia", id],
  tarefasMateria: (id) => ["tarefas_materia", id],
  provasMateria: (id) => ["provas_materia", id],
};

export const fetcherEventosRange = ([, userId, inicio, fim]) =>
  fetchEventosRange(userId, inicio, fim);
