import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import PlanoEnsinoAssistente from "./PlanoEnsinoAssistente";
import { icons } from "./icons";

export default function AppLayout({ children }) {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: icons.home },
    { href: "/materias", label: "Matérias", icon: icons.book },
    { href: "/flashcards", label: "Flashcards", icon: icons.layers },
    { href: "/tarefas", label: "Tarefas", icon: icons.check },
    { href: "/calendario", label: "Calendário", icon: icons.calendar },
  ];

  return (
    <div className="min-h-screen flex bg-surface">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:flex-col w-56 shrink-0 bg-white border-r border-borderSoft py-6 px-4">
        <Link href="/dashboard" className="flex items-center gap-2 px-2 mb-8">
          <span className="text-xl"></span>
          <span className="font-bold text-textPrimary">SIMPLIFY</span>
        </Link>

        <nav className="flex flex-col gap-1.5 flex-1">
          {links.map((link) => {
            const active = router.pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  "flex items-center gap-3 h-11 px-3 rounded-xl text-sm transition-colors duration-200 " +
                  (active
                    ? "bg-primarySoft text-textPrimary font-semibold"
                    : "text-textSecondary hover:bg-primaryExtraSoft")
                }
              >
                <span className={active ? "text-primary" : "text-textMuted"}>{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 h-11 px-3 rounded-xl text-sm text-textSecondary hover:bg-primaryExtraSoft hover:text-danger transition-colors duration-200"
        >
          <span className="text-textMuted">{icons.logout}</span>
          Sair
        </button>
      </aside>

      {/* Navbar simplificada (mobile) */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white/90 backdrop-blur border-b border-borderSoft px-4 py-3 flex items-center justify-between z-10">
        <Link href="/dashboard" className="font-bold text-textPrimary text-base">SIMPLIFY</Link>
        <button onClick={handleLogout} className="text-textSecondary text-sm">Sair</button>
      </div>

      <main className="flex-1 min-w-0 px-4 py-6 pt-20 md:pt-8 md:px-8 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>

      {/* Navegação inferior (mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-borderSoft flex justify-around py-2 z-10">
        {links.map((link) => {
          const active = router.pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={"flex flex-col items-center gap-0.5 text-xs px-3 py-1 " + (active ? "text-primary" : "text-textMuted")}
            >
              {link.icon}
              {link.label}
            </Link>
          );
        })}
      </nav>

      <PlanoEnsinoAssistente />
    </div>
  );
}
