import { confirmDialog } from "@/components/app/confirm-dialog";
import { createFileRoute, useNavigate, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Mail,
  Phone,
  Trash2,
  Building2,
  User as UserIcon,
  Search,
  ChevronLeft,
  ChevronRight,
  History,
  FileText,
  Calendar,
  CheckSquare,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveCompany } from "@/hooks/use-active-company";
import {
  createClientAdmin,
  deleteClientAdmin,
  listClientsAdmin,
} from "@/lib/core-persistence.functions";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/_app/app/clientes")({
  component: ClientesRoute,
});

type ClientType = "individual" | "company";

type Client = {
  id: string;
  name: string;
  client_type: ClientType;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

type HistoryCase = { id: string; title: string; status: string | null; created_at: string };
type HistoryTask = { id: string; title: string; status: string | null; due_date: string | null };
type HistoryEvent = { id: string; title: string; starts_at: string; event_type: string | null };

const PAGE_SIZE = 10;

// ---------- Document helpers ----------
const onlyDigits = (v: string) => v.replace(/\D/g, "");

const formatCPF = (v: string) =>
  onlyDigits(v)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

const formatCNPJ = (v: string) =>
  onlyDigits(v)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");

const formatPhone = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
      [a && `(${a}`, a && a.length === 2 ? ") " : "", b, c && `-${c}`].filter(Boolean).join(""),
    );
  return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
};

// ---------- Validation ----------
const baseSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120),
  client_type: z.enum(["individual", "company"]),
  document: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  address: z.string().trim().max(240).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

const emptyForm = {
  name: "",
  client_type: "individual" as ClientType,
  document: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
};

function ClientesRoute() {
  const location = useLocation();

  if (location.pathname !== "/app/clientes") {
    return <Outlet />;
  }

  return <ClientesPage />;
}

