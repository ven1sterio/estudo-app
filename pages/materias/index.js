import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { useRequireAuth } from "../../lib/useAuth";
import { supabase } from "../../lib/supabaseClient";
import AppLayout from "../../components/AppLayout";
import Skeleton from "../../components/Skeleton";
import { icons } from "../../components/icons";
import {
  swrKeys,
  fetchMaterias,
  fetchTarefas,
  fetchColecoes,
} from "../../lib/fetchers";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const PASTEL_COLORS = ["#FBE9D0", "#E9E1FF", "#DDEEFF", "#E3F5E9", "#FFE4EF"];

export default function Materias() {
  const { user, loading: authLoading } = useRequireAuth();
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState("grid");

  const { data: materias = [], isLoading: lM } = useSWR(
    user ? swrKeys.materias : null,
    fetchMaterias
  );
  const { data: tarefas = [] } = useSWR(
    user ? swrKeys.tarefas : null,
    fetchTarefas
  );
  const { data: colecoes = [] } = useSWR(
    user ? swrKeys.colecoes : null,
    fetchColecoes
  );

  // Stats derivados em memória — zero queries extras
  const materiaStats = useMemo(() => {
    const stats = {};
    for (const m of materias) {
      const tarefasM = tarefas.filter((t) => t.materia_id === m.id);
      const concluidas = tarefasM.filter((t) => t.concluido).length;
      const flashcardsTotal = colecoes
        .filter((c) => c.materia_id === m.id)
        .reduce((sum, c) => sum + (c.flashcards?.[0]?.count ?? 0), 0);
      stats[m.id] = {
        tarefasTotal: tarefasM.length,
        tarefasConcluidas: concluidas,
        tarefasPendentes: tarefasM.length - concluidas,
        flashcardsTotal,
      };
    }
    return stats;
  }, [materias, tarefas, colecoes]);

  async function handleDeleteMateria(e, materiaId, nome) {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Tem certeza que deseja excluir a matéria "${nome}"?`)) return;

    // Otimista: remove da lista imediatamente
    globalMutate(
      swrKeys.materias,
      (prev) => prev?.filter((m) => m.id !== materiaId),
      false
    );

    const { error } = await supabase.from("materias").delete().eq("id", materiaId);
    if (error) {
      alert("Erro ao excluir matéria: " + error.message);
    }
    // Revalida do servidor (mesmo em erro, pra ficar consistente)
    globalMutate(swrKeys.materias);
  }

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 text-textPrimary">
          {icons.book}
          Minhas Matérias
        </h2>

        <div className="flex items-center gap-3">
          <div className="flex bg-white rounded-xl border border-borderSoft p-1 shadow-sm">
            <button
              onClick={() => setView("grid")}
              className={
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors " +
                (view === "grid"
                  ? "bg-primarySoft text-primaryDark"
                  : "text-textMuted hover:text-textPrimary")
              }
            >
              Grade
            </button>
            <button
              onClick={() => setView("list")}
              className={
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors " +
                (view === "list"
                  ? "bg-primarySoft text-primaryDark"
                  : "text-textMuted hover:text-textPrimary")
              }
            >
              Lista
            </button>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary shadow-sm flex items-center gap-2"
          >
            + Nova matéria
          </button>
        </div>
      </div>

      {showForm && (
        <NovaMateriaForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            globalMutate(swrKeys.materias);
          }}
        />
      )}

      {lM ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[210px] w-full" />
          ))}
        </div>
      ) : materias.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-borderSoft p-10 text-textMuted text-center">
          Você ainda não cadastrou nenhuma matéria. Clique em{" "}
          <span className="font-semibold text-textPrimary">"+ Nova matéria"</span>{" "}
          para começar.
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {materias.map((m, i) => (
            <MateriaCard
              key={m.id}
              m={m}
              index={i}
              stats={materiaStats[m.id]}
              onDelete={handleDeleteMateria}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {materias.map((m, i) => (
            <MateriaRow
              key={m.id}
              m={m}
              index={i}
              stats={materiaStats[m.id]}
              onDelete={handleDeleteMateria}
            />
          ))}
        </div>
      )}
    </AppLayout>
  );
}

function HorariosBadges({ horarios }) {
  if (!horarios?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2 min-w-0">
      {horarios.map((h) => (
        <span
          key={h.id}
          className="text-[10px] bg-primarySoft text-primaryDark rounded-md px-1.5 py-0.5 max-w-full break-words"
        >
          {DIAS[h.dia_semana]} {h.hora_inicio?.slice(0, 5)}-
          {h.hora_fim?.slice(0, 5)}
          {h.sala ? ` · ${h.sala}` : ""}
        </span>
      ))}
    </div>
  );
}

function MateriaCard({ m, index, stats, onDelete }) {
  const cor = m.cor || PASTEL_COLORS[index % PASTEL_COLORS.length];

  return (
    <div
      className="group relative rounded-2xl border-l-4 overflow-hidden shadow-[0_4px_18px_rgba(40,30,70,0.05)] hover:shadow-[0_8px_24px_rgba(40,30,70,0.09)] transition-shadow flex flex-col min-h-[210px]"
      style={{
        borderLeftColor: cor,
        background: `linear-gradient(135deg, ${cor}3D 0%, ${cor}14 45%, #FFFFFF 100%)`,
      }}
    >
      <button
        onClick={(e) => onDelete(e, m.id, m.nome)}
        className="absolute right-3 top-3 w-7 h-7 rounded-full flex items-center justify-center bg-white/50 hover:bg-white/80 text-textPrimary/80 transition-colors text-xs z-10"
        title="Excluir matéria"
      >
        ✕
      </button>
      <Link href={`/materias/${m.id}`} className="p-4 flex-1 flex flex-col min-w-0">
        <span
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-white [&>svg]:w-5 [&>svg]:h-5"
          style={{ background: cor }}
        >
          {icons.book}
        </span>

        <h3 className="font-semibold text-[15px] text-textPrimary mt-3 truncate">
          {m.nome}
        </h3>
        {m.professor && (
          <p className="text-textMuted text-xs mt-0.5 truncate">Prof. {m.professor}</p>
        )}
        {m.descricao && (
          <p className="text-textMuted text-[11px] mt-0.5 line-clamp-2">
            {m.descricao}
          </p>
        )}

        <HorariosBadges horarios={m.horarios} />

        <div className="mt-auto pt-3 flex items-center justify-between gap-2 min-w-0">
          {stats && (
            <div className="flex items-center gap-2 text-[11px] text-textSecondary min-w-0 overflow-hidden">
              <span className="flex items-center gap-1 shrink-0 [&>svg]:w-3 [&>svg]:h-3">
                {icons.check}
                {stats.tarefasPendentes}
              </span>
              <span className="flex items-center gap-1 shrink-0 [&>svg]:w-3 [&>svg]:h-3 truncate">
                {icons.layers}
                {stats.flashcardsTotal}
              </span>
            </div>
          )}
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5"
            style={{ background: cor }}
          >
            {icons.arrowRight}
          </span>
        </div>
      </Link>
    </div>
  );
}

