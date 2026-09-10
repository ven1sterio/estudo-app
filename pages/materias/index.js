import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "../../lib/useAuth";
import { supabase } from "../../lib/supabaseClient";
import AppLayout from "../../components/AppLayout";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Minhas Matérias</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-white rounded-xl border border-gray-200 p-1">
            <button
              onClick={() => setView("grid")}
              className={
                "px-3 py-1 rounded-lg text-sm transition-colors " +
                (view === "grid" ? "bg-primarySoft text-primaryDark" : "text-gray-400")
              }
            >
              ▦ Grade
            </button>
            <button
              onClick={() => setView("list")}
              className={
                "px-3 py-1 rounded-lg text-sm transition-colors " +
                (view === "list" ? "bg-primarySoft text-primaryDark" : "text-gray-400")
              }
            >
              ☰ Lista
            </button>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary">
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
        <p className="text-gray-400">Carregando...</p>
      ) : materias.length === 0 ? (
        <p className="text-gray-400">
          Você ainda não cadastrou nenhuma matéria. Clique em "+ Nova matéria" para
          começar.
        </p>
      ) : view === "grid" ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {materias.map((m) => (
            <MateriaCard key={m.id} m={m} onDelete={handleDeleteMateria} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {materias.map((m) => (
            <MateriaRow key={m.id} m={m} onDelete={handleDeleteMateria} />
          ))}
        </div>
      )}
    </AppLayout>
  );
}

function HorariosBadges({ horarios }) {
  if (!horarios?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {horarios.map((h) => (
        <span key={h.id} className="text-xs bg-primarySoft text-primaryDark rounded-full px-2 py-0.5">
          {DIAS[h.dia_semana]} {h.hora_inicio?.slice(0, 5)}-{h.hora_fim?.slice(0, 5)}
          {h.sala ? ` · ${h.sala}` : ""}
        </span>
      ))}
    </div>
  );
}

function MateriaCard({ m, onDelete }) {
  return (
    <div
      className="card hover:shadow-md transition-shadow relative"
      style={{ borderLeft: `4px solid ${m.cor || "#8B85F0"}` }}
    >
      <div className="flex justify-between items-start mb-1">
        <Link href={`/materias/${m.id}`} className="font-semibold text-lg hover:underline flex-1">
          {m.nome}
        </Link>
        <button
          onClick={(e) => onDelete(e, m.id, m.nome)}
          className="text-gray-400 hover:text-red-500 text-xs ml-2 p-1"
          title="Excluir matéria"
        >
          🗑️
        </button>
      </div>
      <Link href={`/materias/${m.id}`} className="block">
        <p className="text-gray-400 text-sm">{m.professor}</p>
        {m.descricao && <p className="text-gray-400 text-xs mt-1 line-clamp-2">{m.descricao}</p>}
        <p className="text-gray-400 text-xs mt-1">{m.sala ? `Sala ${m.sala}` : ""}</p>
        <HorariosBadges horarios={m.horarios} />
      </Link>
    </div>
  );
}

function MateriaRow({ m, onDelete }) {
  return (
    <div
      className="card hover:shadow-md transition-shadow flex items-center justify-between gap-4"
      style={{ borderLeft: `4px solid ${m.cor || "#8B85F0"}` }}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/materias/${m.id}`} className="font-semibold hover:underline">
            {m.nome}
          </Link>
        </div>
        <p className="text-gray-400 text-sm">
          {m.professor} {m.sala ? `· Sala ${m.sala}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <HorariosBadges horarios={m.horarios} />
        <button
          onClick={(e) => onDelete(e, m.id, m.nome)}
          className="text-gray-400 hover:text-red-500 text-xs p-1"
          title="Excluir matéria"
        >
          🗑️
        </button>
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

  // Cada horário agora tem seu próprio local, já que a matéria pode
  // acontecer em salas diferentes dependendo do dia da semana.
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
    <div className="card mb-6">
      <h2 className="font-semibold text-lg mb-4">Nova matéria</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome *</label>
            <input
              required
              className="input-field"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Cálculo I"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Código</label>
            <input
              className="input-field"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ex: MAT101"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Professor</label>
            <input
              className="input-field"
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email do professor</label>
            <input
              type="email"
              className="input-field"
              value={emailProfessor}
              onChange={(e) => setEmailProfessor(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Descrição</label>
            <textarea
              className="input-field"
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ementa, observações ou notas sobre a matéria"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cor</label>
            <input
              type="color"
              className="w-full h-10 rounded-xl border border-gray-200"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
            />
          </div>
        </div>

        <hr className="border-gray-100" />
        <p className="text-sm font-medium text-gray-500">
          Locais e horários (cada dia pode ter um local diferente)
        </p>

        {horarios.map((h, i) => (
          <div key={i} className="border border-borderSoft rounded-xl p-3 space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <select
                className="input-field"
                value={h.diaSemana}
                onChange={(e) => updateHorario(i, "diaSemana", e.target.value)}
              >
                {DIAS.map((d, idx) => (
                  <option key={idx} value={idx}>
                    {d}
                  </option>
                ))}
              </select>
              <input
                type="time"
                className="input-field"
                value={h.horaInicio}
                onChange={(e) => updateHorario(i, "horaInicio", e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  type="time"
                  className="input-field"
                  value={h.horaFim}
                  onChange={(e) => updateHorario(i, "horaFim", e.target.value)}
                />
                {horarios.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeHorario(i)}
                    className="text-gray-400 hover:text-red-500 px-2"
                    title="Remover este horário"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <input
                className="input-field"
                placeholder="Prédio"
                value={h.predio}
                onChange={(e) => updateHorario(i, "predio", e.target.value)}
              />
              <input
                className="input-field"
                placeholder="Bloco"
                value={h.bloco}
                onChange={(e) => updateHorario(i, "bloco", e.target.value)}
              />
              <input
                className="input-field"
                placeholder="Sala"
                value={h.sala}
                onChange={(e) => updateHorario(i, "sala", e.target.value)}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addHorario}
          className="flex items-center gap-2 text-primary text-sm hover:underline"
        >
          <span className="w-5 h-5 rounded-full bg-primarySoft flex items-center justify-center">+</span>
          outro local e horário
        </button>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Salvando..." : "Salvar matéria"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 px-4 py-2 hover:text-gray-600"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
