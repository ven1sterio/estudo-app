import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-bold mb-3 text-primary">SIMPLIFY</h1>
      <p className="text-gray-600 mb-8 max-w-md">
        Organize suas matérias, materiais, provas e flashcards em um só lugar.
      </p>
      <div className="flex gap-4">
        <Link href="/login" className="btn-primary">
          Entrar
        </Link>
        <Link
          href="/cadastro"
          className="border border-primary text-primary font-medium py-2 px-4 rounded-lg hover:bg-primary hover:text-white transition-colors"
        >
          Criar conta
        </Link>
      </div>
    </div>
  );
}
