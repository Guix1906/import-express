import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar as CalendarIcon, Search, Tag as TagIcon, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { id: "todo", label: "A fazer" },
  { id: "in_progress", label: "Em andamento" },
  { id: "done", label: "Concluído" },
  { id: "cancelled", label: "Cancelado" },
] as const;

const PRIORITY_OPTIONS = [
  { id: "low", label: "Baixa" },
  { id: "medium", label: "Média" },
  { id: "high", label: "Alta" },
  { id: "urgent", label: "Urgente" },
] as const;

const taskSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Descreva a tarefa")
    .max(4000, "Descrição muito longa (máx. 4000)"),
  due_date: z.string().max(40).optional().or(z.literal("")),
  case_id: z.string().uuid().optional().or(z.literal("")),
  assigned_to: z.string().uuid({ message: "Selecione um responsável" }),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]),
});

type Form = z.infer<typeof taskSchema>;

const empty: Form = {
  description: "",
  due_date: "",
  case_id: "",
  assigned_to: "",
  priority: "low",
  status: "todo",
};

type ExistingTask = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  case_id: string | null;
  assigned_to: string | null;
  priority: Form["priority"];
  status: Form["status"];
};

export function QuickAddTaskDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task?: ExistingTask | null;
}) {
  const { user } = useAuth();
  const { companyId } = useActiveCompany();
  const qc = useQueryClient();
  const isEdit = !!task;
  const [form, setForm] = useState<Form>({ ...empty, assigned_to: user?.id ?? "" });
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    if (task) {
      setForm({
        description: task.description ?? task.title ?? "",
        due_date: task.due_date ? task.due_date.slice(0, 16) : "",
        case_id: task.case_id ?? "",
        assigned_to: task.assigned_to ?? user?.id ?? "",
        priority: task.priority,
        status: task.status,
      });
    } else {
      setForm({ ...empty, assigned_to: user?.id ?? "" });
    }
    setErrors({});
  }, [open, task, user?.id]);

  const { data: cases = [] } = useQuery({
    queryKey: ["cases-mini", companyId],
    enabled: !!companyId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("cases")
        .select("id, title")
        .eq("company_id", companyId!)
        .order("title");
      return data ?? [];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members-mini", companyId],
    enabled: !!companyId && open,
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

  const create = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Empresa não selecionada");

      const result = taskSchema.safeParse(form);
      if (!result.success) {
        const errs: Record<string, boolean> = {};
        for (const issue of result.error.issues) {
          if (issue.path[0]) errs[String(issue.path[0])] = true;
        }
        setErrors(errs);
        const first = result.error.issues[0]?.message ?? "Preencha os campos obrigatórios";
        throw new Error(first);
      }
      setErrors({});
      const data = result.data;

      const payload = {
        title: data.description.slice(0, 120),
        description: data.description,
        priority: data.priority,
        status: data.status,
        due_date: data.due_date ? new Date(data.due_date).toISOString() : null,
        case_id: data.case_id || null,
        assigned_to: data.assigned_to,
      };
      if (isEdit && task) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", task.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").insert({
          company_id: companyId,
          created_by: user.id,
          ...payload,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Tarefa atualizada" : "Tarefa adicionada");
      setForm({ ...empty, assigned_to: user?.id ?? "" });
      setErrors({});
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["tasks-kanban"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const fieldLabel = (txt: string, required = false) => (
    <Label className="text-xs font-medium text-foreground/80">
      {txt}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        {/* Accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" aria-hidden />
        <div className="pl-6 pr-5 pt-5 pb-4">
          <DialogHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <DialogTitle className="text-lg">
                {isEdit ? "Editar tarefa" : "Adicionar tarefa"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Preencha os campos para {isEdit ? "atualizar a" : "criar uma nova"} tarefa.
              </DialogDescription>
            </div>
            <button
              className="text-muted-foreground hover:text-foreground transition"
              title="Tags"
              type="button"
            >
              <TagIcon className="h-4 w-4" />
            </button>
          </DialogHeader>

          <div className="grid gap-4 mt-5">
            {/* Descrição */}
            <div className="space-y-1.5">
              {fieldLabel("Descrição da tarefa", true)}
              <Textarea
                rows={3}
                autoFocus
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Digite a descrição da tarefa"
                className={cn(
                  errors.description && "border-destructive focus-visible:ring-destructive/30",
                )}
              />
            </div>

            {/* Data + Lista (Coluna) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                {fieldLabel("Data")}
                <div className="relative">
                  <Input
                    type="datetime-local"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  />
                  <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                {fieldLabel("Lista de tarefas", true)}
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as Form["status"] })}
                >
                  <SelectTrigger
                    className={cn(errors.status && "border-destructive focus:ring-destructive/30")}
                  >
                    <SelectValue placeholder="Lista de tarefas" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => toast.info("Em breve: criação de listas personalizadas")}
                >
                  Criar nova lista
                </button>
              </div>
            </div>

            {/* Processo */}
            <div className="space-y-1.5">
              {fieldLabel("Processo, caso ou atendimento")}
              <div className="relative">
                <Select
                  value={form.case_id || "__none"}
                  onValueChange={(v) => setForm({ ...form, case_id: v === "__none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Encontre um processo, caso ou atendimento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Nenhum</SelectItem>
                    {cases.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Search className="absolute right-9 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Responsável + Prioridade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                {fieldLabel("Responsável", true)}
                <Select
                  value={form.assigned_to || "__none"}
                  onValueChange={(v) => setForm({ ...form, assigned_to: v === "__none" ? "" : v })}
                >
                  <SelectTrigger
                    className={cn(
                      errors.assigned_to && "border-destructive focus:ring-destructive/30",
                    )}
                  >
                    <SelectValue placeholder="Selecione um responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name ?? "Sem nome"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  onClick={() => toast.info("Em breve: convidar mais responsáveis")}
                >
                  <UserPlus className="h-3 w-3" /> Envolver mais pessoas
                </button>
              </div>
              <div className="space-y-1.5">
                {fieldLabel("Prioridade", true)}
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm({ ...form, priority: v as Form["priority"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quadro / Coluna do Kanban */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                {fieldLabel("Quadro do Kanban", true)}
                <Select value="default" onValueChange={() => {}}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Kanban principal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                {fieldLabel("Coluna do Kanban", true)}
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as Form["status"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 -mx-1 sm:-mx-0">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="uppercase tracking-wide"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending}
              variant="ghost"
              className="text-primary hover:text-primary uppercase tracking-wide font-semibold"
            >
              {create.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
