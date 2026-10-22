import "../styles/globals.css";
import Head from "next/head";
import { Poppins } from "next/font/google";
import { SWRConfig } from "swr";
import { AuthProvider } from "../lib/auth-context";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

// Cache + dedupe + revalidate inteligente
const swrConfig = {
  revalidateOnFocus: false, // não refaz request ao trocar de aba
  revalidateOnReconnect: true, // refaz quando volta a internet
  dedupingInterval: 60_000, // 60s de cache mesmo entre navegações
  errorRetryCount: 2,
  keepPreviousData: true, // sem flash de loading ao navegar
};

export default function App({ Component, pageProps }) {
  return (
    <main className={poppins.className}>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </Head>
      <SWRConfig value={swrConfig}>
        <AuthProvider>
          <Component {...pageProps} />
        </AuthProvider>
      </SWRConfig>
    </main>
  );
}