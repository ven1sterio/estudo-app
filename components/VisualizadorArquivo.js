import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const BUCKET = "materiais";

const EXTENSOES = {
  imagem: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"],
  pdf: ["pdf"],
  texto: ["txt", "md", "csv", "json", "log"],
  video: ["mp4", "webm", "mov", "m4v", "ogv"],
  audio: ["mp3", "wav", "ogg", "m4a", "aac"],
  office: ["doc", "docx", "ppt", "pptx", "xls", "xlsx", "odt", "odp", "ods"],
};

export function tipoDoArquivo(nome = "") {
  const ext = nome.split("?")[0].split(".").pop().toLowerCase();
  for (const [tipo, lista] of Object.entries(EXTENSOES)) {
    if (lista.includes(ext)) return tipo;
  }
  return "outro";
}

export function caminhoNoStorage(url = "") {
  const parte = url.split(`/${BUCKET}/`)[1];
  if (!parte) return null;
  try {
    return decodeURIComponent(parte.split("?")[0]);
  } catch {
    return parte.split("?")[0];
  }
}

function urlDeDownload(url, titulo) {
  return url + (url.includes("?") ? "&" : "?") + "download=" + encodeURIComponent(titulo || "arquivo");
}

function extensaoDe(titulo = "", url = "") {
  const fonte = (titulo || "").includes(".") ? titulo : url;
  return fonte.split("?")[0].split(".").pop().toLowerCase();
}

/* ---------------------------------- PDF ---------------------------------- */

