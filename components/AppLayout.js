import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import PlanoEnsinoAssistente from "./PlanoEnsinoAssistente";

export default function AppLayout({ children }) {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/materias", label: "Matérias" },
    { href: "/calendario", label: "Calendário" },
    { href: "/tarefas", label: "Tarefas" },
  ];

  return (
    <div className="min-h-screen">
      <nav className="bg-white/80 backdrop-blur border-b border-gray-100 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <Link href="/dashboard" className="font-bold text-primary text-lg">
          SIMPLIFY
        </Link>
        <div className="flex items-center gap-6 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                router.pathname.startsWith(link.href)
                  ? "text-primary font-semibold"
                  : "text-gray-600 hover:text-primary"
              }
            >
              {link.label}
            </Link>
          ))}
          <button onClick={handleLogout} className="text-gray-500 hover:text-red-500">
            Sair
          </button>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      <PlanoEnsinoAssistente />
    </div>
  );
}
