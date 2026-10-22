import { useMemo, useRef, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { useRequireAuth } from "../lib/useAuth";
import { supabase } from "../lib/supabaseClient";
import AppLayout from "../components/AppLayout";
import Skeleton from "../components/Skeleton";
import {
  swrKeys,
  fetchEventosRange,
  fetcherEventosRange,
  ymd,
} from "../lib/fetchers";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const TIPO_INFO = {
  prova: { label: "Provas", cor: "#8B85F0" },
  trabalho: { label: "Trabalhos", cor: "#B8E6D5" },
  atividade: { label: "Atividades", cor: "#FFE9B3" },
  outro: { label: "Outros Eventos", cor: "#F5C9E0" },
};

const TAREFA_TIPO_PARA_FILTRO = {
  prova: "prova", trabalho: "trabalho", atividade: "atividade",
  seminario: "atividade", lista: "atividade", outro: "outro",
};

export default function Calendario() {
  const { user, loading: authLoading } = useRequireAuth();

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const inicioMes = ymd(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  const fimMes = ymd(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));

  const { data: range, isLoading } = useSWR(
    user ? swrKeys.eventosRange(inicioMes, fimMes) : null,
    fetcherEventosRange,
    { keepPreviousData: false }
  );

  const [selectedDay, setSelectedDay] = useState(null);
  const [showNovoEvento, setShowNovoEvento] = useState(false);
  const [filtros, setFiltros] = useState({
    prova: true, trabalho: true, atividade: true, outro: true,
  });

  const eventos = useMemo(() => {
    if (!range) return [];
    return [
      ...range.eventos.map((e) => ({
        id: `evento-${e.id}`,
        data: e.data,
        titulo: e.titulo,
        descricao: e.descricao,
        filtro: e.tipo,
        cor: e.cor || e.materias?.cor || TIPO_INFO[e.tipo]?.cor,
        materia: e.materias?.nome,
      })),
      ...range.tarefas.map((t) => ({
        id: `tarefa-${t.id}`,
        data: t.data_entrega,
        titulo: t.titulo,
        descricao: t.descricao,
        filtro: TAREFA_TIPO_PARA_FILTRO[t.tipo] || "atividade",
        cor: t.cor || t.materias?.cor || TIPO_INFO[TAREFA_TIPO_PARA_FILTRO[t.tipo]]?.cor,
        materia: t.materias?.nome,
        concluido: t.concluido,
      })),
    ];
  }, [range]);

  async function handleCriarEvento({ titulo, descricao, tipo, cor }) {
    await supabase.from("eventos_calendario").insert({
      user_id: user.id,
      titulo,
      descricao,
      tipo,
      cor,
      data: selectedDay,
      origem: "manual",
    });
    setShowNovoEvento(false);
    globalMutate(swrKeys.eventosRange(inicioMes, fimMes));
    globalMutate(swrKeys.eventosProximos);
    globalMutate(swrKeys.eventosManuais);
  }

  const eventosFiltrados = useMemo(
    () => eventos.filter((e) => filtros[e.filtro]),
    [eventos, filtros]
  );

  const eventosPorDia = useMemo(() => {
    const map = {};
    for (const e of eventosFiltrados) {
      (map[e.data] = map[e.data] || []).push(e);
    }
    return map;
  }, [eventosFiltrados]);

  const dias = useMemo(() => {
    const ano = cursor.getFullYear();
    const mes = cursor.getMonth();
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const celulas = [];
    for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
    for (let d = 1; d <= totalDias; d++) celulas.push(new Date(ano, mes, d));
    return celulas;
  }, [cursor]);

  function mudarMes(delta) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
    setSelectedDay(null);
    setShowNovoEvento(false);
  }

  const detalheRef = useRef(null);
  const hojeStr = ymd(new Date());
  const eventosDoDiaSelecionado = selectedDay
    ? eventosPorDia[selectedDay] || []
    : [];

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="text-2xl font-bold">calendário</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => mudarMes(-1)}
            className="text-gray-400 hover:text-primary px-3 py-1 text-xl"
          >
            ‹
          </button>
          <span className="font-medium w-32 sm:w-40 text-center">
            {MESES[cursor.getMonth()]} {cursor.getFullYear()}
          </span>
          <button
            onClick={() => mudarMes(1)}
            className="text-gray-400 hover:text-primary px-3 py-1 text-xl"
          >
            ›
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4 text-sm">
        {Object.entries(TIPO_INFO).map(([key, info]) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filtros[key]}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, [key]: e.target.checked }))
              }
              className="accent-primary"
            />
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: info.cor }}
            />
            {info.label}
          </label>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-[420px] w-full" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <div className="grid grid-cols-7 text-center text-xs text-gray-400 mb-2">
              {DIAS_SEMANA.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {dias.map((dia, i) => {
                if (!dia) return <div key={i} />;
                const dataStr = ymd(dia);
                const eventosDoDia = eventosPorDia[dataStr] || [];
                const isHoje = dataStr === hojeStr;
                const isSelected = dataStr === selectedDay;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedDay(dataStr);
                      setShowNovoEvento(false);
                      if (
                        typeof window !== "undefined" &&
                        window.innerWidth < 768
                      ) {
                        setTimeout(
                          () =>
                            detalheRef.current?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            }),
                          60
                        );
                      }
                    }}
                    className={
                      "aspect-square rounded-lg sm:rounded-xl border text-left p-1 sm:p-1.5 flex flex-col overflow-hidden " +
                      (isSelected
                        ? "border-primary bg-primarySoft/40"
                        : "border-gray-100 hover:border-gray-300")
                    }
                  >
                    <span
                      className={
                        "text-xs font-medium " +
                        (isHoje
                          ? "text-primary font-bold"
                          : "text-gray-600")
                      }
                    >
                      {dia.getDate()}
                    </span>
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {eventosDoDia.slice(0, 4).map((e) => (
                        <span
                          key={e.id}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: e.cor }}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div ref={detalheRef} className="card h-fit">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">
                {selectedDay
                  ? new Date(selectedDay + "T00:00:00").toLocaleDateString(
                      "pt-BR",
                      { weekday: "long", day: "2-digit", month: "long" }
                    )
                  : "Selecione um dia"}
              </h2>
              {selectedDay && (
                <button
                  onClick={() => setShowNovoEvento((s) => !s)}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-primarySoft text-primaryDark hover:bg-primary hover:text-white transition-colors"
                  title="Novo evento"
                >
                  +
                </button>
              )}
            </div>

            {showNovoEvento && (
              <NovoEventoForm
                onCancel={() => setShowNovoEvento(false)}
                onCreate={handleCriarEvento}
              />
            )}

            {selectedDay && !showNovoEvento && eventosDoDiaSelecionado.length === 0 && (
              <p className="text-gray-400 text-sm">Nada por aqui neste dia.</p>
            )}

            {!showNovoEvento && (
              <ul className="space-y-2">
                {eventosDoDiaSelecionado.map((e) => (
                  <li key={e.id} className="flex items-start gap-2">
                    <span
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ background: e.cor }}
                    />
                    <div>
                      <p className="text-sm font-medium">{e.titulo}</p>
                      {e.descricao && (
                        <p className="text-xs text-gray-400">{e.descricao}</p>
                      )}
                      <p className="text-xs text-gray-400">
                        {TIPO_INFO[e.filtro]?.label}
                        {e.materia ? ` · ${e.materia}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function NovoEventoForm({ onCancel, onCreate }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("outro");
  const [cor, setCor] = useState("#F5C9E0");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await onCreate({ titulo, descricao, tipo, cor });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mb-3">
      <input
        required
        autoFocus
        className="input-field"
        placeholder="Título do evento"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
      />
      <textarea
        className="input-field"
        rows={2}
        placeholder="Descrição (opcional)"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
      />
      <div className="flex gap-2">
        <select
          className="input-field"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          {Object.entries(TIPO_INFO).map(([key, info]) => (
            <option key={key} value={key}>
              {info.label}
            </option>
          ))}
        </select>
        <input
          type="color"
          className="w-12 h-10 rounded-xl border border-gray-200 shrink-0"
          value={cor}
          onChange={(e) => setCor(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Salvando..." : "Salvar evento"}
        </button>
        <button type="button" onClick={onCancel} className="text-gray-400 px-3">
          Cancelar
        </button>
      </div>
    </form>
  );
}