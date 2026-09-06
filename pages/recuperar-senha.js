import { useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

export default function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReset(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nova-senha`,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setEnviado(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="card w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1">Recuperar senha</h1>
        <p className="text-gray-500 text-sm mb-6">
          Enviaremos um link de redefinição para seu email
        </p>

        {enviado ? (
          <p className="text-green-600 text-sm">
            Email enviado! Verifique sua caixa de entrada.
          </p>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <input
              type="email"
              required
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Enviando..." : "Enviar link"}
            </button>
          </form>
        )}

        <p className="mt-4 text-sm text-center">
          <Link href="/login" className="text-primary hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}
