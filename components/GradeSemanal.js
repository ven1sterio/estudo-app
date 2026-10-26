import { useMemo } from "react";
import Link from "next/link";
import { useTheme } from "../lib/theme-context";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Ordem visual: Seg → Dom (fim de semana no fim)
const ORDEM = [1, 2, 3, 4, 5, 6, 0];

export default function GradeSemanal({ materias }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const blocosPorDia = useMemo(() => {
    const mapa = {};
    for (const m of materias) {
      for (const h of m.horarios || []) {
        const dia = Number(h.dia_semana);
        if (Number.isNaN(dia)) continue;
        (mapa[dia] = mapa[dia] || []).push({
          materia: m,
          inicio: h.hora_inicio,
          fim: h.hora_fim,
          sala: h.sala,
        });
      }
    }
    for (const dia of Object.keys(mapa)) {
      mapa[dia].sort((a, b) =>
        (a.inicio || "").localeCompare(b.inicio || "")
      );
    }
    return mapa;
  }, [materias]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {ORDEM.map((diaIdx) => (
        <div
          key={diaIdx}
          className="rounded-2xl border border-borderSoft bg-white p-3 min-h-[160px]"
        >
          <p className="text-xs font-bold text-textMuted uppercase mb-2">
            {DIAS[diaIdx]}
          </p>
          {(blocosPorDia[diaIdx] || []).length === 0 ? (
            <p className="text-[11px] text-textMuted">Livre</p>
          ) : (
            <ul className="space-y-1.5">
              {(blocosPorDia[diaIdx] || []).map((b, i) => {
                const cor = b.materia.cor || "#8B85F0";
                // Alpha menor no claro, maior no escuro — mantém legível nos dois
                const alpha = isDark ? "40" : "18";
                return (
                  <li
                    key={i}
                    className="rounded-lg px-2 py-1.5 text-[11px] border-l-2"
                    style={{
                      borderLeftColor: cor,
                      backgroundColor: `${cor}${alpha}`,
                    }}
                  >
                    <Link
                      href={`/materias/${b.materia.id}`}
                      className="font-semibold text-textPrimary truncate block hover:underline"
                    >
                      {b.materia.nome}
                    </Link>
                    <p className="text-textMuted">
                      {(b.inicio || "").slice(0, 5)}-
                      {(b.fim || "").slice(0, 5)}
                      {b.sala ? ` · ${b.sala}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
