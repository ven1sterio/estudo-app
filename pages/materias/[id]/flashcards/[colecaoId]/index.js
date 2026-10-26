import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { useRequireAuth } from "../../../../../lib/useAuth";
import { useConfirm } from "../../../../../components/ConfirmDialog";
import { useToast } from "../../../../../components/Toast";
import { supabase } from "../../../../../lib/supabaseClient";
import AppLayout from "../../../../../components/AppLayout";
import Skeleton from "../../../../../components/Skeleton";

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
    .eq("colecao_id", colecaoId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

/* ------------------ CSV helpers (import / export) ------------------ */

function parseCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        cells.push(cur);
        cur = "";
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  cells.push(cur);
  return cells;
}

function parseCsv(texto) {
  const linhas = texto
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  if (linhas.length === 0) return [];
  const primeira = parseCsvLine(linhas[0]).map((c) => c.trim().toLowerCase());
  const temCabecalho =
    primeira[0] === "frente" || primeira[0] === "pergunta" || primeira[0] === "a";

  const corpo = temCabecalho ? linhas.slice(1) : linhas;
  const resultado = [];
  for (const linha of corpo) {
    const [frente, verso] = parseCsvLine(linha);
    if (!frente || !verso) continue;
    resultado.push({ frente: frente.trim(), verso: verso.trim() });
  }
  return resultado;
}

