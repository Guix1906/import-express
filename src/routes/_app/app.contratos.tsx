import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  FileSignature,
  Search,
  Pencil,
  Trash2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  ExternalLink,
  Upload,
  X,
  Loader2,
  Play,
  Download,
  Briefcase,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { activateContractWithFinance } from "@/lib/contracts.functions";
import { createCaseFromContract } from "@/lib/process.functions";
import {
  deleteContractAdmin,
  listClientsAdmin,
  listContractsAdmin,
  saveContractAdmin,
} from "@/lib/core-persistence.functions";
import { generateSimpleContractPdf } from "@/lib/simple-contract-pdf";
import { Link } from "@tanstack/react-router";

import { toast } from "sonner";
import { format, parseISO, isBefore, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveCompany } from "@/hooks/use-active-company";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/app/contratos")({
  component: ContratosPage,
});

type ContractType = "honorarios" | "prestacao_servicos" | "consultoria" | "parceria" | "outro";
type ContractStatus =
  | "rascunho"
  | "ativo"
  | "pendente_assinatura"
  | "vencido"
  | "encerrado"
  | "cancelado";

type Contract = {
  id: string;
  title: string;
  contract_type: ContractType;
  client_id: string | null;
  case_id: string | null;
  counterparty: string | null;
  value: number | null;
  payment_terms: string | null;
  start_date: string | null;
  end_date: string | null;
  signed_at: string | null;
  status: ContractStatus;
  file_url: string | null;
  notes: string | null;
};

const TYPE_LABEL: Record<ContractType, string> = {
  honorarios: "Honorários",
  prestacao_servicos: "Prestação de serviços",
  consultoria: "Consultoria",
  parceria: "Parceria",
  outro: "Outro",
};

const STATUS_LABEL: Record<ContractStatus, string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  pendente_assinatura: "Aguardando assinatura",
  vencido: "Vencido",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

const STATUS_STYLE: Record<ContractStatus, string> = {
  rascunho: "bg-muted text-muted-foreground border-border",
  ativo: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  pendente_assinatura: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  vencido: "bg-rose-500/10 text-rose-700 border-rose-500/20",
  encerrado: "bg-slate-500/10 text-slate-700 border-slate-500/20",
  cancelado: "bg-muted text-muted-foreground border-border",
};

