import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

export default function Cadastro() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCadastro(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome }, // fica disponível em user_metadata
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Se a confirmação por e-mail estiver ativa, não haverá sessão ainda
    if (data.session) {
      router.push("/onboarding");
    } else {
      setSucesso(true);
    }
  }

  if (sucesso) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div className="card max-w-sm">
          <h1 className="text-xl font-bold mb-2">Verifique seu email ✉️</h1>
          <p className="text-gray-600 text-sm mb-4">
            Enviamos um link de confirmação para <strong>{email}</strong>. Confirme
            para poder entrar.
          </p>
          <Link href="/login" className="btn-primary inline-block">
            Ir para login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="card w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1">Criar conta</h1>
        <p className="text-gray-500 text-sm mb-6">Comece a organizar seus estudos</p>

        <form onSubmit={handleCadastro} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input
              type="text"
              required
              className="input-field"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mínimo 6 caracteres"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Criando..." : "Criar conta"}
          </button>
        </form>

        <p className="mt-4 text-sm text-center">
          Já tem conta?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
