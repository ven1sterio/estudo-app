import "../styles/globals.css";
import Head from "next/head";
import { Poppins } from "next/font/google";
import { SWRConfig } from "swr";
import { AuthProvider } from "../lib/auth-context";
import { ThemeProvider } from "../lib/theme-context";
import { ToastProvider } from "../components/Toast";
import { ConfirmProvider } from "../components/ConfirmDialog";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 60_000,
  errorRetryCount: 2,
  keepPreviousData: true,
};

// Aplica `dark` no <html> antes do React montar (evita flash de tema claro).
const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('simplify-theme');
    if (t !== 'dark' && t !== 'light') {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    var root = document.documentElement;
    if (t === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  } catch (e) {}
})();
`;

export default function App({ Component, pageProps }) {
  return (
    <main className={poppins.className}>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#8B6FD8" />
        <meta
          name="description"
          content="SIMPLIFY — organize matérias, materiais, flashcards, tarefas e calendário."
        />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </Head>
      <SWRConfig value={swrConfig}>
        <AuthProvider>
          <ThemeProvider>
            <ToastProvider>
              <ConfirmProvider>
                <Component {...pageProps} />
              </ConfirmProvider>
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </SWRConfig>
    </main>
  );
}
