import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "./auth-context";

// Mantém a API antiga, mas agora lê do contexto (zero chamadas Supabase).
export function useRequireAuth() {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  return { user, loading };
}