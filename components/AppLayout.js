import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import PlanoEnsinoAssistente from "./PlanoEnsinoAssistente";

// Ícones outline simples (sem dependências novas), stroke ~1.8px
const icons = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  ),
  layers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17 21 12 16 7" />
      <path d="M21 12H9" />
    </svg>
  ),
};

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
