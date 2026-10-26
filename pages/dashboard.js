import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { useRequireAuth } from "../lib/useAuth";
import { supabase } from "../lib/supabaseClient";
import AppLayout from "../components/AppLayout";
import Skeleton from "../components/Skeleton";
import { icons } from "../components/icons";
import { diasConsecutivos, hojeIso } from "../lib/streak";
import {
  swrKeys,
  fetchProfile,
  fetchMaterias,
  fetchColecoes,
  fetchTarefas,
  fetchLembretes,
  fetchEventosProximos,
  fetchDiasRevisao,
  fetcherEventosRange,
  ymd,
} from "../lib/fetchers";

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
  prova: "prova", trabalho: "trabalho", atividade: "atividade",
  seminario: "atividade", lista: "atividade", outro: "outro",
};

const PASTEL_COLORS = ["#FBE9D0", "#E9E1FF", "#DDEEFF", "#E3F5E9", "#FFE4EF"];

export default function Dashboard() {
  const { user, loading: authLoading } = useRequireAuth();
  const uid = user?.id;

  const { data: profile } = useSWR(
    uid ? swrKeys.profile(uid) : null,
    () => fetchProfile(uid)
  );
  const { data: materias, isLoading: lMaterias } = useSWR(
    uid ? swrKeys.materias(uid) : null,
    () => fetchMaterias(uid)
  );
  const { data: colecoes } = useSWR(
    uid ? swrKeys.colecoes(uid) : null,
    () => fetchColecoes(uid)
  );
  const { data: tarefas } = useSWR(
    uid ? swrKeys.tarefas(uid) : null,
    () => fetchTarefas(uid)
  );
  const { data: lembretes } = useSWR(
    uid ? swrKeys.lembretes(uid) : null,
    () => fetchLembretes(uid)
  );
  const { data: eventosProximos } = useSWR(
    uid ? swrKeys.eventosProximos(uid) : null,
    () => fetchEventosProximos(uid)
  );
  const { data: diasRevisao } = useSWR(
    uid ? swrKeys.diasRevisao(uid) : null,
    fetchDiasRevisao
  );

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const inicioMes = ymd(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  const fimMes = ymd(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));

  const { data: eventosRange, isLoading: lCal } = useSWR(
    uid ? swrKeys.eventosRange(uid, inicioMes, fimMes) : null,
    fetcherEventosRange,
    { keepPreviousData: false }
  );

  const [selectedDay, setSelectedDay] = useState(null);
  const [showNovoEvento, setShowNovoEvento] = useState(false);
  const [filtros, setFiltros] = useState({
    prova: true, trabalho: true, atividade: true, outro: true,
  });
  const detalheRef = useRef(null);

  const streak = useMemo(
    () => diasConsecutivos(diasRevisao || [], hojeIso()),
    [diasRevisao]
  );

  const materiaStats = useMemo(() => {
    const stats = {};
    if (!materias) return stats;
    for (const m of materias) {
      const tarefasM = (tarefas || []).filter((t) => t.materia_id === m.id);
      const concluidas = tarefasM.filter((t) => t.concluido).length;
      const flashcardsTotal = (colecoes || [])
        .filter((c) => c.materia_id === m.id)
        .reduce((sum, c) => sum + (c.flashcards?.[0]?.count ?? 0), 0);
      stats[m.id] = {
        tarefasTotal: tarefasM.length,
        tarefasConcluidas: concluidas,
        tarefasPendentes: tarefasM.length - concluidas,
        flashcardsTotal,
      };
    }
    return stats;
  }, [materias, tarefas, colecoes]);

  const proximos = useMemo(() => {
    const lista = [
      ...(eventosProximos || []).map((e) => ({
        id: `ev-${e.id}`,
        titulo: e.titulo,
        data: e.data,
        materia: e.materias?.nome,
      })),
      ...(tarefas || [])
        .filter((t) => !t.concluido)
        .slice(0, 4)
        .map((t) => ({
          id: `tf-${t.id}`,
          titulo: t.titulo,
          data: t.data_entrega,
          materia: t.materias?.nome,
        })),
    ]
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(0, 3);
    return lista;
  }, [eventosProximos, tarefas]);

  const eventosNormalizados = useMemo(() => {
    if (!eventosRange) return [];
    return [
      ...eventosRange.eventos.map((e) => ({
        id: `evento-${e.id}`,
        data: e.data,
        titulo: e.titulo,
        descricao: e.descricao,
        filtro: e.tipo,
        cor: e.cor || e.materias?.cor || TIPO_INFO[e.tipo]?.cor,
        materia: e.materias?.nome,
      })),
      ...eventosRange.tarefas.map((t) => ({
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
  }, [eventosRange]);

  const eventosFiltrados = useMemo(
    () => eventosNormalizados.filter((e) => filtros[e.filtro]),
    [eventosNormalizados, filtros]
  );

  const eventosPorDia = useMemo(() => {
    const map = {};
    for (const e of eventosFiltrados) {
      (map[e.data] = map[e.data] || []).push(e);
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

  const hojeStr = ymd(new Date());
  const eventosDoDiaSelecionado = selectedDay
    ? eventosPorDia[selectedDay] || []
    : [];

  function mudarMes(delta) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
    setSelectedDay(null);
    setShowNovoEvento(false);
  }

  async function handleCriarEvento({ titulo, descricao, tipo, cor }) {
    await supabase.from("eventos_calendario").insert({
      user_id: uid,
      titulo,
      descricao,
      tipo,
      cor,
      data: selectedDay,
      origem: "manual",
    });
    setShowNovoEvento(false);
    globalMutate(swrKeys.eventosRange(uid, inicioMes, fimMes));
    globalMutate(swrKeys.eventosProximos(uid));
  }

  async function toggleLembrete(l) {
    globalMutate(
      swrKeys.lembretes(uid),
      (prev) =>
        prev?.map((x) =>
          x.id === l.id ? { ...x, concluido: !x.concluido } : x
        ),
      false
    );
    await supabase
      .from("tarefas_rotina")
      .update({ concluido: !l.concluido })
      .eq("id", l.id);
    globalMutate(swrKeys.lembretes(uid));
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="w-40 h-8" />
      </div>
    );
  }

  const nomeUsuario =
    profile?.nome ||
    user?.user_metadata?.nome ||
    user?.user_metadata?.full_name ||
    "Estudante";

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-textPrimary">
            Olá, {nomeUsuario}!
          </h2>
          <p className="text-textMuted mt-1">
            Que tal continuar seus estudos hoje?
          </p>
        </div>
        {streak > 0 && (
          <div
            className="bg-white rounded-2xl shadow-soft px-4 py-2.5 flex items-center gap-2 shrink-0"
            title="Dias seguidos revisando flashcards"
          >
            <span className="text-2xl" aria-hidden="true">🔥</span>
            <div>
              <p className="text-lg font-bold text-textPrimary leading-none">
                {streak} dia{streak === 1 ? "" : "s"}
              </p>
              <p className="text-[11px] text-textMuted leading-tight mt-0.5">
                de estudo seguido{streak === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <div className="lg:col-span-2 min-w-0 space-y-6">
          {lMaterias ? (
            <Skeleton className="h-[210px] w-full" />
          ) : (
            <MateriasCarousel
              materias={materias || []}
              materiaStats={materiaStats}
            />
          )}
          <FlashcardsList cartoes={colecoes || []} />
        </div>

        <div className="min-w-0 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold flex items-center gap-2 text-textPrimary">
                <span aria-hidden="true">{icons.check}</span> Atividades
              </h2>
              <Link
                href="/tarefas"
                aria-label="Ir para tarefas"
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
                        "flex items-center gap-3 rounded-2xl px-4 py-3 shadow-soft transition-shadow hover:shadow-softHover " +
                        (destaque ? "bg-primary" : "bg-white")
                      }
                    >
                      <span
                        className={
                          "w-9 h-9 rounded-full flex items-center justify-center shrink-0 " +
                          (destaque ? "bg-white/20 text-white" : "bg-primarySoft text-primaryDark")
                        }
                        aria-hidden="true"
                      >
                        {icons.check}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p
                          className={
                            "text-sm font-medium truncate " +
                            (destaque ? "text-white" : "text-textPrimary")
                          }
                        >
                          {p.titulo}
                        </p>
                        {p.materia && (
                          <p
                            className={
                              "text-xs truncate " +
                              (destaque ? "text-white/75" : "text-textMuted")
                            }
                          >
                            {p.materia}
                          </p>
                        )}
                      </div>
                      <span
                        className={
                          "text-xs shrink-0 " +
                          (destaque ? "text-white/85" : "text-textMuted")
                        }
                      >
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
                <span aria-hidden="true">{icons.bell}</span> Lembretes
              </h2>
              <Link
                href="/tarefas"
                aria-label="Ir para tarefas"
                className="w-6 h-6 flex items-center justify-center rounded-full bg-primarySoft text-primaryDark hover:bg-primary hover:text-white transition-colors"
              >
                +
              </Link>
            </div>
            {!lembretes ? (
              <Skeleton className="h-10 w-full" />
            ) : lembretes.length === 0 ? (
              <p className="text-textMuted text-sm">Nenhum lembrete ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {lembretes.slice(0, 6).map((l) => (
                  <label
                    key={l.id}
                    className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-soft cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={l.concluido}
                      onChange={() => toggleLembrete(l)}
                      className="w-4 h-4 accent-primary shrink-0"
                    />
                    <span
                      className={
                        "text-sm flex-1 min-w-0 truncate " +
                        (l.concluido ? "line-through text-textMuted" : "text-textPrimary")
                      }
                    >
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

      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-textPrimary">
            <span aria-hidden="true">{icons.calendar}</span> Calendário
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => mudarMes(-1)}
              aria-label="Mês anterior"
              className="text-textMuted hover:text-primary px-3 py-1 text-xl"
            >
              ‹
            </button>
            <span className="font-medium w-32 sm:w-40 text-center text-sm sm:text-base text-textPrimary">
              {MESES[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <button
              onClick={() => mudarMes(1)}
              aria-label="Próximo mês"
              className="text-textMuted hover:text-primary px-3 py-1 text-xl"
            >
              ›
            </button>
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
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: info.cor }}
                aria-hidden="true"
              />
              {info.label}
            </label>
          ))}
        </div>

        {lCal ? (
          <Skeleton className="h-[400px] w-full" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white rounded-2xl shadow-soft p-4">
              <div className="grid grid-cols-7 text-center text-xs text-textMuted mb-2">
                {DIAS_SEMANA.map((d) => (
                  <div key={d}>{d}</div>
                ))}
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
                        if (typeof window !== "undefined" && window.innerWidth < 768) {
                          setTimeout(
                            () =>
                              detalheRef.current?.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              }),
                            60
                          );
                        }
                      }}
                      className={
                        "aspect-square rounded-lg sm:rounded-xl border text-left p-1 sm:p-1.5 flex flex-col overflow-hidden transition-colors " +
                        (isSelected
                          ? "border-primary bg-primarySoft/50"
                          : "border-borderSoft hover:border-primary/40")
                      }
                    >
                      <span
                        className={
                          "text-xs font-medium " +
                          (isHoje
                            ? "text-primary font-bold"
                            : "text-textSecondary")
                        }
                      >
                        {dia.getDate()}
                      </span>
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {eventosDoDia.slice(0, 4).map((e) => (
                          <span
                            key={e.id}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: e.cor }}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div ref={detalheRef} className="bg-white rounded-2xl shadow-soft p-4 h-fit">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-textPrimary">
                  {selectedDay
                    ? new Date(selectedDay + "T00:00:00").toLocaleDateString(
                        "pt-BR",
                        { weekday: "long", day: "2-digit", month: "long" }
                      )
                    : "Selecione um dia"}
                </h2>
                {selectedDay && (
                  <button
                    onClick={() => setShowNovoEvento((s) => !s)}
                    aria-label="Novo evento"
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-primarySoft text-primaryDark hover:bg-primary hover:text-white transition-colors"
                  >
                    +
                  </button>
                )}
              </div>

              {showNovoEvento && (
                <NovoEventoForm
                  onCancel={() => setShowNovoEvento(false)}
                  onCreate={handleCriarEvento}
                />
              )}

              {selectedDay && !showNovoEvento && eventosDoDiaSelecionado.length === 0 && (
                <p className="text-textMuted text-sm">Nada por aqui neste dia.</p>
              )}

              {!showNovoEvento && (
                <ul className="space-y-2">
                  {eventosDoDiaSelecionado.map((e) => (
                    <li key={e.id} className="flex items-start gap-2">
                      <span
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ background: e.cor }}
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm font-medium text-textPrimary">{e.titulo}</p>
                        {e.descricao && (
                          <p className="text-xs text-textMuted">{e.descricao}</p>
                        )}
                        <p className="text-xs text-textMuted">
                          {TIPO_INFO[e.filtro]?.label}
                          {e.materia ? ` · ${e.materia}` : ""}
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

function MateriasCarousel({ materias, materiaStats }) {
  const scrollerRef = useRef(null);

  function scrollByAmount(delta) {
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    function handleWheel(e) {
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
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-textPrimary">
          <span aria-hidden="true">{icons.book}</span> Minhas Matérias
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
          className="flex gap-4 w-full max-w-full overflow-x-auto overscroll-x-contain snap-x snap-mandatory scroll-smooth pb-2 pt-2 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {materias.map((m, i) => {
            const cor = m.cor || PASTEL_COLORS[i % PASTEL_COLORS.length];
            const stats = materiaStats?.[m.id];
            return (
              <Link
                key={m.id}
                href={`/materias/${m.id}`}
                className="group card-tinted snap-start shrink-0 w-[85%] sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)] rounded-2xl overflow-hidden shadow-[0_4px_18px_rgba(40,30,70,0.05)] hover:shadow-[0_8px_24px_rgba(40,30,70,0.09)] transition-shadow flex flex-col min-h-[210px]"
                style={{ "--cor": cor }}
              >
                <div className="p-4 flex-1 flex flex-col min-w-0">
                  <span
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-white [&>svg]:w-5 [&>svg]:h-5"
                    style={{ background: cor }}
                    aria-hidden="true"
                  >
                    {icons.book}
                  </span>
                  <h3 className="font-semibold text-[15px] text-textPrimary mt-3 truncate">
                    {m.nome}
                  </h3>
                  {m.professor && (
                    <p className="text-textSecondary text-xs mt-0.5 truncate">
                      Prof. {m.professor}
                    </p>
                  )}
                  {m.sala && (
                    <p className="text-textSecondary text-xs mt-0.5 truncate">
                      Sala {m.sala}
                    </p>
                  )}
                  {m.horarios?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 min-w-0">
                      {m.horarios.map((h) => (
                        <span
                          key={h.id}
                          className="text-[11px] bg-white/60 dark:bg-black/20 text-textPrimary dark:text-textPrimary rounded-full px-2 py-0.5 max-w-full break-words"
                        >
                          {DIAS_SEMANA[h.dia_semana]}{" "}
                          {h.hora_inicio?.slice(0, 5)}-{h.hora_fim?.slice(0, 5)}
                          {h.sala ? ` · ${h.sala}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto pt-3 flex items-center justify-between gap-2 min-w-0">
                    {stats && (
                      <div className="flex items-center gap-2 text-[11px] text-textPrimary/70 dark:text-textSecondary min-w-0 overflow-hidden">
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
                      aria-hidden="true"
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

function FlashcardsList({ cartoes }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-textPrimary">
          <span aria-hidden="true">{icons.layers}</span> Meus Flashcards
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
              typeof c.progresso === "number"
                ? Math.max(0, Math.min(100, c.progresso))
                : null;
            return (
              <Link
                key={c.id}
                href={`/materias/${c.materia_id}/flashcards/${c.id}`}
                className="w-full h-[70px] flex items-center gap-3 bg-white rounded-2xl border-l-4 border border-borderSoft pl-3 pr-4 shadow-soft hover:shadow-softHover transition-shadow"
                style={{ borderLeftColor: cor }}
              >
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white [&>svg]:w-5 [&>svg]:h-5"
                  style={{ background: cor }}
                  aria-hidden="true"
                >
                  {icons.layers}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-textPrimary truncate">
                    {c.nome_colecao}
                  </p>
                  <p className="text-[11px] text-textMuted truncate">
                    {c.materias?.nome}
                    {c.materias?.nome ? " · " : ""}
                    {total} cartõe{total === 1 ? "" : "s"}
                  </p>
                </div>
                {progresso !== null && (
                  <span
                    className="text-[11px] font-semibold shrink-0"
                    style={{ color: cor }}
                  >
                    {progresso}%
                  </span>
                )}
                <span className="text-primary shrink-0 [&>svg]:w-6 [&>svg]:h-6 font-bold" aria-hidden="true">
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
        <select
          className="input-field"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          {Object.entries(TIPO_INFO).map(([key, info]) => (
            <option key={key} value={key}>
              {info.label}
            </option>
          ))}
        </select>
        <input
          type="color"
          className="w-12 h-10 rounded-xl border border-gray-200 shrink-0"
          value={cor}
          onChange={(e) => setCor(e.target.value)}
          aria-label="Cor do evento"
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
