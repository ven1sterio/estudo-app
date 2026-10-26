import { useEffect, useMemo, useRef, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { useRequireAuth } from "../lib/useAuth";
import { useConfirm } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";
import { supabase } from "../lib/supabaseClient";
import { db } from "../lib/db";
import { insertLocal, updateLocal, deleteLocal } from "../lib/cacheWrite";
import { sincronizarAgoraSeOnline } from "../lib/sync";
import AppLayout from "../components/AppLayout";
import Skeleton from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import {
  swrKeys,
  fetchMaterias,
  fetchTarefas,
  fetchLembretes,
  fetchProvas,
  fetchEventosManuais,
} from "../lib/fetchers";

const TIPOS = {
  prova: "Prova",
  atividade: "Atividade",
  trabalho: "Trabalho",
  seminario: "Seminário",
  lista: "Lista",
  outro: "Outro",
};

const PRIORIDADES = {
  alta: { label: "Alta", classe: "text-danger" },
  media: { label: "Média", classe: "text-warning" },
  baixa: { label: "Baixa", classe: "text-textMuted" },
};

function hojeStr() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function dataRelativa(dateStr) {
  if (!dateStr) return "";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(dateStr + "T00:00:00");
  const diff = Math.round((alvo - hoje) / 86400000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  if (diff < -1) return `atrasada ${Math.abs(diff)}d`;
  if (diff <= 7) return `em ${diff} dias`;
  return alvo.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const VIEWS = [
  { key: "todas", label: "Tudo" },
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Esta semana" },
  { key: "feitas", label: "Feitas" },
];

export default function Tarefas() {
  const { user, loading: authLoading } = useRequireAuth();
  const uid = user?.id;
  const confirm = useConfirm();
  const { showToast } = useToast();

  const { data: materias = [] } = useSWR(
    uid ? swrKeys.materias(uid) : null,
    () => fetchMaterias(uid)
  );
  const { data: tarefas = [], isLoading: lT } = useSWR(
    uid ? swrKeys.tarefas(uid) : null,
    () => fetchTarefas(uid)
  );
  const { data: lembretes = [], isLoading: lL } = useSWR(
    uid ? swrKeys.lembretes(uid) : null,
    () => fetchLembretes(uid)
  );
  const { data: provas = [] } = useSWR(
    uid ? swrKeys.provas(uid) : null,
    () => fetchProvas(uid)
  );
  const { data: eventosManuais = [] } = useSWR(
    uid ? swrKeys.eventosManuais(uid) : null,
    () => fetchEventosManuais(uid)
  );

  const [view, setView] = useState("todas");
  const [addOpen, setAddOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [novoLembrete, setNovoLembrete] = useState("");
  const [savingLembrete, setSavingLembrete] = useState(false);

  const hoje = hojeStr();
  const limiteSemana = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, []);

  const tarefasFiltradas = useMemo(() => {
    return tarefas.filter((t) => {
      if (view === "hoje") return !t.concluido && t.data_entrega === hoje;
      if (view === "semana")
        return (
          !t.concluido &&
          t.data_entrega >= hoje &&
          t.data_entrega <= limiteSemana
        );
      if (view === "feitas") return t.concluido;
      return true;
    });
  }, [tarefas, view, hoje, limiteSemana]);

  const grupos = useMemo(() => {
    const mapa = {};
    for (const t of tarefasFiltradas) {
      const mat = materias.find((m) => m.id === t.materia_id);
      const key = mat?.id || "_sem";
      if (!mapa[key]) {
        mapa[key] = {
          id: key,
          nome: mat?.nome || "Sem matéria",
          cor: mat?.cor || "#A3A0A8",
          tarefas: [],
        };
      }
      mapa[key].tarefas.push(t);
    }
    for (const g of Object.values(mapa)) {
      g.tarefas.sort((a, b) => a.data_entrega.localeCompare(b.data_entrega));
    }
    return Object.values(mapa).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [tarefasFiltradas, materias]);

  const totalPendentes = tarefas.filter((t) => !t.concluido).length;
  const totalHoje = tarefas.filter(
    (t) => !t.concluido && t.data_entrega === hoje
  ).length;

  /* -------------------- handlers (offline-first) -------------------- */

  async function handleAddTarefa({ titulo, materiaId, data, tipo, prioridade }) {
    if (!uid || !materiaId) return false;
    try {
      await insertLocal("tarefas", {
        user_id: uid,
        materia_id: materiaId,
        titulo,
        data_entrega: data,
        tipo,
        prioridade,
        concluido: false,
      });
      await sincronizarAgoraSeOnline();
      globalMutate(swrKeys.tarefas(uid));
      globalMutate((key) => Array.isArray(key) && key[0] === "eventos_range");
      showToast("Tarefa criada.", "success");
      return true;
    } catch (e) {
      showToast(
        "Erro ao criar tarefa: " + (e?.message || String(e)),
        "error"
      );
      return false;
    }
  }

  async function handleUpdateTarefa(id, patch) {
    globalMutate(
      swrKeys.tarefas(uid),
      (prev) => prev?.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      false
    );
    await updateLocal("tarefas", id, patch);
    await sincronizarAgoraSeOnline();
    globalMutate(swrKeys.tarefas(uid));
    globalMutate((key) => Array.isArray(key) && key[0] === "eventos_range");
  }

  async function toggleTarefa(tarefa) {
    const novo = !tarefa.concluido;
    globalMutate(
      swrKeys.tarefas(uid),
      (prev) =>
        prev?.map((t) => (t.id === tarefa.id ? { ...t, concluido: novo } : t)),
      false
    );
    await updateLocal("tarefas", tarefa.id, { concluido: novo });
    await sincronizarAgoraSeOnline();
    globalMutate(swrKeys.tarefas(uid));
  }

  async function removeTarefa(id) {
    const ok = await confirm({
      title: "Remover tarefa",
      description: "Esta ação não pode ser desfeita.",
      confirmLabel: "Remover",
      danger: true,
    });
    if (!ok) return;
    await deleteLocal("tarefas", id);
    await sincronizarAgoraSeOnline();
    globalMutate(swrKeys.tarefas(uid));
    globalMutate((key) => Array.isArray(key) && key[0] === "eventos_range");
    showToast("Tarefa removida.", "success");
  }

  async function handleAddLembrete(e) {
    e.preventDefault();
    if (!novoLembrete.trim()) return;
    setSavingLembrete(true);
    try {
      await insertLocal("tarefas_rotina", {
        user_id: uid,
        titulo: novoLembrete,
        concluido: false,
      });
      await sincronizarAgoraSeOnline();
      setNovoLembrete("");
      globalMutate(swrKeys.lembretes(uid));
      showToast("Lembrete adicionado.", "success");
    } catch (e) {
      showToast(
        "Erro ao adicionar lembrete: " + (e?.message || String(e)),
        "error"
      );
    } finally {
      setSavingLembrete(false);
    }
  }

  async function toggleLembrete(lembrete) {
    const novo = !lembrete.concluido;
    globalMutate(
      swrKeys.lembretes(uid),
      (prev) =>
        prev?.map((l) => (l.id === lembrete.id ? { ...l, concluido: novo } : l)),
      false
    );
    await updateLocal("tarefas_rotina", lembrete.id, { concluido: novo });
    await sincronizarAgoraSeOnline();
    globalMutate(swrKeys.lembretes(uid));
  }

  async function removeLembrete(id) {
    const ok = await confirm({
      title: "Remover lembrete",
      confirmLabel: "Remover",
      danger: true,
    });
    if (!ok) return;
    await deleteLocal("tarefas_rotina", id);
    await sincronizarAgoraSeOnline();
    globalMutate(swrKeys.lembretes(uid));
    showToast("Lembrete removido.", "success");
  }

  async function removeProva(id) {
    const ok = await confirm({
      title: "Remover prova",
      description: "O evento no calendário também será removido.",
      confirmLabel: "Remover",
      danger: true,
    });
    if (!ok) return;

    // Cobre o trigger do banco quando offline: remove eventos ligados à prova
    try {
      const locais = await db.eventos_calendario.toArray();
      for (const e of locais) {
        if (e.prova_id === id) {
          await deleteLocal("eventos_calendario", e.id);
        }
      }
    } catch {
      /* sem eventos locais para limpar */
    }

    await deleteLocal("provas", id);
    await sincronizarAgoraSeOnline();
    globalMutate(swrKeys.provas(uid));
    globalMutate((key) => Array.isArray(key) && key[0] === "eventos_range");
    globalMutate(swrKeys.eventosManuais(uid));
    showToast("Prova removida.", "success");
  }

  async function removeEventoManual(id) {
    const ok = await confirm({
      title: "Remover evento",
      description: "O evento será removido do calendário.",
      confirmLabel: "Remover",
      danger: true,
    });
    if (!ok) return;
    await deleteLocal("eventos_calendario", id);
    await sincronizarAgoraSeOnline();
    globalMutate(swrKeys.eventosManuais(uid));
    globalMutate((key) => Array.isArray(key) && key[0] === "eventos_range");
    showToast("Evento removido.", "success");
  }

  if (authLoading) return null;

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-textPrimary">
              Tarefas
            </h1>
            <p className="text-textMuted mt-1 text-sm">
              {totalPendentes} pendente{totalPendentes === 1 ? "" : "s"}
              {totalHoje > 0 ? ` · ${totalHoje} para hoje` : ""}
            </p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="btn-primary flex items-center gap-2"
            disabled={materias.length === 0}
            title={
              materias.length === 0
                ? "Cadastre uma matéria primeiro"
                : "Nova tarefa"
            }
          >
            + Nova tarefa
          </button>
        </div>
      </div>

      {/* Views */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto scrollbar-none">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap " +
              (view === v.key
                ? "bg-primarySoft text-primaryDark"
                : "text-textMuted hover:bg-primaryExtraSoft")
            }
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Nova tarefa inline */}
      {addOpen && (
        <AddTarefaInline
          materias={materias}
          onCancel={() => setAddOpen(false)}
          onSave={handleAddTarefa}
        />
      )}

      {/* Lista agrupada */}
      {lT ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : grupos.length === 0 ? (
        <EmptyState
          icon="✓"
          title={
            view === "feitas"
              ? "Nada concluído ainda"
              : view === "hoje"
              ? "Nada para hoje 🎉"
              : "Nenhuma tarefa por aqui"
          }
          description={
            view === "feitas"
              ? "As tarefas concluídas aparecem aqui."
              : "Quando você criar tarefas acadêmicas, elas aparecem nesta lista agrupadas por matéria."
          }
          action={
            materias.length > 0 ? (
              <button onClick={() => setAddOpen(true)} className="btn-primary">
                + Nova tarefa
              </button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-6">
          {grupos.map((g) => (
            <TarefaGrupo
              key={g.id}
              grupo={g}
              collapsed={!!collapsed[g.id]}
              onToggleCollapse={() =>
                setCollapsed((c) => ({ ...c, [g.id]: !c[g.id] }))
              }
              onToggleTarefa={toggleTarefa}
              onRemoveTarefa={removeTarefa}
              onUpdateTarefa={handleUpdateTarefa}
            />
          ))}
        </div>
      )}

      {/* Rotina */}
      <div className="mt-12">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-info" />
          <h2 className="text-sm font-semibold text-textMuted uppercase tracking-wide">
            Rotina diária
          </h2>
        </div>
        <div className="card">
          <form onSubmit={handleAddLembrete} className="flex gap-2 mb-3">
            <input
              className="input-field"
              placeholder="Adicionar lembrete à rotina..."
              value={novoLembrete}
              onChange={(e) => setNovoLembrete(e.target.value)}
            />
            <button
              type="submit"
              disabled={savingLembrete || !novoLembrete.trim()}
              className="btn-primary shrink-0"
            >
              Adicionar
            </button>
          </form>
          {lL ? (
            <Skeleton className="h-10 w-full" />
          ) : lembretes.length === 0 ? (
            <p className="text-textMuted text-sm">
              Nenhum hábito cadastrado ainda.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {lembretes.map((l) => (
                <li
                  key={l.id}
                  className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-primaryExtraSoft transition-colors"
                >
                  <NotionCheckbox
                    done={l.concluido}
                    onToggle={() => toggleLembrete(l)}
                    label={l.titulo}
                  />
                  <span
                    className={
                      "flex-1 min-w-0 break-words text-sm " +
                      (l.concluido
                        ? "line-through text-textMuted"
                        : "text-textPrimary")
                    }
                  >
                    {l.titulo}
                  </span>
                  <button
                    onClick={() => removeLembrete(l.id)}
                    aria-label="Remover lembrete"
                    className="opacity-0 group-hover:opacity-100 text-textMuted hover:text-danger text-xs px-2 py-1 rounded transition-opacity"
                  >
                    remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Provas e eventos */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <h2 className="text-sm font-semibold text-textMuted uppercase tracking-wide">
            Provas e eventos
          </h2>
        </div>
        <div className="card">
          {provas.length === 0 && eventosManuais.length === 0 ? (
            <p className="text-textMuted text-sm">Nada por aqui ainda.</p>
          ) : (
            <ul className="space-y-1">
              {provas.map((p) => (
                <li
                  key={`prova-${p.id}`}
                  className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-primaryExtraSoft transition-colors"
                >
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primarySoft text-primaryDark shrink-0">
                    Prova
                  </span>
                  <span className="flex-1 min-w-0 break-words text-sm text-textPrimary">
                    {p.titulo}
                    <span className="text-textMuted">
                      {" "}
                      · {p.materias?.nome} · {dataRelativa(p.data)}
                    </span>
                  </span>
                  <button
                    onClick={() => removeProva(p.id)}
                    className="text-textMuted hover:text-danger text-xs px-2 py-1"
                  >
                    remover
                  </button>
                </li>
              ))}
              {eventosManuais.map((e) => (
                <li
                  key={`evento-${e.id}`}
                  className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-primaryExtraSoft transition-colors"
                >
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accentPink/60 text-pink-700 dark:text-pink-300 shrink-0">
                    Evento
                  </span>
                  <span className="flex-1 min-w-0 break-words text-sm text-textPrimary">
                    {e.titulo}
                    <span className="text-textMuted">
                      {" "}
                      · {e.materias?.nome ? `${e.materias.nome} · ` : ""}
                      {dataRelativa(e.data)}
                    </span>
                  </span>
                  <button
                    onClick={() => removeEventoManual(e.id)}
                    className="text-textMuted hover:text-danger text-xs px-2 py-1"
                  >
                    remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

/* ------------------------ Subcomponentes ------------------------ */

function NotionCheckbox({ done, onToggle, label }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={
        "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all " +
        (done
          ? "bg-success border-success text-white"
          : "border-textMuted/40 hover:border-primary")
      }
      aria-label={done ? `Marcar "${label}" como pendente` : `Marcar "${label}" como concluída`}
    >
      {done && (
        <svg
          viewBox="0 0 24 24"
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m5 12 5 5L20 7" />
        </svg>
      )}
    </button>
  );
}

function TarefaGrupo({
  grupo,
  collapsed,
  onToggleCollapse,
  onToggleTarefa,
  onRemoveTarefa,
  onUpdateTarefa,
}) {
  const done = grupo.tarefas.filter((t) => t.concluido).length;
  const total = grupo.tarefas.length;

  return (
    <section>
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex items-center gap-2 mb-1 w-full text-left group"
        aria-expanded={!collapsed}
      >
        <span
          className="text-textMuted text-xs transition-transform inline-block w-3"
          style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0)" }}
          aria-hidden="true"
        >
          ▼
        </span>
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: grupo.cor }}
          aria-hidden="true"
        />
        <h2 className="font-semibold text-textPrimary truncate">
          {grupo.nome}
        </h2>
        <span className="text-textMuted text-xs shrink-0">
          {done > 0 ? `${done}/${total}` : `${total}`}
        </span>
      </button>

      {!collapsed && (
        <div className="pl-5 space-y-0.5">
          {grupo.tarefas.map((t) => (
            <TarefaRow
              key={t.id}
              tarefa={t}
              onToggle={() => onToggleTarefa(t)}
              onRemove={() => onRemoveTarefa(t.id)}
              onUpdate={(patch) => onUpdateTarefa(t.id, patch)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TarefaRow({ tarefa, onToggle, onRemove, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [titulo, setTitulo] = useState(tarefa.titulo);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setTitulo(tarefa.titulo);
  }, [tarefa.titulo]);

  function commitEdit() {
    const novo = titulo.trim();
    if (novo && novo !== tarefa.titulo) {
      onUpdate({ titulo: novo });
    } else {
      setTitulo(tarefa.titulo);
    }
    setEditing(false);
  }

  const prio = PRIORIDADES[tarefa.prioridade];

  return (
    <div className="group flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-primaryExtraSoft transition-colors">
      <div className="mt-0.5">
        <NotionCheckbox
          done={tarefa.concluido}
          onToggle={onToggle}
          label={tarefa.titulo}
        />
      </div>

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitEdit();
              } else if (e.key === "Escape") {
                setTitulo(tarefa.titulo);
                setEditing(false);
              }
            }}
            className="w-full bg-transparent border-b border-primary outline-none text-sm text-textPrimary py-0.5"
          />
        ) : (
          <button
            type="button"
            onClick={() => !tarefa.concluido && setEditing(true)}
            className={
              "text-left w-full text-sm leading-snug break-words " +
              (tarefa.concluido
                ? "line-through text-textMuted cursor-default"
                : "text-textPrimary hover:text-primary")
            }
            title={tarefa.concluido ? "" : "Clique para editar"}
          >
            {tarefa.titulo}
          </button>
        )}

        <div className="flex items-center gap-1.5 text-xs text-textMuted mt-0.5 flex-wrap">
          <span>{dataRelativa(tarefa.data_entrega)}</span>
          {prio && tarefa.prioridade !== "baixa" && (
            <>
              <span aria-hidden="true">·</span>
              <span className={prio.classe}>{prio.label}</span>
            </>
          )}
          {tarefa.tipo && tarefa.tipo !== "atividade" && (
            <>
              <span aria-hidden="true">·</span>
              <span>{TIPOS[tarefa.tipo] || tarefa.tipo}</span>
            </>
          )}
        </div>
      </div>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((m) => !m)}
          className="w-7 h-7 rounded flex items-center justify-center text-textMuted hover:bg-surface opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          aria-label="Mais ações"
        >
          ⋯
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#262430] border border-borderSoft rounded-lg shadow-lg z-20 py-1 min-w-[150px]">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setEditing(true);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-textPrimary hover:bg-primaryExtraSoft"
              >
                Renomear
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onRemove();
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
              >
                Remover
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AddTarefaInline({ materias, onCancel, onSave }) {
  const [titulo, setTitulo] = useState("");
  const [materiaId, setMateriaId] = useState(materias[0]?.id || "");
  const [data, setData] = useState(hojeStr());
  const [tipo, setTipo] = useState("atividade");
  const [prioridade, setPrioridade] = useState("media");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!titulo.trim() || !materiaId) return;
    setSaving(true);
    const ok = await onSave({
      titulo: titulo.trim(),
      materiaId,
      data,
      tipo,
      prioridade,
    });
    setSaving(false);
    if (ok) {
      setTitulo("");
      onCancel();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card mb-5 space-y-3">
      <input
        autoFocus
        required
        className="input-field font-medium"
        placeholder="O que precisa ser feito?"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <select
          className="input-field"
          value={materiaId}
          onChange={(e) => setMateriaId(e.target.value)}
        >
          {materias.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="input-field"
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
        <select
          className="input-field"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          {Object.entries(TIPOS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          className="input-field"
          value={prioridade}
          onChange={(e) => setPrioridade(e.target.value)}
        >
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-textMuted px-3"
        >
          Cancelar
        </button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Salvando..." : "Adicionar"}
        </button>
      </div>
    </form>
  );
}