function ClientesPage() {
  const { user } = useAuth();
  const { companyId } = useActiveCompany();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listClientsFn = useServerFn(listClientsAdmin);
  const createClientFn = useServerFn(createClientAdmin);
  const deleteClientFn = useServerFn(deleteClientAdmin);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | ClientType>("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", companyId],
    enabled: !!companyId,
    staleTime: 60_000,
    queryFn: async () => {
      return (await listClientsFn({ data: { companyId: companyId! } })) as Client[];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return clients.filter((c) => {
      if (typeFilter !== "all" && c.client_type !== typeFilter) return false;
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        (c.email ?? "").toLowerCase().includes(term) ||
        (c.document ?? "").toLowerCase().includes(term) ||
        (c.phone ?? "").toLowerCase().includes(term)
      );
    });
  }, [clients, q, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Empresa não selecionada");
      const parsed = baseSchema.safeParse(form);
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.issues.forEach((i) => {
          errs[i.path[0] as string] = i.message;
        });
        setErrors(errs);
        throw new Error("Verifique os campos");
      }
      setErrors({});
      await createClientFn({
        data: {
          companyId,
          name: parsed.data.name,
          client_type: parsed.data.client_type,
          document: parsed.data.document || null,
          email: parsed.data.email || null,
          phone: parsed.data.phone || null,
          address: parsed.data.address || null,
          notes: parsed.data.notes || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Cliente criado com sucesso");
      setOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      await deleteClientFn({ data: { companyId, id } });
    },
    onSuccess: () => {
      toast.success("Cliente excluído");
      qc.invalidateQueries({ queryKey: ["clients"] });
      setDetail(null);
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  // ---------- Detail / History ----------
  const { data: history } = useQuery({
    queryKey: ["client-history", detail?.id],
    enabled: !!detail?.id,
    queryFn: async () => {
      const [cases, tasks, events] = await Promise.all([
        supabase
          .from("cases")
          .select("id,title,status,created_at")
          .eq("client_id", detail!.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("tasks")
          .select("id,title,status,due_date,case_id")
          .in(
            "case_id",
            (await supabase.from("cases").select("id").eq("client_id", detail!.id)).data?.map(
              (c) => c.id,
            ) ?? ["00000000-0000-0000-0000-000000000000"],
          ),
        supabase
          .from("events")
          .select("id,title,starts_at,event_type,case_id")
          .in(
            "case_id",
            (await supabase.from("cases").select("id").eq("client_id", detail!.id)).data?.map(
              (c) => c.id,
            ) ?? ["00000000-0000-0000-0000-000000000000"],
          ),
      ]);
      return {
        cases: cases.data ?? [],
        tasks: tasks.data ?? [],
        events: events.data ?? [],
      };
    },
  });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Clientes"
        subtitle="Gerencie pessoas físicas e jurídicas atendidas pelo escritório."
        actions={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) {
                setErrors({});
                setForm(emptyForm);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1.5" /> Novo cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Novo cliente</DialogTitle>
                <DialogDescription>Cadastre um novo cliente do escritório.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <Select
                      value={form.client_type}
                      onValueChange={(v) =>
                        setForm({ ...form, client_type: v as ClientType, document: "" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Pessoa física</SelectItem>
                        <SelectItem value="company">Pessoa jurídica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{form.client_type === "company" ? "CNPJ" : "CPF"}</Label>
                    <Input
                      value={form.document}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          document:
                            form.client_type === "company"
                              ? formatCNPJ(e.target.value)
                              : formatCPF(e.target.value),
                        })
                      }
                      placeholder={
                        form.client_type === "company" ? "00.000.000/0000-00" : "000.000.000-00"
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>
                    Nome <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={form.client_type === "company" ? "Razão social" : "Nome completo"}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="contato@exemplo.com"
                    />
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
                      placeholder="(11) 90000-0000"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Endereço</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Rua, número, cidade/UF"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Notas internas sobre o cliente"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                  {createMut.isPending ? "Salvando..." : "Salvar cliente"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, e-mail, documento..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v as typeof typeFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="individual">Pessoa física</SelectItem>
            <SelectItem value="company">Pessoa jurídica</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            q || typeFilter !== "all" ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"
          }
          description={
            q || typeFilter !== "all"
              ? "Ajuste a busca ou os filtros."
              : "Comece adicionando seu primeiro cliente."
          }
          action={
            <Button onClick={() => setOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1.5" /> Novo cliente
            </Button>
          }
        />
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-soft overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Cliente</th>
                  <th className="text-left font-medium px-4 py-2.5 hidden md:table-cell">
                    Documento
                  </th>
                  <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">
                    Contato
                  </th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paged.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate({ to: "/app/clientes/$id", params: { id: c.id } })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate({ to: "/app/clientes/$id", params: { id: c.id } });
                      }
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-md bg-primary-soft text-primary">
                          {c.client_type === "company" ? (
                            <Building2 className="h-4 w-4" />
                          ) : (
                            <UserIcon className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            to="/app/clientes/$id"
                            params={{ id: c.id }}
                            className="font-medium hover:text-primary hover:underline underline-offset-4 transition-colors block truncate"
                            title="Abrir detalhes do cliente"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {c.name}
                          </Link>
                          <Badge variant="secondary" className="text-[10px] mt-0.5">
                            {c.client_type === "company" ? "PJ" : "PF"}
                          </Badge>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground tabular-nums">
                      {c.document ?? "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        {c.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3" /> {c.email}
                          </div>
                        )}
                        {c.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3" /> {c.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          confirmDialog({
                            title: "Excluir cliente",
                            description: `Deseja realmente excluir ${c.name}? Esta ação não pode ser desfeita.`,
                            confirmText: "Excluir",
                          }).then((ok) => {
                            if (ok) deleteMut.mutate(c.id);
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>
              {filtered.length} {filtered.length === 1 ? "cliente" : "clientes"} • página{" "}
              {currentPage} de {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Drawer: detalhes & histórico */}
      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary-soft text-primary">
                    {detail.client_type === "company" ? (
                      <Building2 className="h-5 w-5" />
                    ) : (
                      <UserIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <SheetTitle>{detail.name}</SheetTitle>
                    <SheetDescription>
                      {detail.client_type === "company" ? "Pessoa jurídica" : "Pessoa física"}
                      {detail.document && ` • ${detail.document}`}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                <div className="grid gap-3 text-sm">
                  {detail.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" /> {detail.email}
                    </div>
                  )}
                  {detail.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" /> {detail.phone}
                    </div>
                  )}
                  {detail.address && <p className="text-muted-foreground">{detail.address}</p>}
                  {detail.notes && (
                    <div className="rounded-md bg-muted/40 p-3 text-muted-foreground whitespace-pre-wrap">
                      {detail.notes}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
                    <History className="h-4 w-4" /> Histórico
                  </h3>

                  <div className="space-y-4">
                    <HistorySection
                      icon={<FileText className="h-4 w-4" />}
                      title="Processos"
                      items={((history?.cases ?? []) as HistoryCase[]).map((c) => ({
                        id: c.id,
                        primary: c.title,
                        secondary: new Date(c.created_at).toLocaleDateString("pt-BR"),
                        badge: c.status ?? undefined,
                      }))}
                    />
                    <HistorySection
                      icon={<CheckSquare className="h-4 w-4" />}
                      title="Tarefas"
                      items={((history?.tasks ?? []) as HistoryTask[]).map((t) => ({
                        id: t.id,
                        primary: t.title,
                        secondary: t.due_date
                          ? new Date(t.due_date).toLocaleDateString("pt-BR")
                          : "Sem prazo",
                        badge: t.status ?? undefined,
                      }))}
                    />
                    <HistorySection
                      icon={<Calendar className="h-4 w-4" />}
                      title="Eventos"
                      items={((history?.events ?? []) as HistoryEvent[]).map((e) => ({
                        id: e.id,
                        primary: e.title,
                        secondary: new Date(e.starts_at).toLocaleString("pt-BR"),
                        badge: e.event_type ?? undefined,
                      }))}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      confirmDialog({
                        title: "Excluir cliente",
                        description: `Deseja realmente excluir ${detail.name}? Esta ação não pode ser desfeita.`,
                        confirmText: "Excluir",
                      }).then((ok) => {
                        if (ok) deleteMut.mutate(detail.id);
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" /> Excluir cliente
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function HistorySection({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: { id: string; primary: string; secondary: string; badge?: string }[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
        {icon} {title} <span className="ml-auto tabular-nums">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground/70 px-1">Nenhum registro.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 5).map((i) => (
            <li
              key={i.id}
              className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{i.primary}</p>
                <p className="text-xs text-muted-foreground">{i.secondary}</p>
              </div>
              {i.badge && (
                <Badge variant="secondary" className="text-[10px]">
                  {i.badge}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
