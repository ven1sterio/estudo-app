import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { mutate } from "swr";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/theme-context";
import { icons } from "./icons";

// Carrega o assistente só no client, como chunk separado do bundle inicial.
const PlanoEnsinoAssistente = dynamic(() => import("./PlanoEnsinoAssistente"), {
  ssr: false,
});

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: icons.home },
  { href: "/materias", label: "Matérias", icon: icons.book },
  { href: "/materias/semana", label: "Semana", icon: icons.weekView },
  { href: "/flashcards", label: "Flashcards", icon: icons.layers },
  { href: "/tarefas", label: "Tarefas", icon: icons.check },
  { href: "/calendario", label: "Calendário", icon: icons.calendar },
];

// Marca ativo pelo "match mais específico" — evita que /materias e
// /materias/semana fiquem ambos destacados.
function isActiveLink(link, pathname) {
  const matches = (l) =>
    pathname === l.href || pathname.startsWith(l.href + "/");
  if (!matches(link)) return false;
  const maisEspecifico = LINKS.some(
    (l) =>
      l.href !== link.href &&
      l.href.length > link.href.length &&
      matches(l)
  );
  return !maisEspecifico;
}

export default function AppLayout({ children }) {
  const router = useRouter();
  const { theme, mounted, toggle } = useTheme();
  const isDark = mounted && theme === "dark";
  const themeIcon = isDark ? icons.sun : icons.moon;
  const themeLabel = isDark ? "Modo claro" : "Modo escuro";

  async function handleLogout() {
    await supabase.auth.signOut();
    await mutate(() => true, undefined, { revalidate: false });
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex bg-surface">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:flex-col w-56 shrink-0 bg-white border-r border-borderSoft py-6 px-4">
        <Link href="/dashboard" className="flex items-center gap-2 px-2 mb-8">
          <span className="text-xl" aria-hidden="true">🌟</span>
          <span className="font-bold text-textPrimary">SIMPLIFY</span>
        </Link>

        <nav className="flex flex-col gap-1.5 flex-1" aria-label="Navegação principal">
          {LINKS.map((link) => {
            const active = isActiveLink(link, router.pathname);
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
                <span className={active ? "text-primary" : "text-textMuted"} aria-hidden="true">
                  {link.icon}
                </span>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="pt-3 mt-3 border-t border-borderSoft space-y-1">
          <button
            onClick={toggle}
            className="flex items-center gap-3 h-11 px-3 rounded-xl text-sm text-textSecondary hover:bg-primaryExtraSoft transition-colors duration-200 w-full"
            aria-label={themeLabel}
          >
            <span className="text-textMuted" aria-hidden="true">
              {mounted ? themeIcon : <span className="w-5 h-5 block" />}
            </span>
            {mounted ? themeLabel : "Tema"}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 h-11 px-3 rounded-xl text-sm text-textSecondary hover:bg-primaryExtraSoft hover:text-danger transition-colors duration-200 w-full"
          >
            <span className="text-textMuted" aria-hidden="true">{icons.logout}</span>
            Sair
          </button>
        </div>
      </aside>

      {/* Navbar simplificada (mobile) */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white/90 backdrop-blur border-b border-borderSoft px-4 pb-3 pt-[calc(0.75rem_+_env(safe-area-inset-top))] flex items-center justify-between z-10">
        <Link href="/dashboard" className="font-bold text-textPrimary text-base">SIMPLIFY</Link>
        <div className="flex items-center gap-1">
          <button
            onClick={toggle}
            className="w-9 h-9 flex items-center justify-center text-textSecondary"
            aria-label={themeLabel}
          >
            {mounted ? themeIcon : <span className="w-5 h-5 block" />}
          </button>
          <button onClick={handleLogout} className="text-textSecondary text-sm px-2">Sair</button>
        </div>
      </div>

      <main className="flex-1 min-w-0 px-4 py-6 pt-[calc(4.5rem_+_env(safe-area-inset-top))] md:pt-8 md:px-8 pb-[calc(6rem_+_env(safe-area-inset-bottom))] md:pb-8">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>

      {/* Navegação inferior (mobile) */}
      <nav
        aria-label="Navegação principal mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-borderSoft flex justify-around pt-2 pb-[calc(0.5rem_+_env(safe-area-inset-bottom))] z-10"
      >
        {LINKS.map((link) => {
          const active = isActiveLink(link, router.pathname);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={"flex-1 min-w-0 flex flex-col items-center gap-0.5 text-[10px] px-1 py-1 " + (active ? "text-primary" : "text-textMuted")}
            >
              <span aria-hidden="true">{link.icon}</span>
              <span className="max-w-full truncate">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <PlanoEnsinoAssistente />
    </div>
  );
}
