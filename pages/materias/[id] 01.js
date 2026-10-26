// Rota-legado: o arquivo original tinha espaço no nome ("[id] 01") e gerava
// uma rota duplicada em /materias/[id] 01. Ele existe apenas para não quebrar
// bookmarks antigos — qualquer acesso é redirecionado para a página real.
//
// Não referencie este arquivo em nenhum lugar. A página de verdade vive em
// pages/materias/[id].js.

import { useEffect } from "react";
import { useRouter } from "next/router";

export default function MateriaDetalheLegado() {
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!id) return;
    router.replace(`/materias/${encodeURIComponent(id)}`);
  }, [id, router]);

  return null;
}
