import { useRequireAuth } from "../lib/useAuth";
import AppLayout from "../components/AppLayout";
import CalendarioView from "../components/CalendarioView";
import { icons } from "../components/icons";

export default function Calendario() {
  const { user, loading: authLoading } = useRequireAuth();
  if (authLoading) return null;

  return (
    <AppLayout>
      <CalendarioView
        uid={user?.id}
        title="Calendário"
        titleIcon={icons.calendar}
      />
    </AppLayout>
  );
}
