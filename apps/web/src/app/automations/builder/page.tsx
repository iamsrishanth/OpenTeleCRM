'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, Loader2, Save, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { LoadingScreen } from '@/components/loading'
import {
  extractWebhookSecret,
  WebhookSecretDialog,
} from '@/components/webhook-secret-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { PUBLIC_BASE } from '@/lib/config'
import type { AutomationRule } from '@/lib/types'
import { cn } from '@/lib/utils'
import CanvasNode, { NodeActionsProvider } from '@/components/builder/canvas-node'
import { compileRule, defaultNodeData, patchPayloadFromCompiled, ruleToGraph } from '@/components/builder/compile'
import { DND_MIME, Palette, type PaletteDropPayload } from '@/components/builder/palette'
import { PropertiesPanel } from '@/components/builder/properties-panel'
import type { BuilderFlowNode } from '@/components/builder/types'

const nodeTypes: NodeTypes = {
  trigger: CanvasNode,
  condition: CanvasNode,
  action: CanvasNode,
}

const NODE_ROW_GAP = 150

function BuilderPageInner() {
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const router = useRouter()
  const { isReady, token, enterpriseId } = useAuth()
  const { screenToFlowPosition } = useReactFlow()

  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderFlowNode>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [cron, setCron] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  // One-time webhook secret reveal — a webhook_received create returns the
  // HMAC secret exactly once; hold navigation until the operator saves it.
  const [secretReveal, setSecretReveal] = useState<{
    label: string
    secret: string
    name: string
  } | null>(null)

  const idCounter = useRef(0)

  // -------------------------------------------------------------------------
  // Load rule in edit mode (?id=) — GET /automations/:id, hydrate the canvas.
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isReady) return
    if (!token || !enterpriseId) {
      router.replace('/login')
      return
    }
    if (!editId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.get<{ data: AutomationRule }>(`/automations/${editId}`)
        const rule = data?.data
        if (!rule) throw new Error('Rule not found')
        if (cancelled) return
        setName(rule.name)
        setIsActive(rule.isActive)
        setCron(rule.schedule?.cron ?? '')
        setNodes(ruleToGraph(rule))
      } catch (err) {
        if (!cancelled) {
          setLoadError(true)
          toast.error(err instanceof Error ? err.message : 'Failed to load automation')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isReady, token, enterpriseId, editId, router, setNodes])

  // -------------------------------------------------------------------------
  // Node CRUD
  // -------------------------------------------------------------------------

  const addNode = useCallback(
    (payload: PaletteDropPayload, position?: { x: number; y: number }) => {
      const kind: BuilderFlowNode['data']['kind'] =
        payload.group === 'triggers'
          ? 'trigger'
          : payload.group === 'conditions'
            ? 'condition'
            : 'action'
      const id = `${kind}-${idCounter.current++}`
      const node: BuilderFlowNode = {
        id,
        type: kind,
        // Callers always pass an explicit position (drop coordinates or the
        // click-to-add cascade); this is a safe fallback.
        position: position ?? { x: 40, y: 40 + idCounter.current * NODE_ROW_GAP },
        data: defaultNodeData(kind, payload.value),
      }
      setNodes((nds) => [...nds, node])
      setSelectedId(id)
    },
    [setNodes],
  )

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id))
      setSelectedId((prev) => (prev === id ? null : prev))
    },
    [setNodes],
  )

  const updateNodeConfig = useCallback(
    (id: string, config: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, config } } : n)),
      )
    },
    [setNodes],
  )

  const clickAdd = useCallback(
    (payload: PaletteDropPayload) => {
      // Click-to-add fallback (HTML5 drag is flaky on some touch devices).
      // Stagger new nodes near the top-left so they never stack exactly.
      const n = idCounter.current
      addNode(payload, { x: 40 + (n % 3) * 32, y: 40 + Math.floor(n / 3) * 24 })
    },
    [addNode],
  )

  // -------------------------------------------------------------------------
  // Drag & drop (HTML5 native)
  // -------------------------------------------------------------------------

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const raw = e.dataTransfer.getData(DND_MIME)
      if (!raw) return
      try {
        const payload = JSON.parse(raw) as PaletteDropPayload
        addNode(payload, screenToFlowPosition({ x: e.clientX, y: e.clientY }))
      } catch {
        // malformed drag payload — ignore
      }
    },
    [addNode, screenToFlowPosition],
  )

  // -------------------------------------------------------------------------
  // Save — compile the canvas into the AutomationRule payload.
  // -------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error('Rule name is required')
      return
    }
    const triggerCount = nodes.filter((n) => n.data.kind === 'trigger').length
    const actionCount = nodes.filter((n) => n.data.kind === 'action').length
    if (triggerCount !== 1) {
      toast.error(
        triggerCount === 0
          ? 'Add exactly one trigger node'
          : 'Only one trigger node is allowed — remove the extra triggers',
      )
      return
    }
    if (actionCount === 0) {
      toast.error('Add at least one action node')
      return
    }

    const compiled = compileRule(nodes, { name, isActive, cron })
    setSaving(true)
    try {
      if (editId) {
        await api.patch(`/automations/${editId}`, patchPayloadFromCompiled(compiled))
        toast.success('Automation updated')
        router.push('/automations')
      } else {
        const res = await api.post<unknown>('/automations', compiled)
        const webhookSecret = extractWebhookSecret(res)
        if (webhookSecret) {
          // Show the one-time secret BEFORE leaving the page; onClose navigates.
          setSecretReveal({
            label: `Webhook secret for “${name.trim()}” (shown once)`,
            secret: webhookSecret,
            name: name.trim(),
          })
          toast.success('Automation created — save the webhook secret')
          return
        }
        toast.success('Automation created')
        router.push('/automations')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save automation')
    } finally {
      setSaving(false)
    }
  }, [name, nodes, isActive, cron, editId, router])

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  )

  // -------------------------------------------------------------------------
  // States
  // -------------------------------------------------------------------------

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  if (loading) {
    return <LoadingScreen label={editId ? 'Loading automation…' : 'Preparing canvas…'} />
  }

  if (loadError) {
    return (
      <AppShell>
        <div className="flex h-full min-h-64 flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm font-medium text-foreground">Could not load this automation</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            The rule may have been deleted, or the API is unreachable. Head back to the
            automations list and try again.
          </p>
          <Link href="/automations">
            <Button variant="outline" size="sm">
              <ArrowLeft className="size-3.5" /> Back to automations
            </Button>
          </Link>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col gap-4">
        {/* Header: name, active toggle, schedule, save */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <Link
              href="/automations"
              className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-ring/60 hover:text-foreground"
              title="Back to automations"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <Workflow className="size-4 text-primary" />
                {editId ? 'Edit automation' : 'New automation'}
              </h1>
              <p className="text-sm text-muted-foreground">
                Drag nodes onto the canvas. Top-to-bottom, left-to-right order becomes execution order.
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="rule-name" className="text-xs text-muted-foreground">
                Rule name
              </Label>
              <Input
                id="rule-name"
                className="h-8 w-56"
                placeholder="e.g. Welcome message on new lead"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rule-cron" className="text-xs text-muted-foreground">
                Schedule (cron, optional)
              </Label>
              <Input
                id="rule-cron"
                className="h-8 w-36 font-mono text-xs"
                placeholder="0 9 * * *"
                value={cron}
                onChange={(e) => setCron(e.target.value)}
              />
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive((v) => !v)}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
                isActive ? 'bg-primary' : 'bg-input',
              )}
              title={isActive ? 'Rule is active — click to pause' : 'Rule is paused — click to activate'}
            >
              <span
                className={cn(
                  'inline-block size-3.5 rounded-full bg-white shadow transition-transform',
                  isActive ? 'translate-x-[18px]' : 'translate-x-[3px]',
                )}
              />
            </button>
            <Button size="sm" onClick={handleSave} disabled={saving || nodes.length === 0}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              {editId ? 'Save changes' : 'Save rule'}
            </Button>
          </div>
        </div>

        {/* Workspace: palette | canvas | properties */}
        <div className="flex min-h-0 flex-1 gap-4">
          <Palette onAdd={clickAdd} />

          <div className="relative min-h-[480px] min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-card/30">
            <NodeActionsProvider actions={{ onSelect: setSelectedId, onDelete: deleteNode }}>
              <ReactFlow<BuilderFlowNode>
                nodes={nodes}
                edges={[]}
                onNodesChange={onNodesChange}
                nodeTypes={nodeTypes}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeClick={(_, node) => setSelectedId(node.id)}
                onPaneClick={() => setSelectedId(null)}
                colorMode="dark"
                fitView
                snapToGrid
                snapGrid={[10, 10]}
                proOptions={{ hideAttribution: true }}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={24}
                  size={1}
                  color="#2a2a38"
                />
                <Controls />
                <MiniMap
                  pannable
                  zoomable
                  nodeColor={(n) =>
                    (n.data as { kind?: string } | undefined)?.kind === 'trigger'
                      ? '#6366f1'
                      : (n.data as { kind?: string } | undefined)?.kind === 'condition'
                        ? '#f59e0b'
                        : '#0ea5e9'
                  }
                  maskColor="rgba(10,10,15,0.7)"
                />
              </ReactFlow>
            </NodeActionsProvider>

            {nodes.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <div className="max-w-xs rounded-lg border border-dashed border-border bg-card/70 px-6 py-5 text-center">
                  <Workflow className="mx-auto size-5 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium text-foreground">Canvas is empty</p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">
                    Drag a trigger, condition or action from the palette onto the canvas to start
                    building this rule.
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <PropertiesPanel node={selectedNode} onConfig={updateNodeConfig} onDelete={deleteNode} />
        </div>
      </div>

      {secretReveal ? (
        <WebhookSecretDialog
          open
          onClose={() => {
            setSecretReveal(null)
            router.push('/automations')
          }}
          label={secretReveal.label}
          secret={secretReveal.secret}
          tenantId={enterpriseId ?? ''}
          name={secretReveal.name}
          base={PUBLIC_BASE}
        />
      ) : null}
    </AppShell>
  )
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading builder…" />}>
      <ReactFlowProvider>
        <BuilderPageInner />
      </ReactFlowProvider>
    </Suspense>
  )
}
