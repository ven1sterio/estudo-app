import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useRequireAuth } from "../../../../../lib/useAuth";
import { supabase } from "../../../../../lib/supabaseClient";
import AppLayout from "../../../../../components/AppLayout";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function EstudarFlashcards() {
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();
  const { id, colecaoId } = router.query;

  const [colecao, setColecao] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sabidos, setSabidos] = useState(0);

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
      .eq("colecao_id", colecaoId);

    setColecao(colecaoData);
    setCards(shuffle(cardsData || []));
    setLoading(false);
  }

  function proximo(soube) {
    if (soube) setSabidos((s) => s + 1);
    setFlipped(false);
    setTimeout(() => setIndex((i) => i + 1), 150);
  }

  function reiniciar() {
    setCards((c) => shuffle(c));
    setIndex(0);
    setFlipped(false);
    setSabidos(0);
  }

  useEffect(() => {
    if (index >= cards.length && cards.length > 0) {
      supabase
        .from("flashcard_colecoes")
        .update({ ultima_revisao: new Date().toISOString() })
        .eq("id", colecaoId)
        .then(() => {});
    }
  }, [index]);

  if (authLoading || loading) return null;

  if (cards.length === 0) {
    return (
      <AppLayout>
        <Link
          href={`/materias/${id}/flashcards/${colecaoId}`}
          className="text-sm text-primary hover:underline"
        >
          ← {colecao?.nome_colecao}
        </Link>
        <p className="text-gray-500 mt-6">
          Este baralho ainda não tem cartões. Adicione alguns para estudar.
        </p>
      </AppLayout>
    );
  }

  const acabou = index >= cards.length;

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={`/materias/${id}/flashcards/${colecaoId}`}
          className="text-sm text-primary hover:underline"
        >
          ← {colecao?.nome_colecao}
        </Link>
        {!acabou && (
          <span className="text-sm text-gray-500">
            {index + 1} / {cards.length}
          </span>
        )}
      </div>

      {acabou ? (
        <div className="card text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Sessão concluída! 🎉</h2>
          <p className="text-gray-500 mb-6">
            Você acertou {sabidos} de {cards.length} cartões.
          </p>
          <button onClick={reiniciar} className="btn-primary">
            Estudar novamente
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div
            onClick={() => setFlipped((f) => !f)}
            className="card w-full max-w-lg h-64 flex items-center justify-center text-center cursor-pointer select-none px-8"
            style={{
              background: flipped ? "#f0eeff" : "white",
              transition: "background 0.15s",
            }}
          >
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">
                {flipped ? "Resposta" : "Pergunta"}
              </p>
              <p className="text-lg font-medium">
                {flipped ? cards[index].verso : cards[index].frente}
              </p>
            </div>
          </div>

          <p className="text-gray-400 text-sm mt-3">
            Clique no cartão para {flipped ? "ver a pergunta" : "ver a resposta"}
          </p>

          {flipped && (
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => proximo(false)}
                className="border border-red-300 text-red-500 font-medium py-2 px-6 rounded-lg hover:bg-red-50"
              >
                Não sabia
              </button>
              <button
                onClick={() => proximo(true)}
                className="border border-green-300 text-green-600 font-medium py-2 px-6 rounded-lg hover:bg-green-50"
              >
                Sabia ✓
              </button>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
