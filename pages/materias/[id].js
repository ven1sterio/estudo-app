import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useRequireAuth } from "../../lib/useAuth";
import { supabase } from "../../lib/supabaseClient";
import AppLayout from "../../components/AppLayout";
import VisualizadorArquivo, { caminhoNoStorage } from "../../components/VisualizadorArquivo";
import { icons } from "../../components/icons";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatRevisao(data) {
  if (!data) return "nunca revisado";
  const dias = Math.floor((Date.now() - new Date(data).getTime()) / 86400000);
  if (dias <= 0) return "revisado hoje";
  return `revisado há ${dias} dia${dias > 1 ? "s" : ""}`;
}

export default function MateriaDetalhe() {
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();
  const { id } = router.query;

  const [materia, setMateria] = useState(null);
  const [materiais, setMateriais] = useState([]);
  const [colecoes, setColecoes] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [provas, setProvas] = useState([]);
  const [lembretes, setLembretes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingMateria, setDeletingMateria] = useState(false);
  const [view, setView] = useState("grid");

  const [playlistAtiva, setPlaylistAtiva] = useState("Geral");
  const [novaPlaylist, setNovaPlaylist] = useState("");
  const [showNovaPlaylist, setShowNovaPlaylist] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    if (user && id) fetchTudo();
  }, [user, id]);

  async function fetchTudo() {
    setLoading(true);
    const { data: materiaData } = await supabase
      .from("materias")
      .select("*, horarios(*)")
      .eq("id", id)
      .single();

    const { data: materiaisData } = await supabase
      .from("materiais")
      .select("*")
      .eq("materia_id", id)
      .order("created_at", { ascending: false });

    const { data: colecoesData } = await supabase
      .from("flashcard_colecoes")
      .select("*, flashcards(count)")
      .eq("materia_id", id)
      .order("created_at", { ascending: false });

    const { data: tarefasData } = await supabase
      .from("tarefas")
      .select("*")
      .eq("materia_id", id)
      .order("data_entrega", { ascending: true });

    const { data: provasData } = await supabase
      .from("provas")
      .select("*")
      .eq("materia_id", id)
      .order("data", { ascending: true });

    const { data: lembretesData } = await supabase
      .from("tarefas_rotina")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(5);

    setMateria(materiaData);
    setMateriais(materiaisData || []);
    setColecoes(colecoesData || []);
    setTarefas(tarefasData || []);
    setProvas(provasData || []);
    setLembretes(lembretesData || []);
    setLoading(false);
  }

  const playlists = useMemo(() => {
    const existentes = new Set(materiais.map((m) => m.topico || "Geral"));
    existentes.add("Geral");
    return Array.from(existentes);
  }, [materiais]);

  async function handleDeleteMateria() {
    if (!confirm(`Tem certeza que deseja excluir a matéria "${materia.nome}"?`)) return;
    setDeletingMateria(true);
    const { error: deleteError } = await supabase.from("materias").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      setDeletingMateria(false);
      return;
    }
    router.push("/materias");
  }

  const [arquivoAberto, setArquivoAberto] = useState(null);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);

    const { data: { user } } = await supabase.auth.getUser();
    const filePath = `${user.id}/${id}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage.from("materiais").upload(filePath, file);
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("materiais").getPublicUrl(filePath);

    const { error: insertError } = await supabase.from("materiais").insert({
      materia_id: id,
      user_id: user.id,
      titulo: file.name,
      arquivo_url: publicUrl,
      topico: playlistAtiva,
    });

    setUploading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    e.target.value = "";
    fetchTudo();
  }

  async function handleDeleteMaterial(materialId, arquivoUrl) {
    if (!confirm("Remover este material?")) return;
    const path = caminhoNoStorage(arquivoUrl);
    if (path) await supabase.storage.from("materiais").remove([path]);
    await supabase.from("materiais").delete().eq("id", materialId);
    fetchTudo();
  }

  function handleCriarPlaylist(e) {
    e.preventDefault();
    if (!novaPlaylist.trim()) return;
    setPlaylistAtiva(novaPlaylist.trim());
    setNovaPlaylist("");
    setShowNovaPlaylist(false);
  }

  async function handleDeleteBaralho(colecaoId) {
    if (!confirm("Remover este baralho e todos os cartões dele?")) return;
    await supabase.from("flashcard_colecoes").delete().eq("id", colecaoId);
    fetchTudo();
  }

  async function toggleTarefa(t) {
    setTarefas((prev) => prev.map((x) => (x.id === t.id ? { ...x, concluido: !x.concluido } : x)));
    await supabase.from("tarefas").update({ concluido: !t.concluido }).eq("id", t.id);
  }

  async function toggleLembrete(l) {
    setLembretes((prev) => prev.map((x) => (x.id === l.id ? { ...x, concluido: !x.concluido } : x)));
    await supabase.from("tarefas_rotina").update({ concluido: !l.concluido }).eq("id", l.id);
  }

  if (authLoading || loading) return null;
  if (!materia) return <AppLayout><p>Matéria não encontrada.</p></AppLayout>;

  const materiaisDaPlaylist = materiais.filter((m) => (m.topico || "Geral") === playlistAtiva);

  const atividadesLista = [
    ...provas.map((p) => ({ id: `prova-${p.id}`, titulo: p.titulo, data: p.data, link: null })),
    ...tarefas.map((t) => ({ id: `tarefa-${t.id}`, titulo: t.titulo, data: t.data_entrega, link: "/tarefas" })),
  ].sort((a, b) => a.data.localeCompare(b.data));

  return (
    <AppLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ---------- Coluna principal ---------- */}
        <div className="lg:col-span-2 min-w-0 space-y-6">
          {/* Cabeçalho */}
          <div className="card" style={{ borderLeft: `4px solid ${materia.cor || "#8B85F0"}` }}>
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold break-words">{materia.nome}</h1>
                <p className="text-gray-400">
                  {materia.codigo && `${materia.codigo} · `}
                  {materia.professor}
                </p>
              </div>
              <button
                onClick={handleDeleteMateria}
                disabled={deletingMateria}
                className="text-red-500 hover:text-red-700 text-sm font-medium border border-red-200 hover:border-red-400 rounded-xl px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                {deletingMateria ? "Excluindo..." : "Excluir matéria"}
              </button>
            </div>
            {materia.descricao && <p className="text-gray-500 text-sm mt-2">{materia.descricao}</p>}
            {materia.horarios?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {materia.horarios.map((h) => (
                  <span key={h.id} className="text-xs bg-primarySoft text-primaryDark rounded-full px-2 py-0.5">
                    {DIAS[h.dia_semana]} {h.hora_inicio?.slice(0, 5)}-{h.hora_fim?.slice(0, 5)}
                    {h.sala ? ` · ${h.sala}` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Baralhos de flashcards */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-3 text-textPrimary">Flashcards </h2>
            <Link href={`/materias/${id}/flashcards`} className="btn-primary">
              + Novo baralho
            </Link>
          </div>
          {colecoes.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhum baralho criado ainda.</p>
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

          {/* Materiais */}
          <div className="card">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="font-semibold text-lg">📎 Materiais</h2>
              <div className="flex bg-surface rounded-xl border border-gray-200 p-1">
                <button
                  onClick={() => setView("grid")}
                  className={"px-3 py-1 rounded-lg text-sm " + (view === "grid" ? "bg-white shadow-sm text-primaryDark" : "text-gray-400")}
                >▦</button>
                <button
                  onClick={() => setView("list")}
                  className={"px-3 py-1 rounded-lg text-sm " + (view === "list" ? "bg-white shadow-sm text-primaryDark" : "text-gray-400")}
                >☰</button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              {playlists.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlaylistAtiva(p)}
                  className={
                    "text-sm rounded-full px-3 py-1 transition-colors " +
                    (p === playlistAtiva ? "bg-primary text-white" : "bg-surface text-gray-500 hover:bg-primarySoft")
                  }
                >{p}</button>
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
                  className="text-sm rounded-full px-3 py-1 border border-dashed border-gray-300 text-gray-400 hover:text-primary hover:border-primary"
                >+ playlist</button>
              )}
            </div>

            <label className="btn-primary cursor-pointer inline-block mb-4">
              {uploading ? "Enviando..." : `+ Adicionar arquivo em "${playlistAtiva}"`}
              <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            {materiaisDaPlaylist.length === 0 ? (
              <p className="text-gray-400 text-sm">Nenhum arquivo nesta playlist ainda.</p>
            ) : view === "list" ? (
              <ul className="space-y-1">
                {materiaisDaPlaylist.map((m) => (
                  <li key={m.id} className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 text-sm">
                    <button type="button" onClick={() => setArquivoAberto(m)} className="text-primary hover:underline truncate min-w-0 text-left">{m.titulo}</button>
                    <button onClick={() => handleDeleteMaterial(m.id, m.arquivo_url)} className="text-gray-400 hover:text-red-500 text-xs ml-3 p-2 -m-2 shrink-0">remover</button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {materiaisDaPlaylist.map((m) => (
                  <div key={m.id} className="border border-gray-100 rounded-xl p-3 bg-surface">
                    <button type="button" onClick={() => setArquivoAberto(m)} className="text-primary text-sm hover:underline block truncate w-full text-left">📄 {m.titulo}</button>
                    <button onClick={() => handleDeleteMaterial(m.id, m.arquivo_url)} className="text-gray-400 hover:text-red-500 text-xs mt-2">remover</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---------- Coluna lateral ---------- */}
        <div className="space-y-6">
          <section className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm tracking-wide text-gray-500 uppercase">Atividades</h2>
              <Link href="/tarefas" className="w-6 h-6 flex items-center justify-center rounded-full bg-primarySoft text-primaryDark hover:bg-primary hover:text-white transition-colors">+</Link>
            </div>
            {atividadesLista.length === 0 ? (
              <p className="text-gray-400 text-sm">Nenhuma atividade vinculada ainda.</p>
            ) : (
              <ul className="space-y-2">
                {atividadesLista.map((a) => (
                  <li key={a.id} className="text-sm flex justify-between">
                    <span className="min-w-0 break-words">{materia.nome} · <span className="text-primary">{a.titulo}</span></span>
                    <span className="text-xs text-gray-400 shrink-0 ml-2">
                      {new Date(a.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm tracking-wide text-gray-500 uppercase">Lembretes</h2>
              <Link href="/tarefas" className="w-6 h-6 flex items-center justify-center rounded-full bg-primarySoft text-primaryDark hover:bg-primary hover:text-white transition-colors">+</Link>
            </div>
            {lembretes.length === 0 ? (
              <p className="text-gray-400 text-sm">Nenhum lembrete ainda.</p>
            ) : (
              <ul className="space-y-2">
                {lembretes.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={l.concluido} onChange={() => toggleLembrete(l)} className="w-4 h-4 accent-primary shrink-0" />
                    <span className={"min-w-0 break-words " + (l.concluido ? "line-through text-gray-300" : "")}>{l.titulo}</span>
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
    </AppLayout>
  );
}

function BaralhoCard({ c, materiaId, materiaCor, onDelete }) {
  const cor = c.cor || materiaCor || "#8B85F0";
  const total = c.flashcards?.[0]?.count ?? 0;
  // "progresso" ainda não existe no banco — a barra só aparece se o campo vier preenchido.
  const progresso =
    typeof c.progresso === "number" ? Math.max(0, Math.min(100, c.progresso)) : null;

  return (
    <div className="relative flex flex-col sm:flex-row bg-white rounded-2xl border border-borderSoft shadow-[0_4px_20px_rgba(40,30,70,0.06)] overflow-hidden min-h-[150px]">
      {/* Faixa lateral colorida */}
      <div
        className="relative flex items-center justify-center h-20 sm:h-auto sm:w-[20%] shrink-0 overflow-hidden"
        style={{ background: cor }}
      >
        <span className="text-white [&>svg]:w-9 [&>svg]:h-9 sm:[&>svg]:w-12 sm:[&>svg]:h-12">
          {icons.layers}
        </span>
        {/* Decoração curva abstrata */}
        <svg
          className="absolute bottom-0 left-0 w-full h-8 opacity-20 pointer-events-none"
          viewBox="0 0 100 20"
          preserveAspectRatio="none"
        >
          <path d="M0 20 Q 50 -2 100 20 Z" fill="white" />
        </svg>
      </div>

      {/* Conteúdo */}
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
          <span>{total} cartão{total === 1 ? "" : "ões"}</span>
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
            <p className="text-[11px] text-textMuted mt-1">{progresso}% concluído</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <Link
            href={`/materias/${materiaId}/flashcards/${c.id}/estudar`}
            className="h-[42px] rounded-[10px] bg-primary text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity sm:flex-1"
          >
            Estudar
            <span className="[&>svg]:w-4 [&>svg]:h-4">{icons.arrowRight}</span>
          </Link>
          <Link
            href={`/materias/${materiaId}/flashcards/${c.id}`}
            className="h-[42px] rounded-[10px] border text-sm font-semibold flex items-center justify-center hover:bg-primarySoft/40 transition-colors sm:flex-1"
            style={{ borderColor: "#CFC2F5", color: "#8B6FD8" }}
          >
            Gerenciar
          </Link>
        </div>
      </div>

      {/* Remover baralho */}
      <button
        onClick={() => onDelete(c.id)}
        className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-textMuted hover:text-red-500 hover:bg-red-50 transition-colors text-xs"
        title="Remover baralho"
      >
        ✕
      </button>
    </div>
  );
}
