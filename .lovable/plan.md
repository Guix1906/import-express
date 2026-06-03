
## Diagnóstico técnico (estado atual)

**O que já está bom (não precisa mexer):**
- Code-splitting automático do TanStack Start já está ativo — cada rota gera seu próprio chunk via Vite plugin. Não é necessário criar `.lazy.tsx` manualmente nem React.lazy.
- Cache global do React Query já está configurado em `src/router.tsx` com `staleTime: 5min` e `refetchOnWindowFocus: false`.
- Índices do banco estão **fortes**: `production_cards` tem 13 índices cobrindo `company_id`, `assignee_id`, `column_key`, `client_id`, `case_id`, `due_date`, `updated_at`, e composites para `(company_id, operational_status)` e `(company_id, legal_phase)`. Os índices propostos no pedido (`status`, `stage`, `assigned_to`, `created_by`, `due_date`, `completed_at`, `created_at`) ou já existem com nome equivalente, ou usam colunas que não existem (a tabela usa `assignee_id`, `operational_status`, `legal_phase`).
- Realtime é usado em apenas 2 rotas (`agenda`, `quadros/$id`) — não é a fonte do problema.

**Problemas reais encontrados:**

1. **Bundle-buster (alta prioridade)** — `src/routes/_app/app.kanban-processual.tsx` exporta `KanbanBoard`, que é importada por `app.kanban-operacional.tsx`. Isso quebra o auto code-splitting das duas rotas e infla o bundle inicial.
2. **Queries com refetch agressivo** — `use-company-members.tsx`, `app.documentos.tsx` e `CardDrawer.tsx` usam `staleTime: 0` + `refetchOnWindowFocus: true`. Toda vez que o usuário troca de aba o sistema refaz queries pesadas sem necessidade.
3. **`select("*")` em listas grandes** — `app.clientes.tsx`, `app.financeiro.tsx`, `app.documentos.tsx`, `app.atendimentos.tsx`, `app.triagem.tsx`. Carrega colunas que a UI não usa.
4. **Sem `limit()` em algumas listas** — `app.clientes.tsx`, `app.financeiro.tsx` podem trazer todos os registros da empresa.
5. **Arquivos de rota gigantes** — `publicacoes.tsx` (1388 linhas), `producao-escritorio.tsx` (1230), `meu-quadro.tsx` (1134). Pesa no parse/render do chunk, mas o impacto é menor que os 4 itens acima.
6. **Índices duplicados** — `production_cards` tem `idx_pc_assignee` e `idx_production_cards_assignee` (mesma coluna). Não atrapalha leitura, mas torna escritas mais caras.

## Escopo deste plano (foco no maior ganho/risco baixo)

Vou executar 5 frentes nesta rodada. Os outros itens do pedido (virtualização, divisão em 8 sub-componentes da Produção, otimização de gráficos, skeletons por bloco) entram como "próximos passos" para serem feitos em iterações dirigidas — refatorar 1.200 linhas de uma vez sem direção do usuário tem alto risco de quebrar comportamento.

### 1. Liberar code-splitting do Kanban
- Mover `KanbanBoard` de `app.kanban-processual.tsx` para `src/components/app/kanban-board.tsx`.
- `app.kanban-processual.tsx` e `app.kanban-operacional.tsx` passam a importar do novo arquivo.
- Resultado: as duas rotas viram chunks separados e nenhum delas é puxada no bundle inicial.

### 2. Ajustar cache nas queries quentes
- `use-company-members.tsx`: `staleTime: 5min`, `refetchOnWindowFocus: false`. Membros da empresa quase não mudam.
- `CardDrawer.tsx` (comentários/eventos): `staleTime: 30s` em vez de 0.
- `app.documentos.tsx`: `staleTime: 60s`, `refetchOnWindowFocus: false`.

### 3. Projeção de colunas + limites
- `app.clientes.tsx`: trocar `select("*")` por colunas usadas pela lista (`id, name, email, phone, document, client_type, city, created_at`) e adicionar `.limit(500)`.
- `app.financeiro.tsx`: idem para a tabela `financial_entries`.
- `app.documentos.tsx`: projeção de colunas + `.limit(500)`.
- `app.atendimentos.tsx`: projeção das colunas usadas + `.limit(500)`.

### 4. Atualização otimista no Meu Quadro (já existe parcialmente)
- Confirmar que `moveCard.mutate` em `meu-quadro.tsx` já faz `onMutate` com rollback (faz). Acrescentar `keepPreviousData` nas queries do quadro para evitar flash de skeleton ao trocar de membro.

### 5. Migration para remover índices duplicados
- Drop dos índices duplicados em `production_cards`, `cases`, `clients`, `tasks`, `events` (mantendo o mais antigo). Reduz custo de escrita e tamanho de tabela.

## Fora desta rodada (proponho como próximos passos dirigidos)

- Quebrar `producao-escritorio.tsx` nos 8 sub-componentes citados → 1 PR dedicado.
- Virtualização (`@tanstack/react-virtual`) em Kanban e listas → só vale a pena se você tiver coluna com 200+ cards; hoje o limite é 500 no total. Confirmar com volume real antes.
- Skeletons por bloco no dashboard de Produção → faço junto com a quebra do componente.
- Análise de bundle (`vite-bundle-visualizer`) e tree-shake de ícones lucide.
- Lazy-loading de avatares/imagens em listas.

## Relatório final
Depois da execução, devolvo: o que foi mudado por arquivo, queries impactadas, índices removidos, e instruções para você medir o ganho no DevTools (Network + Performance) — sem inventar números de "antes/depois" que não posso medir sem instrumentação real.

## Confirmação
Posso executar as 5 frentes acima? Se sim, eu rodo tudo e depois te entrego o relatório.
