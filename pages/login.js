import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { useNetworkStatus } from "../lib/network";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const online = useNetworkStatus();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");

    if (!online) {
      setError(
        "Você está offline. Conecte-se à internet para entrar — depois o app funciona offline normalmente."
      );
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      // Erros de rede costumam vir como "Failed to fetch" ou "NetworkError"
      const msg = error.message || "";
      if (/failed to fetch|networkerror|network/i.test(msg)) {
        setError(
          "Não consegui falar com o servidor. Verifique a conexão e tente novamente."
        );
      } else {
        setError("Email ou senha inválidos.");
      }
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="card w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1">Bem-vindo de volta</h1>
        <p className="text-gray-500 text-sm mb-6">
          Entre na sua conta para continuar
        </p>

        {!online && (
          <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-300">
            Sem conexão. Login e cadastro precisam de internet. O app volta a
            funcionar offline normalmente depois que você entrar uma vez.
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Senha</label>
            <input
              type="password"
              required
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-4 flex justify-between text-sm">
          <Link href="/recuperar-senha" className="text-primary hover:underline">
            Esqueci minha senha
          </Link>
          <Link href="/cadastro" className="text-primary hover:underline">
            Criar conta
          </Link>
        </div>
      </div>
    </div>
  );
}
