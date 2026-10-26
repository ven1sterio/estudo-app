import { supabase } from "./supabaseClient";

export function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* --------------------- Helpers de tolerância --------------------- */
// Se a migration 05 ainda não foi rodada, algumas colunas (deleted_at,
// proximo_review, ultima_revisao) não existem. Ao invés de esconder os
// dados do usuário, refazemos a query sem o filtro problemático.
function colunaAusente(error, nomeColuna) {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  return msg.includes(nomeColuna.toLowerCase()) && msg.includes("does not exist");
}

/* --------------------- Fetchers globais --------------------- */

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("nome, foto_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchMaterias(userId) {
  const base = () => {
    let q = supabase
      .from("materias")
      .select(
        "id, nome, cor, professor, descricao, codigo, sala, created_at, horarios(*)"
      )
      .order("created_at", { ascending: false });
    if (userId) q = q.eq("user_id", userId);
    return q;
  };

  let resp = await base().is("deleted_at", null);
  if (colunaAusente(resp.error, "deleted_at")) {
    resp = await base();
  }
  if (resp.error) throw resp.error;
  return resp.data || [];
}

export async function fetchColecoes(userId) {
  let q = supabase
    .from("flashcard_colecoes")
    .select(
      "id, nome_colecao, materia_id, cor, progresso, materias(nome, cor), flashcards(count), created_at"
    )
    .order("created_at", { ascending: false });
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchTarefas(userId) {
  let q = supabase
    .from("tarefas")
    .select("*, materias(nome, cor)")
    .order("data_entrega", { ascending: true });
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchLembretes(userId) {
  let q = supabase
    .from("tarefas_rotina")
    .select("*")
    .order("created_at", { ascending: true });
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchProvas(userId) {
  let q = supabase
    .from("provas")
    .select("*, materias(nome, cor)")
    .order("data", { ascending: true });
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchEventosManuais(userId) {
  let q = supabase
    .from("eventos_calendario")
    .select("*, materias(nome)")
    .eq("origem", "manual")
    .order("data", { ascending: true });
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchEventosProximos(userId) {
  const hoje = ymd(new Date());
  let q = supabase
    .from("eventos_calendario")
    .select("id, titulo, data, tipo, materias(nome)")
    .gte("data", hoje)
    .order("data", { ascending: true })
    .limit(4);
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchEventosRange(userId, inicio, fim) {
  const eventosQ = supabase
    .from("eventos_calendario")
    .select("*, materias(nome, cor)")
    .gte("data", inicio)
    .lte("data", fim);
  const tarefasQ = supabase
    .from("tarefas")
    .select("*, materias(nome, cor)")
    .gte("data_entrega", inicio)
    .lte("data_entrega", fim);

  if (userId) {
    eventosQ.eq("user_id", userId);
    tarefasQ.eq("user_id", userId);
  }

  const [eventos, tarefas] = await Promise.all([eventosQ, tarefasQ]);
  if (eventos.error) throw eventos.error;
  if (tarefas.error) throw tarefas.error;
  return { eventos: eventos.data || [], tarefas: tarefas.data || [] };
}

// Dias (YYYY-MM-DD) com revisão de flashcard nos últimos 60 dias.
// Tolerante caso a coluna ultima_revisao ainda não exista.
export async function fetchDiasRevisao() {
  const limite = new Date();
  limite.setDate(limite.getDate() - 60);

  const resp = await supabase
    .from("flashcards")
    .select("ultima_revisao")
    .not("ultima_revisao", "is", null)
    .gte("ultima_revisao", limite.toISOString());

  if (colunaAusente(resp.error, "ultima_revisao")) {
    // Sem a coluna → sem histórico → streak 0
    return [];
  }
  if (resp.error) throw resp.error;

  const dias = new Set();
  for (const row of resp.data || []) {
    if (!row.ultima_revisao) continue;
    dias.add(row.ultima_revisao.slice(0, 10));
  }
  return Array.from(dias).sort();
}

/* --------------------- Fetchers por matéria --------------------- */

export async function fetchMateriaDetalhe(id) {
  const base = () =>
    supabase.from("materias").select("*, horarios(*)").eq("id", id);

  let resp = await base().is("deleted_at", null).maybeSingle();
  if (colunaAusente(resp.error, "deleted_at")) {
    resp = await base().maybeSingle();
  }
  if (resp.error) throw resp.error;
  return resp.data;
}

export async function fetchMateriaisDaMateria(id) {
  const { data, error } = await supabase
    .from("materiais")
    .select("id, titulo, arquivo_url, topico, created_at")
    .eq("materia_id", id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchColecoesDaMateria(id) {
  const { data, error } = await supabase
    .from("flashcard_colecoes")
    .select("*, flashcards(count)")
    .eq("materia_id", id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchTarefasDaMateria(id) {
  const { data, error } = await supabase
    .from("tarefas")
    .select("*")
    .eq("materia_id", id)
    .order("data_entrega", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchProvasDaMateria(id) {
  const { data, error } = await supabase
    .from("provas")
    .select("*")
    .eq("materia_id", id)
    .order("data", { ascending: true });
  if (error) throw error;
  return data || [];
}

/* --------------------- Chaves canônicas do SWR --------------------- */

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
