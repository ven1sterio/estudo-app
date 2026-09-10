// Interpreta os códigos de horário do SIGAA, ex: "2N12 5N34", "4T345 5T2", "24M12".
// Formato de cada token: [dígitos de dia][turno M/T/N][dígitos de horário]
// Dia: 1=Dom, 2=Seg, 3=Ter, 4=Qua, 5=Qui, 6=Sex, 7=Sáb (mesmo padrão da tabela de horários da instituição)
//
// A tabela de horários abaixo é a tabela institucional padrão (manhã/tarde/noite).
// Se a sua instituição usa uma tabela diferente, ajuste os horários aqui.
export const TABELA_HORARIOS = {
  M: {
    1: ["07:30", "08:20"],
    2: ["08:20", "09:10"],
    3: ["09:30", "10:20"],
    4: ["10:20", "11:10"],
    5: ["11:10", "12:00"],
  },
  T: {
    1: ["13:30", "14:20"],
    2: ["14:20", "15:10"],
    3: ["15:30", "16:20"],
    4: ["16:20", "17:10"],
    5: ["17:10", "18:00"],
    6: ["18:00", "18:50"],
  },
  N: {
    1: ["19:00", "19:45"],
    2: ["19:45", "20:30"],
    3: ["20:50", "21:35"],
    4: ["21:35", "22:20"],
  },
};

// Converte o dígito de dia do SIGAA (1=Dom...7=Sáb) para o índice usado no app (0=Dom...6=Sáb)
function diaSigaaParaIndice(diaSigaa) {
  return diaSigaa - 1;
}

// Retorna uma lista de { diaSemana, diaSigaa, horaInicio, horaFim } a partir de uma
// string de horário do SIGAA, ex: "2N12 5N34" -> dois horários (Seg e Qui, à noite).
export function parseHorarioSigaa(raw) {
  if (!raw) return [];
  const tokens = raw.trim().split(/\s+/);
  const resultados = [];

  for (const token of tokens) {
    const match = token.match(/^(\d+)([MTN])(\d+)$/i);
    if (!match) continue;

    const [, diasStr, turnoRaw, slotsStr] = match;
    const turno = turnoRaw.toUpperCase();
    const tabelaTurno = TABELA_HORARIOS[turno];
    if (!tabelaTurno) continue;

    const dias = diasStr.split("").map(Number);
    const slots = slotsStr.split("").map(Number).filter((s) => tabelaTurno[s]);
    if (slots.length === 0) continue;

    const horaInicio = tabelaTurno[Math.min(...slots)][0];
    const horaFim = tabelaTurno[Math.max(...slots)][1];

    for (const diaSigaa of dias) {
      resultados.push({
        diaSigaa,
        diaSemana: diaSigaaParaIndice(diaSigaa),
        horaInicio,
        horaFim,
      });
    }
  }

  return resultados;
}

// Interpreta o campo de local, que pode ser:
// - um texto único (mesmo local todos os dias): "Campus Jatobá, CA1 - Sala 14"
// - vários locais, um por dia, separados por ";", cada um prefixado com "Nª ":
//   "4ª CA II - Sala 10; 5ª LEC III"
export function parseLocaisSigaa(raw) {
  if (!raw) return { tipo: "unico", texto: "" };

  const partes = raw.split(";").map((p) => p.trim()).filter(Boolean);
  const comOrdinal = partes.every((p) => /^\d+ª\s+/.test(p));

  if (partes.length > 1 && comOrdinal) {
    const mapa = {};
    for (const parte of partes) {
      const m = parte.match(/^(\d+)ª\s+(.*)$/);
      if (m) mapa[Number(m[1])] = m[2];
    }
    return { tipo: "por_dia", mapa };
  }

  return { tipo: "unico", texto: raw.replace(/^\d+ª\s+/, "").trim() };
}

// Junta horário + local em uma lista pronta pra virar linhas da tabela `horarios`.
export function montarHorarios(horarioRaw, locaisRaw) {
  const horarios = parseHorarioSigaa(horarioRaw);
  const locais = parseLocaisSigaa(locaisRaw);

  return horarios.map((h) => ({
    diaSemana: h.diaSemana,
    horaInicio: h.horaInicio,
    horaFim: h.horaFim,
    sala: locais.tipo === "por_dia" ? locais.mapa[h.diaSigaa] || "" : locais.texto,
  }));
}
