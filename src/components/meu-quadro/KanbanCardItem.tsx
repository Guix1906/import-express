import { useEffect, useRef } from "react";
import { ListChecks, MessageSquare, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PRIORITY_DOT, initials, type Card, type MemberPalette } from "./shared";

export function KanbanCardItem({
  card,
  onClick,
  palette,
  highlighted = false,
}: {
  card: Card;
  onClick: () => void;
  palette: MemberPalette;
  highlighted?: boolean;
}) {
  const overdue = card.due_date && new Date(card.due_date) < new Date();
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (highlighted && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted]);
  return (
    <div
      ref={ref}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/card-id", card.id)}
      onClick={onClick}
      className={cn(
        "group rounded-xl bg-white border border-slate-200 p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 transition-all cursor-pointer",
        overdue && "border-l-4 border-l-rose-500 border-rose-200",
        highlighted && "ring-2 ring-indigo-500 ring-offset-2 shadow-lg animate-pulse",
      )}
    >
      <div className="font-semibold text-[13px] text-[#1E293B] leading-snug mb-1 line-clamp-2">
        {card.title}
      </div>
      {card.client_name_snapshot && (
        <div className="text-[11px] text-slate-500 truncate mb-2">{card.client_name_snapshot}</div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <ListChecks className="h-3 w-3" />1 etapa
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />0
          </span>
          {card.due_date && (
            <span className={cn("flex items-center gap-1", overdue && "text-rose-600 font-medium")}>
              <Calendar className="h-3 w-3" />
              {format(new Date(card.due_date), "dd/MM", { locale: ptBR })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              PRIORITY_DOT[card.priority] ?? PRIORITY_DOT.media,
            )}
          />
          <div
            className={cn(
              "h-6 w-6 rounded-full text-white text-[9px] font-semibold flex items-center justify-center shadow-sm",
              palette.avatar,
            )}
          >
            {initials(card.client_name_snapshot || card.title)}
          </div>
        </div>
      </div>
    </div>
  );
}
