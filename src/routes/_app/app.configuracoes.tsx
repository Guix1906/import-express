import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, User, Building2, Shield, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/app/configuracoes")({
  component: ConfiguracoesPage,
});

const UF = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

function ConfiguracoesPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Configurações"
        subtitle="Gerencie seu perfil, escritório e preferências de segurança."
      />
      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="perfil" className="gap-2">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="escritorio" className="gap-2">
            <Building2 className="h-4 w-4" />
            Escritório
          </TabsTrigger>
          <TabsTrigger value="seguranca" className="gap-2">
            <Shield className="h-4 w-4" />
            Segurança
          </TabsTrigger>
          <TabsTrigger value="preferencias" className="gap-2">
            <Settings className="h-4 w-4" />
            Preferências
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfil">
          <PerfilTab />
        </TabsContent>
        <TabsContent value="escritorio">
          <EscritorioTab />
        </TabsContent>
        <TabsContent value="seguranca">
          <SegurancaTab />
        </TabsContent>
        <TabsContent value="preferencias">
          <PreferenciasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-soft">
      <div className="mb-4">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

/* ---------------- PERFIL ---------------- */
function PerfilTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, oab_number, oab_state, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [fullName, setFullName] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [oabState, setOabState] = useState<string>("");

  useEffect(() => {
    if (data) {
      setFullName(data.full_name ?? "");
      setOabNumber(data.oab_number ?? "");
      setOabState(data.oab_state ?? "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = fullName.trim();
      if (!trimmed) throw new Error("Nome é obrigatório");
      if (trimmed.length > 120) throw new Error("Nome muito longo");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: trimmed,
          oab_number: oabNumber.trim() || null,
          oab_state: oabState || null,
        })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <Card title="Informações pessoais" description="Como você aparece para a equipe.">
      <div className="grid gap-4">
        <div>
          <Label>E-mail</Label>
          <Input value={user?.email ?? ""} disabled className="mt-1.5" />
          <p className="text-xs text-muted-foreground mt-1">O e-mail não pode ser alterado aqui.</p>
        </div>
        <div>
          <Label>Nome completo *</Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1.5"
            maxLength={120}
          />
        </div>
        <div className="grid grid-cols-[1fr_140px] gap-3">
          <div>
            <Label>OAB (número)</Label>
            <Input
              value={oabNumber}
              onChange={(e) => setOabNumber(e.target.value)}
              className="mt-1.5"
              maxLength={20}
              placeholder="123456"
            />
          </div>
          <div>
            <Label>UF</Label>
            <Select value={oabState} onValueChange={setOabState}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                {UF.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar perfil
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- ESCRITÓRIO ---------------- */
function EscritorioTab() {
  const { companyId } = useActiveCompany();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["company", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, slug, created_at")
        .eq("id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [name, setName] = useState("");
  useEffect(() => {
    if (data) setName(data.name ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Nome do escritório é obrigatório");
      if (trimmed.length > 200) throw new Error("Nome muito longo");
      const { error } = await supabase
        .from("companies")
        .update({ name: trimmed })
        .eq("id", companyId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escritório atualizado");
      qc.invalidateQueries({ queryKey: ["company"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <Card
      title="Dados do escritório"
      description="Apenas proprietários e administradores podem alterar."
    >
      <div className="grid gap-4">
        <div>
          <Label>Nome do escritório *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5"
            maxLength={200}
          />
        </div>
        <div>
          <Label>ID do escritório</Label>
          <Input value={data?.id ?? ""} disabled className="mt-1.5 font-mono text-xs" />
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar escritório
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- SEGURANÇA ---------------- */
function SegurancaTab() {
  const { signOut } = useAuth();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const change = useMutation({
    mutationFn: async () => {
      if (pwd.length < 8) throw new Error("Senha deve ter ao menos 8 caracteres");
      if (pwd !== confirm) throw new Error("As senhas não coincidem");
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Senha alterada");
      setPwd("");
      setConfirm("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card title="Alterar senha" description="Use ao menos 8 caracteres com letras e números.">
        <div className="grid gap-4">
          <div>
            <Label>Nova senha</Label>
            <Input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="mt-1.5"
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label>Confirmar nova senha</Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1.5"
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => change.mutate()}
              disabled={change.isPending || !pwd}
              className="gap-2"
            >
              {change.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              Alterar senha
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Sessão" description="Encerre sua sessão em todos os dispositivos.">
        <Button
          variant="outline"
          onClick={async () => {
            await signOut();
            toast.success("Sessão encerrada");
          }}
        >
          Sair de todos os dispositivos
        </Button>
      </Card>
    </div>
  );
}

/* ---------------- PREFERÊNCIAS ---------------- */
function PreferenciasTab() {
  return (
    <Card
      title="Preferências"
      description="Mais opções em breve: tema, idioma e notificações por e-mail."
    >
      <p className="text-sm text-muted-foreground">
        Você pode alternar entre tema claro/escuro pelo botão na barra superior.
      </p>
    </Card>
  );
}
