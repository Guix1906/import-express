import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { useActiveCompany } from "@/hooks/use-active-company";
import { useCompanyMembers } from "@/hooks/use-company-members";
import { createBoardWithDefaults } from "@/lib/boards.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Loader2, Check } from "lucide-react";

const BOARD_TYPES = [
  { value: "advogado", label: "Advogado" },
  { value: "estagiario", label: "Estagiário" },
  { value: "financeiro", label: "Financeiro" },
  { value: "administrativo", label: "Administrativo" },
  { value: "coordenacao", label: "Coordenação" },
];

const COLOR_THEMES = [
  { key: "violet", label: "Violeta", gradient: "from-violet-600 via-purple-600 to-fuchsia-600" },
  { key: "blue", label: "Azul", gradient: "from-blue-600 via-indigo-600 to-sky-600" },
  { key: "emerald", label: "Esmeralda", gradient: "from-emerald-500 via-teal-500 to-cyan-500" },
  { key: "amber", label: "Âmbar", gradient: "from-orange-500 via-amber-500 to-yellow-500" },
  { key: "rose", label: "Rosa", gradient: "from-pink-500 via-rose-500 to-fuchsia-500" },
  { key: "slate", label: "Grafite", gradient: "from-slate-700 via-slate-800 to-zinc-900" },
];

const EMOJIS = ["⚖️", "📂", "💼", "📊", "🏛️", "📑", "🔍", "💰", "📌", "🎯", "🚀", "✨"];

export function CreateBoardDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const { companyId } = useActiveCompany();
  const { members } = useCompanyMembers(companyId);
  const createBoard = useServerFn(createBoardWithDefaults);
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [boardType, setBoardType] = useState("advogado");
  const [ownerId, setOwnerId] = useState<string>("");
  const [roleLabel, setRoleLabel] = useState("");
  const [color, setColor] = useState("blue");
  const [emoji, setEmoji] = useState("⚖️");

  const reset = () => {
    setName("");
    setDescription("");
    setBoardType("advogado");
    setOwnerId("");
    setRoleLabel("");
    setColor("blue");
    setEmoji("⚖️");
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Sessão inválida");
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Informe o nome do quadro");
      if (trimmed.length > 80) throw new Error("Nome muito longo (máx 80)");

      const theme = COLOR_THEMES.find((t) => t.key === color) ?? COLOR_THEMES[1];

      const board = await createBoard({
        data: {
          companyId,
          name: trimmed,
          description: description.trim() || null,
          boardType,
          color,
          gradient: theme.gradient,
          icon: emoji,
          ownerId: ownerId || user.id,
          roleLabel: roleLabel.trim() || null,
        },
      });

      return board;
    },
    onSuccess: () => {
      toast.success("Quadro criado com sucesso");
      qc.invalidateQueries({ queryKey: ["boards"] });
      qc.invalidateQueries({ queryKey: ["meu-quadro-boards"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao criar quadro"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Criar novo quadro</DialogTitle>
          <DialogDescription>
            Quadros podem representar pessoas, equipes ou departamentos do escritório.
          </DialogDescription>
        </DialogHeader>

        {/* Preview */}
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br shadow-xl",
            COLOR_THEMES.find((t) => t.key === color)?.gradient,
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20" />
          <div className="relative flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl">
              {emoji}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-lg truncate">
                {name.trim() || "Nome do quadro"}
              </div>
              <div className="text-xs text-white/80 truncate">
                {roleLabel.trim() || BOARD_TYPES.find((t) => t.value === boardType)?.label}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome do quadro *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Quadro Cível, João Silva..."
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={boardType} onValueChange={setBoardType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOARD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select value={ownerId || (user?.id ?? "")} onValueChange={setOwnerId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    members.length === 0 ? "Carregando membros..." : "Selecione um responsável"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {members.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Nenhum membro encontrado
                  </div>
                ) : (
                  members.map((m) => {
                    const name = m.full_name ?? "Membro";
                    const initials =
                      name
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((s) => s[0]?.toUpperCase() ?? "")
                        .join("") || "?";
                    return (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center">
                            {initials}
                          </div>
                          <span>
                            {name}
                            {m.user_id === user?.id && (
                              <span className="text-xs text-muted-foreground ml-1">(você)</span>
                            )}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cargo</Label>
            <Input
              value={roleLabel}
              onChange={(e) => setRoleLabel(e.target.value)}
              placeholder="Ex: Advogado Sênior"
              maxLength={60}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Para que serve este quadro?"
              maxLength={500}
              rows={2}
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Cor / Tema</Label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {COLOR_THEMES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setColor(t.key)}
                  className={cn(
                    "relative h-12 rounded-lg bg-gradient-to-br shadow-sm transition-all",
                    t.gradient,
                    color === t.key
                      ? "ring-2 ring-offset-2 ring-primary scale-105"
                      : "hover:scale-105",
                  )}
                  title={t.label}
                >
                  {color === t.key && (
                    <Check className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Ícone</Label>
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "h-10 rounded-lg border bg-background text-xl transition-all hover:bg-accent",
                    emoji === e && "ring-2 ring-primary border-primary",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !name.trim()}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar Quadro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
