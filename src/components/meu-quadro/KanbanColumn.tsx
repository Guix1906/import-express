import { useEffect, useState } from "react";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Plus,
  Check,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { KanbanCardItem } from "./KanbanCardItem";
import {
  COLUMN_COLORS,
  colorClasses,
  type Card,
  type MemberColumn,
  type MemberPalette,
} from "./shared";

export function KanbanColumn({
  column,
  cards,
  loading,
  isFirst,
  isLast,
  canDelete,
  onDropCard,
  onCardClick,
  onRename,
  onChangeColor,
  onMove,
  onDelete,
  onAddCard,
  assigneePalette,
  highlightCardId,
}: {
  column: MemberColumn;
  cards: Card[];
  loading: boolean;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  onDropCard: (cardId: string) => void;
  onCardClick: (c: Card) => void;
  onRename: (title: string) => void;
  onChangeColor: (color: string) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  onAddCard: (title: string) => void;
  assigneePalette: MemberPalette;
  highlightCardId?: string | null;
}) {
  const [isOver, setIsOver] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(column.title);
  const [colorOpen, setColorOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const c = colorClasses(column.color);

  useEffect(() => setDraftTitle(column.title), [column.title]);

  const commitRename = () => {
    const v = draftTitle.trim();
    setEditing(false);
    if (v && v !== column.title) onRename(v);
    else setDraftTitle(column.title);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!isOver) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        const cardId = e.dataTransfer.getData("text/card-id");
        if (cardId) onDropCard(cardId);
      }}
      className={cn(
        "min-w-[280px] w-[280px] rounded-2xl bg-slate-100 border border-slate-200 flex flex-col transition-all",
        isOver && cn("ring-2 bg-[#4F46E5]/10", c.ring),
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={cn("h-2 w-2 rounded-full shrink-0", c.dot)} />
          {editing ? (
            <Input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setDraftTitle(column.title);
                  setEditing(false);
                }
              }}
              className="h-7 text-sm px-2"
            />
          ) : (
            <button
              onDoubleClick={() => setEditing(true)}
              className="font-semibold text-sm text-[#1E293B] truncate text-left hover:text-[#4F46E5] transition-colors"
              title="Duplo clique para renomear"
            >
              {column.title}
            </button>
          )}
          <span className="text-xs text-slate-500 font-medium shrink-0">{cards.length}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-7 w-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setColorOpen(true);
              }}
            >
              <span className={cn("h-3 w-3 rounded-full mr-2", c.dot)} />
              Alterar cor
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={isFirst} onSelect={() => onMove(-1)}>
              <ArrowLeft className="h-3.5 w-3.5 mr-2" />
              Mover para esquerda
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isLast} onSelect={() => onMove(1)}>
              <ArrowRight className="h-3.5 w-3.5 mr-2" />
              Mover para direita
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!canDelete}
              onSelect={() => {
                if (
                  confirm(
                    `Excluir a coluna "${column.title}"? Os cards serão movidos para outra coluna.`,
                  )
                ) {
                  onDelete();
                }
              }}
              className="text-rose-600 focus:text-rose-700"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Excluir coluna
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {colorOpen && (
        <div className="px-3 py-2 border-b border-slate-200 bg-white flex flex-wrap gap-1.5 items-center">
          {COLUMN_COLORS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                onChangeColor(opt.key);
                setColorOpen(false);
              }}
              className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center transition-all hover:scale-110",
                opt.dot,
                column.color === opt.key && "ring-2 ring-offset-1 ring-slate-700",
              )}
              title={opt.label}
            >
              {column.color === opt.key && <Check className="h-3 w-3 text-white" />}
            </button>
          ))}
          <button
            onClick={() => setColorOpen(false)}
            className="ml-auto h-6 w-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 p-2.5 space-y-2 min-h-[200px] max-h-[calc(100vh-380px)] overflow-y-auto">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))
        ) : cards.length === 0 ? (
          <div className="text-[11px] text-slate-400 text-center py-6">Nenhum cartão</div>
        ) : (
          cards.map((card) => (
            <KanbanCardItem
              key={card.id}
              card={card}
              onClick={() => onCardClick(card)}
              palette={assigneePalette}
              highlighted={highlightCardId === card.id}
            />
          ))
        )}
      </div>
      {adding ? (
        <div className="border-t border-slate-200 p-2.5 bg-white space-y-2">
          <Input
            autoFocus
            placeholder="Título do processo..."
            value={newCardTitle}
            onChange={(e) => setNewCardTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newCardTitle.trim()) {
                onAddCard(newCardTitle.trim());
                setNewCardTitle("");
                setAdding(false);
              }
              if (e.key === "Escape") {
                setNewCardTitle("");
                setAdding(false);
              }
            }}
            className="h-8 text-sm"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-7 text-xs bg-[#1E293B] hover:bg-[#1E293B]/90 text-white"
              onClick={() => {
                if (newCardTitle.trim()) {
                  onAddCard(newCardTitle.trim());
                  setNewCardTitle("");
                  setAdding(false);
                }
              }}
            >
              Adicionar
            </Button>
            <button
              onClick={() => {
                setNewCardTitle("");
                setAdding(false);
              }}
              className="h-7 w-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 text-xs text-[#4F46E5] hover:bg-indigo-50 font-medium px-4 py-3 border-t border-slate-200 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar processo
        </button>
      )}
    </div>
  );
}
