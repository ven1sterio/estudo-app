import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { montarHorarios } from "../lib/sigaaHorarios";

const TIPOS = {
  prova: "Prova",
  atividade: "Atividade",
  trabalho: "Trabalho",
  seminario: "Seminário",
  lista: "Lista",
  outro: "Outro",
};

const CORES_AUTO = ["#8B6FD8", "#70A8DE", "#72C69A", "#F2B866", "#E98282", "#E99BC4"];
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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
  const [modo, setModo] = useState("plano"); // 'plano' | 'matricula'
  const [step, setStep] = useState("upload"); // 'upload' | 'revisao' | 'salvo'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // --- Plano de Ensino (avaliações de uma matéria já existente) ---
  const [materias, setMaterias] = useState(null);
  const [propostasAvaliacoes, setPropostasAvaliacoes] = useState([]);
  const [materiaSugerida, setMateriaSugerida] = useState(null);
  const [materiaSelecionada, setMateriaSelecionada] = useState("");

  // --- Comprovante de Matrícula (cria várias matérias de uma vez) ---
  const [propostasDisciplinas, setPropostasDisciplinas] = useState([]);

  async function abrir() {
    setOpen(true);
    setModo("plano");
    setStep("upload");
    setError("");
    setPropostasAvaliacoes([]);
    setPropostasDisciplinas([]);
    if (!materias) {
      const { data } = await supabase.from("materias").select("id, nome").order("nome");
      setMaterias(data || []);
      if (data?.length) setMateriaSelecionada(data[0].id);
    }
  }

  function fechar() {
    setOpen(false);
  }

  function trocarModo(novoModo) {
    setModo(novoModo);
    setStep("upload");
    setError("");
  }

  // ---------- Fluxo: Plano de Ensino ----------
  async function handleFilePlano(e) {
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

      const avaliacoes = (data.avaliacoes || []).map((a, i) => ({ ...a, _id: i, incluir: true }));
      setPropostasAvaliacoes(avaliacoes);
      setMateriaSugerida(data.materia_sugerida || null);
      setStep("revisao");
    } catch (err) {
      setError(err.message || "Erro inesperado ao processar o arquivo.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  function atualizarAvaliacao(id, campo, valor) {
    setPropostasAvaliacoes((prev) => prev.map((p) => (p._id === id ? { ...p, [campo]: valor } : p)));
  }

  async function handleSalvarAvaliacoes() {
    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    const selecionadas = propostasAvaliacoes.filter((p) => p.incluir && p.data && materiaSelecionada);

    if (selecionadas.length === 0) {
      setError("Marque ao menos uma avaliação com data preenchida.");
      setLoading(false);
      return;
    }

    const provasParaInserir = selecionadas
      .filter((p) => p.tipo === "prova")
      .map((p) => ({ materia_id: materiaSelecionada, user_id: user.id, titulo: p.titulo, data: p.data }));

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
      if (error) { setError(error.message); setLoading(false); return; }
    }
    if (tarefasParaInserir.length > 0) {
      const { error } = await supabase.from("tarefas").insert(tarefasParaInserir);
      if (error) { setError(error.message); setLoading(false); return; }
    }

    setLoading(false);
    setStep("salvo");
  }

  // ---------- Fluxo: Comprovante de Matrícula ----------
  async function handleFileMatricula(e) {
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
      const res = await fetch("/api/extrair-matricula", {
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

      // O cálculo de dias/horas é feito aqui no app (determinístico), não pela IA.
      const disciplinas = (data.disciplinas || []).map((d, i) => ({
        _id: i,
        incluir: true,
        codigo: d.codigo || "",
        nome: d.nome || "",
        professor: d.professor || "",
        cor: CORES_AUTO[i % CORES_AUTO.length],
        horarios: montarHorarios(d.horario_raw, d.locais_raw),
      }));

      setPropostasDisciplinas(disciplinas);
      setStep("revisao");
    } catch (err) {
      setError(err.message || "Erro inesperado ao processar o arquivo.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  function atualizarDisciplina(id, campo, valor) {
    setPropostasDisciplinas((prev) => prev.map((d) => (d._id === id ? { ...d, [campo]: valor } : d)));
  }

  function atualizarHorarioDisciplina(id, idx, campo, valor) {
    setPropostasDisciplinas((prev) =>
      prev.map((d) =>
        d._id === id
          ? { ...d, horarios: d.horarios.map((h, i) => (i === idx ? { ...h, [campo]: valor } : h)) }
          : d
      )
    );
  }

  async function handleSalvarMatricula() {
    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    const selecionadas = propostasDisciplinas.filter((d) => d.incluir && d.nome);

    if (selecionadas.length === 0) {
      setError("Marque ao menos uma disciplina para importar.");
      setLoading(false);
      return;
    }

    for (const d of selecionadas) {
      const { data: materia, error: materiaError } = await supabase
        .from("materias")
        .insert({
          user_id: user.id,
          nome: d.nome,
          codigo: d.codigo,
          professor: d.professor,
          cor: d.cor,
          // email do professor fica em branco de propósito — você preenche depois na matéria
        })
        .select()
        .single();

      if (materiaError) {
        setError(`Erro ao criar "${d.nome}": ${materiaError.message}`);
        setLoading(false);
        return;
      }

      if (d.horarios.length > 0) {
        const { error: horarioError } = await supabase.from("horarios").insert(
          d.horarios.map((h) => ({
            materia_id: materia.id,
            dia_semana: h.diaSemana,
            hora_inicio: h.horaInicio,
            hora_fim: h.horaFim,
            sala: h.sala || null,
          }))
        );
        if (horarioError) {
          setError(`Erro ao salvar horários de "${d.nome}": ${horarioError.message}`);
          setLoading(false);
          return;
        }
      }
    }

    setLoading(false);
    setStep("salvo");
  }

  return (
    <>
      <button
        onClick={abrir}
        className="fixed bottom-[calc(5rem_+_env(safe-area-inset-bottom))] md:bottom-6 right-5 md:right-6 w-14 h-14 rounded-full bg-primary text-white text-2xl shadow-soft flex items-center justify-center hover:bg-primaryDark hover:shadow-softHover transition-all duration-200 z-20"
        title="Assistente"
      >
        🤖
      </button>

      {open && (
        <div className="assistente-overlay fixed inset-0 flex items-end sm:items-center justify-center z-30 sm:px-4">
          <div className="assistente-modal bg-white rounded-t-[18px] sm:rounded-[18px] max-w-lg w-full max-h-[90dvh] sm:max-h-[85vh] overflow-y-auto overscroll-contain p-4 sm:p-6 pb-[calc(1rem_+_env(safe-area-inset-bottom))] sm:pb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg text-textPrimary">🤖 Assistente</h2>
              <button onClick={fechar} className="text-textMuted hover:text-textPrimary">✕</button>
            </div>

            {step === "upload" && (
              <>
                <div className="flex bg-surface rounded-xl border border-borderSoft p-1 mb-4">
                  <button
                    onClick={() => trocarModo("plano")}
                    className={"flex-1 text-xs sm:text-sm py-2 rounded-lg transition-colors " + (modo === "plano" ? "bg-white shadow-sm text-primary font-semibold" : "text-textMuted")}
                  >
                    Plano de Ensino
                  </button>
                  <button
                    onClick={() => trocarModo("matricula")}
                    className={"flex-1 text-xs sm:text-sm py-2 rounded-lg transition-colors " + (modo === "matricula" ? "bg-white shadow-sm text-primary font-semibold" : "text-textMuted")}
                  >
                    Comprovante de Matrícula
                  </button>
                </div>

                {modo === "plano" ? (
                  <>
                    <p className="text-textSecondary text-sm mb-4">
                      Envie o PDF do plano de ensino de uma matéria já cadastrada. Vou encontrar as
                      provas, trabalhos e entregas e te mostrar antes de marcar qualquer coisa no calendário.
                    </p>
                    <label className="btn-primary cursor-pointer inline-block">
                      {loading ? "Lendo o PDF..." : "Selecionar PDF"}
                      <input type="file" accept="application/pdf" className="hidden" onChange={handleFilePlano} disabled={loading} />
                    </label>
                  </>
                ) : (
                  <>
                    <p className="text-textSecondary text-sm mb-4">
                      Envie o PDF do "Comprovante de Matrícula" do SIGAA. Vou identificar as
                      disciplinas, professores e horários e criar as matérias pra você revisar antes de salvar.
                      O e-mail do professor não vem no documento — você preenche depois na matéria.
                    </p>
                    <label className="btn-primary cursor-pointer inline-block">
                      {loading ? "Lendo o PDF..." : "Selecionar PDF"}
                      <input type="file" accept="application/pdf" className="hidden" onChange={handleFileMatricula} disabled={loading} />
                    </label>
                  </>
                )}
                {error && <p className="text-danger text-sm mt-3">{error}</p>}
              </>
            )}

            {step === "revisao" && modo === "plano" && (
              <>
                <p className="text-textSecondary text-sm mb-1">
                  Confira e ajuste antes de salvar. Datas em branco (por conta de referências
                  tipo "semana X") precisam ser preenchidas manualmente.
                </p>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1 text-textPrimary">Matéria de destino</label>
                  <select className="input-field" value={materiaSelecionada} onChange={(e) => setMateriaSelecionada(e.target.value)}>
                    {(materias || []).map((m) => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                  {materiaSugerida && (
                    <p className="text-xs text-textMuted mt-1">Sugestão identificada no PDF: "{materiaSugerida}"</p>
                  )}
                </div>

                <div className="space-y-3 mb-4">
                  {propostasAvaliacoes.map((p) => (
                    <div key={p._id} className="border border-borderSoft rounded-xl p-3 bg-surface">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={p.incluir}
                          onChange={(e) => atualizarAvaliacao(p._id, "incluir", e.target.checked)}
                          className="w-4 h-4 accent-primary mt-2 shrink-0"
                        />
                        <div className="flex-1 min-w-0 space-y-2">
                          <input className="input-field" value={p.titulo} onChange={(e) => atualizarAvaliacao(p._id, "titulo", e.target.value)} />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <select className="input-field" value={p.tipo} onChange={(e) => atualizarAvaliacao(p._id, "tipo", e.target.value)}>
                              {Object.entries(TIPOS).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
                            </select>
                            <input type="date" className="input-field" value={p.data || ""} onChange={(e) => atualizarAvaliacao(p._id, "data", e.target.value)} />
                          </div>
                          {!p.data && (
                            <p className="text-xs text-warning">
                              {p.semana_referencia
                                ? `Sem data exata — o plano menciona "semana ${p.semana_referencia}". Preencha a data acima.`
                                : "Sem data identificada. Preencha a data acima para incluir esta avaliação."}
                            </p>
                          )}
                          {p.confianca === "baixa" && (
                            <p className="text-xs text-textMuted">confiança baixa nesta extração — confira com atenção</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {error && <p className="text-danger text-sm mb-3">{error}</p>}

                <div className="flex gap-2">
                  <button onClick={handleSalvarAvaliacoes} disabled={loading} className="btn-primary">
                    {loading ? "Salvando..." : "Salvar no calendário"}
                  </button>
                  <button onClick={() => setStep("upload")} className="text-textMuted px-3">Voltar</button>
                </div>
              </>
            )}

            {step === "revisao" && modo === "matricula" && (
              <>
                <p className="text-textSecondary text-sm mb-4">
                  Confira nome, professor e horários antes de criar as matérias. Desmarque o que
                  não quiser importar.
                </p>

                <div className="space-y-4 mb-4">
                  {propostasDisciplinas.map((d) => (
                    <div key={d._id} className="border border-borderSoft rounded-xl p-3 bg-surface">
                      <div className="flex items-start gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={d.incluir}
                          onChange={(e) => atualizarDisciplina(d._id, "incluir", e.target.checked)}
                          className="w-4 h-4 accent-primary mt-2.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="grid grid-cols-[1fr_auto] gap-2">
                            <input className="input-field" value={d.nome} onChange={(e) => atualizarDisciplina(d._id, "nome", e.target.value)} placeholder="Nome da matéria" />
                            <input type="color" className="w-10 h-10 rounded-xl border border-borderSoft" value={d.cor} onChange={(e) => atualizarDisciplina(d._id, "cor", e.target.value)} />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input className="input-field" value={d.codigo} onChange={(e) => atualizarDisciplina(d._id, "codigo", e.target.value)} placeholder="Código" />
                            <input className="input-field" value={d.professor} onChange={(e) => atualizarDisciplina(d._id, "professor", e.target.value)} placeholder="Professor" />
                          </div>
                        </div>
                      </div>

                      {d.horarios.length > 0 ? (
                        <div className="pl-6 space-y-1">
                          {d.horarios.map((h, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <span className="text-textMuted w-9 shrink-0">{DIAS[h.diaSemana]}</span>
                              <span className="text-textMuted shrink-0">{h.horaInicio}-{h.horaFim}</span>
                              <input
                                className="input-field min-w-0 !py-1.5"
                                placeholder="Sala"
                                value={h.sala}
                                onChange={(e) => atualizarHorarioDisciplina(d._id, idx, "sala", e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="pl-6 text-xs text-warning">
                          Não consegui identificar o horário desta disciplina — confira manualmente depois de criada.
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {error && <p className="text-danger text-sm mb-3">{error}</p>}

                <div className="flex gap-2">
                  <button onClick={handleSalvarMatricula} disabled={loading} className="btn-primary">
                    {loading ? "Criando matérias..." : "Criar matérias"}
                  </button>
                  <button onClick={() => setStep("upload")} className="text-textMuted px-3">Voltar</button>
                </div>
              </>
            )}

            {step === "salvo" && (
              <div className="text-center py-6">
                <p className="text-lg font-semibold mb-2 text-textPrimary">Prontinho! 🎉</p>
                <p className="text-textSecondary text-sm mb-4">
                  {modo === "plano"
                    ? "As avaliações selecionadas já estão no seu calendário."
                    : "As matérias foram criadas. Não esqueça de preencher o e-mail do professor em cada uma."}
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