function MateriaRow({ m, index, stats, onDelete }) {
  const cor = m.cor || PASTEL_COLORS[index % PASTEL_COLORS.length];

  return (
    <div
      className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl border-l-4 px-5 py-4 shadow-[0_4px_18px_rgba(40,30,70,0.05)] hover:shadow-[0_8px_24px_rgba(40,30,70,0.09)] transition-shadow"
      style={{
        borderLeftColor: cor,
        background: `linear-gradient(135deg, ${cor}3D 0%, ${cor}14 45%, #FFFFFF 100%)`,
      }}
    >
      <div className="flex w-full sm:w-auto items-center gap-4 flex-1 min-w-0">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-white [&>svg]:w-5 [&>svg]:h-5"
          style={{ background: cor }}
        >
          {icons.book}
        </div>
        <div className="flex-1 min-w-0">
          <Link
            href={`/materias/${m.id}`}
            className="font-semibold text-[15px] text-textPrimary hover:underline block truncate"
          >
            {m.nome}
          </Link>
          <p className="text-textMuted text-xs mt-0.5 truncate">
            {m.professor ? `Prof. ${m.professor}` : ""}{" "}
            {m.descricao ? `· ${m.descricao}` : ""}
          </p>
          {stats && (
            <div className="flex items-center gap-2.5 text-[11px] text-textSecondary mt-1">
              <span className="flex items-center gap-1 shrink-0 [&>svg]:w-3 [&>svg]:h-3">
                {icons.check}
                {stats.tarefasPendentes} tarefa
                {stats.tarefasPendentes === 1 ? "" : "s"}
              </span>
              <span className="flex items-center gap-1 shrink-0 [&>svg]:w-3 [&>svg]:h-3">
                {icons.layers}
                {stats.flashcardsTotal} flashcard
                {stats.flashcardsTotal === 1 ? "" : "s"}
              </span>
            </div>
          )}
          <div className="sm:hidden block">
            <HorariosBadges horarios={m.horarios} />
          </div>
        </div>
      </div>

      <div className="hidden sm:block flex-1 min-w-0">
        <HorariosBadges horarios={m.horarios} />
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center mt-2 sm:mt-0">
        <button
          onClick={(e) => onDelete(e, m.id, m.nome)}
          className="w-8 h-8 flex items-center justify-center bg-white/50 hover:bg-white/80 text-textPrimary/80 rounded-full transition-colors text-xs"
          title="Excluir matéria"
        >
          ✕
        </button>
        <Link
          href={`/materias/${m.id}`}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm transition-transform hover:scale-105 [&>svg]:w-3.5 [&>svg]:h-3.5"
          style={{ background: cor }}
        >
          {icons.arrowRight}
        </Link>
      </div>
    </div>
  );
}

