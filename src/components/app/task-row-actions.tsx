import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { addDays, nextMonday, startOfDay } from "date-fns";
import { Calendar, Pencil, Search, Tag as TagIcon, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { deleteTask } from "@/lib/tasks.functions";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { QuickAddTaskDialog } from "./quick-add-task";
import { cn } from "@/lib/utils";

const LABEL_COLORS = [
  { name: "Vermelho", value: "red", className: "bg-red-500" },
  { name: "Laranja", value: "orange", className: "bg-orange-500" },
  { name: "Amarelo", value: "yellow", className: "bg-yellow-400" },
  { name: "Verde", value: "green", className: "bg-emerald-500" },
  { name: "Azul", value: "blue", className: "bg-blue-500" },
  { name: "Roxo", value: "purple", className: "bg-purple-500" },
  { name: "Rosa", value: "pink", className: "bg-pink-500" },
  { name: "Cinza", value: "gray", className: "bg-slate-500" },
];

export type TaskRowTask = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  case_id: string | null;
  assigned_to: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "todo" | "in_progress" | "done" | "cancelled";
  tags?: string[] | null;
};

function ActionBtn({
  title,
  onClick,
  children,
  className,
}: {
  title: string;
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TaskRowActions({ task }: { task: TaskRowTask }) {
  const { companyId } = useActiveCompany();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [tagQuery, setTagQuery] = useState("");
  const [tagColor, setTagColor] = useState<string>("blue");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["tasks-kanban"] });
    qc.invalidateQueries({ queryKey: ["my-activities-tasks"] });
  };

  const { data: members = [] } = useQuery({
    queryKey: ["members-mini", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: m } = await supabase
        .from("company_members")
        .select("user_id")
        .eq("company_id", companyId!);
      const ids = (m ?? []).map((x) => x.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      return profiles ?? [];
    },
  });

  const filteredMembers = members.filter((m: any) =>
    (m.full_name ?? "").toLowerCase().includes(memberQuery.toLowerCase()),
  );

  const assignMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ assigned_to: userId })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Responsável atualizado");
      invalidate();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const tagMutation = useMutation({
    mutationFn: async (newTags: string[]) => {
      const { error } = await supabase.from("tasks").update({ tags: newTags }).eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Etiquetas atualizadas");
      invalidate();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const dueMutation = useMutation({
    mutationFn: async (date: Date | null) => {
      const { error } = await supabase
        .from("tasks")
        .update({ due_date: date ? date.toISOString() : null })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prazo atualizado");
      invalidate();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const deleteTaskFn = useServerFn(deleteTask);
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteTaskFn({ data: { id: task.id } });
    },
    onSuccess: () => {
      toast.success("Tarefa excluída");
      invalidate();
      setDeleteOpen(false);
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const currentTags = task.tags ?? [];
  const addTag = () => {
    const name = tagQuery.trim();
    if (!name) return;
    const value = `${tagColor}:${name}`;
    if (currentTags.includes(value)) return;
    tagMutation.mutate([...currentTags, value]);
    setTagQuery("");
  };
  const removeTag = (t: string) => tagMutation.mutate(currentTags.filter((x) => x !== t));

  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      {/* 1. Responsável */}
      <Popover>
        <PopoverTrigger asChild>
          <ActionBtn title="Encontrar responsável">
            <Search className="h-4 w-4" />
          </ActionBtn>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-2">
          <Input
            autoFocus
            placeholder="Pesquisar responsável"
            value={memberQuery}
            onChange={(e) => setMemberQuery(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="mt-2 max-h-56 overflow-auto">
            {filteredMembers.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground">Nenhum membro</p>
            )}
            {filteredMembers.map((m: any) => (
              <button
                key={m.id}
                type="button"
                onClick={() => assignMutation.mutate(m.id)}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted"
              >
                <span className="truncate">{m.full_name ?? "Sem nome"}</span>
                {task.assigned_to === m.id && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* 2. Etiquetas */}
      <Popover>
        <PopoverTrigger asChild>
          <ActionBtn title="Encontrar uma etiqueta">
            <TagIcon className="h-4 w-4" />
          </ActionBtn>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Cor da etiqueta</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {LABEL_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.name}
                onClick={() => setTagColor(c.value)}
                className={cn(
                  "h-6 w-6 rounded-full transition-transform",
                  c.className,
                  tagColor === c.value && "ring-2 ring-offset-2 ring-ring scale-110",
                )}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            <Input
              placeholder="Nome da etiqueta"
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTag()}
              className="h-8 text-sm"
            />
            <button
              type="button"
              onClick={addTag}
              className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Adicionar
            </button>
          </div>
          {currentTags.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Etiquetas</p>
              <div className="flex flex-wrap gap-1.5">
                {currentTags.map((t) => {
                  const [color, ...rest] = t.split(":");
                  const name = rest.join(":") || t;
                  const meta = LABEL_COLORS.find((c) => c.value === color);
                  return (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs"
                    >
                      <span
                        className={cn("h-2 w-2 rounded-full", meta?.className ?? "bg-slate-400")}
                      />
                      {name}
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* 3. Reagendar */}
      <Popover>
        <PopoverTrigger asChild>
          <ActionBtn title="Reagendar">
            <Calendar className="h-4 w-4" />
          </ActionBtn>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1">
          {[
            {
              label: "Reagendar para amanhã",
              run: () => dueMutation.mutate(addDays(startOfDay(new Date()), 1)),
            },
            {
              label: "Reagendar para algum dia",
              run: () => dueMutation.mutate(addDays(startOfDay(new Date()), 7)),
            },
            {
              label: "Reagendar para próxima segunda",
              run: () => dueMutation.mutate(nextMonday(new Date())),
            },
            { label: "Retirar a data devida", run: () => dueMutation.mutate(null) },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={opt.run}
              className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              {opt.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* 4. Editar */}
      <ActionBtn title="Editar tarefa" onClick={() => setEditOpen(true)}>
        <Pencil className="h-4 w-4" />
      </ActionBtn>

      {/* 5. Excluir */}
      <ActionBtn
        title="Excluir tarefa"
        onClick={() => setDeleteOpen(true)}
        className="hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
      >
        <Trash2 className="h-4 w-4" />
      </ActionBtn>

      <QuickAddTaskDialog open={editOpen} onOpenChange={setEditOpen} task={task} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A tarefa "{task.title}" será removida
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
