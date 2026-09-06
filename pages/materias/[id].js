import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useRequireAuth } from "../../lib/useAuth";
import { supabase } from "../../lib/supabaseClient";
import AppLayout from "../../components/AppLayout";

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
    const path = arquivoUrl.split("/materiais/")[1];
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
      <div className="grid lg:grid-cols-3 gap-6">
        {/* ---------- Coluna principal ---------- */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cabeçalho */}
          <div className="card" style={{ borderLeft: `4px solid ${materia.cor || "#8B85F0"}` }}>
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <h1 className="text-2xl font-bold">{materia.nome}</h1>
                <p className="text-gray-400">
                  {materia.codigo && `${materia.codigo} · `}
                  {materia.professor}
                </p>
                {materia.sala && <p className="text-gray-400 text-sm">{materia.sala}</p>}
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
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Baralhos de flashcards */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg flex items-center gap-2">🧠 Baralhos de Flashcards</h2>
            <Link href={`/materias/${id}/flashcards`} className="btn-primary">
              + Novo baralho
            </Link>
          </div>
          {colecoes.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhum baralho criado ainda.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {colecoes.map((c) => (
                <div key={c.id} className="card" style={{ borderLeft: `4px solid ${c.cor || materia.cor || "#8B85F0"}` }}>
                  <Link href={`/materias/${id}/flashcards/${c.id}`} className="font-semibold hover:underline block">
                    {c.nome_colecao}
                  </Link>
                  {c.descricao && <p className="text-gray-500 text-sm mt-0.5">{c.descricao}</p>}
                  <p className="text-gray-400 text-xs mt-1">{formatRevisao(c.ultima_revisao)}</p>
                </div>
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
                    <a href={m.arquivo_url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">{m.titulo}</a>
                    <button onClick={() => handleDeleteMaterial(m.id, m.arquivo_url)} className="text-gray-400 hover:text-red-500 text-xs ml-3">remover</button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid sm:grid-cols-3 gap-3">
                {materiaisDaPlaylist.map((m) => (
                  <div key={m.id} className="border border-gray-100 rounded-xl p-3 bg-surface">
                    <a href={m.arquivo_url} target="_blank" rel="noreferrer" className="text-primary text-sm hover:underline block truncate">📄 {m.titulo}</a>
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
                    <span>{materia.nome} · <span className="text-primary">{a.titulo}</span></span>
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
                    <span className={l.concluido ? "line-through text-gray-300" : ""}>{l.titulo}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
