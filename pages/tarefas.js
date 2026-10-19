import { useEffect, useState } from "react";
import { useRequireAuth } from "../lib/useAuth";
import { supabase } from "../lib/supabaseClient";
import AppLayout from "../components/AppLayout";

const PRIORIDADES = {
  alta: { label: "Alta", classes: "bg-red-100 text-red-500" },
  media: { label: "Média", classes: "bg-accentYellow/60 text-yellow-700" },
  baixa: { label: "Baixa", classes: "bg-accentGreen/60 text-green-700" },
};

const TIPOS = {
  prova: "Prova",
  atividade: "Atividade",
  trabalho: "Trabalho",
  seminario: "Seminário",
  lista: "Lista",
  outro: "Outro",
};

export default function Tarefas() {
  const { user, loading: authLoading } = useRequireAuth();

  const [materias, setMaterias] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [lembretes, setLembretes] = useState([]);
  const [provas, setProvas] = useState([]);
  const [eventosManuais, setEventosManuais] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showTarefaForm, setShowTarefaForm] = useState(false);
  const [tTitulo, setTTitulo] = useState("");
  const [tDescricao, setTDescricao] = useState("");
  const [tMateria, setTMateria] = useState("");
  const [tData, setTData] = useState("");
  const [tPrioridade, setTPrioridade] = useState("media");
  const [tTipo, setTTipo] = useState("atividade");
  const [savingTarefa, setSavingTarefa] = useState(false);

  const [novoLembrete, setNovoLembrete] = useState("");
  const [savingLembrete, setSavingLembrete] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    if (user) fetchTudo();
  }, [user]);

  async function fetchTudo() {
    setLoading(true);

    const { data: materiasData } = await supabase
      .from("materias")
      .select("id, nome, cor")
      .order("nome");

    const { data: tarefasData } = await supabase
      .from("tarefas")
      .select("*, materias(nome, cor)")
      .order("data_entrega", { ascending: true });

    const { data: lembretesData } = await supabase
      .from("tarefas_rotina")
      .select("*")
      .order("created_at", { ascending: true });

    const { data: provasData } = await supabase
      .from("provas")
      .select("*, materias(nome, cor)")
      .order("data", { ascending: true });

    const { data: eventosData } = await supabase
      .from("eventos_calendario")
      .select("*, materias(nome)")
      .eq("origem", "manual")
      .order("data", { ascending: true });

    setMaterias(materiasData || []);
    setTarefas(tarefasData || []);
    setLembretes(lembretesData || []);
    setProvas(provasData || []);
    setEventosManuais(eventosData || []);
    if (materiasData?.length && !tMateria) setTMateria(materiasData[0].id);
    setLoading(false);
  }

  async function removeProva(id) {
    if (!confirm("Remover esta prova? O evento no calendário também será removido.")) return;
    await supabase.from("provas").delete().eq("id", id);
    fetchTudo();
  }

  async function removeEventoManual(id) {
    if (!confirm("Remover este evento do calendário?")) return;
    await supabase.from("eventos_calendario").delete().eq("id", id);
    fetchTudo();
  }

  async function handleAddTarefa(e) {
    e.preventDefault();
    setError("");
    setSavingTarefa(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("tarefas").insert({
      user_id: user.id,
      materia_id: tMateria,
      titulo: tTitulo,
      descricao: tDescricao,
      data_entrega: tData,
      prioridade: tPrioridade,
      tipo: tTipo,
    });

    setSavingTarefa(false);

    if (error) {
      setError(error.message);
      return;
    }

    setTTitulo("");
    setTDescricao("");
    setTData("");
    setTPrioridade("media");
    setTTipo("atividade");
    setShowTarefaForm(false);
    fetchTudo();
  }

  async function toggleTarefa(tarefa) {
    setTarefas((prev) =>
      prev.map((t) => (t.id === tarefa.id ? { ...t, concluido: !t.concluido } : t))
    );
    await supabase
      .from("tarefas")
      .update({ concluido: !tarefa.concluido })
      .eq("id", tarefa.id);
  }

  async function removeTarefa(id) {
    await supabase.from("tarefas").delete().eq("id", id);
    fetchTudo();
  }

  async function handleAddLembrete(e) {
    e.preventDefault();
    if (!novoLembrete.trim()) return;
    setSavingLembrete(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("tarefas_rotina").insert({
      user_id: user.id,
      titulo: novoLembrete,
    });

    setNovoLembrete("");
    setSavingLembrete(false);
    fetchTudo();
  }

  async function toggleLembrete(lembrete) {
    setLembretes((prev) =>
      prev.map((l) => (l.id === lembrete.id ? { ...l, concluido: !l.concluido } : l))
    );
    await supabase
      .from("tarefas_rotina")
      .update({ concluido: !lembrete.concluido })
      .eq("id", lembrete.id);
  }

  async function removeLembrete(id) {
    await supabase.from("tarefas_rotina").delete().eq("id", id);
    fetchTudo();
  }

  if (authLoading || loading) return null;

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold mb-6">Tarefas e Rotina</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ---------- Checklist de Rotina ---------- */}
        <section className="card">
          <h2 className="font-semibold text-lg mb-1">🔁 Checklist de Rotina</h2>
          <p className="text-gray-400 text-sm mb-4">
            Hábitos recorrentes que não pertencem a nenhuma matéria específica.
          </p>

          <form onSubmit={handleAddLembrete} className="flex gap-2 mb-4">
            <input
              className="input-field"
              placeholder='Ex: "Revisar anotações por 30 min"'
              value={novoLembrete}
              onChange={(e) => setNovoLembrete(e.target.value)}
            />
            <button type="submit" disabled={savingLembrete} className="btn-primary shrink-0">
              + Adicionar
            </button>
          </form>

          {lembretes.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhum lembrete ainda.</p>
          ) : (
            <ul className="space-y-1">
              {lembretes.map((l) => (
                <li key={l.id} className="flex items-center gap-3 bg-surface rounded-lg px-3 py-2">
                  <input
                    type="checkbox"
                    checked={l.concluido}
                    onChange={() => toggleLembrete(l)}
                    className="w-4 h-4 accent-primary shrink-0"
                  />
                  <span className={"flex-1 min-w-0 break-words text-sm " + (l.concluido ? "line-through text-gray-300" : "")}>
                    {l.titulo}
                  </span>
                  <button onClick={() => removeLembrete(l.id)} className="text-gray-400 hover:text-red-500 text-xs p-2 -m-2">
                    remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- Tarefas Acadêmicas ---------- */}
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h2 className="font-semibold text-lg">📚 Tarefas Acadêmicas</h2>
            <button onClick={() => setShowTarefaForm((s) => !s)} className="btn-primary">
              + Nova tarefa
            </button>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Associadas a uma matéria, com tipo, data de entrega e prioridade.
          </p>

          {showTarefaForm && (
            <form onSubmit={handleAddTarefa} className="space-y-3 mb-5 border border-gray-100 rounded-xl p-4">
              <div>
                <label className="block text-sm font-medium mb-1">Título</label>
                <input
                  required
                  className="input-field"
                  value={tTitulo}
                  onChange={(e) => setTTitulo(e.target.value)}
                  placeholder="Ex: Entregar lista de exercícios"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descrição</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={tDescricao}
                  onChange={(e) => setTDescricao(e.target.value)}
                  placeholder="Detalhes opcionais"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo</label>
                  <select className="input-field" value={tTipo} onChange={(e) => setTTipo(e.target.value)}>
                    {Object.entries(TIPOS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Matéria</label>
                  <select
                    required
                    className="input-field"
                    value={tMateria}
                    onChange={(e) => setTMateria(e.target.value)}
                  >
                    {materias.length === 0 && <option value="">Nenhuma matéria</option>}
                    {materias.map((m) => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Data de entrega</label>
                  <input
                    type="date"
                    required
                    className="input-field"
                    value={tData}
                    onChange={(e) => setTData(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Prioridade</label>
                  <select className="input-field" value={tPrioridade} onChange={(e) => setTPrioridade(e.target.value)}>
                    <option value="alta">Alta</option>
                    <option value="media">Média</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </div>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={savingTarefa || !materias.length} className="btn-primary">
                {savingTarefa ? "Salvando..." : "Salvar tarefa"}
              </button>
              {!materias.length && (
                <p className="text-gray-400 text-xs">
                  Cadastre uma matéria antes de criar tarefas acadêmicas.
                </p>
              )}
            </form>
          )}

          {tarefas.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhuma tarefa cadastrada ainda.</p>
          ) : (
            <ul className="space-y-1">
              {tarefas.map((t) => (
                <li key={t.id} className="flex items-center gap-3 bg-surface rounded-lg px-3 py-2 flex-wrap">
                  <input
                    type="checkbox"
                    checked={t.concluido}
                    onChange={() => toggleTarefa(t)}
                    className="w-4 h-4 accent-primary shrink-0"
                  />
                  <span className={"flex-1 text-sm min-w-[140px] break-words " + (t.concluido ? "line-through text-gray-300" : "")}>
                    {t.titulo}
                    <span className="text-gray-400">
                      {" "}· {t.materias?.nome} ·{" "}
                      {new Date(t.data_entrega + "T00:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primarySoft text-primaryDark shrink-0">
                    {TIPOS[t.tipo] || "Atividade"}
                  </span>
                  <span className={"text-xs px-2 py-0.5 rounded-full shrink-0 " + PRIORIDADES[t.prioridade].classes}>
                    {PRIORIDADES[t.prioridade].label}
                  </span>
                  <button onClick={() => removeTarefa(t.id)} className="text-gray-400 hover:text-red-500 text-xs p-2 -m-2 shrink-0">
                    remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---------- Provas e Eventos do Calendário ---------- */}
      <section className="card mt-6">
        <h2 className="font-semibold text-lg mb-1">🗓️ Provas e Eventos</h2>
        <p className="text-gray-400 text-sm mb-4">
          Provas cadastradas na matéria, eventos criados pelo Assistente de Plano de Ensino
          e eventos criados diretamente no calendário. Aqui você pode remover qualquer um deles.
        </p>

        {provas.length === 0 && eventosManuais.length === 0 ? (
          <p className="text-gray-400 text-sm">Nada por aqui ainda.</p>
        ) : (
          <ul className="space-y-1">
            {provas.map((p) => (
              <li key={`prova-${p.id}`} className="flex items-center gap-3 bg-surface rounded-lg px-3 py-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-primarySoft text-primaryDark shrink-0">Prova</span>
                <span className="flex-1 min-w-0 break-words text-sm">
                  {p.titulo}
                  <span className="text-gray-400"> · {p.materias?.nome} · {new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                </span>
                <button onClick={() => removeProva(p.id)} className="text-gray-400 hover:text-red-500 text-xs p-2 -m-2 shrink-0">
                  remover
                </button>
              </li>
            ))}
            {eventosManuais.map((e) => (
              <li key={`evento-${e.id}`} className="flex items-center gap-3 bg-surface rounded-lg px-3 py-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-accentPink/60 text-pink-700 shrink-0">Evento</span>
                <span className="flex-1 min-w-0 break-words text-sm">
                  {e.titulo}
                  <span className="text-gray-400">
                    {" "}· {e.materias?.nome ? `${e.materias.nome} · ` : ""}
                    {new Date(e.data + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
                </span>
                <button onClick={() => removeEventoManual(e.id)} className="text-gray-400 hover:text-red-500 text-xs p-2 -m-2 shrink-0">
                  remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppLayout>
  );
}
