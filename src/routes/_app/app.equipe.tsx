import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users2,
  Shield,
  ShieldCheck,
  UserPlus,
  Trash2,
  Crown,
  Eye,
  Briefcase,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { inviteMemberByEmail, listCompanyTeamMembers } from "@/lib/team.functions";
import { useAuth } from "@/hooks/use-auth";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

export const Route = createFileRoute("/_app/app/equipe")({
  component: EquipePage,
});

type AppRole = "owner" | "admin" | "lawyer" | "assistant" | "viewer";

const ROLE_LABEL: Record<AppRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  lawyer: "Advogado",
  assistant: "Assistente",
  viewer: "Visualizador",
};

const ROLE_DESC: Record<AppRole, string> = {
  owner: "Acesso total. Único que pode excluir o escritório.",
  admin: "Gerencia equipe, contratos, financeiro e exclui registros.",
  lawyer: "Cria e edita processos, prazos, tarefas e atendimentos.",
  assistant: "Apoio operacional: agenda, tarefas e cadastros.",
  viewer: "Apenas visualização. Não pode editar.",
};

const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  owner: [
    "Acesso total ao escritório",
    "Gerencia equipe, permissões, financeiro e contratos",
    "Pode conceder perfil de proprietário",
  ],
  admin: [
    "Gerencia equipe, processos, contratos e financeiro",
    "Pode cadastrar membros, advogados e assistentes",
    "Não pode conceder perfil de proprietário",
  ],
  lawyer: [
    "Atende triagens atribuídas",
    "Cria e edita clientes, processos, prazos e tarefas",
    "Registra análise jurídica e produção",
  ],
  assistant: [
    "Cria triagens e cadastros operacionais",
    "Apoia agenda, documentos e tarefas",
    "Não altera análise jurídica",
  ],
  viewer: [
    "Visualiza informações permitidas do escritório",
    "Não cria, edita ou exclui registros",
    "Indicado para consulta e acompanhamento",
  ],
};

const ROLE_ICON: Record<AppRole, typeof Shield> = {
  owner: Crown,
  admin: ShieldCheck,
  lawyer: Briefcase,
  assistant: Users2,
  viewer: Eye,
};

const ROLE_STYLE: Record<AppRole, string> = {
  owner: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  admin: "bg-primary/10 text-primary border-primary/20",
  lawyer: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
  assistant: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  viewer: "bg-muted text-muted-foreground border-border",
};

type MemberRow = {
  user_id: string;
  full_name: string | null;
  roles: AppRole[];
};

