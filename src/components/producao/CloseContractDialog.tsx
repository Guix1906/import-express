import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { closeContractFromCard } from "@/lib/triagem-flow.functions";
import { generateContractDocuments } from "@/lib/contract-pdf";
import { supabase } from "@/integrations/supabase/client";
import type { ProductionCard } from "./types";

export function CloseContractDialog({
  card,
  open,
  onOpenChange,
  companyId,
}: {
  card: ProductionCard;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string | null;
}) {
  const qc = useQueryClient();
  const closeFn = useServerFn(closeContractFromCard);
  const [saving, setSaving] = useState(false);
  const [contractType, setContractType] = useState<"administrativo" | "judicial">("administrativo");
  const [value, setValue] = useState("");
  const [hon, setHon] = useState("");
  const [rg, setRg] = useState("");
  const [marital, setMarital] = useState("");
  const [profession, setProfession] = useState("");
  const [address, setAddress] = useState("");
  const [birth, setBirth] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [genDocs, setGenDocs] = useState(true);

  async function submit() {
    if (!card.client_id) {
      toast.error("Cartão sem cliente vinculado");
      return;
    }
    if (!companyId) {
      toast.error("Empresa não identificada");
      return;
    }
    setSaving(true);
    try {
      // 1) Foto (se enviada) — bucket privado "client-photos"
      // Armazena o storage path; viewers geram signed URL on-demand.
      if (photoFile) {
        const ext = (photoFile.name.split(".").pop() ?? "jpg").toLowerCase();
        const key = `${companyId}/${card.client_id}_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("client-photos")
          .upload(key, photoFile, { upsert: true, contentType: photoFile.type });
        if (upErr) throw new Error(`Foto: ${upErr.message}`);
        await supabase
          .from("clients")
          .update({ photo_url: key } as never)
          .eq("id", card.client_id);
      }

      // 2) Server fn: promove cliente, cria contrato/financeiro/checklist, move card
      await closeFn({
        data: {
          cardId: card.id,
          clientId: card.client_id,
          contractType,
          contractValue: value ? Number(value) : undefined,
          honorarios: hon ? Number(hon) : undefined,
          clientUpdate: {
            rg: rg || null,
            marital_status: marital || null,
            profession: profession || null,
            address: address || null,
            birth_date: birth || null,
          },
        },
      });

      // 3) Geração dos PDFs (contrato + procuração) — opcional
      if (genDocs) {
        try {
          const { data: companyRow } = await supabase
            .from("companies")
            .select("name")
            .eq("id", companyId)
            .maybeSingle();
          const { data: userInfo } = await supabase.auth.getUser();
          await generateContractDocuments({
            companyId,
            companyName: companyRow?.name ?? "Escritório",
            clientId: card.client_id,
            cardId: card.id,
            clientName: card.client_name_snapshot ?? "Cliente",
            clientCpf: null,
            clientRg: rg || null,
            clientAddress: address || null,
            clientCity: null,
            clientMaritalStatus: marital || null,
            clientProfession: profession || null,
            contractType,
            contractValue: value ? Number(value) : null,
            honorarios: hon ? Number(hon) : null,
            benefitType: card.demand_type,
            userId: userInfo.user?.id ?? "",
          });
          toast.success("Contrato e procuração gerados");
        } catch (gErr) {
          const m = gErr instanceof Error ? gErr.message : "Erro";
          toast.warning(`Contrato fechado, mas falhou ao gerar PDFs: ${m}`);
        }
      }

      toast.success("Contrato fechado e cartão movido");
      qc.invalidateQueries({ queryKey: ["production-cards", companyId] });
      qc.invalidateQueries({ queryKey: ["card-checklist", card.id] });
      qc.invalidateQueries({ queryKey: ["card-documents", card.id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao fechar contrato";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fechar contrato — {card.client_name_snapshot ?? card.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo de contrato</Label>
              <Select
                value={contractType}
                onValueChange={(v) => setContractType(v as "administrativo" | "judicial")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrativo">Administrativo</SelectItem>
                  <SelectItem value="judicial">Judicial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor do contrato (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Honorários a receber (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={hon}
                onChange={(e) => setHon(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              Complemente os dados do cliente (opcional):
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">RG</Label>
                <Input value={rg} onChange={(e) => setRg(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Estado civil</Label>
                <Input value={marital} onChange={(e) => setMarital(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Profissão</Label>
                <Input value={profession} onChange={(e) => setProfession(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Data de nascimento</Label>
                <Input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Endereço completo</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Foto do cliente</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm pt-2 border-t cursor-pointer">
            <input
              type="checkbox"
              checked={genDocs}
              onChange={(e) => setGenDocs(e.target.checked)}
              className="h-4 w-4"
            />
            Gerar Contrato + Procuração em PDF automaticamente
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Fechando..." : "Fechar contrato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
