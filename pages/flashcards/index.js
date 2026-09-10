import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "../../lib/useAuth";
import { supabase } from "../../lib/supabaseClient";
import AppLayout from "../../components/AppLayout";

function formatRevisao(data) {
  if (!data) return "nunca revisado";
  const dias = Math.floor((Date.now() - new Date(data).getTime()) / 86400000);
  if (dias <= 0) return "revisado hoje";
  return `revisado há ${dias} dia${dias > 1 ? "s" : ""}`;
}

export default function TodosFlashcards() {
  const { user, loading: authLoading } = useRequireAuth();
  const [colecoes, setColecoes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchTudo();
  }, [user]);

  async function fetchTudo() {
    setLoading(true);
    const { data } = await supabase
      .from("flashcard_colecoes")
      .select("*, flashcards(count), materias(id, nome, cor)")
      .order("created_at", { ascending: false });

    setColecoes(data || []);
    setLoading(false);
  }

  if (authLoading || loading) return null;

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold mb-6">🃏 Meus Cartões</h1>

      {colecoes.length === 0 ? (
        <p className="text-textMuted">
          Você ainda não criou nenhum baralho. Entre em uma matéria e clique em
          "+ Novo baralho" para começar.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {colecoes.map((c) => (
            <div
              key={c.id}
              className="card"
              style={{ borderLeft: `4px solid ${c.cor || c.materias?.cor || "#8B6FD8"}` }}
            >
              <p className="text-xs text-textMuted mb-1">{c.materias?.nome}</p>
              <Link
                href={`/materias/${c.materia_id}/flashcards/${c.id}`}
                className="font-semibold hover:underline block"
              >
                {c.nome_colecao}
              </Link>
              {c.descricao && <p className="text-textSecondary text-sm mt-0.5">{c.descricao}</p>}
              <p className="text-textMuted text-xs mt-2">
                {c.flashcards?.[0]?.count ?? 0} cartão(ões) · {formatRevisao(c.ultima_revisao)}
              </p>
              <div className="flex gap-4 text-sm mt-3">
                <Link href={`/materias/${c.materia_id}/flashcards/${c.id}`} className="text-primary hover:underline">
                  Gerenciar
                </Link>
                <Link href={`/materias/${c.materia_id}/flashcards/${c.id}/estudar`} className="text-primary hover:underline">
                  Estudar
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
