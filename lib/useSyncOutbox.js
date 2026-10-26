// Hook que dispara o processamento da fila de sync.
//
// - Reage à reconexão (`online`/`offline`).
// - Processa a fila imediatamente ao ficar online e a cada 30s enquanto
//   online (para pegar operações enfileiradas depois do boot).
// - Atualiza um contador reativo de pendências para o indicador de UI.
// - Após sincronizar, invalida o cache SWR para refletir dados do servidor.

import { useCallback, useEffect, useRef, useState } from "react";
import { mutate } from "swr";
import { useNetworkStatus } from "./network";
import { processarFila, tamanhoFila } from "./sync";

const INTERVALO_SYNC_MS = 30_000;
const INTERVALO_CONTADOR_MS = 4_000;

export function useSyncOutbox() {
  const online = useNetworkStatus();
  const [pending, setPending] = useState(0);
  const [syncando, setSyncando] = useState(false);
  const syncandoRef = useRef(false);

  const atualizarContador = useCallback(async () => {
    try {
      setPending(await tamanhoFila());
    } catch {
      /* Dexie pode estar indisponível em SSR — ignora */
    }
  }, []);

  const sincronizarAgora = useCallback(async () => {
    if (syncandoRef.current) return { ignorado: true };
    if (!online) return { offline: true };

    syncandoRef.current = true;
    setSyncando(true);
    try {
      const r = await processarFila();
      if (r.processadas > 0) {
        await mutate(() => true);
      }
      await atualizarContador();
      return r;
    } finally {
      syncandoRef.current = false;
      setSyncando(false);
    }
  }, [online, atualizarContador]);

  // Contador reativo
  useEffect(() => {
    atualizarContador();
    const id = setInterval(atualizarContador, INTERVALO_CONTADOR_MS);
    return () => clearInterval(id);
  }, [atualizarContador]);

  // Sincronização automática ao reconectar + periódica enquanto online
  useEffect(() => {
    if (!online) return;
    sincronizarAgora();
    const id = setInterval(sincronizarAgora, INTERVALO_SYNC_MS);
    return () => clearInterval(id);
  }, [online, sincronizarAgora]);

  return { online, pending, syncando, sincronizarAgora };
}
