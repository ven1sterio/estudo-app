// Hook simples de status de rede.
//
// - `navigator.onLine` como semente (funciona no client)
// - Escuta `online` / `offline` para atualizar em tempo real
// - Em SSR retorna `true` (o servidor não tem como saber)

import { useEffect, useState } from "react";

export function useNetworkStatus() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}

/** Versão fora de React — usada por lib/sync.js. */
export function isOnline() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}