function EquipePage() {
  const { companyId, role: activeRole } = useActiveCompany();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [inviteOpen, setInviteOpen] = useState(false);
  const listMembersFn = useServerFn(listCompanyTeamMembers);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team-members", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      return (await listMembersFn({ data: { companyId: companyId! } })) as MemberRow[];
    },
  });

  const myRoles = useMemo(() => {
    return members.find((m) => m.user_id === user?.id)?.roles ?? [];
  }, [members, user?.id]);
  const isAdmin =
    activeRole === "owner" ||
    activeRole === "admin" ||
    myRoles.includes("owner") ||
    myRoles.includes("admin");

  const stats = useMemo(() => {
    const c: Record<AppRole, number> = { owner: 0, admin: 0, lawyer: 0, assistant: 0, viewer: 0 };
    for (const m of members) for (const r of m.roles) c[r] = (c[r] ?? 0) + 1;
    return c;
  }, [members]);

  const addRoleMut = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { addCompanyRole } = await import("@/lib/team.functions");
      await addCompanyRole({
        data: { companyId: companyId!, targetUserId: userId, role },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["company-members"] });
      qc.invalidateQueries({ queryKey: ["quadros-members"] });
      toast.success("Cargo adicionado");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const removeRoleMut = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { removeCompanyRole } = await import("@/lib/team.functions");
      await removeCompanyRole({
        data: { companyId: companyId!, targetUserId: userId, role },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["company-members"] });
      qc.invalidateQueries({ queryKey: ["quadros-members"] });
      toast.success("Cargo removido");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const removeMemberMut = useMutation({
    mutationFn: async (userId: string) => {
      const { removeCompanyMember } = await import("@/lib/team.functions");
      await removeCompanyMember({
        data: { companyId: companyId!, targetUserId: userId },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["company-members"] });
      qc.invalidateQueries({ queryKey: ["quadros-members"] });
      toast.success("Membro removido");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const inviteFn = useServerFn(inviteMemberByEmail);
  const inviteMut = useMutation({
    mutationFn: async (input: { emails: string[]; role: AppRole; fullName?: string }) => {
      const results: { email: string; ok: boolean; action?: string; error?: string }[] = [];
      for (const email of input.emails) {
        try {
          const res = await inviteFn({
            data: {
              companyId: companyId!,
              email,
              role: input.role,
              fullName: input.fullName?.trim() || null,
            },
          });
          results.push({ email, ok: true, action: res.action });
        } catch (e: unknown) {
          results.push({
            email,
            ok: false,
            error: e instanceof Error ? e.message : "Erro desconhecido",
          });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["company-members"] });
      qc.invalidateQueries({ queryKey: ["quadros-members"] });
      const ok = results.filter((r) => r.ok);
      const fail = results.filter((r) => !r.ok);
      if (ok.length > 0) {
        const invited = ok.filter((r) => r.action === "invited").length;
        const added = ok.length - invited;
        const parts: string[] = [];
        if (invited > 0)
          parts.push(
            `${invited} convite${invited > 1 ? "s" : ""} enviado${invited > 1 ? "s" : ""}`,
          );
        if (added > 0) parts.push(`${added} adicionado${added > 1 ? "s" : ""}`);
        toast.success(parts.join(" · "));
      }
      if (fail.length > 0) {
        toast.error(`${fail.length} falha${fail.length > 1 ? "s" : ""}`, {
          description: fail.map((f) => `${f.email}: ${f.error}`).join("\n"),
        });
      }
      if (fail.length === 0) {
        setInviteOpen(false);
      }
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div>
      <PageHeader
        title="Equipe & Permissões"
        subtitle="Gerencie membros do escritório e seus níveis de acesso (RBAC)."
        actions={
          companyId ? (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" /> Cadastrar membro
                </Button>
              </DialogTrigger>
              <MemberDialog
                title="Adicionar membros à equipe"
                description="Adicione um ou vários e-mails para o mesmo cargo. Cada membro será convidado individualmente e receberá as permissões do perfil escolhido."
                submitLabel="Adicionar membro"
                onSubmit={(p) => inviteMut.mutate(p)}
                saving={inviteMut.isPending}
              />
            </Dialog>
          ) : null
        }
      />

      <div className="grid gap-4 grid-cols-2 md:grid-cols-5 mb-6">
        {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => {
          const Icon = ROLE_ICON[r];
          return (
            <div key={r} className="rounded-xl border bg-card p-4 shadow-soft">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center",
                    ROLE_STYLE[r],
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{ROLE_LABEL[r]}</p>
                  <p className="text-lg font-semibold tabular-nums">{stats[r] ?? 0}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          title="Sem membros"
          description="Adicione advogados e assistentes ao escritório."
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead>Cargos</TableHead>
                <TableHead className="w-[260px]">Adicionar cargo</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const isSelf = m.user_id === user?.id;
                const isOwner = m.roles.includes("owner");
                return (
                  <TableRow key={m.user_id}>
                    <TableCell
                      onClick={() => navigate({ to: "/app/equipe/$id", params: { id: m.user_id } })}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs">
                            {(m.full_name ?? "?")
                              .split(" ")
                              .map((s) => s[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">
                            {m.full_name ?? "Membro"}{" "}
                            {isSelf && (
                              <span className="text-xs text-muted-foreground">(você)</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {m.roles.length === 0 && (
                          <span className="text-xs text-muted-foreground">Sem cargo</span>
                        )}
                        {m.roles.map((r) => {
                          const Icon = ROLE_ICON[r];
                          return (
                            <Badge key={r} variant="outline" className={cn("gap-1", ROLE_STYLE[r])}>
                              <Icon className="h-3 w-3" />
                              {ROLE_LABEL[r]}
                              {isAdmin && r !== "owner" && (
                                <button
                                  onClick={() =>
                                    removeRoleMut.mutate({ userId: m.user_id, role: r })
                                  }
                                  className="ml-1 hover:text-rose-600"
                                  title="Remover cargo"
                                >
                                  ×
                                </button>
                              )}
                            </Badge>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select
                          onValueChange={(v) =>
                            addRoleMut.mutate({ userId: m.user_id, role: v as AppRole })
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Atribuir cargo..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(["admin", "lawyer", "assistant", "viewer"] as AppRole[])
                              .filter((r) => !m.roles.includes(r))
                              .map((r) => (
                                <SelectItem key={r} value={r}>
                                  <div className="flex flex-col">
                                    <span>{ROLE_LABEL[r]}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {ROLE_DESC[r]}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isAdmin && !isOwner && !isSelf && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" title="Remover do escritório">
                              <Trash2 className="h-4 w-4 text-rose-600" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Remover {m.full_name ?? "membro"}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                O membro perderá acesso ao escritório. Esta ação pode ser revertida
                                adicionando-o novamente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeMemberMut.mutate(m.user_id)}>
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="mt-8 rounded-xl border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Como funciona o RBAC</p>
            <ul className="mt-1.5 space-y-1 text-muted-foreground">
              {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => (
                <li key={r}>
                  <strong className="text-foreground">{ROLE_LABEL[r]}:</strong> {ROLE_DESC[r]}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Para adicionar alguém, o usuário precisa primeiro ter conta na plataforma. Use o ID do
              usuário (UUID) ou peça para que ele se cadastre antes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InviteDialog({
  onSubmit,
  saving,
  title = "Adicionar membro a equipe",
  description = "Cadastre ou convide um membro e defina exatamente o perfil de acesso RBAC que ele tera no escritorio.",
  defaultRole = "lawyer",
  submitLabel = "Adicionar membro",
}: {
  onSubmit: (p: { emails: string[]; role: AppRole; fullName?: string }) => void;
  saving: boolean;
  title?: string;
  description?: string;
  defaultRole?: AppRole;
  submitLabel?: string;
}) {
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>(defaultRole);

  const isValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const addEmails = (raw: string) => {
    const parts = raw
      .split(/[\s,;\n]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const valid = parts.filter(isValid);
    const invalid = parts.filter((p) => !isValid(p));
    if (invalid.length)
      toast.error(`Inválido${invalid.length > 1 ? "s" : ""}: ${invalid.join(", ")}`);
    if (valid.length) {
      setEmails((prev) => Array.from(new Set([...prev, ...valid])));
    }
    setEmailInput("");
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === " " || e.key === "Tab") {
      if (emailInput.trim()) {
        e.preventDefault();
        addEmails(emailInput);
      }
    } else if (e.key === "Backspace" && !emailInput && emails.length > 0) {
      setEmails((prev) => prev.slice(0, -1));
    }
  };

  const submit = () => {
    const all = emailInput.trim()
      ? Array.from(
          new Set([
            ...emails,
            ...emailInput
              .split(/[\s,;\n]+/)
              .map((s) => s.trim().toLowerCase())
              .filter(isValid),
          ]),
        )
      : emails;
    if (all.length === 0) {
      toast.error("Informe ao menos um e-mail válido");
      return;
    }
    onSubmit({ emails: all, role, fullName: fullName.trim() || undefined });
  };

  return (
    <DialogContent className="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>Adicionar membros à equipe</DialogTitle>
        <DialogDescription>
          Adicione um ou vários e-mails para o mesmo cargo. Use Enter, vírgula ou ponto-e-vírgula
          para separar. Cada membro será convidado individualmente.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div>
          <Label htmlFor="invite-email">E-mails dos convidados</Label>
          <div className="min-h-[44px] flex flex-wrap gap-1.5 items-center rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
            <Mail className="h-4 w-4 text-muted-foreground ml-1" />
            {emails.map((e) => (
              <Badge key={e} variant="secondary" className="gap-1 pr-1">
                {e}
                <button
                  type="button"
                  onClick={() => setEmails((prev) => prev.filter((x) => x !== e))}
                  className="ml-1 rounded hover:bg-muted-foreground/20 px-1 text-xs"
                  aria-label={`Remover ${e}`}
                >
                  ×
                </button>
              </Badge>
            ))}
            <input
              id="invite-email"
              type="text"
              value={emailInput}
              onChange={(ev) => setEmailInput(ev.target.value)}
              onKeyDown={onKey}
              onBlur={() => emailInput.trim() && addEmails(emailInput)}
              onPaste={(ev) => {
                const text = ev.clipboardData.getData("text");
                if (/[\s,;\n]/.test(text)) {
                  ev.preventDefault();
                  addEmails(text);
                }
              }}
              placeholder={emails.length === 0 ? "advogado@escritorio.com.br" : ""}
              className="flex-1 min-w-[180px] bg-transparent outline-none text-sm py-1"
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {emails.length > 0
              ? `${emails.length} e-mail${emails.length > 1 ? "s" : ""} pronto${emails.length > 1 ? "s" : ""} para convite.`
              : "Pressione Enter ou vírgula para adicionar."}
          </p>
        </div>

        <div>
          <Label htmlFor="invite-name">Nome completo (opcional)</Label>
          <Input
            id="invite-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ex: Dra. Mariana Silva"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Aplicado apenas quando houver um único convidado novo.
          </p>
        </div>

        <div>
          <Label>Cargo para todos</Label>
          <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["admin", "lawyer", "assistant", "viewer"] as AppRole[]).map((r) => (
                <SelectItem key={r} value={r}>
                  <div className="flex flex-col">
                    <span>{ROLE_LABEL[r]}</span>
                    <span className="text-xs text-muted-foreground">{ROLE_DESC[r]}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Todos os e-mails receberão este cargo. Você pode ajustar individualmente depois.
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving || (emails.length === 0 && !isValid(emailInput))}>
          {saving
            ? "Enviando..."
            : emails.length > 1
              ? `Adicionar ${emails.length} membros`
              : "Adicionar membro"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function MemberDialog({
  onSubmit,
  saving,
  title = "Adicionar membros à equipe",
  description = "Adicione um ou vários e-mails para o mesmo cargo. Use Enter, vírgula ou ponto-e-vírgula para separar. Cada membro será convidado individualmente.",
  defaultRole = "lawyer",
  submitLabel = "Adicionar membro",
}: {
  onSubmit: (p: { emails: string[]; role: AppRole; fullName?: string }) => void;
  saving: boolean;
  title?: string;
  description?: string;
  defaultRole?: AppRole;
  submitLabel?: string;
}) {
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>(defaultRole);
  const SelectedIcon = ROLE_ICON[role];

  const isValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const addEmails = (raw: string) => {
    const parts = raw
      .split(/[\s,;\n]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const valid = parts.filter(isValid);
    const invalid = parts.filter((item) => !isValid(item));
    if (invalid.length) toast.error(`E-mail invalido: ${invalid.join(", ")}`);
    if (valid.length) setEmails((prev) => Array.from(new Set([...prev, ...valid])));
    setEmailInput("");
  };

  const submit = () => {
    const typed = emailInput
      .split(/[\s,;\n]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(isValid);
    const all = Array.from(new Set([...emails, ...typed]));
    if (all.length === 0) {
      toast.error("Informe ao menos um e-mail valido");
      return;
    }
    onSubmit({ emails: all, role, fullName: fullName.trim() || undefined });
  };

  return (
    <DialogContent className="sm:max-w-[620px]">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-5 py-2">
        <div>
          <Label htmlFor="member-email">E-mails dos convidados</Label>
          <div className="min-h-[44px] flex flex-wrap gap-1.5 items-center rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
            <Mail className="h-4 w-4 text-muted-foreground ml-1" />
            {emails.map((email) => (
              <Badge key={email} variant="secondary" className="gap-1 pr-1">
                {email}
                <button
                  type="button"
                  onClick={() => setEmails((prev) => prev.filter((item) => item !== email))}
                  className="ml-1 rounded px-1 text-xs hover:bg-muted-foreground/20"
                  aria-label={`Remover ${email}`}
                >
                  x
                </button>
              </Badge>
            ))}
            <input
              id="member-email"
              type="text"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              onKeyDown={(event) => {
                if (["Enter", ",", ";", "Tab"].includes(event.key) && emailInput.trim()) {
                  event.preventDefault();
                  addEmails(emailInput);
                }
              }}
              onBlur={() => emailInput.trim() && addEmails(emailInput)}
              placeholder={emails.length === 0 ? "advogado@escritorio.com.br" : ""}
              className="flex-1 min-w-[180px] bg-transparent outline-none text-sm py-1"
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Pressione Enter, vírgula ou ponto-e-vírgula para adicionar.
          </p>
        </div>

        <div>
          <Label htmlFor="member-name">Nome completo (opcional)</Label>
          <Input
            id="member-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Ex: Dra. Mariana Silva"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Aplicado apenas quando houver um único convidado novo.
          </p>
        </div>

        <div>
          <Label>Cargo para todos</Label>
          <Select value={role} onValueChange={(value) => setRole(value as AppRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["owner", "admin", "lawyer", "assistant", "viewer"] as AppRole[]).map((item) => {
                const Icon = ROLE_ICON[item];
                return (
                  <SelectItem key={item} value={item}>
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4" />
                      <div className="flex flex-col">
                        <span>{ROLE_LABEL[item]}</span>
                        <span className="text-xs text-muted-foreground">{ROLE_DESC[item]}</span>
                      </div>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Todos os e-mails receberão este cargo. Você pode ajustar individualmente depois.
          </p>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                ROLE_STYLE[role],
              )}
            >
              <SelectedIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">Permissões do perfil {ROLE_LABEL[role]}</p>
              <p className="mt-1 text-xs text-muted-foreground">{ROLE_DESC[role]}</p>
              <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                {ROLE_PERMISSIONS[role].map((permission) => (
                  <li key={permission} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{permission}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button onClick={submit} disabled={saving || (emails.length === 0 && !isValid(emailInput))}>
          {saving
            ? "Enviando..."
            : emails.length > 1
              ? `Adicionar ${emails.length} membros`
              : submitLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
