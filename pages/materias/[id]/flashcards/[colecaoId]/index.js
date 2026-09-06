import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useRequireAuth } from "../../../../../lib/useAuth";
import { supabase } from "../../../../../lib/supabaseClient";
import AppLayout from "../../../../../components/AppLayout";

export default function GerenciarCartoes() {
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();
  const { id, colecaoId } = router.query; // id = materia_id

  const [colecao, setColecao] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [frente, setFrente] = useState("");
  const [verso, setVerso] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    if (user && colecaoId) fetchTudo();
  }, [user, colecaoId]);

  async function fetchTudo() {
    setLoading(true);

    const { data: colecaoData } = await supabase
      .from("flashcard_colecoes")
      .select("*")
      .eq("id", colecaoId)
      .single();

    const { data: cardsData } = await supabase
      .from("flashcards")
      .select("*")
      .eq("colecao_id", colecaoId)
      .order("created_at", { ascending: true });

    setColecao(colecaoData);
    setCards(cardsData || []);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("flashcards")
        .update({ frente, verso })
        .eq("id", editingId);
      setSaving(false);
      if (error) {
        setError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("flashcards").insert({
        colecao_id: colecaoId,
        frente,
        verso,
      });
      setSaving(false);
      if (error) {
        setError(error.message);
        return;
      }
    }

    setFrente("");
    setVerso("");
    setEditingId(null);
    fetchTudo();
  }

  function handleEdit(card) {
    setEditingId(card.id);
    setFrente(card.frente);
    setVerso(card.verso);
  }

  function cancelEdit() {
    setEditingId(null);
    setFrente("");
    setVerso("");
  }

  async function handleDelete(cardId) {
    if (!confirm("Remover este cartão?")) return;
    await supabase.from("flashcards").delete().eq("id", cardId);
    fetchTudo();
  }

  if (authLoading || loading) return null;

  return (
    <AppLayout>
      <div className="mb-6">
        <Link
          href={`/materias/${id}/flashcards`}
          className="text-sm text-primary hover:underline"
        >
          ← Baralhos
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{colecao?.nome_colecao}</h1>
        <Link
          href={`/materias/${id}/flashcards/${colecaoId}/estudar`}
          className="btn-primary"
        >
          ▶ Estudar
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="card mb-6 space-y-3">
        <h2 className="font-semibold">
          {editingId ? "Editar cartão" : "Novo cartão"}
        </h2>
        <div>
          <label className="block text-sm font-medium mb-1">
            Lado A (Pergunta/Conceito)
          </label>
          <textarea
            required
            className="input-field"
            rows={2}
            value={frente}
            onChange={(e) => setFrente(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Lado B (Resposta/Explicação)
          </label>
          <textarea
            required
            className="input-field"
            rows={2}
            value={verso}
            onChange={(e) => setVerso(e.target.value)}
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar cartão"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-gray-500 px-4 py-2"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <h2 className="font-semibold mb-3">{cards.length} cartão(ões)</h2>
      {cards.length === 0 ? (
        <p className="text-gray-500 text-sm">Nenhum cartão ainda.</p>
      ) : (
        <div className="space-y-2">
          {cards.map((c) => (
            <div key={c.id} className="card flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium">{c.frente}</p>
                <p className="text-sm text-gray-500 mt-1">{c.verso}</p>
              </div>
              <div className="flex gap-3 text-xs shrink-0">
                <button
                  onClick={() => handleEdit(c)}
                  className="text-primary hover:underline"
                >
                  editar
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-gray-400 hover:text-red-500"
                >
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
