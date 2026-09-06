import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { useRequireAuth } from "../lib/useAuth";

export default function Onboarding() {
  const { user, loading: authLoading } = useRequireAuth();
  const [faculdade, setFaculdade] = useState("");
  const [curso, setCurso] = useState("");
  const [semestre, setSemestre] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      nome: user.user_metadata?.nome || "",
      faculdade,
      curso,
      semestre: Number(semestre) || null,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/dashboard");
  }

  if (authLoading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mb-1">Só mais um passo 🎓</h1>
        <p className="text-gray-500 text-sm mb-6">
          Conte um pouco sobre seu curso para personalizarmos sua experiência
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Faculdade</label>
            <input
              type="text"
              required
              className="input-field"
              value={faculdade}
              onChange={(e) => setFaculdade(e.target.value)}
              placeholder="Nome da sua faculdade"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Curso</label>
            <input
              type="text"
              required
              className="input-field"
              value={curso}
              onChange={(e) => setCurso(e.target.value)}
              placeholder="Ex: Engenharia de Software"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Semestre atual</label>
            <input
              type="number"
              min="1"
              max="20"
              required
              className="input-field"
              value={semestre}
              onChange={(e) => setSemestre(e.target.value)}
              placeholder="Ex: 3"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Salvando..." : "Concluir"}
          </button>
        </form>
      </div>
    </div>
  );
}
