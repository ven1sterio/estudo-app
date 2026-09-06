// Recebe { pdfBase64 } no corpo da requisição, envia pro Gemini e devolve
// a lista de avaliações extraídas do plano de ensino.
//
// A chave GEMINI_API_KEY fica só no servidor (nunca use NEXT_PUBLIC_ nela).

export const config = {
  api: {
    bodyParser: { sizeLimit: "15mb" }, // PDFs de plano de ensino costumam ser pequenos
  },
};

const PROMPT = `Você vai receber um plano de ensino de uma disciplina universitária em PDF.
Extraia todas as avaliações, provas, trabalhos, entregas, seminários e listas mencionadas.

Responda APENAS com um JSON no seguinte formato, sem nenhum texto antes ou depois:

{
  "materia_sugerida": "nome da disciplina, se identificável, senão null",
  "avaliacoes": [
    {
      "titulo": "string curta, ex: 'P1' ou 'Trabalho final'",
      "tipo": "prova" | "atividade" | "trabalho" | "seminario" | "lista" | "outro",
      "data": "YYYY-MM-DD ou null se não houver data explícita no documento",
      "semana_referencia": número da semana do semestre mencionada (ex: 8), ou null,
      "confianca": "alta" | "media" | "baixa"
    }
  ]
}

Regras:
- Se a data estiver escrita por extenso ou em outro formato, converta para YYYY-MM-DD.
- Se só houver uma referência relativa (ex: "semana 8", "penúltima semana"), preencha "semana_referencia" e deixe "data" como null.
- Use "confianca": "baixa" sempre que você estiver inferindo algo que não está explícito no texto.
- Não invente avaliações que não estão no documento.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { pdfBase64 } = req.body || {};
  if (!pdfBase64) {
    return res.status(400).json({ error: "Nenhum PDF enviado" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor" });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: "application/pdf", data: pdfBase64 } },
                { text: PROMPT },
              ],
            },
          ],
          generationConfig: { response_mime_type: "application/json" },
        }),
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({
        error: data.error?.message || "Erro ao chamar a API do Gemini",
      });
    }

    const textoResposta = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textoResposta) {
      return res.status(502).json({ error: "Resposta vazia do Gemini" });
    }

    let parsed;
    try {
      parsed = JSON.parse(textoResposta);
    } catch {
      return res.status(502).json({ error: "Não consegui interpretar a resposta do modelo" });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Erro inesperado" });
  }
}