function PaginaPdf({ doc, numero, razao, largura }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisivel(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setVisivel(true),
      { rootMargin: "900px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visivel || !doc || !largura) return;
    let task;
    let cancelado = false;
    (async () => {
      try {
        const page = await doc.getPage(numero);
        if (cancelado) return;
        const base = page.getViewport({ scale: 1 });
        const escala = largura / base.width;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const vp = page.getViewport({ scale: escala * dpr });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.style.width = Math.floor(vp.width / dpr) + "px";
        canvas.style.height = Math.floor(vp.height / dpr) + "px";
        task = page.render({ canvasContext: canvas.getContext("2d"), viewport: vp });
        await task.promise;
      } catch (e) {
        if (e?.name !== "RenderingCancelledException") {
          console.error("Erro ao desenhar página do PDF", e);
        }
      }
    })();
    return () => {
      cancelado = true;
      task?.cancel();
    };
  }, [visivel, doc, numero, largura]);

  return (
    <div
      ref={wrapRef}
      className="bg-white shadow-sm mx-auto mb-3"
      style={{ width: largura, minHeight: visivel ? undefined : largura * razao }}
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}

function VisualizadorPdf({ path, zoom, onErro }) {
  const containerRef = useRef(null);
  const [largura, setLargura] = useState(0);
  const [doc, setDoc] = useState(null);
  const [info, setInfo] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(el.clientWidth - 16, 200));
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelado = false;
    let pdf;
    (async () => {
      try {
        const { data, error } = await supabase.storage.from(BUCKET).download(path);
        if (error) throw error;
        const buffer = await data.arrayBuffer();

        // pdfjs-dist v4+: os arquivos são .mjs (ESM).
        // Mantemos fallback para v3 caso o usuário não tenha migrado ainda.
        let pdfjsLib;
        try {
          pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
        } catch {
          pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");
        }

        // v4 expõe exports nomeados diretos; v3 (CJS) precisa de `.default`.
        const pdfjs = pdfjsLib.getDocument ? pdfjsLib : pdfjsLib.default;
        if (!pdfjs?.getDocument) {
          throw new Error(
            "pdfjs-dist não encontrado. Rode `npm install pdfjs-dist@4.2.67`."
          );
        }

        // O worker precisa existir em /public/pdf.worker.min.mjs
        // (copie de node_modules/pdfjs-dist/build/pdf.worker.min.mjs
        //  ou legacy/build/pdf.worker.min.mjs).
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        // Já temos o buffer completo em memória — desliga streaming/auto-fetch
        // para evitar requisições desnecessárias.
        pdf = await pdfjs.getDocument({
          data: buffer,
          disableAutoFetch: true,
          disableStream: true,
        }).promise;

        if (cancelado) return;
        const p1 = await pdf.getPage(1);
        const vp = p1.getViewport({ scale: 1 });
        setInfo({ paginas: pdf.numPages, razao: vp.height / vp.width });
        setDoc(pdf);
      } catch (e) {
        console.error("Erro ao carregar PDF:", e);
        if (!cancelado) onErro?.("Não foi possível abrir este PDF aqui.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
      pdf?.destroy?.();
    };
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  const larguraPagina = Math.round(largura * zoom);

  return (
    <div ref={containerRef} className="p-2 min-h-full">
      {carregando && (
        <p className="text-center text-sm text-gray-500 py-10">Carregando PDF…</p>
      )}
      {doc && info &&
        Array.from({ length: info.paginas }, (_, i) => (
          <PaginaPdf
            key={i + 1}
            doc={doc}
            numero={i + 1}
            razao={info.razao}
            largura={larguraPagina}
          />
        ))}
    </div>
  );
}

/* --------------------------------- DOCX ---------------------------------- */

function VisualizadorDocx({ path, onErro }) {
  const containerRef = useRef(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const { data, error } = await supabase.storage.from(BUCKET).download(path);
        if (error) throw error;
        if (cancelado || !containerRef.current) return;

        const { renderAsync } = await import("docx-preview");
        if (cancelado || !containerRef.current) return;

        containerRef.current.innerHTML = "";
        await renderAsync(data, containerRef.current, undefined, {
          className: "docx-preview-wrapper",
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          renderHeaders: true,
          renderFooters: true,
        });
      } catch (e) {
        console.error(e);
        if (!cancelado) onErro?.("Não foi possível abrir este arquivo .docx.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-full bg-gray-100">
      {carregando && (
        <p className="text-center text-sm text-gray-500 py-10">Carregando documento…</p>
      )}
      <div ref={containerRef} className="docx-container" />
    </div>
  );
}

/* --------------------------------- Texto --------------------------------- */

function VisualizadorTexto({ path, onErro }) {
  const [texto, setTexto] = useState(null);
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data, error } = await supabase.storage.from(BUCKET).download(path);
      if (cancelado) return;
      if (error) return onErro?.("Não foi possível abrir este arquivo aqui.");
      const t = await data.text();
      if (!cancelado) {
        setTexto(
          t.length > 500000
            ? t.slice(0, 500000) + "\n\n… (arquivo grande, mostrando o início)"
            : t
        );
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  if (texto === null) {
    return <p className="text-center text-sm text-gray-500 py-10">Carregando…</p>;
  }
  return (
    <pre className="p-4 text-sm whitespace-pre-wrap break-words bg-white min-h-full">
      {texto}
    </pre>
  );
}

/* ------------------------------- Principal ------------------------------- */

const ZOOMS = [1, 1.25, 1.5, 2, 3];

export default function VisualizadorArquivo({ titulo, url, onClose }) {
  const tipo =
    tipoDoArquivo(titulo) !== "outro" ? tipoDoArquivo(titulo) : tipoDoArquivo(url);
  const ext = extensaoDe(titulo, url);
  const path = caminhoNoStorage(url);
  const [erro, setErro] = useState("");
  const [zoomIdx, setZoomIdx] = useState(0);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = anterior;
    };
  }, [onClose]);

  const handleErro = useCallback((msg) => setErro(msg), []);

  let corpo;
  if (erro) {
    corpo = null;
  } else if (tipo === "imagem") {
    corpo = (
      <div className="min-h-full flex items-center justify-center p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={titulo}
          className="max-w-full max-h-full object-contain"
          onError={() => setErro("Não foi possível carregar a imagem.")}
        />
      </div>
    );
  } else if (tipo === "pdf" && path) {
    corpo = <VisualizadorPdf path={path} zoom={ZOOMS[zoomIdx]} onErro={handleErro} />;
  } else if (tipo === "texto" && path) {
    corpo = <VisualizadorTexto path={path} onErro={handleErro} />;
  } else if (tipo === "video") {
    corpo = (
      <div className="min-h-full flex items-center justify-center bg-black">
        <video src={url} controls playsInline className="max-w-full max-h-full" />
      </div>
    );
  } else if (tipo === "audio") {
    corpo = (
      <div className="min-h-full flex items-center justify-center p-6">
        <audio src={url} controls className="w-full max-w-md" />
      </div>
    );
  } else if (tipo === "office") {
    if (ext === "docx" && path) {
      corpo = <VisualizadorDocx path={path} onErro={handleErro} />;
    } else {
      corpo = (
        <iframe
          title={titulo}
          src={
            "https://view.officeapps.live.com/op/embed.aspx?src=" +
            encodeURIComponent(url)
          }
          className="w-full h-full border-0 bg-white"
        />
      );
    }
  } else {
    corpo = (
      <div className="min-h-full flex flex-col items-center justify-center text-center p-6 gap-3">
        <p className="text-gray-600 text-sm">Este tipo de arquivo não tem pré-visualização.</p>
        <a href={urlDeDownload(url, titulo)} className="btn-primary">
          Baixar arquivo
        </a>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div
        className="flex flex-col w-full max-w-5xl mx-auto h-[100dvh] sm:h-[calc(100dvh-3rem)] bg-surface sm:rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 bg-white border-b border-borderSoft px-3 pb-2 pt-[calc(0.5rem_+_env(safe-area-inset-top))] sm:pt-2">
          <p className="flex-1 min-w-0 truncate text-sm font-medium" title={titulo}>
            {titulo}
          </p>

          {tipo === "pdf" && !erro && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                className="w-9 h-9 rounded-lg bg-primarySoft text-primaryDark disabled:opacity-40"
                disabled={zoomIdx === 0}
                onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}
                aria-label="Diminuir zoom"
              >
                −
              </button>
              <button
                className="w-9 h-9 rounded-lg bg-primarySoft text-primaryDark disabled:opacity-40"
                disabled={zoomIdx === ZOOMS.length - 1}
                onClick={() => setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1))}
                aria-label="Aumentar zoom"
              >
                +
              </button>
            </div>
          )}

          <a
            href={urlDeDownload(url, titulo)}
            className="shrink-0 text-xs px-3 h-9 inline-flex items-center rounded-lg border border-borderSoft text-textMuted hover:text-primary"
          >
            Baixar
          </a>
          <button
            onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-lg text-xl text-textMuted hover:text-primary"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto overscroll-contain bg-gray-100">
          {corpo}
          {erro && (
            <div className="min-h-full flex flex-col items-center justify-center text-center p-6 gap-3">
              <p className="text-sm text-red-500">{erro}</p>
              <a href={urlDeDownload(url, titulo)} className="btn-primary">
                Baixar arquivo
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}