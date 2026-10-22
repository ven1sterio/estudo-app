import { supabase } from "./supabaseClient";

export function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

export async function fetchMaterias() {
  const { data, error } = await supabase
    .from("materias")
    .select("id, nome, cor, professor, descricao, codigo, sala, created_at, horarios(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchColecoes() {
  const { data, error } = await supabase
    .from("flashcard_colecoes")
    .select(
      "id, nome_colecao, materia_id, cor, progresso, materias(nome, cor), flashcards(count), created_at"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchTarefas() {
  const { data, error } = await supabase
    .from("tarefas")
    .select("*, materias(nome, cor)")
    .order("data_entrega", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchLembretes() {
  const { data, error } = await supabase
    .from("tarefas_rotina")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchProvas() {
  const { data, error } = await supabase
    .from("provas")
    .select("*, materias(nome, cor)")
    .order("data", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchEventosManuais() {
  const { data, error } = await supabase
    .from("eventos_calendario")
    .select("*, materias(nome)")
    .eq("origem", "manual")
    .order("data", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchEventosProximos() {
  const hoje = ymd(new Date());
  const { data, error } = await supabase
    .from("eventos_calendario")
    .select("id, titulo, data, tipo, materias(nome)")
    .gte("data", hoje)
    .order("data", { ascending: true })
    .limit(4);
  if (error) throw error;
  return data || [];
}

export async function fetchEventosRange(inicio, fim) {
  const [eventos, tarefas] = await Promise.all([
    supabase
      .from("eventos_calendario")
      .select("*, materias(nome, cor)")
      .gte("data", inicio)
      .lte("data", fim),
    supabase
      .from("tarefas")
      .select("*, materias(nome, cor)")
      .gte("data_entrega", inicio)
      .lte("data_entrega", fim),
  ]);
  if (eventos.error) throw eventos.error;
  if (tarefas.error) throw tarefas.error;
  return { eventos: eventos.data || [], tarefas: tarefas.data || [] };
}

/* --------------------- Fetchers por matéria --------------------- */

export async function fetchMateriaDetalhe(id) {
  const { data, error } = await supabase
    .from("materias")
    .select("*, horarios(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
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
  materias: "materias",
  colecoes: "flashcard_colecoes",
  tarefas: "tarefas",
  lembretes: "lembretes_rotina",
  provas: "provas",
  eventosManuais: "eventos_manuais",
  eventosProximos: "eventos_proximos",
  eventosRange: (inicio, fim) => ["eventos_range", inicio, fim],

  materiaDetalhe: (id) => ["materia", id],
  materiaisMateria: (id) => ["materiais_materia", id],
  colecoesMateria: (id) => ["colecoes_materia", id],
  tarefasMateria: (id) => ["tarefas_materia", id],
  provasMateria: (id) => ["provas_materia", id],
};

export const fetcherEventosRange = ([, inicio, fim]) =>
  fetchEventosRange(inicio, fim);