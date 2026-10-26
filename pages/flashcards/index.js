import { useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useRequireAuth } from "../../lib/useAuth";
import AppLayout from "../../components/AppLayout";
import Skeleton from "../../components/Skeleton";
import { icons } from "../../components/icons";
import { supabase } from "../../lib/supabaseClient";
import { swrKeys, fetchColecoes } from "../../lib/fetchers";

function formatRevisao(data) {
  if (!data) return "nunca revisado";
  const dias = Math.floor((Date.now() - new Date(data).getTime()) / 86400000);
  if (dias <= 0) return "revisado hoje";
  return `revisado há ${dias} dia${dias > 1 ? "s" : ""}`;
}

function hojeStr() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

async function fetchContagemPendentes() {
  const hoje = hojeStr();

  // 1ª tentativa: filtrar pelos cartões com revisão vencida ou nula
  let resp = await supabase
    .from("flashcards")
    .select("colecao_id, proximo_review")
    .or(`proximo_review.lte.${hoje},proximo_review.is.null`);

  // Fallback se a coluna ainda não existir (migration 05 não rodada):
  // conta todos os cartões como pendentes.
  if (
    resp.error &&
    (resp.error.message || "").toLowerCase().includes("proximo_review") &&
    (resp.error.message || "").toLowerCase().includes("does not exist")
  ) {
    resp = await supabase.from("flashcards").select("colecao_id");
  }

  if (resp.error) throw resp.error;

  const contagem = {};
  for (const row of resp.data || []) {
    contagem[row.colecao_id] = (contagem[row.colecao_id] || 0) + 1;
  }
  return contagem;
}

export default function TodosFlashcards() {
  const { user, loading: authLoading } = useRequireAuth();
  const uid = user?.id;

  const { data: colecoes = [], isLoading } = useSWR(
    uid ? swrKeys.colecoes(uid) : null,
    () => fetchColecoes(uid)
  );
  const { data: pendentes = {} } = useSWR(
    uid ? ["flashcards_pendentes", uid] : null,
    fetchContagemPendentes
  );

  const totalPendentes = useMemo(
    () => Object.values(pendentes).reduce((a, b) => a + b, 0),
    [pendentes]
  );

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-textPrimary">
          <span aria-hidden="true">{icons.layers}</span> Meus Cartões
        </h1>
        {totalPendentes > 0 && (
          <span className="text-xs bg-accentYellow/60 text-yellow-700 rounded-full px-3 py-1 font-semibold">
            {totalPendentes} cartão(ões) para revisar hoje
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton className="h-[190px] w-full" />
          <Skeleton className="h-[190px] w-full" />
        </div>
      ) : colecoes.length === 0 ? (
        <p className="text-textMuted">
          Você ainda não criou nenhum baralho. Entre em uma matéria e clique em
          "+ Novo baralho" para começar.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {colecoes.map((c) => (
            <FlashcardCard
              key={c.id}
              c={c}
              pendentes={pendentes[c.id] || 0}
            />
          ))}
        </div>
      )}
    </AppLayout>
  );
}

function FlashcardCard({ c, pendentes }) {
  const cor = c.cor || c.materias?.cor || "#8B6FD8";
  const total = c.flashcards?.[0]?.count ?? 0;
  const progresso =
    typeof c.progresso === "number"
      ? Math.max(0, Math.min(100, c.progresso))
      : null;

  return (
    <div className="flex flex-col sm:flex-row bg-white rounded-2xl border border-borderSoft shadow-[0_4px_20px_rgba(40,30,70,0.06)] overflow-hidden min-h-[150px]">
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

      <div className="flex-1 flex flex-col justify-center px-5 py-4 sm:px-7 sm:py-5 gap-1.5 min-w-0">
        {c.materias?.nome && (
          <span className="self-start text-[12px] font-semibold rounded-full px-2.5 py-1 badge-materia">
            {c.materias.nome}
          </span>
        )}

        <Link
          href={`/materias/${c.materia_id}/flashcards/${c.id}`}
          className="text-[22px] font-bold text-textPrimary hover:underline leading-tight truncate"
        >
          {c.nome_colecao}
        </Link>

        {c.descricao && (
          <p className="text-[13px] text-textSecondary line-clamp-2">
            {c.descricao}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-textMuted mt-1 flex-wrap">
          <span>
            {total} cartão{total === 1 ? "" : "ões"}
          </span>
          <span>·</span>
          <span>{formatRevisao(c.ultima_revisao)}</span>
          {pendentes > 0 && (
            <>
              <span>·</span>
              <span className="text-warning font-semibold">
                {pendentes} para hoje
              </span>
            </>
          )}
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
            href={`/materias/${c.materia_id}/flashcards/${c.id}/estudar`}
            className="h-[42px] rounded-[10px] bg-primary text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity sm:flex-1"
          >
            Estudar
            <span className="[&>svg]:w-4 [&>svg]:h-4" aria-hidden="true">
              {icons.arrowRight}
            </span>
          </Link>
          <Link
            href={`/materias/${c.materia_id}/flashcards/${c.id}`}
            className="h-[42px] rounded-[10px] border btn-outline-primary text-sm font-semibold flex items-center justify-center hover:bg-primarySoft/40 transition-colors sm:flex-1"
          >
            Gerenciar
          </Link>
        </div>
      </div>
    </div>
  );
}
