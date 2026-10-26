import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { useRequireAuth } from "../../../../../lib/useAuth";
import { useToast } from "../../../../../components/Toast";
import { supabase } from "../../../../../lib/supabaseClient";
import AppLayout from "../../../../../components/AppLayout";
import Skeleton from "../../../../../components/Skeleton";
import { calcularProximoReview, estaParaRevisar } from "../../../../../lib/sm2";

const swrKeyColecao = (colecaoId) => ["colecao", colecaoId];
const swrKeyCards = (colecaoId) => ["cards", colecaoId];

async function fetchColecao(colecaoId) {
  const { data, error } = await supabase
    .from("flashcard_colecoes")
    .select("*")
    .eq("id", colecaoId)
    .single();
  if (error) throw error;
  return data;
}

async function fetchCards(colecaoId) {
  const { data, error } = await supabase
    .from("flashcards")
    .select("*")
    .eq("colecao_id", colecaoId);
  if (error) throw error;
  return data || [];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hojeStr() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default function EstudarFlashcards() {
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();
  const { id, colecaoId } = router.query;
  const { showToast } = useToast();

  const ready = !!user && !!colecaoId;

  const { data: colecao } = useSWR(
    ready ? swrKeyColecao(colecaoId) : null,
    () => fetchColecao(colecaoId)
  );
  const { data: cardsRaw = [], isLoading } = useSWR(
    ready ? swrKeyCards(colecaoId) : null,
    () => fetchCards(colecaoId)
  );

  const [fila, setFila] = useState([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sabidos, setSabidos] = useState(0);
  const inicioRef = useRef(null);

  // Monta a fila uma vez por sessão, priorizando cartões pendentes de revisão.
  useEffect(() => {
    if (inicioRef.current) return;
    if (!cardsRaw || cardsRaw.length === 0) return;
    inicioRef.current = true;

    const hoje = hojeStr();
    const pendentes = cardsRaw.filter((c) => estaParaRevisar(c, hoje));
    const base = pendentes.length > 0 ? pendentes : cardsRaw;
    setFila(shuffle(base));
  }, [cardsRaw]);

  function proximo(soube) {
    const cartaoAtual = fila[index];
    if (soube) setSabidos((s) => s + 1);

    if (cartaoAtual) {
      const update = calcularProximoReview(cartaoAtual, soube);
      supabase
        .from("flashcards")
        .update(update)
        .eq("id", cartaoAtual.id)
        .then(() => {});
    }

    setFlipped(false);
    setTimeout(() => setIndex((i) => i + 1), 150);
  }

  const acabou = fila.length > 0 && index >= fila.length;

  // Ao finalizar, atualiza ultima_revisao da coleção (para o card do dashboard).
  useEffect(() => {
    if (!acabou || !colecaoId) return;
    supabase
      .from("flashcard_colecoes")
      .update({ ultima_revisao: new Date().toISOString() })
      .eq("id", colecaoId)
      .then(() => {
        globalMutate(swrKeyColecao(colecaoId));
        globalMutate(["flashcard_colecoes", user?.id]);
      });
  }, [acabou, colecaoId, user?.id]);

  const total = fila.length;
  const pendentesHoje = useMemo(() => {
    const hoje = hojeStr();
    return cardsRaw.filter((c) => estaParaRevisar(c, hoje)).length;
  }, [cardsRaw]);

  if (authLoading || isLoading) {
    return (
      <AppLayout>
        <Skeleton className="h-64 w-full max-w-lg mx-auto" />
      </AppLayout>
    );
  }

  if (cardsRaw.length === 0) {
    return (
      <AppLayout>
        <Link
          href={`/materias/${id}/flashcards/${colecaoId}`}
          className="text-sm text-primary hover:underline min-w-0 truncate"
        >
          ← {colecao?.nome_colecao}
        </Link>
        <p className="text-textSecondary mt-6">
          Este baralho ainda não tem cartões. Adicione alguns para estudar.
        </p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href={`/materias/${id}/flashcards/${colecaoId}`}
          className="text-sm text-primary hover:underline min-w-0 truncate"
        >
          ← {colecao?.nome_colecao}
        </Link>
        {!acabou && (
          <span className="text-sm text-textSecondary shrink-0">
            {index + 1} / {total}
          </span>
        )}
      </div>

      {!acabou && pendentesHoje > 0 && index === 0 && (
        <p className="text-xs text-textMuted text-center mb-4">
          {pendentesHoje} cartão(ões) para revisar hoje · {total} na fila desta
          sessão
        </p>
      )}

      {acabou ? (
        <div className="card text-center py-12">
          <h2 className="text-2xl font-bold mb-2 text-textPrimary">
            Sessão concluída! 🎉
          </h2>
          <p className="text-textSecondary mb-6">
            Você acertou {sabidos} de {total} cartões.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() =>
                router.push(`/materias/${id}/flashcards/${colecaoId}`)
              }
              className="border border-borderSoft rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-surface transition-colors text-textPrimary"
            >
              Voltar
            </button>
            <button
              onClick={() => {
                inicioRef.current = false;
                setFila(shuffle(cardsRaw));
                setIndex(0);
                setFlipped(false);
                setSabidos(0);
              }}
              className="btn-primary"
            >
              Estudar novamente
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div
            onClick={() => setFlipped((f) => !f)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                setFlipped((f) => !f);
              }
            }}
            className={
              "card flashcard-tile w-full max-w-lg min-h-[16rem] flex items-center justify-center text-center cursor-pointer select-none px-5 sm:px-8 " +
              (flipped ? "is-flipped" : "")
            }
          >
            <div>
              <p className="text-xs uppercase tracking-wide text-textMuted mb-3">
                {flipped ? "Resposta" : "Pergunta"}
              </p>
              <p className="text-lg font-medium break-words text-textPrimary">
                {flipped ? fila[index]?.verso : fila[index]?.frente}
              </p>
            </div>
          </div>

          <p className="text-textMuted text-sm mt-3">
            Clique no cartão (ou aperte espaço) para{" "}
            {flipped ? "ver a pergunta" : "ver a resposta"}
          </p>

          {flipped && (
            <div className="flex gap-3 sm:gap-4 mt-6 w-full max-w-lg">
              <button
                onClick={() => proximo(false)}
                className="border border-red-300 text-red-500 flex-1 font-medium py-3 px-4 rounded-lg hover:bg-red-50"
              >
                Não sabia
              </button>
              <button
                onClick={() => proximo(true)}
                className="border border-green-300 text-green-600 flex-1 font-medium py-3 px-4 rounded-lg hover:bg-green-50"
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
