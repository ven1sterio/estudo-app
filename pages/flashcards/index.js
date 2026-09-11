import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "../../lib/useAuth";
import { supabase } from "../../lib/supabaseClient";
import AppLayout from "../../components/AppLayout";
import { icons } from "../../components/icons";

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
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-textPrimary">
        {icons.layers}
        Meus Cartões
      </h1>

      {colecoes.length === 0 ? (
        <p className="text-textMuted">
          Você ainda não criou nenhum baralho. Entre em uma matéria e clique em
          "+ Novo baralho" para começar.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {colecoes.map((c) => (
            <FlashcardCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </AppLayout>
  );
}

function FlashcardCard({ c }) {
  const cor = c.cor || c.materias?.cor || "#8B6FD8";
  const total = c.flashcards?.[0]?.count ?? 0;
  // "progresso" não existe hoje no banco — a barra só aparece se o campo vier preenchido.
  const progresso =
    typeof c.progresso === "number" ? Math.max(0, Math.min(100, c.progresso)) : null;

  return (
    <div className="flex flex-col sm:flex-row bg-white rounded-2xl border border-borderSoft shadow-[0_4px_20px_rgba(40,30,70,0.06)] overflow-hidden min-h-[150px]">
      {/* Faixa lateral colorida (~20% no desktop, barra no topo no mobile) */}
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
      <div className="flex-1 flex flex-col justify-center px-5 py-4 sm:px-7 sm:py-5 gap-1.5 min-w-0">
        {c.materias?.nome && (
          <span
            className="self-start text-[12px] font-semibold rounded-full px-2.5 py-1"
            style={{ color: "#8B6FD8", background: "#F0EAFF" }}
          >
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
          <p className="text-[13px] text-textSecondary line-clamp-2">{c.descricao}</p>
        )}

        <div className="flex items-center gap-2 text-xs text-textMuted mt-1">
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
            href={`/materias/${c.materia_id}/flashcards/${c.id}/estudar`}
            className="h-[42px] rounded-[10px] bg-primary text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity sm:flex-1"
          >
            Estudar
            <span className="[&>svg]:w-4 [&>svg]:h-4">{icons.arrowRight}</span>
          </Link>
          <Link
            href={`/materias/${c.materia_id}/flashcards/${c.id}`}
            className="h-[42px] rounded-[10px] border text-sm font-semibold flex items-center justify-center hover:bg-primarySoft/40 transition-colors sm:flex-1"
            style={{ borderColor: "#CFC2F5", color: "#8B6FD8" }}
          >
            Gerenciar
          </Link>
        </div>
      </div>
    </div>
  );
}
