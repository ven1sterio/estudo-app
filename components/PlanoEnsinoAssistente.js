import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

const TIPOS = {
  prova: "Prova",
  atividade: "Atividade",
  trabalho: "Trabalho",
  seminario: "Seminário",
  lista: "Lista",
  outro: "Outro",
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PlanoEnsinoAssistente() {
  const [open, setOpen] = useState(false);
  const [materias, setMaterias] = useState(null); // carregado sob demanda
  const [step, setStep] = useState("upload"); // 'upload' | 'revisao' | 'salvo'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [propostas, setPropostas] = useState([]);
  const [materiaSugerida, setMateriaSugerida] = useState(null);
  const [materiaSelecionada, setMateriaSelecionada] = useState("");

  async function abrir() {
    setOpen(true);
    setStep("upload");
    setError("");
    setPropostas([]);
    if (!materias) {
      const { data } = await supabase.from("materias").select("id, nome").order("nome");
      setMaterias(data || []);
      if (data?.length) setMateriaSelecionada(data[0].id);
    }
  }

  function fechar() {
    setOpen(false);
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Envie um arquivo em PDF.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const pdfBase64 = await fileToBase64(file);
      const res = await fetch("/api/extrair-plano", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64 }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao processar o PDF.");
        setLoading(false);
        return;
      }

      const avaliacoes = (data.avaliacoes || []).map((a, i) => ({
        ...a,
        _id: i,
        incluir: true,
      }));

      setPropostas(avaliacoes);
      setMateriaSugerida(data.materia_sugerida || null);
      setStep("revisao");
    } catch (err) {
      setError(err.message || "Erro inesperado ao processar o arquivo.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  function atualizarProposta(id, campo, valor) {
    setPropostas((prev) =>
      prev.map((p) => (p._id === id ? { ...p, [campo]: valor } : p))
    );
  }

  async function handleSalvar() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const selecionadas = propostas.filter((p) => p.incluir && p.data && materiaSelecionada);

    if (selecionadas.length === 0) {
      setError("Marque ao menos uma avaliação com data preenchida.");
      setLoading(false);
      return;
    }

    // Provas vão para a tabela `provas` (dispara a trigger que cria o evento no calendário).
    // Os demais tipos vão para `tarefas`.
    const provasParaInserir = selecionadas
      .filter((p) => p.tipo === "prova")
      .map((p) => ({
        materia_id: materiaSelecionada,
        user_id: user.id,
        titulo: p.titulo,
        data: p.data,
      }));

    const tarefasParaInserir = selecionadas
      .filter((p) => p.tipo !== "prova")
      .map((p) => ({
        user_id: user.id,
        materia_id: materiaSelecionada,
        titulo: p.titulo,
        tipo: p.tipo,
        data_entrega: p.data,
        prioridade: "media",
      }));

    if (provasParaInserir.length > 0) {
      const { error } = await supabase.from("provas").insert(provasParaInserir);
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    }

    if (tarefasParaInserir.length > 0) {
      const { error } = await supabase.from("tarefas").insert(tarefasParaInserir);
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    setStep("salvo");
  }

  return (
    <>
      {/* Bolinha flutuante */}
      <button
        onClick={abrir}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-white text-2xl shadow-soft flex items-center justify-center hover:bg-primaryDark transition-colors z-20"
        title="Assistente de plano de ensino"
      >
        🤖
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-30 px-4">
          <div className="bg-white rounded-2xl shadow-soft max-w-lg w-full max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">🤖 Assistente de Plano de Ensino</h2>
              <button onClick={fechar} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {step === "upload" && (
              <>
                <p className="text-gray-500 text-sm mb-4">
                  Envie o PDF do plano de ensino de uma matéria. Vou encontrar as provas,
                  trabalhos e entregas e te mostrar antes de marcar qualquer coisa no calendário.
                </p>
                <label className="btn-primary cursor-pointer inline-block">
                  {loading ? "Lendo o PDF..." : "Selecionar PDF"}
                  <input type="file" accept="application/pdf" className="hidden" onChange={handleFile} disabled={loading} />
                </label>
                {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
              </>
            )}

            {step === "revisao" && (
              <>
                <p className="text-gray-500 text-sm mb-1">
                  Confira e ajuste antes de salvar. Datas em branco (por conta de referências
                  tipo "semana X") precisam ser preenchidas manualmente.
                </p>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Matéria de destino</label>
                  <select
                    className="input-field"
                    value={materiaSelecionada}
                    onChange={(e) => setMateriaSelecionada(e.target.value)}
                  >
                    {(materias || []).map((m) => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                  {materiaSugerida && (
                    <p className="text-xs text-gray-400 mt-1">
                      Sugestão identificada no PDF: "{materiaSugerida}"
                    </p>
                  )}
                </div>

                <div className="space-y-3 mb-4">
                  {propostas.map((p) => (
                    <div key={p._id} className="border border-gray-100 rounded-xl p-3 bg-surface">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={p.incluir}
                          onChange={(e) => atualizarProposta(p._id, "incluir", e.target.checked)}
                          className="w-4 h-4 accent-primary mt-2 shrink-0"
                        />
                        <div className="flex-1 space-y-2">
                          <input
                            className="input-field"
                            value={p.titulo}
                            onChange={(e) => atualizarProposta(p._id, "titulo", e.target.value)}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              className="input-field"
                              value={p.tipo}
                              onChange={(e) => atualizarProposta(p._id, "tipo", e.target.value)}
                            >
                              {Object.entries(TIPOS).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                              ))}
                            </select>
                            <input
                              type="date"
                              className="input-field"
                              value={p.data || ""}
                              onChange={(e) => atualizarProposta(p._id, "data", e.target.value)}
                            />
                          </div>
                          {!p.data && (
                            <p className="text-xs text-amber-600">
                              {p.semana_referencia
                                ? `Sem data exata — o plano menciona "semana ${p.semana_referencia}". Preencha a data acima.`
                                : "Sem data identificada. Preencha a data acima para incluir esta avaliação."}
                            </p>
                          )}
                          {p.confianca === "baixa" && (
                            <p className="text-xs text-gray-400">confiança baixa nesta extração — confira com atenção</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

                <div className="flex gap-2">
                  <button onClick={handleSalvar} disabled={loading} className="btn-primary">
                    {loading ? "Salvando..." : "Salvar no calendário"}
                  </button>
                  <button onClick={() => setStep("upload")} className="text-gray-400 px-3">
                    Voltar
                  </button>
                </div>
              </>
            )}

            {step === "salvo" && (
              <div className="text-center py-6">
                <p className="text-lg font-semibold mb-2">Prontinho! 🎉</p>
                <p className="text-gray-500 text-sm mb-4">
                  As avaliações selecionadas já estão no seu calendário.
                </p>
                <button onClick={fechar} className="btn-primary">Fechar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
