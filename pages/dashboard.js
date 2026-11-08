import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { useRequireAuth } from "../lib/useAuth";
import { updateLocal } from "../lib/cacheWrite";
import { sincronizarAgoraSeOnline } from "../lib/sync";
import AppLayout from "../components/AppLayout";
import Skeleton from "../components/Skeleton";
import CalendarioView from "../components/CalendarioView";
import { icons } from "../components/icons";
import { useToast } from "../components/Toast";
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
} from "../lib/fetchers";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const PASTEL_COLORS = ["#FBE9D0", "#E9E1FF", "#DDEEFF", "#E3F5E9", "#FFE4EF"];

export default function Dashboard() {
  const { user, loading: authLoading } = useRequireAuth();
  const uid = user?.id;
  const { showToast } = useToast();

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

  // Lock por id de lembrete: evita mutações otimistas conflitantes se o
  // usuário clicar rápido (o segundo clique espera o primeiro terminar).
  const togglingRef = useRef(new Set());

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
        realId: e.id,
        tipo: "evento",
        titulo: e.titulo,
        data: e.data,
        materia: e.materias?.nome,
      })),
      ...(tarefas || [])
        .filter((t) => !t.concluido)
        .slice(0, 4)
        .map((t) => ({
          id: `tf-${t.id}`,
          realId: t.id,
          tipo: "tarefa",
          titulo: t.titulo,
          data: t.data_entrega,
          materia: t.materias?.nome,
        })),
    ]
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(0, 3);
    return lista;
  }, [eventosProximos, tarefas]);

  // Concluir uma tarefa diretamente do card de "Atividades" do dashboard.
  // Atualização otimista (a tarefa some da lista na hora) + sync + toast.
  async function concluirTarefa(tarefaId) {
    globalMutate(
      swrKeys.tarefas(uid),
      (prev) =>
        prev?.map((t) =>
          t.id === tarefaId ? { ...t, concluido: true } : t
        ),
      false
    );
    try {
      await updateLocal("tarefas", tarefaId, { concluido: true });
      await sincronizarAgoraSeOnline();
      globalMutate(swrKeys.tarefas(uid));
      globalMutate(swrKeys.eventosProximos(uid));
      globalMutate((key) => Array.isArray(key) && key[0] === "eventos_range");
      showToast("Tarefa concluída.", "success");
    } catch (e) {
      showToast(
        "Erro ao concluir tarefa: " + (e?.message || String(e)),
        "error"
      );
      globalMutate(swrKeys.tarefas(uid));
    }
  }

  // Lock por id: só aplica a mudança otimista depois que o clique anterior
  // terminou de sincronizar. Sem isso, dois cliques rápidos computavam
  // `!x.concluido` sobre o mesmo snapshot e o segundo sobrescrevia o
  // primeiro em vez de alternar de novo.
  async function toggleLembrete(l) {
    if (!l?.id || togglingRef.current.has(l.id)) return;
    togglingRef.current.add(l.id);
    const novoConcluido = !l.concluido;

    globalMutate(
      swrKeys.lembretes(uid),
      (prev) =>
        prev?.map((x) =>
          x.id === l.id ? { ...x, concluido: novoConcluido } : x
        ),
      false
    );

    try {
      await updateLocal("tarefas_rotina", l.id, { concluido: novoConcluido });
      await sincronizarAgoraSeOnline();
    } finally {
      togglingRef.current.delete(l.id);
      globalMutate(swrKeys.lembretes(uid));
    }
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
                <span aria-hidden="true">{icons.clipboard}</span> Atividades
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
                  const isTarefa = p.tipo === "tarefa";
                  return (
                    <div
                      key={p.id}
                      className={
                        "flex items-center gap-3 rounded-2xl px-4 py-3 shadow-soft transition-shadow hover:shadow-softHover " +
                        (destaque ? "bg-primary" : "bg-white")
                      }
                    >
                      {isTarefa ? (
                        <button
                          type="button"
                          onClick={() => concluirTarefa(p.realId)}
                          className={
                            "w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors " +
                            (destaque
                              ? "bg-white/20 text-white hover:bg-success hover:text-white"
                              : "bg-primarySoft text-primaryDark hover:bg-success hover:text-white")
                          }
                          aria-label={`Marcar "${p.titulo}" como concluída`}
                          title="Marcar como concluída"
                        >
                          {icons.circle}
                        </button>
                      ) : (
                        <span
                          className={
                            "w-9 h-9 rounded-full flex items-center justify-center shrink-0 " +
                            (destaque ? "bg-white/20 text-white" : "bg-primarySoft text-primaryDark")
                          }
                          aria-hidden="true"
                        >
                          {icons.calendar}
                        </span>
                      )}
                      <Link href="/tarefas" className="flex-1 min-w-0">
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
                      </Link>
                      <Link
                        href="/tarefas"
                        className={
                          "text-xs shrink-0 " +
                          (destaque ? "text-white/85" : "text-textMuted")
                        }
                      >
                        {new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </Link>
                    </div>
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

      <CalendarioView uid={uid} title="Calendário" titleIcon={icons.calendar} />
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
                          {icons.circle}
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
