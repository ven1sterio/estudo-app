// SM-2 simplificado — apenas duas respostas: "sabia" (true) / "não sabia" (false).
// Retorna o novo estado de agendamento do cartão.
//
// Regras:
//  - Acerto seguido de acerto: intervalo cresce (1 → 6 → intervalo*ease)
//  - Erro: intervalo volta para 1 dia, ease diminui (nunca abaixo de 1.3)
//  - proximo_review = hoje + intervalo_dias

export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;

function hoje() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * @param {object} cartao  — objeto atual do flashcard
 * @param {boolean} soube  — true = sabia, false = não sabia
 * @returns {object} campos a atualizar
 */
export function calcularProximoReview(cartao, soube) {
  const intervaloAtual = Number(cartao?.intervalo_dias) || 0;
  const acertos = Number(cartao?.acertos) || 0;
  const erros = Number(cartao?.erros) || 0;
  const ease = Number(cartao?.ease) > 0 ? Number(cartao.ease) : DEFAULT_EASE;

  let novoIntervalo;
  let novoEase = ease;
  let novosAcertos = acertos;
  let novosErros = erros;

  if (soube) {
    novosAcertos = acertos + 1;
    if (intervaloAtual <= 0) novoIntervalo = 1;
    else if (intervaloAtual === 1) novoIntervalo = 6;
    else novoIntervalo = Math.round(intervaloAtual * ease);
    novoEase = Math.min(2.8, ease + 0.05);
  } else {
    novosErros = erros + 1;
    novoIntervalo = 1;
    novoEase = Math.max(MIN_EASE, ease - 0.2);
  }

  const proximo = hoje();
  proximo.setDate(proximo.getDate() + novoIntervalo);

  return {
    intervalo_dias: novoIntervalo,
    proximo_review: isoDate(proximo),
    acertos: novosAcertos,
    erros: novosErros,
    ease: novoEase,
    ultima_revisao: new Date().toISOString(),
  };
}

/**
 * Retorna se um cartão deve ser revisado hoje (ou já está atrasado).
 * Cartão "novo" (sem proximo_review) conta como pendente.
 */
export function estaParaRevisar(cartao, dataHojeStr) {
  if (!cartao?.proximo_review) return true;
  return cartao.proximo_review <= dataHojeStr;
}
