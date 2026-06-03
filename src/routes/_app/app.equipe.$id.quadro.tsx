import { createFileRoute } from "@tanstack/react-router";
import { KanbanBoard } from "@/components/app/kanban-board";

export const Route = createFileRoute("/_app/app/equipe/$id/quadro")({
  component: MemberBoardPage,
});

function MemberBoardPage() {
  const { id } = Route.useParams();
  return (
    <KanbanBoard
      track="operational"
      title="Quadro do colaborador"
      subtitle="Demandas atribuídas a este colaborador."
      lockedAssigneeId={id}
    />
  );
}