function NovaMateriaForm({ onClose, onCreated }) {
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [professor, setProfessor] = useState("");
  const [emailProfessor, setEmailProfessor] = useState("");
  const [cor, setCor] = useState("#8B6FD8");

  const [horarios, setHorarios] = useState([
    { diaSemana: "1", horaInicio: "", horaFim: "", predio: "", bloco: "", sala: "" },
  ]);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function addHorario() {
    setHorarios((h) => [
      ...h,
      { diaSemana: "1", horaInicio: "", horaFim: "", predio: "", bloco: "", sala: "" },
    ]);
  }
  function removeHorario(i) {
    setHorarios((h) => h.filter((_, idx) => idx !== i));
  }
  function updateHorario(i, field, value) {
    setHorarios((h) =>
      h.map((row, idx) => (idx === i ? { ...row, [field]: value } : row))
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: materia, error: materiaError } = await supabase
      .from("materias")
      .insert({
        user_id: user.id,
        nome,
        codigo,
        descricao,
        professor,
        email_professor: emailProfessor,
        cor,
      })
      .select()
      .single();

    if (materiaError) {
      setError(materiaError.message);
      setLoading(false);
      return;
    }

    const horariosValidos = horarios.filter((h) => h.horaInicio && h.horaFim);
    if (horariosValidos.length > 0) {
      const { error: horarioError } = await supabase.from("horarios").insert(
        horariosValidos.map((h) => ({
          materia_id: materia.id,
          dia_semana: Number(h.diaSemana),
          hora_inicio: h.horaInicio,
          hora_fim: h.horaFim,
          predio: h.predio || null,
          bloco: h.bloco || null,
          sala: h.sala || null,
        }))
      );
      if (horarioError) {
        setError(horarioError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    onCreated();
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(40,30,70,0.06)] p-6 mb-8 border border-borderSoft">
      <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-textPrimary">
        Nova Matéria
      </h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-textPrimary">Nome *</label>
            <input
              required
              className="input-field w-full"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Cálculo I"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-textPrimary">Código</label>
            <input
              className="input-field w-full"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ex: MAT101"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-textPrimary">Professor</label>
            <input
              className="input-field w-full"
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
              placeholder="Nome do professor"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-textPrimary">
              Email do professor
            </label>
            <input
              type="email"
              className="input-field w-full"
              value={emailProfessor}
              onChange={(e) => setEmailProfessor(e.target.value)}
              placeholder="email@instituicao.edu.br"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1.5 text-textPrimary">Descrição</label>
            <textarea
              className="input-field w-full"
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ementa, observações ou notas sobre a matéria"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-textPrimary">
              Cor de Destaque
            </label>
            <div className="flex gap-3">
              <input
                type="color"
                className="w-12 h-12 rounded-xl border border-borderSoft cursor-pointer shrink-0"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
              />
              <p className="text-xs text-textMuted flex items-center">
                Selecione uma cor para personalizar esta matéria no seu dashboard e grade.
              </p>
            </div>
          </div>
        </div>

        <hr className="border-borderSoft my-6" />

        <div>
          <h3 className="text-sm font-bold text-textPrimary mb-3">Locais e Horários</h3>
          <p className="text-xs text-textMuted mb-4">
            Adicione as informações de sala para cada dia da semana.
          </p>
        </div>

        {horarios.map((h, i) => (
          <div
            key={i}
            className="border border-borderSoft bg-gray-50/50 rounded-xl p-4 space-y-4 relative"
          >
            {horarios.length > 1 && (
              <button
                type="button"
                onClick={() => removeHorario(i)}
                className="absolute right-3 top-3 w-6 h-6 flex items-center justify-center rounded-full bg-white border border-borderSoft text-textMuted hover:text-red-500 transition-colors shadow-sm"
                title="Remover este horário"
              >
                ✕
              </button>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-textSecondary">
                  Dia da semana
                </label>
                <select
                  className="input-field w-full"
                  value={h.diaSemana}
                  onChange={(e) => updateHorario(i, "diaSemana", e.target.value)}
                >
                  {DIAS.map((d, idx) => (
                    <option key={idx} value={idx}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-textSecondary">Início</label>
                <input
                  type="time"
                  className="input-field w-full"
                  value={h.horaInicio}
                  onChange={(e) => updateHorario(i, "horaInicio", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-textSecondary">Fim</label>
                <input
                  type="time"
                  className="input-field w-full"
                  value={h.horaFim}
                  onChange={(e) => updateHorario(i, "horaFim", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-textSecondary">Prédio</label>
                <input
                  className="input-field w-full"
                  placeholder="Ex: Prédio 1"
                  value={h.predio}
                  onChange={(e) => updateHorario(i, "predio", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-textSecondary">Bloco</label>
                <input
                  className="input-field w-full"
                  placeholder="Ex: A"
                  value={h.bloco}
                  onChange={(e) => updateHorario(i, "bloco", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-textSecondary">Sala</label>
                <input
                  className="input-field w-full"
                  placeholder="Ex: 304"
                  value={h.sala}
                  onChange={(e) => updateHorario(i, "sala", e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addHorario}
          className="flex items-center gap-2 text-primary font-medium text-sm hover:underline"
        >
          <span className="w-5 h-5 rounded-full bg-primarySoft flex items-center justify-center">
            +
          </span>
          Adicionar outro local e horário
        </button>

        {error && (
          <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-4 border-t border-borderSoft mt-6">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Salvando..." : "Salvar matéria"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-textMuted hover:text-textPrimary transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}