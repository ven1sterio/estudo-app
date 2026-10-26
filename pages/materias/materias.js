// Rota-legado: alias antigo que vive em /materias/materias. Não é referenciado
// em nenhum lugar do app. Existe apenas para não 404 em bookmarks antigos —
// qualquer acesso é redirecionado para /materias.

import { useEffect } from "react";
import { useRouter } from "next/router";

export default function MateriasLegado() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    router.replace("/materias");
  }, [router]);

  return null;
}
