import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useRequireAuth } from "../../../../lib/useAuth";
import { supabase } from "../../../../lib/supabaseClient";
import AppLayout from "../../../../components/AppLayout";

function formatRevisao(data) {
  if (!data) return "nunca revisado";
  const dias = Math.floor((Date.now() - new Date(data).getTime()) / 86400000);
  if (dias <= 0) return "revisado hoje";
  return `revisado há ${dias} dia${dias > 1 ? "s" : ""}`;
}

export default function Flashcards() {
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();
  const { id } = router.query;

  const [materia, setMateria] = useState(null);
  const [colecoes, setColecoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novaCor, setNovaCor] = useState("#8B85F0");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && id) fetchTudo();
  }, [user, id]);

  async function fetchTudo() {
    setLoading(true);
    const { data: materiaData } = await supabase
      .from("materias")
      .select("id, nome, cor")
      .eq("id", id)
      .single();

    const { data: colecoesData } = await supabase
      .from("flashcard_colecoes")
      .select("*, flashcards(count)")
      .eq("materia_id", id)
      .order("created_at", { ascending: false });

    setMateria(materiaData);
    setColecoes(colecoesData || []);
    setLoading(false);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("flashcard_colecoes").insert({
      materia_id: id,
      user_id: user.id,
      nome_colecao: novoNome,
      descricao: novaDescricao,
      cor: novaCor,
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setNovoNome("");
    setNovaDescricao("");
    setNovaCor("#8B85F0");
    setShowForm(false);
    fetchTudo();
  }

  async function handleDelete(colecaoId) {
    if (!confirm("Remover este baralho e todos os cartões dele?")) return;
    await supabase.from("flashcard_colecoes").delete().eq("id", colecaoId);
    fetchTudo();
  }

  if (authLoading || loading) return null;

  return (
    <AppLayout>
      <div className="mb-6">
        <Link href={`/materias/${id}`} className="text-sm text-primary hover:underline">
          ← {materia?.nome}
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="font-semibold text-lg flex items-center gap-2">Flashcards</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + Novo baralho
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card mb-6 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nome do baralho</label>
            <input
              required
              autoFocus
              className="input-field"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex: Fórmulas de Cálculo I"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descrição</label>
            <textarea
              className="input-field"
              rows={2}
              value={novaDescricao}
              onChange={(e) => setNovaDescricao(e.target.value)}
              placeholder="Do que se trata esse baralho?"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cor</label>
            <input
              type="color"
              className="w-24 h-10 rounded-xl border border-gray-200"
              value={novaCor}
              onChange={(e) => setNovaCor(e.target.value)}
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Salvando..." : "Criar"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 px-2 py-2">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {colecoes.length === 0 ? (
        <p className="text-gray-400">
          Nenhum baralho ainda. Crie um para começar a adicionar flashcards.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {colecoes.map((c) => (
            <div key={c.id} className="card" style={{ borderLeft: `4px solid ${c.cor || "#8B85F0"}` }}>
              <h2 className="font-semibold text-lg">{c.nome_colecao}</h2>
              {c.descricao && <p className="text-gray-500 text-sm mt-0.5">{c.descricao}</p>}
              <p className="text-gray-400 text-xs mt-1">
                {c.flashcards?.[0]?.count ?? 0} cartão(ões) · {formatRevisao(c.ultima_revisao)}
              </p>
              <div className="flex gap-4 text-sm mt-3">
                <Link href={`/materias/${id}/flashcards/${c.id}`} className="text-primary hover:underline">
                  Gerenciar cartões
                </Link>
                <Link href={`/materias/${id}/flashcards/${c.id}/estudar`} className="text-primary hover:underline">
                  Estudar
                </Link>
                <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-red-500 ml-auto">
                  remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
