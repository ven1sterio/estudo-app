// Cálculo de dias consecutivos com revisão de flashcard.
// Recebe uma lista de datas ISO (YYYY-MM-DD) e devolve o streak atual.
//
// Regra: se o usuário não estudou hoje ainda, o streak continua válido
// até ontem (para não "perder" o número por não ter aberto o app hoje).

export function diasConsecutivos(diasIso, hojeIso) {
  const set = new Set(diasIso || []);
  if (set.size === 0) return 0;

  const hoje = new Date(hojeIso + "T00:00:00");
  let cursor = new Date(hoje);

  // Se hoje não teve revisão, começa a contar de ontem
  if (!set.has(hojeIso)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!set.has(iso)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function hojeIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
