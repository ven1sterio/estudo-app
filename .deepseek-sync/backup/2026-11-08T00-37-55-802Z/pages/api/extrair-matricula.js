// Recebe { pdfBase64 } com o Comprovante de Matrícula do SIGAA e devolve as
// disciplinas matriculadas em formato bruto. O cálculo de dias/horários fica
// por conta do parser determinístico em lib/sigaaHorarios.js — pedimos pro
// modelo só extrair o texto das colunas, não fazer contas.

export const config = {
  api: {
    bodyParser: { sizeLimit: "15mb" },
  },
};

const PROMPT = `Você vai receber um "Comprovante de Matrícula" do sistema SIGAA de uma universidade.
Extraia a tabela "Turmas Matriculadas", uma linha por disciplina.

Responda APENAS com um JSON neste formato, sem texto antes ou depois:

{
  "disciplinas": [
    {
      "codigo": "código da disciplina, ex: ICE0668",
      "nome": "nome da disciplina em maiúsculas como aparece",
      "professor": "nome do docente responsável",
      "horario_raw": "o código de horário EXATAMENTE como está escrito na coluna Horário, ex: '2N12 5N34'",
      "locais_raw": "o texto EXATO do campo 'Local' daquela disciplina, incluindo prefixos como '4ª' se houver, ex: '4ª CA II - Sala 10; 5ª LEC III'"
    }
  ]
}

Regras importantes:
- NÃO calcule horários nem interprete os códigos — apenas copie o texto exatamente como está no documento.
- Copie "locais_raw" literalmente, inclusive pontuação e prefixos de dia ("2ª", "4ª" etc.), quando existirem.
- Se um campo não existir no documento, use null.`;

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
