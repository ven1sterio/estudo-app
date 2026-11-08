import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { useRequireAuth } from "../../lib/useAuth";
import { useConfirm } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import Modal from "../../components/Modal";
import { supabase } from "../../lib/supabaseClient";
import { db } from "../../lib/db";
import { isOnline } from "../../lib/network";
import {
  insertLocal,
  updateLocal,
  deleteLocal,
  deleteMateriaLocal,
} from "../../lib/cacheWrite";
import { sincronizarAgoraSeOnline } from "../../lib/sync";
import AppLayout from "../../components/AppLayout";
import Skeleton from "../../components/Skeleton";
import VisualizadorArquivo, {
  caminhoNoStorage,
} from "../../components/VisualizadorArquivo";
import { icons } from "../../components/icons";
import {
  swrKeys,
  fetchMateriaDetalhe,
  fetchMateriaisDaMateria,
  fetchColecoesDaMateria,
  fetchTarefasDaMateria,
  fetchProvasDaMateria,
  fetchLembretes,
} from "../../lib/fetchers";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatRevisao(data) {
  if (!data) return "nunca revisado";
  const dias = Math.floor((Date.now() - new Date(data).getTime()) / 86400000);
  if (dias <= 0) return "revisado hoje";
  return `revisado há ${dias} dia${dias > 1 ? "s" : ""}`;
}

