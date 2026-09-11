import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "../../lib/useAuth";
import { supabase } from "../../lib/supabaseClient";
import AppLayout from "../../components/AppLayout";
import { icons } from "../../components/icons";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const PASTEL_COLORS = ["#FBE9D0", "#E9E1FF", "#DDEEFF", "#E3F5E9", "#FFE4EF"];

export default function Materias() {
  const { user, loading: authLoading } = useRequireAuth();
  const [materias, setMaterias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState("grid"); // 'grid' | 'list'

  useEffect(() => {
    if (user) fetchMaterias();
  }, [user]);

  async function fetchMaterias() {
    setLoading(true);
    const { data, error } = await supabase
      .from("materias")
      .select("*, horarios(*)")
      .order("created_at", { ascending: false });

    if (!error) setMaterias(data || []);
    setLoading(false);
  }

  async function handleDeleteMateria(e, materiaId, nome) {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Tem certeza que deseja excluir a matéria "${nome}"?`)) return;

    const { error } = await supabase.from("materias").delete().eq("id", materiaId);

    if (error) {
      alert("Erro ao excluir matéria: " + error.message);
      return;
    }

    fetchMaterias();
  }

  if (authLoading || !user) return null;

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <h2 className="text-3xl font-bold flex items-center gap-2 text-textPrimary">
          {icons.book}
          Minhas Matérias
        </h2>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-white rounded-xl border border-borderSoft p-1 shadow-sm">
            <button
              onClick={() => setView("grid")}
              className={
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors " +
                (view === "grid" ? "bg-primarySoft text-primaryDark" : "text-textMuted hover:text-textPrimary")
              }
            >
              Grade
            </button>
            <button
              onClick={() => setView("list")}
              className={
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors " +
                (view === "list" ? "bg-primarySoft text-primaryDark" : "text-textMuted hover:text-textPrimary")
              }
            >
              Lista
            </button>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary shadow-sm flex items-center gap-2">
            + Nova matéria
          </button>
        </div>
      </div>

      {showForm && (
        <NovaMateriaForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            fetchMaterias();
          }}
        />
      )}

      {loading ? (
        <p className="text-textMuted">Carregando...</p>
      ) : materias.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-borderSoft p-10 text-textMuted text-center">
          Você ainda não cadastrou nenhuma matéria. Clique em <span className="font-semibold text-textPrimary">"+ Nova matéria"</span> para começar.
        </div>
      ) : view === "grid" ? (
        // AQUI FOI ALTERADO PARA CABER 4 (lg:grid-cols-4) E 5 EM TELAS GIGANTES (xl:grid-cols-5)
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {materias.map((m, i) => (
            <MateriaCard key={m.id} m={m} index={i} onDelete={handleDeleteMateria} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {materias.map((m, i) => (
            <MateriaRow key={m.id} m={m} index={i} onDelete={handleDeleteMateria} />
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
        <span key={h.id} className="text-[10px] bg-primarySoft text-primaryDark rounded-md px-1.5 py-0.5 max-w-full break-words">
          {DIAS[h.dia_semana]} {h.hora_inicio?.slice(0, 5)}-{h.hora_fim?.slice(0, 5)}
          {h.sala ? ` · ${h.sala}` : ""}
        </span>
      ))}
    </div>
  );
}

function MateriaCard({ m, index, onDelete }) {
  const cor = m.cor || PASTEL_COLORS[index % PASTEL_COLORS.length];

  return (
    <div className="group rounded-[16px] bg-white overflow-hidden shadow-[0_4px_20px_rgba(40,30,70,0.06)] hover:shadow-[0_8px_28px_rgba(40,30,70,0.10)] transition-shadow flex flex-col relative">
      <div
        className="h-12 flex items-center px-3 justify-between"
        style={{ background: cor }}
      >
        <span className="w-6 h-6 rounded-lg bg-white/60 flex items-center justify-center text-textPrimary [&>svg]:w-3.5 [&>svg]:h-3.5">
          {icons.book}
        </span>
        <button
          onClick={(e) => onDelete(e, m.id, m.nome)}
          className="w-6 h-6 rounded-full flex items-center justify-center bg-white/30 hover:bg-white/60 text-textPrimary/80 transition-colors text-xs"
          title="Excluir matéria"
        >
          ✕
        </button>
      </div>
      <Link href={`/materias/${m.id}`} className="p-4 pt-3 flex-1 flex flex-col min-w-0">
        <h3 className="font-bold text-sm text-textPrimary leading-tight line-clamp-2">{m.nome}</h3>
        {m.professor && <p className="text-textMuted text-[11px] mt-1 truncate">{m.professor}</p>}
        {m.descricao && <p className="text-textMuted text-[11px] mt-0.5 line-clamp-2">{m.descricao}</p>}
        
        <HorariosBadges horarios={m.horarios} />
        
        <div className="mt-auto pt-3 flex justify-end">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform [&>svg]:w-3 [&>svg]:h-3"
            style={{ background: "#8B6FD8" }}
          >
            {icons.arrowRight}
          </span>
        </div>
      </Link>
    </div>
  );
}

function MateriaRow({ m, index, onDelete }) {
  const cor = m.cor || PASTEL_COLORS[index % PASTEL_COLORS.length];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white rounded-2xl px-5 py-4 shadow-[0_4px_20px_rgba(40,30,70,0.06)] hover:shadow-[0_8px_28px_rgba(40,30,70,0.10)] transition-shadow">
      <div className="flex w-full sm:w-auto items-center gap-4 flex-1 min-w-0">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-textPrimary"
          style={{ background: cor }}
        >
          {icons.book}
        </div>
        <div className="flex-1 min-w-0">
          <Link href={`/materias/${m.id}`} className="font-semibold text-[15px] text-textPrimary hover:underline block truncate">
            {m.nome}
          </Link>
          <p className="text-textMuted text-xs mt-0.5 truncate">
            {m.professor} {m.descricao ? `· ${m.descricao}` : ""}
          </p>
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
          className="w-8 h-8 flex items-center justify-center text-textMuted hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
          title="Excluir matéria"
        >
          ✕
        </button>
        <Link
          href={`/materias/${m.id}`}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm transition-transform hover:scale-105"
          style={{ background: "#8B6FD8" }}
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
    setHorarios((h) => [...h, { diaSemana: "1", horaInicio: "", horaFim: "", predio: "", bloco: "", sala: "" }]);
  }

  function removeHorario(i) {
    setHorarios((h) => h.filter((_, idx) => idx !== i));
  }

  function updateHorario(i, field, value) {
    setHorarios((h) => h.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
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
        <div className="grid sm:grid-cols-2 gap-5">
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
            <label className="block text-sm font-medium mb-1.5 text-textPrimary">Email do professor</label>
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
            <label className="block text-sm font-medium mb-1.5 text-textPrimary">Cor de Destaque</label>
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
          <h3 className="text-sm font-bold text-textPrimary mb-3">
            Locais e Horários
          </h3>
          <p className="text-xs text-textMuted mb-4">Adicione as informações de sala para cada dia da semana.</p>
        </div>

        {horarios.map((h, i) => (
          <div key={i} className="border border-borderSoft bg-gray-50/50 rounded-xl p-4 space-y-4 relative">
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
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-textSecondary">Dia da semana</label>
                <select
                  className="input-field w-full"
                  value={h.diaSemana}
                  onChange={(e) => updateHorario(i, "diaSemana", e.target.value)}
                >
                  {DIAS.map((d, idx) => (
                    <option key={idx} value={idx}>{d}</option>
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
            
            <div className="grid sm:grid-cols-3 gap-4">
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
          <span className="w-5 h-5 rounded-full bg-primarySoft flex items-center justify-center">+</span>
          Adicionar outro local e horário
        </button>

        {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}

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