function toCsv(cards) {
  const header = "frente,verso";
  const linhas = cards.map((c) => {
    const f = '"' + c.frente.replace(/"/g, '""').replace(/\r?\n/g, " ") + '"';
    const v = '"' + c.verso.replace(/"/g, '""').replace(/\r?\n/g, " ") + '"';
    return `${f},${v}`;
  });
  return [header, ...linhas].join("\n");
}

function downloadArquivo(nome, conteudo, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------------ Página ------------------------------ */

export default function GerenciarCartoes() {
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();
  const { id, colecaoId } = router.query;
  const uid = user?.id;
  const confirm = useConfirm();
  const { showToast } = useToast();

  const ready = !!user && !!colecaoId;

  const { data: colecao } = useSWR(
    ready ? swrKeyColecao(colecaoId) : null,
    () => fetchColecao(colecaoId)
  );
  const { data: cards = [], isLoading } = useSWR(
    ready ? swrKeyCards(colecaoId) : null,
    () => fetchCards(colecaoId)
  );

  const [frente, setFrente] = useState("");
  const [verso, setVerso] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("flashcards")
        .update({ frente, verso })
        .eq("id", editingId);
      setSaving(false);
      if (error) {
        setError(error.message);
        showToast("Erro ao editar cartão.", "error");
        return;
      }
      showToast("Cartão atualizado.", "success");
    } else {
      const { error } = await supabase.from("flashcards").insert({
        colecao_id: colecaoId,
        frente,
        verso,
      });
      setSaving(false);
      if (error) {
        setError(error.message);
        showToast("Erro ao criar cartão.", "error");
        return;
      }
      showToast("Cartão adicionado.", "success");
    }

    setFrente("");
    setVerso("");
    setEditingId(null);
    globalMutate(swrKeyCards(colecaoId));
    globalMutate(swrKeyColecao(colecaoId));
    globalMutate(["colecoes_materia", id]);
    globalMutate(["flashcard_colecoes", uid]);
  }

  function handleEdit(card) {
    setEditingId(card.id);
    setFrente(card.frente);
    setVerso(card.verso);
  }

  function cancelEdit() {
    setEditingId(null);
    setFrente("");
    setVerso("");
  }

  async function handleDelete(cardId) {
    const ok = await confirm({
      title: "Remover cartão",
      confirmLabel: "Remover",
      danger: true,
    });
    if (!ok) return;
    await supabase.from("flashcards").delete().eq("id", cardId);
    globalMutate(swrKeyCards(colecaoId));
    globalMutate(swrKeyColecao(colecaoId));
    globalMutate(["colecoes_materia", id]);
    globalMutate(["flashcard_colecoes", uid]);
    showToast("Cartão removido.", "success");
  }

  function handleExport() {
    if (!cards.length) {
      showToast("Não há cartões para exportar.", "info");
      return;
    }
    const nomeBase = (colecao?.nome_colecao || "baralho")
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-");
    downloadArquivo(`${nomeBase}.csv`, toCsv(cards));
    showToast("CSV gerado.", "success");
  }

  async function handleImport(e) {
    e.preventDefault();
    if (!importText.trim()) return;
    setImporting(true);

    const novos = parseCsv(importText);
    if (novos.length === 0) {
      setImporting(false);
      showToast("Nada reconhecido no CSV. Use o formato: frente,verso", "error");
      return;
    }

    const { error } = await supabase.from("flashcards").insert(
      novos.map((c) => ({
        colecao_id: colecaoId,
        frente: c.frente,
        verso: c.verso,
      }))
    );
    setImporting(false);

    if (error) {
      showToast("Erro ao importar: " + error.message, "error");
      return;
    }

    setImportText("");
    setShowImport(false);
    globalMutate(swrKeyCards(colecaoId));
    globalMutate(swrKeyColecao(colecaoId));
    globalMutate(["colecoes_materia", id]);
    globalMutate(["flashcard_colecoes", uid]);
    showToast(`${novos.length} cartão(ões) importado(s).`, "success");
  }

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="mb-6">
        <Link
          href={`/materias/${id}/flashcards`}
          className="text-sm text-primary hover:underline"
        >
          ← Baralhos
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold break-words min-w-0">
          {colecao?.nome_colecao}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="h-[42px] rounded-[10px] border border-borderSoft text-sm font-semibold px-4 hover:bg-surface transition-colors"
          >
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => setShowImport((s) => !s)}
            className="h-[42px] rounded-[10px] border border-borderSoft text-sm font-semibold px-4 hover:bg-surface transition-colors"
          >
            {showImport ? "Fechar" : "Importar CSV"}
          </button>
          <Link
            href={`/materias/${id}/flashcards/${colecaoId}/estudar`}
            className="btn-primary flex items-center gap-2"
          >
            ▶ Estudar
          </Link>
        </div>
      </div>

      {showImport && (
        <form onSubmit={handleImport} className="card mb-6 space-y-3">
          <p className="text-sm text-textSecondary">
            Cole abaixo o conteúdo do CSV (uma linha por cartão,{" "}
            <code className="text-xs bg-surface px-1 py-0.5 rounded">
              frente,verso
            </code>
            ). Aceita cabeçalho, aceita vírgulas dentro de aspas duplas.
          </p>
          <textarea
            rows={6}
            className="input-field font-mono text-xs"
            placeholder={`frente,verso\n"O que é fotossíntese?","Processo em que plantas convertem luz em energia"`}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="submit" disabled={importing} className="btn-primary">
              {importing ? "Importando..." : "Importar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowImport(false);
                setImportText("");
              }}
              className="text-textMuted px-3"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <form onSubmit={handleSubmit} className="card mb-6 space-y-3">
        <h2 className="font-semibold">
          {editingId ? "Editar cartão" : "Novo cartão"}
        </h2>
        <div>
          <label className="block text-sm font-medium mb-1">
            Lado A (Pergunta/Conceito)
          </label>
          <textarea
            required
            className="input-field"
            rows={2}
            value={frente}
            onChange={(e) => setFrente(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Lado B (Resposta/Explicação)
          </label>
          <textarea
            required
            className="input-field"
            rows={2}
            value={verso}
            onChange={(e) => setVerso(e.target.value)}
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving
              ? "Salvando..."
              : editingId
              ? "Salvar alterações"
              : "Adicionar cartão"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-gray-500 px-4 py-2"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <h2 className="font-semibold mb-3">{cards.length} cartão(ões)</h2>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : cards.length === 0 ? (
        <p className="text-gray-500 text-sm">Nenhum cartão ainda.</p>
      ) : (
        <div className="space-y-2">
          {cards.map((c) => {
            const proximaRevisao = c.proximo_review
              ? new Date(c.proximo_review + "T00:00:00").toLocaleDateString(
                  "pt-BR"
                )
              : "—";
            return (
              <div
                key={c.id}
                className="card flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0 break-words">
                  <p className="text-sm font-medium">{c.frente}</p>
                  <p className="text-sm text-gray-500 mt-1">{c.verso}</p>
                  <p className="text-[11px] text-textMuted mt-1">
                    Próxima revisão: {proximaRevisao}
                    {c.acertos > 0 || c.erros > 0
                      ? ` · ${c.acertos || 0} acerto(s) / ${c.erros || 0} erro(s)`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-end gap-2 sm:gap-3 text-xs shrink-0">
                  <button
                    onClick={() => handleEdit(c)}
                    className="text-primary hover:underline"
                  >
                    editar
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    remover
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
