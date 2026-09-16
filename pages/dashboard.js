import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRequireAuth } from "../lib/useAuth";
import { supabase } from "../lib/supabaseClient";
import AppLayout from "../components/AppLayout";
import { icons } from "../components/icons";

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

const PASTEL_COLORS = ["#FBE9D0", "#E9E1FF", "#DDEEFF", "#E3F5E9", "#FFE4EF"];

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useRequireAuth();

  const [profile, setProfile] = useState(null);
  const [materias, setMaterias] = useState([]);
  const [materiaStats, setMateriaStats] = useState({});
  const [cartoes, setCartoes] = useState([]);
  const [proximos, setProximos] = useState([]);
  const [lembretes, setLembretes] = useState([]);
  const [loading, setLoading] = useState(true);

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
    if (user) fetchProfile();
  }, [user]);

  async function fetchProfile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("nome, foto_url")
      .eq("id", user.id)
      .single();

    if (!error) setProfile(data);
  }

  useEffect(() => {
    if (user) fetchCalendario();
  }, [user, cursor]);

  async function fetchTudo() {
    setLoading(true);
    const hoje = ymd(new Date());

    const { data: materiasData } = await supabase
      .from("materias")
      .select("*, horarios(*)")
      .order("created_at", { ascending: false });

    const { data: colecoes } = await supabase
      .from("flashcard_colecoes")
      .select("id, nome_colecao, materia_id, cor, materias(nome, cor), created_at")
      .order("created_at", { ascending: false });

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

    const materiaIds = (materiasData || []).map((m) => m.id);
    const stats = {};
    if (materiaIds.length > 0) {
      const { data: tarefasPorMateria } = await supabase
        .from("tarefas")
        .select("id, concluido, materia_id")
        .in("materia_id", materiaIds);

      const { data: colecoesPorMateria } = await supabase
        .from("flashcard_colecoes")
        .select("materia_id, flashcards(count)")
        .in("materia_id", materiaIds);

      for (const mid of materiaIds) {
        const tarefasDaMateria = (tarefasPorMateria || []).filter((t) => t.materia_id === mid);
        const concluidas = tarefasDaMateria.filter((t) => t.concluido).length;
        const total = tarefasDaMateria.length;

        const flashcardsTotal = (colecoesPorMateria || [])
          .filter((c) => c.materia_id === mid)
          .reduce((sum, c) => sum + (c.flashcards?.[0]?.count ?? 0), 0);

        stats[mid] = {
          tarefasTotal: total,
          tarefasConcluidas: concluidas,
          tarefasPendentes: total - concluidas,
          flashcardsTotal,
        };
      }
    }

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
    setMateriaStats(stats);
    setCartoes(colecoes || []);
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
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-textPrimary">
          Olá, {profile?.nome || user?.user_metadata?.nome || user?.user_metadata?.full_name || "Lucas"}!
        </h2>
        <p className="text-textMuted mt-1">Que tal continuar seus estudos hoje?</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-10">
        <div className="lg:col-span-2 space-y-6">
          <MateriasCarousel materias={materias} materiaStats={materiaStats} />

          <FlashcardsList cartoes={cartoes} />
        </div>

        <div className="space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold flex items-center gap-2 text-textPrimary">
                {icons.check}
                Atividades
              </h2>
              <Link
                href="/tarefas"
                title="Adicionar atividade"
                className="w-6 h-6 flex items-center justify-center rounded-full bg-primarySoft text-primaryDark hover:bg-primary hover:text-white transition-colors"
              >
                +
              </Link>
            </div>
            {proximos.length === 0 ? (
              <p className="text-textMuted text-sm">Nada agendado por enquanto.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {proximos.map((p, i) => {
                  const destaque = i === 0;
                  return (
                    <Link
                      key={p.id}
                      href="/tarefas"
                      className={
                        "flex items-center gap-3 rounded-2xl px-4 py-3 shadow-[0_4px_20px_rgba(40,30,70,0.06)] transition-shadow hover:shadow-[0_8px_28px_rgba(40,30,70,0.10)] " +
                        (destaque ? "bg-primary" : "bg-white")
                      }
                    >
                      <span
                        className={
                          "w-9 h-9 rounded-full flex items-center justify-center shrink-0 " +
                          (destaque ? "bg-white/20 text-white" : "bg-primarySoft text-primaryDark")
                        }
                      >
                        {icons.check}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={"text-sm font-medium truncate " + (destaque ? "text-white" : "text-textPrimary")}>
                          {p.titulo}
                        </p>
                        {p.materia && (
                          <p className={"text-xs truncate " + (destaque ? "text-white/75" : "text-textMuted")}>
                            {p.materia}
                          </p>
                        )}
                      </div>
                      <span className={"text-xs shrink-0 " + (destaque ? "text-white/85" : "text-textMuted")}>
                        {new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold flex items-center gap-2 text-textPrimary">
                {icons.bell}
                Lembretes
              </h2>
              <Link
                href="/tarefas"
                title="Adicionar lembrete"
                className="w-6 h-6 flex items-center justify-center rounded-full bg-primarySoft text-primaryDark hover:bg-primary hover:text-white transition-colors"
              >
                +
              </Link>
            </div>
            {lembretes.length === 0 ? (
              <p className="text-textMuted text-sm">Nenhum lembrete ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {lembretes.map((l) => (
                  <label
                    key={l.id}
                    className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-[0_4px_20px_rgba(40,30,70,0.06)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={l.concluido}
                      onChange={() => toggleLembrete(l)}
                      className="w-4 h-4 accent-primary shrink-0"
                    />
                    <span className={"text-sm flex-1 min-w-0 truncate " + (l.concluido ? "line-through text-textMuted" : "text-textPrimary")}>
                      {l.titulo}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <hr className="border-borderSoft my-8" />

      {/* SEÇÃO DO CALENDÁRIO */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-textPrimary">
            {icons.calendar}
            Calendário
          </h2>
          <div className="flex items-center gap-3">
            <button onClick={() => mudarMes(-1)} className="text-textMuted hover:text-primary px-2">‹</button>
            <span className="font-medium w-40 text-center text-textPrimary">
              {MESES[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <button onClick={() => mudarMes(1)} className="text-textMuted hover:text-primary px-2">›</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          {Object.entries(TIPO_INFO).map(([key, info]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer text-textSecondary">
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
          <p className="text-textMuted">Carregando calendário...</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white rounded-2xl shadow-[0_4px_20px_rgba(40,30,70,0.06)] p-4">
              <div className="grid grid-cols-7 text-center text-xs text-textMuted mb-2">
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
                        "aspect-square rounded-xl border text-left p-1.5 flex flex-col overflow-hidden transition-colors " +
                        (isSelected ? "border-primary bg-primarySoft/50" : "border-borderSoft hover:border-primary/40")
                      }
                    >
                      <span className={"text-xs font-medium " + (isHoje ? "text-primary font-bold" : "text-textSecondary")}>
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

            <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(40,30,70,0.06)] p-4 h-fit">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-textPrimary">
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
                <p className="text-textMuted text-sm">Nada por aqui neste dia.</p>
              )}

              {!showNovoEvento && (
                <ul className="space-y-2">
                  {eventosDoDiaSelecionado.map((e) => (
                    <li key={e.id} className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: e.cor }} />
                      <div>
                        <p className="text-sm font-medium text-textPrimary">{e.titulo}</p>
                        {e.descricao && <p className="text-xs text-textMuted">{e.descricao}</p>}
                        <p className="text-xs text-textMuted">
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

/* ---------- Minhas Matérias (carrossel) ---------- */
function MateriasCarousel({ materias, materiaStats }) {
  const scrollerRef = useRef(null);

  function scrollByAmount(delta) {
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }

  // Precisa ser um listener nativo com { passive: false }.
  // O onWheel do React é registrado como passivo por padrão,
  // então e.preventDefault() dentro dele não tem efeito nenhum
  // (por isso a página continuava rolando verticalmente).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    function handleWheel(e) {
      // Converte a rolagem vertical do mouse/trackpad em rolagem horizontal do carrossel
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollBy({ left: e.deltaY, behavior: "auto" });
      }
    }

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [materias.length]);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-textPrimary">
          {icons.book}
          Minhas Matérias
        </h2>
        {materias.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollByAmount(-320)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-primarySoft text-primaryDark hover:bg-primary hover:text-white transition-colors"
              aria-label="Rolar para a esquerda"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => scrollByAmount(320)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-primarySoft text-primaryDark hover:bg-primary hover:text-white transition-colors"
              aria-label="Rolar para a direita"
            >
              ›
            </button>
          </div>
        )}
      </div>
      {materias.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-borderSoft p-6 text-textMuted text-sm text-center">
          Nenhuma matéria cadastrada ainda.
        </div>
      ) : (
        <div
          ref={scrollerRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 pt-2 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {materias.map((m, i) => {
            const cor = m.cor || PASTEL_COLORS[i % PASTEL_COLORS.length];
            const stats = materiaStats?.[m.id];

            return (
              <Link
                key={m.id}
                href={`/materias/${m.id}`}
                className="group snap-start shrink-0 w-[85vw] sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)] rounded-2xl border-l-4 overflow-hidden shadow-[0_4px_18px_rgba(40,30,70,0.05)] hover:shadow-[0_8px_24px_rgba(40,30,70,0.09)] transition-shadow flex flex-col min-h-[210px]"
                style={{
                  borderLeftColor: cor,
                  background: `linear-gradient(135deg, ${cor}3D 0%, ${cor}14 45%, #FFFFFF 100%)`,
                }}
              >
                <div className="p-4 flex-1 flex flex-col min-w-0">
                  <span
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-white [&>svg]:w-5 [&>svg]:h-5"
                    style={{ background: cor }}
                  >
                    {icons.book}
                  </span>

                  <h3 className="font-semibold text-[15px] text-textPrimary mt-3 truncate">{m.nome}</h3>
                  {m.professor && (
                    <p className="text-textMuted text-xs mt-0.5 truncate">Prof. {m.professor}</p>
                  )}
                  {m.sala && <p className="text-textMuted text-xs mt-0.5 truncate">Sala {m.sala}</p>}
                  {m.horarios?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 min-w-0">
                      {m.horarios.map((h) => (
                        <span key={h.id} className="text-[11px] bg-white/70 text-primaryDark rounded-full px-2 py-0.5 max-w-full break-words">
                          {DIAS_SEMANA[h.dia_semana]}{" "}
                          {h.hora_inicio?.slice(0, 5)}-{h.hora_fim?.slice(0, 5)}
                          {h.sala ? ` · ${h.sala}` : ""}
                        </span>
                      ))}
                    </div>
                  )}



                  <div className="mt-auto pt-3 flex items-center justify-between gap-2 min-w-0">
                    {stats && (
                      <div className="flex items-center gap-2 text-[11px] text-textSecondary min-w-0 overflow-hidden">
                        <span className="flex items-center gap-1 shrink-0 [&>svg]:w-3 [&>svg]:h-3">
                          {icons.check}
                          {stats.tarefasPendentes}
                        </span>
                        <span className="flex items-center gap-1 shrink-0 [&>svg]:w-3 [&>svg]:h-3 truncate">
                          {icons.layers}
                          {stats.flashcardsTotal}
                        </span>
                      </div>
                    )}
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5"
                      style={{ background: cor }}
                    >
                      {icons.arrowRight}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------- Meus Flashcards (lista vertical) ---------- */
function FlashcardsList({ cartoes }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-textPrimary">
          {icons.layers}
          Meus Flashcards
        </h2>
      </div>
      {cartoes.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-borderSoft p-6 text-textMuted text-sm text-center">
          Nenhum baralho criado ainda.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cartoes.slice(0, 3).map((c, i) => {
            const cor = c.cor || c.materias?.cor || PASTEL_COLORS[i % PASTEL_COLORS.length];
            const total = c.flashcards?.[0]?.count ?? 0;
            const progresso =
              typeof c.progresso === "number" ? Math.max(0, Math.min(100, c.progresso)) : null;

            return (
              <Link
                key={c.id}
                href={`/materias/${c.materia_id}/flashcards/${c.id}`}
                className="w-full h-[70px] flex items-center gap-3 bg-white rounded-2xl border-l-4 border border-borderSoft pl-3 pr-4 shadow-[0_2px_10px_rgba(40,30,70,0.04)] hover:shadow-[0_6px_18px_rgba(40,30,70,0.08)] transition-shadow"
                style={{ borderLeftColor: cor }}
              >
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white [&>svg]:w-5 [&>svg]:h-5"
                  style={{ background: cor }}
                >
                  {icons.layers}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-textPrimary truncate">{c.nome_colecao}</p>
                  <p className="text-[11px] text-textMuted truncate">
                    {c.materias?.nome}
                    {c.materias?.nome ? " · " : ""}
                    {total} cartõe{total === 1 ? "" : "s"}
                  </p>
                </div>
                {progresso !== null ? (
                  <span className="text-[11px] font-semibold shrink-0" style={{ color: cor }}>
                    {progresso}%
                  </span>
                ) : null}
                <span className="text-primary shrink-0 [&>svg]:w-6 [&>svg]:h-6 font-bold">
                  {icons.arrowRight}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
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