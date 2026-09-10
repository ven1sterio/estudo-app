import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRequireAuth } from "../lib/useAuth";
import { supabase } from "../lib/supabaseClient";
import AppLayout from "../components/AppLayout";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const TIPO_INFO = {
  prova: { label: "Provas", cor: "#8B85F0" },
  trabalho: { label: "Trabalhos", cor: "#B8E6D5" },
  atividade: { label: "Atividades", cor: "#FFE9B3" },
  outro: { label: "Outros Eventos", cor: "#F5C9E0" },
};

const TAREFA_TIPO_PARA_FILTRO = {
  prova: "prova",
  trabalho: "trabalho",
  atividade: "atividade",
  seminario: "atividade",
  lista: "atividade",
  outro: "outro",
};

// Função ymd com correção para o fuso horário local
function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useRequireAuth();

  // Estados do Dashboard
  const [materias, setMaterias] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [proximos, setProximos] = useState([]);
  const [lembretes, setLembretes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados do Calendário
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [eventosMes, setEventosMes] = useState([]);
  const [loadingCalendario, setLoadingCalendario] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showNovoEvento, setShowNovoEvento] = useState(false);
  const [filtros, setFiltros] = useState({
    prova: true,
    trabalho: true,
    atividade: true,
    outro: true,
  });

  useEffect(() => {
    if (user) fetchTudo();
  }, [user]);

  useEffect(() => {
    if (user) fetchCalendario();
  }, [user, cursor]);

  async function fetchTudo() {
    setLoading(true);
    const hoje = ymd(new Date());

    const { data: materiasData } = await supabase
      .from("materias")
      .select("*, horarios(*)")
      .order("created_at", { ascending: false })
      .limit(3);

    const { data: colecoes } = await supabase
      .from("flashcard_colecoes")
      .select("id, nome_colecao, materia_id, cor, materias(cor), created_at")
      .order("created_at", { ascending: false })
      .limit(3);

    const { data: eventosData } = await supabase
      .from("eventos_calendario")
      .select("id, titulo, data, tipo, materias(nome)")
      .gte("data", hoje)
      .order("data", { ascending: true })
      .limit(4);

    const { data: tarefasData } = await supabase
      .from("tarefas")
      .select("id, titulo, data_entrega, concluido, tipo, materias(nome)")
      .eq("concluido", false)
      .order("data_entrega", { ascending: true })
      .limit(4);

    const { data: lembretesData } = await supabase
      .from("tarefas_rotina")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(6);

    const combinados = [
      ...(eventosData || []).map((e) => ({
        id: `ev-${e.id}`,
        titulo: e.titulo,
        data: e.data,
        materia: e.materias?.nome,
      })),
      ...(tarefasData || []).map((t) => ({
        id: `tf-${t.id}`,
        titulo: t.titulo,
        data: t.data_entrega,
        materia: t.materias?.nome,
      })),
    ]
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(0, 3);

    setMaterias(materiasData || []);
    setCartoes((colecoes || []).slice(0, 3));
    setProximos(combinados);
    setLembretes(lembretesData || []);
    setLoading(false);
  }

  async function fetchCalendario() {
    setLoadingCalendario(true);
    const inicioMes = ymd(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    const fimMes = ymd(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));

    const { data: eventosData } = await supabase
      .from("eventos_calendario")
      .select("*, materias(nome, cor)")
      .gte("data", inicioMes)
      .lte("data", fimMes);

    const { data: tarefasData } = await supabase
      .from("tarefas")
      .select("*, materias(nome, cor)")
      .gte("data_entrega", inicioMes)
      .lte("data_entrega", fimMes);

    const normalizados = [
      ...(eventosData || []).map((e) => ({
        id: `evento-${e.id}`,
        data: e.data,
        titulo: e.titulo,
        descricao: e.descricao,
        filtro: e.tipo,
        cor: e.cor || e.materias?.cor || TIPO_INFO[e.tipo]?.cor,
        materia: e.materias?.nome,
      })),
      ...(tarefasData || []).map((t) => ({
        id: `tarefa-${t.id}`,
        data: t.data_entrega,
        titulo: t.titulo,
        descricao: t.descricao,
        filtro: TAREFA_TIPO_PARA_FILTRO[t.tipo] || "atividade",
        cor: t.cor || t.materias?.cor || TIPO_INFO[TAREFA_TIPO_PARA_FILTRO[t.tipo]]?.cor,
        materia: t.materias?.nome,
        concluido: t.concluido,
      })),
    ];

    setEventosMes(normalizados);
    setLoadingCalendario(false);
  }

  async function handleCriarEvento({ titulo, descricao, tipo, cor }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("eventos_calendario").insert({
      user_id: user.id,
      titulo,
      descricao,
      tipo,
      cor,
      data: selectedDay,
      origem: "manual",
    });

    setShowNovoEvento(false);
    fetchCalendario();
    fetchTudo();
  }

  async function toggleLembrete(l) {
    setLembretes((prev) =>
      prev.map((x) => (x.id === l.id ? { ...x, concluido: !x.concluido } : x))
    );
    await supabase
      .from("tarefas_rotina")
      .update({ concluido: !l.concluido })
      .eq("id", l.id);
  }

  const eventosFiltrados = useMemo(
    () => eventosMes.filter((e) => filtros[e.filtro]),
    [eventosMes, filtros]
  );

  const eventosPorDia = useMemo(() => {
    const map = {};
    for (const e of eventosFiltrados) {
      map[e.data] = map[e.data] || [];
      map[e.data].push(e);
    }
    return map;
  }, [eventosFiltrados]);

  const dias = useMemo(() => {
    const ano = cursor.getFullYear();
    const mes = cursor.getMonth();
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();

    const celulas = [];
    for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
    for (let d = 1; d <= totalDias; d++) celulas.push(new Date(ano, mes, d));
    return celulas;
  }, [cursor]);

  function mudarMes(delta) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
    setSelectedDay(null);
    setShowNovoEvento(false);
  }

  const hojeStr = ymd(new Date());
  const eventosDoDiaSelecionado = selectedDay ? eventosPorDia[selectedDay] || [] : [];

  if (authLoading || loading) return null;

  return (
    <AppLayout>
      <div className="grid lg:grid-cols-3 gap-6 mb-10">
        <div className="lg:col-span-2 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-lg">Minhas Matérias</h2>
              <Link href="/materias" className="text-sm text-primary hover:underline">
                ver todas →
              </Link>
            </div>
            {materias.length === 0 ? (
              <div className="card text-gray-400 text-sm">
                Nenhuma matéria cadastrada ainda.
              </div>
            ) : (
              <div className="grid sm:grid-cols-3 gap-3">
                {materias.map((m) => (
                  <Link
                    key={m.id}
                    href={`/materias/${m.id}`}
                    className="card hover:shadow-md transition-shadow block"
                    style={{ borderLeft: `4px solid ${m.cor || "#8B85F0"}` }}
                  >
                    <h3 className="font-semibold">{m.nome}</h3>
                    <p className="text-gray-400 text-xs mt-0.5">{m.professor}</p>
                    {m.sala && <p className="text-gray-400 text-xs mt-0.5">Sala {m.sala}</p>}
                    {m.horarios?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {m.horarios.map((h) => (
                          <span key={h.id} className="text-xs bg-primarySoft text-primaryDark rounded-full px-2 py-0.5">
                            {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][h.dia_semana]}{" "}
                            {h.hora_inicio?.slice(0,5)}-{h.hora_fim?.slice(0,5)}
                            {h.sala ? ` · ${h.sala}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="font-semibold text-lg mb-3">Meus Cartões</h2>
            {cartoes.length === 0 ? (
              <div className="card text-gray-400 text-sm">
                Nenhum baralho criado ainda.
              </div>
            ) : (
              <div className="grid sm:grid-cols-3 gap-3">
                {cartoes.map((c) => (
                  <Link
                    key={c.id}
                    href={`/materias/${c.materia_id}/flashcards/${c.id}`}
                    className="card hover:shadow-md transition-shadow block"
                    style={{ borderLeft: `4px solid ${c.cor || c.materias?.cor || "#8B85F0"}` }}
                  >
                    <h3 className="font-semibold">{c.nome_colecao}</h3>
                    <p className="text-gray-400 text-xs mt-1">ver baralho</p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm tracking-wide text-gray-500 uppercase">Atividades</h2>
              <Link
                href="/tarefas"
                title="Adicionar atividade"
                className="w-6 h-6 flex items-center justify-center rounded-full bg-primarySoft text-primaryDark hover:bg-primary hover:text-white transition-colors"
              >
                +
              </Link>
            </div>
            {proximos.length === 0 ? (
              <p className="text-gray-400 text-sm">Nada agendado por enquanto.</p>
            ) : (
              <ul className="space-y-2">
                {proximos.map((p) => (
                  <li key={p.id} className="text-sm">
                    {p.materia && <span className="text-gray-400">{p.materia} · </span>}
                    <Link href="/tarefas" className="text-primary hover:underline">
                      {p.titulo}
                    </Link>
                    <span className="text-xs text-gray-400 float-right">
                      {new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm tracking-wide text-gray-500 uppercase">Lembretes</h2>
              <Link
                href="/tarefas"
                title="Adicionar lembrete"
                className="w-6 h-6 flex items-center justify-center rounded-full bg-primarySoft text-primaryDark hover:bg-primary hover:text-white transition-colors"
              >
                +
              </Link>
            </div>
            {lembretes.length === 0 ? (
              <p className="text-gray-400 text-sm">Nenhum lembrete ainda.</p>
            ) : (
              <ul className="space-y-2">
                {lembretes.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={l.concluido}
                      onChange={() => toggleLembrete(l)}
                      className="w-4 h-4 accent-primary shrink-0"
                    />
                    <span className={l.concluido ? "line-through text-gray-300" : ""}>
                      {l.titulo}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <hr className="border-gray-100 my-8" />

      {/* SEÇÃO DO CALENDÁRIO */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-3xl">🗓️</span> Calendário
          </h2>
          <div className="flex items-center gap-3">
            <button onClick={() => mudarMes(-1)} className="text-gray-400 hover:text-primary px-2">‹</button>
            <span className="font-medium w-40 text-center">
              {MESES[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <button onClick={() => mudarMes(1)} className="text-gray-400 hover:text-primary px-2">›</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          {Object.entries(TIPO_INFO).map(([key, info]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filtros[key]}
                onChange={(e) => setFiltros((f) => ({ ...f, [key]: e.target.checked }))}
                className="accent-primary"
              />
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: info.cor }} />
              {info.label}
            </label>
          ))}
        </div>

        {loadingCalendario ? (
          <p className="text-gray-400">Carregando calendário...</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <div className="grid grid-cols-7 text-center text-xs text-gray-400 mb-2">
                {DIAS_SEMANA.map((d) => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {dias.map((dia, i) => {
                  if (!dia) return <div key={i} />;
                  const dataStr = ymd(dia);
                  const eventosDoDia = eventosPorDia[dataStr] || [];
                  const isHoje = dataStr === hojeStr;
                  const isSelected = dataStr === selectedDay;

                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedDay(dataStr);
                        setShowNovoEvento(false);
                      }}
                      className={
                        "aspect-square rounded-xl border text-left p-1.5 flex flex-col overflow-hidden " +
                        (isSelected ? "border-primary bg-primarySoft/40" : "border-gray-100 hover:border-gray-300")
                      }
                    >
                      <span className={"text-xs font-medium " + (isHoje ? "text-primary font-bold" : "text-gray-600")}>
                        {dia.getDate()}
                      </span>
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {eventosDoDia.slice(0, 4).map((e) => (
                          <span key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ background: e.cor }} />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="card h-fit">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">
                  {selectedDay
                    ? new Date(selectedDay + "T00:00:00").toLocaleDateString("pt-BR", {
                        weekday: "long", day: "2-digit", month: "long",
                      })
                    : "Selecione um dia"}
                </h2>
                {selectedDay && (
                  <button
                    onClick={() => setShowNovoEvento((s) => !s)}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-primarySoft text-primaryDark hover:bg-primary hover:text-white transition-colors"
                    title="Novo evento"
                  >
                    +
                  </button>
                )}
              </div>

              {showNovoEvento && (
                <NovoEventoForm onCancel={() => setShowNovoEvento(false)} onCreate={handleCriarEvento} />
              )}

              {selectedDay && !showNovoEvento && eventosDoDiaSelecionado.length === 0 && (
                <p className="text-gray-400 text-sm">Nada por aqui neste dia.</p>
              )}

              {!showNovoEvento && (
                <ul className="space-y-2">
                  {eventosDoDiaSelecionado.map((e) => (
                    <li key={e.id} className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: e.cor }} />
                      <div>
                        <p className="text-sm font-medium">{e.titulo}</p>
                        {e.descricao && <p className="text-xs text-gray-400">{e.descricao}</p>}
                        <p className="text-xs text-gray-400">
                          {TIPO_INFO[e.filtro]?.label}{e.materia ? ` · ${e.materia}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function NovoEventoForm({ onCancel, onCreate }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("outro");
  const [cor, setCor] = useState("#F5C9E0");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await onCreate({ titulo, descricao, tipo, cor });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mb-3">
      <input
        required
        autoFocus
        className="input-field"
        placeholder="Título do evento"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
      />
      <textarea
        className="input-field"
        rows={2}
        placeholder="Descrição (opcional)"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
      />
      <div className="flex gap-2">
        <select className="input-field" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {Object.entries(TIPO_INFO).map(([key, info]) => (
            <option key={key} value={key}>{info.label}</option>
          ))}
        </select>
        <input
          type="color"
          className="w-12 h-10 rounded-xl border border-gray-200 shrink-0"
          value={cor}
          onChange={(e) => setCor(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Salvando..." : "Salvar evento"}
        </button>
        <button type="button" onClick={onCancel} className="text-gray-400 px-3">
          Cancelar
        </button>
      </div>
    </form>
  );
}
