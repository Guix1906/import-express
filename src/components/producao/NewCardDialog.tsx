import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ColumnKey, CompanyMemberLite, Priority } from "./types";

export function NewCardDialog({
  open,
  column,
  onClose,
  defaultAssignee,
  members,
  companyId,
  userId,
}: {
  open: boolean;
  column: ColumnKey | null;
  onClose: () => void;
  defaultAssignee: string;
  members: CompanyMemberLite[];
  companyId: string | null;
  userId: string;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [processNumber, setProcessNumber] = useState("");
  const [area, setArea] = useState("");
  const [priority, setPriority] = useState<Priority>("media");
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState(defaultAssignee);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setClientName("");
      setProcessNumber("");
      setArea("");
      setPriority("media");
      setDueDate("");
      setDescription("");
      setAssignee(defaultAssignee);
    }
  }, [open, defaultAssignee]);

  async function save() {
    if (!title.trim() || !assignee || !companyId) {
      toast.error("Preencha o título e o responsável");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("production_cards").insert({
      company_id: companyId,
      assignee_id: assignee,
      created_by: userId,
      title: title.trim(),
      client_name_snapshot: clientName.trim() || null,
      process_number: processNumber.trim() || null,
      practice_area: area.trim() || null,
      priority,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      description: description.trim() || null,
      column_key: column ?? "para_producao",
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao criar cartão");
      return;
    }
    toast.success("Cartão criado");
    qc.invalidateQueries({ queryKey: ["production-cards", companyId] });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo cartão</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Título *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cliente</label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nº Processo</label>
              <Input value={processNumber} onChange={(e) => setProcessNumber(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Área</label>
              <Input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Cível, Trabalhista..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Prazo</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Responsável *</label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name ?? "Membro"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Descrição</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Criar cartão"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
