import Link from "next/link";
import useSWR from "swr";
import { useRequireAuth } from "../../lib/useAuth";
import AppLayout from "../../components/AppLayout";
import Skeleton from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";
import GradeSemanal from "../../components/GradeSemanal";
import { swrKeys, fetchMaterias } from "../../lib/fetchers";

export default function Semana() {
  const { user, loading: authLoading } = useRequireAuth();
  const uid = user?.id;

  const { data: materias = [], isLoading } = useSWR(
    uid ? swrKeys.materias(uid) : null,
    () => fetchMaterias(uid)
  );

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-textPrimary">
            Semana
          </h1>
          <p className="text-textMuted mt-1 text-sm">
            Visão rápida das aulas por dia da semana
          </p>
        </div>
        <Link href="/materias" className="btn-secondary">
          Gerenciar matérias
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-[160px] w-full" />
          ))}
        </div>
      ) : materias.length === 0 ? (
        <EmptyState
          icon="📅"
          title="Nenhuma aula cadastrada ainda"
          description="Cadastre suas matérias e horários para ver a grade semanal."
          action={
            <Link href="/materias" className="btn-primary">
              + Cadastrar matéria
            </Link>
          }
        />
      ) : (
        <GradeSemanal materias={materias} />
      )}
    </AppLayout>
  );
}
