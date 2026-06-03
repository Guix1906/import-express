import { useDraggable, useDroppable } from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, User as UserIcon, Clock, AlertTriangle, Briefcase } from "lucide-react";
import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  type ColumnKey,
  type ProductionCard,
  PRIORITY_LABEL,
  PRIORITY_STYLES,
  initials,
} from "./types";

export function Column({
  col,
  cards,
  isLoading,
  membersById,
  onCardClick,
  onAdd,
}: {
  col: { key: ColumnKey; label: string; accent: string };
  cards: ProductionCard[];
  isLoading: boolean;
  membersById: Map<string, string>;
  onCardClick: (c: ProductionCard) => void;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "shrink-0 w-[300px] snap-start rounded-xl border bg-card/50 backdrop-blur flex flex-col max-h-[calc(100vh-280px)]",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <div className={cn("rounded-t-xl bg-gradient-to-b px-3 py-2.5 border-b", col.accent)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{col.label}</span>
            <span className="rounded-full bg-background/60 px-1.5 text-[10px] font-bold text-muted-foreground">
              {cards.length}
            </span>
          </div>
          <button
            onClick={onAdd}
            className="rounded-md p-1 hover:bg-background/60 text-muted-foreground hover:text-foreground transition"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : cards.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-8">Sem cartões</div>
        ) : (
          <AnimatePresence>
            {cards.map((c) => (
              <DraggableCard
                key={c.id}
                card={c}
                membersById={membersById}
                onClick={() => onCardClick(c)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  card,
  membersById,
  onClick,
}: {
  card: ProductionCard;
  membersById: Map<string, string>;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  return (
    <motion.div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onClick();
      }}
    >
      <CardItem card={card} membersById={membersById} />
    </motion.div>
  );
}

export function CardItem({
  card,
  membersById,
  dragging,
}: {
  card: ProductionCard;
  membersById: Map<string, string>;
  dragging?: boolean;
}) {
  const overdue =
    card.due_date && isPast(new Date(card.due_date)) && card.column_key !== "concluidos";
  return (
    <Card
      className={cn(
        "p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-md transition-all bg-card",
        dragging && "rotate-2 shadow-xl ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-sm leading-tight line-clamp-2">{card.title}</h4>
        <Badge
          variant="outline"
          className={cn("text-[10px] shrink-0", PRIORITY_STYLES[card.priority])}
        >
          {PRIORITY_LABEL[card.priority]}
        </Badge>
      </div>

      {(card.client_name_snapshot || card.process_number) && (
        <div className="space-y-0.5 mb-2">
          {card.client_name_snapshot && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <UserIcon className="h-3 w-3" />
              <span className="truncate">{card.client_name_snapshot}</span>
            </div>
          )}
          {card.process_number && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Briefcase className="h-3 w-3" />
              <span className="truncate">{card.process_number}</span>
            </div>
          )}
        </div>
      )}

      {card.practice_area && (
        <Badge variant="secondary" className="text-[10px] mb-2">
          {card.practice_area}
        </Badge>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[9px]">
              {initials(membersById.get(card.assignee_id))}
            </AvatarFallback>
          </Avatar>
          <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
            {membersById.get(card.assignee_id) ?? "—"}
          </span>
        </div>
        {card.due_date && (
          <div
            className={cn(
              "flex items-center gap-1 text-[10px] font-medium",
              overdue ? "text-rose-500" : "text-muted-foreground",
            )}
          >
            {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {format(new Date(card.due_date), "dd/MM", { locale: ptBR })}
          </div>
        )}
      </div>
    </Card>
  );
}