function fmtData(s) {
  if (!s) return "";
  return new Date(s + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export default function MateriaDetalhe() {
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();
  const { id } = router.query;
  const uid = user?.id;
  const confirm = useConfirm();
  const { showToast } = useToast();

  const ready = !!user && !!id;

  const { data: materia, isLoading: lMat } = useSWR(
    ready ? swrKeys.materiaDetalhe(id) : null,
    () => fetchMateriaDetalhe(id)
  );
  const { data: materiais = [], isLoading: lMats } = useSWR(
    ready ? swrKeys.materiaisMateria(id) : null,
    () => fetchMateriaisDaMateria(id)
  );
  const { data: colecoes = [] } = useSWR(
    ready ? swrKeys.colecoesMateria(id) : null,
    () => fetchColecoesDaMateria(id)
  );
  const { data: tarefas = [] } = useSWR(
    ready ? swrKeys.tarefasMateria(id) : null,
    () => fetchTarefasDaMateria(id)
  );
  const { data: provas = [] } = useSWR(
    ready ? swrKeys.provasMateria(id) : null,
    () => fetchProvasDaMateria(id)
  );
  const { data: lembretes = [] } = useSWR(
    uid ? swrKeys.lembretes(uid) : null,
    () => fetchLembretes(uid)
  );

  const [uploading, setUploading] = useState(false);
  const [deletingMateria, setDeletingMateria] = useState(false);
  const [view, setView] = useState("grid");

  const [playlistAtiva, setPlaylistAtiva] = useState("Geral");
  const [novaPlaylist, setNovaPlaylist] = useState("");
  const [showNovaPlaylist, setShowNovaPlaylist] = useState(false);

  const [error, setError] = useState("");
  const [arquivoAberto, setArquivoAberto] = useState(null);

  // -------- Edição de matéria --------
  const [showEdit, setShowEdit] = useState(false);
  const [formMat, setFormMat] = useState(null);
  const [formHorarios, setFormHorarios] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // -------- Form rápido de prova --------
  const [showProvaForm, setShowProvaForm] = useState(false);
  const [provaTitulo, setProvaTitulo] = useState("");
  const [provaData, setProvaData] = useState("");
  const [savingProva, setSavingProva] = useState(false);

  // Lock por id de lembrete: evita mutações otimistas conflitantes.
  const togglingRef = useRef(new Set());

  const playlists = useMemo(() => {
    const existentes = new Set(materiais.map((m) => m.topico || "Geral"));
    existentes.add("Geral");
    return Array.from(existentes);
  }, [materiais]);

  /* -------------------- Handlers de matéria -------------------- */

  function abrirEdicao() {
    if (!materia) return;
    setFormMat({
      nome: materia.nome || "",
      codigo: materia.codigo || "",
      professor: materia.professor || "",
      email_professor: materia.email_professor || "",
      descricao: materia.descricao || "",
      cor: materia.cor || "#8B6FD8",
    });
    setFormHorarios(
      (materia.horarios || []).map((h) => ({
        _id: h.id,
        dia_semana: h.dia_semana,
        hora_inicio: (h.hora_inicio || "").slice(0, 5),
        hora_fim: (h.hora_fim || "").slice(0, 5),
        predio: h.predio || "",
        bloco: h.bloco || "",
        sala: h.sala || "",
      }))
    );
    setShowEdit(true);
  }

  function addHorarioEdit() {
    setFormHorarios((hs) => [
      ...hs,
      {
        _id: null,
        dia_semana: 1,
        hora_inicio: "",
        hora_fim: "",
        predio: "",
        bloco: "",
        sala: "",
      },
    ]);
  }

  function removeHorarioEdit(idx) {
    setFormHorarios((hs) => hs.filter((_, i) => i !== idx));
  }

  function updateHorarioEdit(idx, campo, valor) {
    setFormHorarios((hs) =>
      hs.map((h, i) => (i === idx ? { ...h, [campo]: valor } : h))
    );
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!formMat) return;
    setSavingEdit(true);

    try {
      await updateLocal("materias", id, {
        nome: formMat.nome,
        codigo: formMat.codigo,
        professor: formMat.professor,
        email_professor: formMat.email_professor,
        descricao: formMat.descricao,
        cor: formMat.cor,
      });

      // Horários: apaga todos os existentes (locais + outbox) e insere os
      // novos via insertLocal. O servidor recebe um delete por horário e
      // um insert por horário novo — mesma semântica do original.
      const horariosAtuais = await db.horarios
        .where("materia_id")
        .equals(id)
        .toArray();
      for (const h of horariosAtuais) {
        await deleteLocal("horarios", h.id);
      }

      const validos = formHorarios.filter((h) => h.hora_inicio && h.hora_fim);
      for (const h of validos) {
        await insertLocal("horarios", {
          materia_id: id,
          dia_semana: Number(h.dia_semana),
          hora_inicio: h.hora_inicio,
          hora_fim: h.hora_fim,
          predio: h.predio || null,
          bloco: h.bloco || null,
          sala: h.sala || null,
        });
      }

      await sincronizarAgoraSeOnline();
      setShowEdit(false);
      globalMutate(swrKeys.materiaDetalhe(id));
      globalMutate(swrKeys.materias(uid));
      showToast("Matéria atualizada.", "success");
    } catch (err) {
      showToast("Erro ao salvar matéria: " + err.message, "error");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteMateria() {
    const ok = await confirm({
      title: "Excluir matéria",
      description: `Tem certeza que deseja excluir a matéria "${materia.nome}"?`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;

    setDeletingMateria(true);
    try {
      await deleteMateriaLocal(id);
      await sincronizarAgoraSeOnline();
      globalMutate(swrKeys.materias(uid));
      showToast("Matéria excluída.", "success");
      router.push("/materias");
    } catch (deleteError) {
      setError(deleteError.message);
      showToast("Erro ao excluir: " + deleteError.message, "error");
    } finally {
      setDeletingMateria(false);
    }
  }

  /* -------------------- Materiais -------------------- */

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !uid) return;
    setError("");

    if (!isOnline()) {
      setError("Você está offline. Envio de arquivos precisa de conexão.");
      e.target.value = "";
      return;
    }

    setUploading(true);

    const filePath = `${uid}/${id}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("materiais")
      .upload(filePath, file);
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      showToast("Falha no upload: " + uploadError.message, "error");
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("materiais").getPublicUrl(filePath);

    try {
      await insertLocal("materiais", {
        materia_id: id,
        user_id: uid,
        titulo: file.name,
        arquivo_url: publicUrl,
        topico: playlistAtiva,
      });
      await sincronizarAgoraSeOnline();
      e.target.value = "";
      globalMutate(swrKeys.materiaisMateria(id));
      showToast("Arquivo enviado.", "success");
    } catch (insertError) {
      setError(insertError.message);
      showToast("Erro ao registrar arquivo: " + insertError.message, "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteMaterial(materialId, arquivoUrl) {
    const ok = await confirm({
      title: "Remover material",
      confirmLabel: "Remover",
      danger: true,
    });
    if (!ok) return;

    // Se online, tenta remover o binário do Storage (best effort)
    if (isOnline()) {
      const path = caminhoNoStorage(arquivoUrl);
      if (path) {
        try {
          await supabase.storage.from("materiais").remove([path]);
        } catch {
          /* arquivo órfão é aceitável */
        }
      }
    }

    globalMutate(
      swrKeys.materiaisMateria(id),
      (prev) => prev?.filter((m) => m.id !== materialId),
      false
    );
    await deleteLocal("materiais", materialId);
    await sincronizarAgoraSeOnline();
    globalMutate(swrKeys.materiaisMateria(id));
    showToast("Material removido.", "success");
  }

  function handleCriarPlaylist(e) {
    e.preventDefault();
    if (!novaPlaylist.trim()) return;
    setPlaylistAtiva(novaPlaylist.trim());
    setNovaPlaylist("");
    setShowNovaPlaylist(false);
  }

  /* -------------------- Baralhos -------------------- */

  async function handleDeleteBaralho(colecaoId) {
    const ok = await confirm({
      title: "Remover baralho",
      description: "Todos os cartões deste baralho serão removidos.",
      confirmLabel: "Remover",
      danger: true,
    });
    if (!ok) return;

    globalMutate(
      swrKeys.colecoesMateria(id),
      (prev) => prev?.filter((c) => c.id !== colecaoId),
      false
    );
    try {
      await db.flashcards.where("colecao_id").equals(colecaoId).delete();
    } catch {
      /* Dexie pode falhar em SSR */
    }
    await deleteLocal("flashcard_colecoes", colecaoId);
    await sincronizarAgoraSeOnline();
    globalMutate(swrKeys.colecoesMateria(id));
    globalMutate(swrKeys.colecoes(uid));
    showToast("Baralho removido.", "success");
  }

  /* -------------------- Lembretes -------------------- */

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

  /* -------------------- Provas (form rápido) -------------------- */

  async function handleAddProva(e) {
    e.preventDefault();
    if (!provaTitulo.trim() || !provaData) return;
    setSavingProva(true);

    try {
      await insertLocal("provas", {
        materia_id: id,
        user_id: uid,
        titulo: provaTitulo.trim(),
        data: provaData,
      });
      await sincronizarAgoraSeOnline();
      setProvaTitulo("");
      setProvaData("");
      setShowProvaForm(false);
      globalMutate(swrKeys.provasMateria(id));
      globalMutate(swrKeys.provas(uid));
      globalMutate((key) => Array.isArray(key) && key[0] === "eventos_range");

      const msg = isOnline()
        ? "Prova criada e adicionada ao calendário."
        : "Prova criada. O evento no calendário aparece ao reconectar.";
      showToast(msg, "success");
    } catch (err) {
      showToast("Erro ao criar prova: " + err.message, "error");
    } finally {
      setSavingProva(false);
    }
  }

  async function handleDeleteProva(provaId) {
    const ok = await confirm({
      title: "Remover prova",
      description: "O evento no calendário também será removido.",
      confirmLabel: "Remover",
      danger: true,
    });
    if (!ok) return;

    // O trigger do servidor (migration 05) remove o evento via prova_id;
    // localmente limpamos os eventos ligados a essa prova.
    try {
      const eventos = await db.eventos_calendario.toArray();
      for (const ev of eventos) {
        if (ev.prova_id === provaId) {
          await db.eventos_calendario.delete(ev.id);
        }
      }
    } catch {
      /* ignora */
    }

    await deleteLocal("provas", provaId);
    await sincronizarAgoraSeOnline();
    globalMutate(swrKeys.provasMateria(id));
    globalMutate(swrKeys.provas(uid));
    globalMutate((key) => Array.isArray(key) && key[0] === "eventos_range");
    showToast("Prova removida.", "success");
  }

  /* -------------------- Render -------------------- */

  if (authLoading) return null;

  if (lMat) {
    return (
      <AppLayout>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!materia) {
    return (
      <AppLayout>
        <p className="text-textPrimary">Matéria não encontrada.</p>
      </AppLayout>
    );
  }

  const materiaisDaPlaylist = materiais.filter(
    (m) => (m.topico || "Geral") === playlistAtiva
  );

  const atividadesLista = [
    ...provas.map((p) => ({
      id: `prova-${p.id}`,
      titulo: p.titulo,
      data: p.data,
      isProva: true,
      provaId: p.id,
    })),
    ...tarefas.map((t) => ({
      id: `tarefa-${t.id}`,
      titulo: t.titulo,
      data: t.data_entrega,
      isProva: false,
    })),
  ].sort((a, b) => a.data.localeCompare(b.data));

  return (
    <AppLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="lg:col-span-2 min-w-0 space-y-6">
          <div
            className="card"
            style={{ borderLeft: `4px solid ${materia.cor || "#8B85F0"}` }}
          >
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold break-words text-textPrimary">{materia.nome}</h1>
                <p className="text-textSecondary">
                  {materia.codigo && `${materia.codigo} · `}
                  {materia.professor}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={abrirEdicao}
                  className="text-primary border border-primarySoft hover:border-primary text-sm font-medium rounded-xl px-3 py-1.5 transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={handleDeleteMateria}
                  disabled={deletingMateria}
                  className="text-red-500 hover:text-red-700 text-sm font-medium border border-red-200 hover:border-red-400 rounded-xl px-3 py-1.5 transition-colors disabled:opacity-50"
                >
                  {deletingMateria ? "Excluindo..." : "Excluir"}
                </button>
              </div>
            </div>
            {materia.descricao && (
              <p className="text-textSecondary text-sm mt-2">{materia.descricao}</p>
            )}
            {materia.horarios?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {materia.horarios.map((h) => (
                  <span
                    key={h.id}
                    className="text-xs bg-primarySoft text-primaryDark rounded-full px-2 py-0.5"
                  >
                    {DIAS[h.dia_semana]} {h.hora_inicio?.slice(0, 5)}-
                    {h.hora_fim?.slice(0, 5)}
                    {h.sala ? ` · ${h.sala}` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-3 text-textPrimary">
              Flashcards
            </h2>
            <Link href={`/materias/${id}/flashcards`} className="btn-primary">
              + Novo baralho
            </Link>
          </div>
          {colecoes.length === 0 ? (
            <p className="text-textMuted text-sm">Nenhum baralho criado ainda.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {colecoes.map((c) => (
                <BaralhoCard
                  key={c.id}
                  c={c}
                  materiaId={id}
                  materiaCor={materia.cor}
                  onDelete={handleDeleteBaralho}
                />
              ))}
            </div>
          )}

          <div className="card">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="font-semibold text-lg text-textPrimary">📎 Materiais</h2>
              <div className="flex bg-surface rounded-xl border border-borderSoft p-1">
                <button
                  onClick={() => setView("grid")}
                  aria-label="Visualização em grade"
                  className={
                    "px-3 py-1 rounded-lg text-sm " +
                    (view === "grid"
                      ? "bg-white shadow-sm text-primaryDark"
                      : "text-textMuted")
                  }
                >
                  ▦
                </button>
                <button
                  onClick={() => setView("list")}
                  aria-label="Visualização em lista"
                  className={
                    "px-3 py-1 rounded-lg text-sm " +
                    (view === "list"
                      ? "bg-white shadow-sm text-primaryDark"
                      : "text-textMuted")
                  }
                >
                  ☰
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              {playlists.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlaylistAtiva(p)}
                  className={
                    "text-sm rounded-full px-3 py-1 transition-colors " +
                    (p === playlistAtiva
                      ? "bg-primary text-white"
                      : "bg-surface text-textSecondary hover:bg-primarySoft")
                  }
                >
                  {p}
                </button>
              ))}
              {showNovaPlaylist ? (
                <form onSubmit={handleCriarPlaylist}>
                  <input
                    autoFocus
                    className="input-field !w-40 !py-1"
                    placeholder="Nova playlist"
                    value={novaPlaylist}
                    onChange={(e) => setNovaPlaylist(e.target.value)}
                    onBlur={() => !novaPlaylist && setShowNovaPlaylist(false)}
                  />
                </form>
              ) : (
                <button
                  onClick={() => setShowNovaPlaylist(true)}
                  className="text-sm rounded-full px-3 py-1 border border-dashed border-borderSoft text-textMuted hover:text-primary hover:border-primary"
                >
                  + playlist
                </button>
              )}
            </div>

            <label className="btn-primary cursor-pointer inline-block mb-4">
              {uploading ? "Enviando..." : `+ Adicionar arquivo em "${playlistAtiva}"`}
              <input
                type="file"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            {lMats ? (
              <Skeleton className="h-20 w-full" />
            ) : materiaisDaPlaylist.length === 0 ? (
              <p className="text-textMuted text-sm">Nenhum arquivo nesta playlist ainda.</p>
            ) : view === "list" ? (
              <ul className="space-y-1">
                {materiaisDaPlaylist.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 text-sm"
                  >
                    <button
                      type="button"
                      onClick={() => setArquivoAberto(m)}
                      className="text-primary hover:underline truncate min-w-0 text-left"
                    >
                      {m.titulo}
                    </button>
                    <button
                      onClick={() => handleDeleteMaterial(m.id, m.arquivo_url)}
                      className="text-textMuted hover:text-red-500 text-xs ml-3 p-2 -m-2 shrink-0"
                    >
                      remover
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {materiaisDaPlaylist.map((m) => (
                  <div
                    key={m.id}
                    className="border border-borderSoft rounded-xl p-3 bg-surface"
                  >
                    <button
                      type="button"
                      onClick={() => setArquivoAberto(m)}
                      className="text-primary text-sm hover:underline block truncate w-full text-left"
                    >
                      📄 {m.titulo}
                    </button>
                    <button
                      onClick={() => handleDeleteMaterial(m.id, m.arquivo_url)}
                      className="text-textMuted hover:text-red-500 text-xs mt-2"
                    >
                      remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-6">
          <section className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm tracking-wide text-textMuted uppercase">
                Atividades
              </h2>
              <Link
                href="/tarefas"
                aria-label="Ir para tarefas"
                className="w-6 h-6 flex items-center justify-center rounded-full bg-primarySoft text-primaryDark hover:bg-primary hover:text-white transition-colors"
              >
                +
              </Link>
            </div>
            {atividadesLista.length === 0 ? (
              <p className="text-textMuted text-sm">Nenhuma atividade vinculada ainda.</p>
            ) : (
              <ul className="space-y-2">
                {atividadesLista.map((a) => (
                  <li key={a.id} className="text-sm flex justify-between gap-2">
                    <span className="min-w-0 break-words">
                      {a.isProva ? "📝 " : ""}
                      <span className="text-primary">{a.titulo}</span>
                    </span>
                    <span className="text-xs text-textMuted shrink-0">
                      {fmtData(a.data)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm tracking-wide text-textMuted uppercase">
                Provas
              </h2>
              <button
                onClick={() => setShowProvaForm((s) => !s)}
                aria-label="Adicionar prova"
                className="w-6 h-6 flex items-center justify-center rounded-full bg-primarySoft text-primaryDark hover:bg-primary hover:text-white transition-colors"
              >
                {showProvaForm ? "✕" : "+"}
              </button>
            </div>

            {showProvaForm && (
              <form onSubmit={handleAddProva} className="space-y-2 mb-3">
                <input
                  required
                  autoFocus
                  className="input-field !py-1.5"
                  placeholder="Título (ex: P1)"
                  value={provaTitulo}
                  onChange={(e) => setProvaTitulo(e.target.value)}
                />
                <input
                  required
                  type="date"
                  className="input-field !py-1.5"
                  value={provaData}
                  onChange={(e) => setProvaData(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={savingProva}
                  className="btn-primary !py-1.5 w-full"
                >
                  {savingProva ? "Salvando..." : "Salvar prova"}
                </button>
                <p className="text-[11px] text-textMuted">
                  A prova aparece automaticamente no calendário.
                </p>
              </form>
            )}

            {provas.length === 0 ? (
              <p className="text-textMuted text-sm">Nenhuma prova cadastrada.</p>
            ) : (
              <ul className="space-y-2">
                {provas.map((p) => (
                  <li key={p.id} className="text-sm flex justify-between gap-2">
                    <span className="min-w-0 break-words">
                      {p.titulo}{" "}
                      <span className="text-xs text-textMuted">
                        · {fmtData(p.data)}
                      </span>
                    </span>
                    <button
                      onClick={() => handleDeleteProva(p.id)}
                      className="text-textMuted hover:text-red-500 text-xs shrink-0 p-1 -m-1"
                    >
                      remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm tracking-wide text-textMuted uppercase">
                Lembretes
              </h2>
              <Link
                href="/tarefas"
                aria-label="Ir para tarefas"
                className="w-6 h-6 flex items-center justify-center rounded-full bg-primarySoft text-primaryDark hover:bg-primary hover:text-white transition-colors"
              >
                +
              </Link>
            </div>
            {lembretes.length === 0 ? (
              <p className="text-textMuted text-sm">Nenhum lembrete ainda.</p>
            ) : (
              <ul className="space-y-2">
                {lembretes.slice(0, 5).map((l) => (
                  <li key={l.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={l.concluido}
                      onChange={() => toggleLembrete(l)}
                      className="w-4 h-4 accent-primary shrink-0"
                    />
                    <span
                      className={
                        "min-w-0 break-words " +
                        (l.concluido ? "line-through text-textMuted" : "text-textPrimary")
                      }
                    >
                      {l.titulo}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {arquivoAberto && (
        <VisualizadorArquivo
          titulo={arquivoAberto.titulo}
          url={arquivoAberto.arquivo_url}
          onClose={() => setArquivoAberto(null)}
        />
      )}

      <Modal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        title="Editar matéria"
        maxWidth="max-w-2xl"
      >
        {formMat && (
          <form onSubmit={handleSaveEdit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-textPrimary">Nome *</label>
                <input
                  required
                  className="input-field"
                  value={formMat.nome}
                  onChange={(e) =>
                    setFormMat((f) => ({ ...f, nome: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-textPrimary">Código</label>
                <input
                  className="input-field"
                  value={formMat.codigo}
                  onChange={(e) =>
                    setFormMat((f) => ({ ...f, codigo: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-textPrimary">Professor</label>
                <input
                  className="input-field"
                  value={formMat.professor}
                  onChange={(e) =>
                    setFormMat((f) => ({ ...f, professor: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-textPrimary">
                  Email do professor
                </label>
                <input
                  type="email"
                  className="input-field"
                  value={formMat.email_professor}
                  onChange={(e) =>
                    setFormMat((f) => ({
                      ...f,
                      email_professor: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1 text-textPrimary">Descrição</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={formMat.descricao}
                  onChange={(e) =>
                    setFormMat((f) => ({ ...f, descricao: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-textPrimary">Cor</label>
                <input
                  type="color"
                  className="w-12 h-10 rounded-xl border border-borderSoft cursor-pointer"
                  value={formMat.cor}
                  onChange={(e) =>
                    setFormMat((f) => ({ ...f, cor: e.target.value }))
                  }
                  aria-label="Cor da matéria"
                />
              </div>
            </div>

            <hr className="border-borderSoft my-3" />

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-textPrimary">
                Locais e Horários
              </h3>
              <button
                type="button"
                onClick={addHorarioEdit}
                className="text-xs text-primary hover:underline"
              >
                + Adicionar
              </button>
            </div>

            {formHorarios.length === 0 && (
              <p className="text-xs text-textMuted">
                Nenhum horário cadastrado. Clique em "+ Adicionar".
              </p>
            )}

            {formHorarios.map((h, idx) => (
              <div
                key={idx}
                className="border border-borderSoft bg-gray-50/50 rounded-xl p-3 space-y-2 relative"
              >
                <button
                  type="button"
                  onClick={() => removeHorarioEdit(idx)}
                  aria-label="Remover este horário"
                  className="absolute right-2 top-2 w-6 h-6 flex items-center justify-center rounded-full bg-white border border-borderSoft text-textMuted hover:text-red-500"
                >
                  ✕
                </button>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    className="input-field"
                    value={h.dia_semana}
                    onChange={(e) =>
                      updateHorarioEdit(idx, "dia_semana", e.target.value)
                    }
                  >
                    {DIAS.map((d, i) => (
                      <option key={i} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    className="input-field"
                    value={h.hora_inicio}
                    onChange={(e) =>
                      updateHorarioEdit(idx, "hora_inicio", e.target.value)
                    }
                  />
                  <input
                    type="time"
                    className="input-field"
                    value={h.hora_fim}
                    onChange={(e) =>
                      updateHorarioEdit(idx, "hora_fim", e.target.value)
                    }
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    className="input-field"
                    placeholder="Prédio"
                    value={h.predio}
                    onChange={(e) =>
                      updateHorarioEdit(idx, "predio", e.target.value)
                    }
                  />
                  <input
                    className="input-field"
                    placeholder="Bloco"
                    value={h.bloco}
                    onChange={(e) =>
                      updateHorarioEdit(idx, "bloco", e.target.value)
                    }
                  />
                  <input
                    className="input-field"
                    placeholder="Sala"
                    value={h.sala}
                    onChange={(e) =>
                      updateHorarioEdit(idx, "sala", e.target.value)
                    }
                  />
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-3 border-t border-borderSoft">
              <button type="submit" disabled={savingEdit} className="btn-primary">
                {savingEdit ? "Salvando..." : "Salvar alterações"}
              </button>
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="text-textMuted px-3"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </Modal>
    </AppLayout>
  );
}

function BaralhoCard({ c, materiaId, materiaCor, onDelete }) {
  const cor = c.cor || materiaCor || "#8B85F0";
  const total = c.flashcards?.[0]?.count ?? 0;
  const progresso =
    typeof c.progresso === "number"
      ? Math.max(0, Math.min(100, c.progresso))
      : null;

  return (
    <div className="relative flex flex-col sm:flex-row bg-white rounded-2xl border border-borderSoft shadow-[0_4px_20px_rgba(40,30,70,0.06)] overflow-hidden min-h-[150px]">
      <div
        className="relative flex items-center justify-center h-20 sm:h-auto sm:w-[20%] shrink-0 overflow-hidden"
        style={{ background: cor }}
      >
        <span
          className="text-white [&>svg]:w-9 [&>svg]:h-9 sm:[&>svg]:w-12 sm:[&>svg]:h-12"
          aria-hidden="true"
        >
          {icons.layers}
        </span>
        <svg
          className="absolute bottom-0 left-0 w-full h-8 opacity-20 pointer-events-none"
          viewBox="0 0 100 20"
          preserveAspectRatio="none"
        >
          <path d="M0 20 Q 50 -2 100 20 Z" fill="white" />
        </svg>
      </div>

      <div className="flex-1 flex flex-col justify-center px-5 py-4 sm:px-7 sm:py-5 gap-1.5 min-w-0 pr-10">
        <Link
          href={`/materias/${materiaId}/flashcards/${c.id}`}
          className="text-[20px] font-bold text-textPrimary hover:underline leading-tight truncate"
        >
          {c.nome_colecao}
        </Link>

        {c.descricao && (
          <p className="text-[13px] text-textSecondary line-clamp-2">{c.descricao}</p>
        )}

        <div className="flex items-center gap-2 text-xs text-textMuted mt-1 flex-wrap">
          <span>
            {total} cartão{total === 1 ? "" : "ões"}
          </span>
          <span>·</span>
          <span>{formatRevisao(c.ultima_revisao)}</span>
        </div>

        {progresso !== null && (
          <div className="mt-2">
            <div className="h-1.5 rounded-full bg-borderSoft overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progresso}%`, background: "#8B6FD8" }}
              />
            </div>
            <p className="text-[11px] text-textMuted mt-1">
              {progresso}% concluído
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <Link
            href={`/materias/${materiaId}/flashcards/${c.id}/estudar`}
            className="h-[42px] rounded-[10px] bg-primary text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity sm:flex-1"
          >
            Estudar
            <span className="[&>svg]:w-4 [&>svg]:h-4" aria-hidden="true">
              {icons.arrowRight}
            </span>
          </Link>
          <Link
            href={`/materias/${materiaId}/flashcards/${c.id}`}
            className="h-[42px] rounded-[10px] border btn-outline-primary text-sm font-semibold flex items-center justify-center hover:bg-primarySoft/40 transition-colors sm:flex-1"
          >
            Gerenciar
          </Link>
        </div>
      </div>

      <button
        onClick={() => onDelete(c.id)}
        className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-textMuted hover:text-red-500 hover:bg-red-50 transition-colors text-xs"
        title="Remover baralho"
        aria-label={`Remover baralho ${c.nome_colecao}`}
      >
        ✕
      </button>
    </div>
  );
}
