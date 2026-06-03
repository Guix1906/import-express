import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { COLUMN_COLORS } from "./shared";

export function AddColumnButton({ onAdd }: { onAdd: (title: string, color: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState("slate");

  const submit = () => {
    const v = title.trim();
    if (!v) return;
    onAdd(v, color);
    setTitle("");
    setColor("slate");
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="min-w-[260px] w-[260px] shrink-0 h-[120px] rounded-2xl border-2 border-dashed border-slate-300 bg-white/40 hover:bg-white hover:border-[#4F46E5] hover:text-[#1E293B] text-slate-500 flex flex-col items-center justify-center gap-2 transition-all"
      >
        <div className="h-9 w-9 rounded-full bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center">
          <Plus className="h-4 w-4" />
        </div>
        <span className="text-xs font-semibold">Adicionar coluna</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova coluna</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da coluna</Label>
              <Input
                autoFocus
                placeholder="Ex.: Aguardando cliente"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLUMN_COLORS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setColor(opt.key)}
                    className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center transition-all hover:scale-110",
                      opt.dot,
                      color === opt.key && "ring-2 ring-offset-2 ring-slate-700",
                    )}
                    title={opt.label}
                  >
                    {color === opt.key && <Check className="h-4 w-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={!title.trim()}
              className="bg-[#1E293B] hover:bg-[#1E293B]/90 text-white"
            >
              Criar coluna
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