const fmtBRL = (v: number | null) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function ContratosPage() {
  const { companyId } = useActiveCompany();
  const { canEditFinance } = usePermissions();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ContractStatus>("all");
  const [editing, setEditing] = useState<Contract | null>(null);
  const [open, setOpen] = useState(false);
  const [activating, setActivating] = useState<Contract | null>(null);
  const [creatingCase, setCreatingCase] = useState<Contract | null>(null);
  const activateFn = useServerFn(activateContractWithFinance);
  const createCaseFn = useServerFn(createCaseFromContract);
  const listClientsFn = useServerFn(listClientsAdmin);
  const listContractsFn = useServerFn(listContractsAdmin);
  const saveContractFn = useServerFn(saveContractAdmin);
  const deleteContractFn = useServerFn(deleteContractAdmin);

  const { data: companyName = "" } = useQuery({
    queryKey: ["company-name", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("name")
        .eq("id", companyId!)
        .maybeSingle();
      return data?.name ?? "";
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      return listClientsFn({ data: { companyId: companyId! } });
    },
  });

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["contracts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      return (await listContractsFn({ data: { companyId: companyId! } })) as Contract[];
    },
  });

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [clients]);

  const kpis = useMemo(() => {
    const today = new Date();
    const in30 = addDays(today, 30);
    let ativos = 0;
    let pendentes = 0;
    let vencendo = 0;
    let valorAtivo = 0;
    for (const c of contracts) {
      if (c.status === "ativo") {
        ativos += 1;
        valorAtivo += Number(c.value ?? 0);
        if (c.end_date) {
          const ed = parseISO(c.end_date);
          if (ed >= today && ed <= in30) vencendo += 1;
        }
      }
      if (c.status === "pendente_assinatura") pendentes += 1;
    }
    return { ativos, pendentes, vencendo, valorAtivo };
  }, [contracts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      const cname = c.client_id ? (clientNameById.get(c.client_id) ?? "") : "";
      if (q && !`${c.title} ${c.counterparty ?? ""} ${cname}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [contracts, search, statusFilter, clientNameById]);

  const saveMut = useMutation({
    mutationFn: async (payload: Partial<Contract> & { id?: string }) => {
      if (!companyId) throw new Error("Empresa nao selecionada");
      await saveContractFn({ data: { ...payload, companyId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast.success(editing ? "Contrato atualizado" : "Contrato criado");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      if (!companyId) throw new Error("Empresa nao selecionada");
      await deleteContractFn({ data: { companyId, id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contrato excluído");
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  const activateMut = useMutation({
    mutationFn: async (input: {
      contractId: string;
      installments: number;
      firstDueDate: string;
    }) => {
      return activateFn({ data: input });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contrato ativado", {
        description:
          res.installments > 0
            ? `${res.installments} parcela(s) lançadas no financeiro.`
            : undefined,
      });
      setActivating(null);
    },
    onError: (e: Error) => toast.error("Falha ao ativar", { description: e.message }),
  });

  const createCaseMut = useMutation({
    mutationFn: async (input: {
      contractId: string;
      title: string;
      cnj_number?: string | null;
      court?: string | null;
      practice_area?: string | null;
      case_value?: number | null;
    }) => createCaseFn({ data: { ...input, generate_default_deadlines: true } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      toast.success("Processo criado e vinculado ao contrato");
      setCreatingCase(null);
    },
    onError: (e: Error) => toast.error("Falha ao criar processo", { description: e.message }),
  });

  const downloadPdf = (c: Contract) => {
    const cname = c.client_id ? (clientNameById.get(c.client_id) ?? null) : null;
    const doc = generateSimpleContractPdf({
      companyName,
      title: c.title,
      clientName: cname,
      counterparty: c.counterparty,
      contractType: TYPE_LABEL[c.contract_type],
      value: c.value,
      paymentTerms: c.payment_terms,
      startDate: c.start_date,
      endDate: c.end_date,
      signedAt: c.signed_at,
      notes: c.notes,
    });
    doc.save(`${c.title.replace(/[^\w.\- ]+/g, "_")}.pdf`);
  };

  return (
    <div>
      <PageHeader
        title="Contratos"
        subtitle="Gestão de contratos, vigência, assinatura e renovação."
        actions={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setEditing(null);
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Novo contrato
              </Button>
            </DialogTrigger>
            <ContractDialog
              contract={editing}
              clients={clients}
              onSubmit={(p) => saveMut.mutate(p)}
              saving={saveMut.isPending}
            />
          </Dialog>
        }
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <KpiCard
          icon={CheckCircle2}
          label="Ativos"
          value={String(kpis.ativos)}
          tone="text-emerald-600"
          bg="bg-emerald-500/10"
        />
        <KpiCard
          icon={Clock}
          label="Aguardando assinatura"
          value={String(kpis.pendentes)}
          tone="text-amber-600"
          bg="bg-amber-500/10"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Vencendo em 30 dias"
          value={String(kpis.vencendo)}
          tone="text-rose-600"
          bg="bg-rose-500/10"
        />
        <KpiCard
          icon={FileSignature}
          label="Valor ativo"
          value={fmtBRL(kpis.valorAtivo)}
          tone="text-primary"
          bg="bg-primary/10"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, cliente ou contraparte..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {(Object.keys(STATUS_LABEL) as ContractStatus[]).map((k) => (
              <SelectItem key={k} value={k}>
                {STATUS_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum contrato"
          description="Cadastre contratos de honorários, prestação de serviços e parcerias."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Novo contrato
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contrato</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cliente / Contraparte</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const overdue =
                  c.status === "ativo" && c.end_date && isBefore(parseISO(c.end_date), new Date());
                const effective: ContractStatus = overdue ? "vencido" : c.status;
                const cname = c.client_id
                  ? (clientNameById.get(c.client_id) ?? "—")
                  : (c.counterparty ?? "—");
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {c.title}
                      </div>
                      {c.signed_at && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Assinado em{" "}
                          {format(parseISO(c.signed_at), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{TYPE_LABEL[c.contract_type]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{cname}</TableCell>
                    <TableCell className="text-sm">
                      {c.start_date || c.end_date ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {c.start_date ? format(parseISO(c.start_date), "dd/MM/yy") : "—"}
                          {" → "}
                          {c.end_date ? format(parseISO(c.end_date), "dd/MM/yy") : "—"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {fmtBRL(c.value)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLE[effective]}>
                        {STATUS_LABEL[effective]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {c.file_url && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Abrir arquivo"
                            onClick={async () => {
                              const url = c.file_url!;
                              if (/^https?:\/\//i.test(url)) {
                                window.open(url, "_blank", "noreferrer");
                                return;
                              }
                              const { data, error } = await supabase.storage
                                .from("documents")
                                .createSignedUrl(url, 60);
                              if (error || !data?.signedUrl) {
                                toast.error("Não foi possível abrir o arquivo", {
                                  description: error?.message,
                                });
                                return;
                              }
                              window.open(data.signedUrl, "_blank", "noreferrer");
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Baixar PDF"
                          onClick={() => downloadPdf(c)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {canEditFinance &&
                          (c.status === "rascunho" || c.status === "pendente_assinatura") && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Ativar contrato"
                              onClick={() => setActivating(c)}
                            >
                              <Play className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                        {c.status === "ativo" &&
                          (c.case_id ? (
                            <Button size="icon" variant="ghost" title="Ver processo" asChild>
                              <Link to="/app/processos/$id" params={{ id: c.case_id }}>
                                <Briefcase className="h-4 w-4 text-primary" />
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Criar processo"
                              onClick={() => setCreatingCase(c)}
                            >
                              <Briefcase className="h-4 w-4 text-blue-600" />
                            </Button>
                          ))}
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Editar"
                          onClick={() => {
                            setEditing(c);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <Trash2 className="h-4 w-4 text-rose-600" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMut.mutate(c.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ActivateDialog
        contract={activating}
        onOpenChange={(v) => {
          if (!v) setActivating(null);
        }}
        onConfirm={(installments, firstDueDate) =>
          activating &&
          activateMut.mutate({ contractId: activating.id, installments, firstDueDate })
        }
        saving={activateMut.isPending}
      />

      <CreateCaseDialog
        contract={creatingCase}
        clientName={
          creatingCase?.client_id ? (clientNameById.get(creatingCase.client_id) ?? null) : null
        }
        onOpenChange={(v) => {
          if (!v) setCreatingCase(null);
        }}
        onConfirm={(p) =>
          creatingCase && createCaseMut.mutate({ contractId: creatingCase.id, ...p })
        }
        saving={createCaseMut.isPending}
      />
    </div>
  );
}

function CreateCaseDialog({
  contract,
  clientName,
  onOpenChange,
  onConfirm,
  saving,
}: {
  contract: Contract | null;
  clientName: string | null;
  onOpenChange: (v: boolean) => void;
  onConfirm: (p: {
    title: string;
    cnj_number?: string | null;
    court?: string | null;
    practice_area?: string | null;
    case_value?: number | null;
  }) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState("");
  const [cnj, setCnj] = useState("");
  const [court, setCourt] = useState("");
  const [area, setArea] = useState("");

  useEffect(() => {
    if (contract) {
      setTitle(`${contract.title}${clientName ? " — " + clientName : ""}`);
      setCnj("");
      setCourt("");
      setArea("");
    }
  }, [contract, clientName]);

  return (
    <Dialog
      open={!!contract}
      onOpenChange={(v) => {
        if (!v) {
          setTitle("");
          setCnj("");
          setCourt("");
          setArea("");
        }
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar processo a partir do contrato</DialogTitle>
          <DialogDescription>
            Um processo será criado vinculado a este contrato. Prazos iniciais serão gerados
            automaticamente conforme a área.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Título do processo</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nº CNJ</Label>
              <Input
                value={cnj}
                onChange={(e) => setCnj(e.target.value)}
                placeholder="0000000-00.0000.0.00.0000"
              />
            </div>
            <div>
              <Label>Área</Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="previdenciario">Previdenciário</SelectItem>
                  <SelectItem value="trabalhista">Trabalhista</SelectItem>
                  <SelectItem value="civel">Cível</SelectItem>
                  <SelectItem value="tributario">Tributário</SelectItem>
                  <SelectItem value="familia">Família</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Vara / Tribunal</Label>
            <Input value={court} onChange={(e) => setCourt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={saving || !title.trim()}
            onClick={() =>
              onConfirm({
                title: title.trim(),
                cnj_number: cnj.trim() || null,
                court: court.trim() || null,
                practice_area: area || null,
                case_value: contract?.value ?? null,
              })
            }
          >
            {saving ? "Criando..." : "Criar processo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActivateDialog({
  contract,
  onOpenChange,
  onConfirm,
  saving,
}: {
  contract: Contract | null;
  onOpenChange: (v: boolean) => void;
  onConfirm: (installments: number, firstDueDate: string) => void;
  saving: boolean;
}) {
  const [installments, setInstallments] = useState("1");
  const [firstDue, setFirstDue] = useState(() => new Date().toISOString().slice(0, 10));
  return (
    <Dialog open={!!contract} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ativar contrato</DialogTitle>
          <DialogDescription>
            O contrato será marcado como ativo e{" "}
            {contract?.value
              ? "as parcelas serão lançadas no financeiro."
              : "nenhuma parcela será gerada (sem valor)."}
          </DialogDescription>
        </DialogHeader>
        {contract?.value ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Parcelas</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
              />
            </div>
            <div>
              <Label>1º vencimento</Label>
              <Input type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={saving}
            onClick={() => onConfirm(Math.max(1, parseInt(installments || "1", 10)), firstDue)}
          >
            {saving ? "Ativando..." : "Ativar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
  bg,
}: {
  icon: typeof FileSignature;
  label: string;
  value: string;
  tone: string;
  bg: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", bg)}>
          <Icon className={cn("h-5 w-5", tone)} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn("text-lg font-semibold tabular-nums truncate", tone)}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function ContractDialog({
  contract,
  clients,
  onSubmit,
  saving,
}: {
  contract: Contract | null;
  clients: { id: string; name: string }[];
  onSubmit: (p: Partial<Contract> & { id?: string }) => void;
  saving: boolean;
}) {
  const { companyId } = useActiveCompany();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: contract?.title ?? "",
    contract_type: (contract?.contract_type ?? "honorarios") as ContractType,
    client_id: contract?.client_id ?? "",
    counterparty: contract?.counterparty ?? "",
    value: contract?.value != null ? String(contract.value) : "",
    payment_terms: contract?.payment_terms ?? "",
    start_date: contract?.start_date ?? "",
    end_date: contract?.end_date ?? "",
    signed_at: contract?.signed_at ?? "",
    status: (contract?.status ?? "rascunho") as ContractStatus,
    file_url: contract?.file_url ?? "",
    notes: contract?.notes ?? "",
  });

  const submit = () => {
    if (!form.title.trim()) {
      toast.error("Informe o título do contrato");
      return;
    }
    onSubmit({
      id: contract?.id,
      title: form.title.trim(),
      contract_type: form.contract_type,
      client_id: form.client_id || null,
      counterparty: form.counterparty.trim() || null,
      value: form.value ? Number(form.value) : null,
      payment_terms: form.payment_terms.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      signed_at: form.signed_at || null,
      status: form.status,
      file_url: form.file_url.trim() || null,
      notes: form.notes.trim() || null,
    });
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{contract ? "Editar contrato" : "Novo contrato"}</DialogTitle>
        <DialogDescription>Defina vigência, valor e status do contrato.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div>
          <Label>Título *</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ex: Contrato de honorários — Cliente X"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select
              value={form.contract_type}
              onValueChange={(v) => setForm({ ...form, contract_type: v as ContractType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABEL) as ContractType[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {TYPE_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as ContractStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABEL) as ContractStatus[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {STATUS_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Cliente</Label>
            <Select
              value={form.client_id || "none"}
              onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem cliente</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Contraparte</Label>
            <Input
              value={form.counterparty}
              onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
              placeholder="Outra parte do contrato"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </div>
          <div>
            <Label>Início</Label>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </div>
          <div>
            <Label>Fim</Label>
            <Input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Assinado em</Label>
            <Input
              type="date"
              value={form.signed_at}
              onChange={(e) => setForm({ ...form, signed_at: e.target.value })}
            />
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <Input
              value={form.payment_terms}
              onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
              placeholder="Ex: 12x de R$ 1.500"
            />
          </div>
        </div>
        <div>
          <Label>Arquivo do contrato (PDF / DOCX)</Label>
          {form.file_url ? (
            <div className="flex items-center gap-2 mt-1 p-2 rounded-md border bg-muted/30">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm truncate flex-1" title={form.file_url}>
                {/^https?:\/\//i.test(form.file_url)
                  ? form.file_url
                  : form.file_url.split("/").pop()}
              </span>
              {!/^https?:\/\//i.test(form.file_url) && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const { data, error } = await supabase.storage
                      .from("documents")
                      .createSignedUrl(form.file_url, 60);
                    if (error || !data?.signedUrl) {
                      toast.error("Não foi possível abrir", { description: error?.message });
                      return;
                    }
                    window.open(data.signedUrl, "_blank", "noreferrer");
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setForm({ ...form, file_url: "" })}
                title="Remover"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <label
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md border border-dashed cursor-pointer text-sm hover:bg-muted/50 transition-colors flex-1",
                  uploading && "opacity-60 pointer-events-none",
                )}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-muted-foreground">
                  {uploading ? "Enviando..." : "Anexar arquivo (até 20MB)"}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  disabled={uploading || !companyId || !user}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file || !companyId || !user) return;
                    if (file.size > 20 * 1024 * 1024) {
                      toast.error("Arquivo excede 20MB");
                      return;
                    }
                    setUploading(true);
                    const ext = file.name.split(".").pop() || "bin";
                    const safe = file.name.replace(/[^\w.-]+/g, "_");
                    const path = `contracts/${companyId}/${crypto.randomUUID()}-${safe}`.replace(
                      /_+/g,
                      "_",
                    );
                    const { error } = await supabase.storage.from("documents").upload(path, file, {
                      contentType: file.type || `application/${ext}`,
                      upsert: false,
                    });
                    setUploading(false);
                    if (error) {
                      toast.error("Falha no upload", { description: error.message });
                      return;
                    }
                    setForm((prev) => ({ ...prev, file_url: path }));
                    toast.success("Arquivo anexado");
                  }}
                />
              </label>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Ou cole um link externo abaixo (assinatura eletrônica, Drive, etc.)
          </p>
          <Input
            className="mt-1"
            value={/^https?:\/\//i.test(form.file_url) ? form.file_url : ""}
            onChange={(e) => setForm({ ...form, file_url: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <div>
          <Label>Observações</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
          />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
