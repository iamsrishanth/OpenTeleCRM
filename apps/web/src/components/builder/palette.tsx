'use client'

import type { DragEvent } from 'react'
import { Plus } from 'lucide-react'
import { PALETTE_GROUPS } from './constants'
import { ICONS } from './canvas-node'
import { cn } from '@/lib/utils'

export const DND_MIME = 'application/builder-node'

export interface PaletteDropPayload {
  group: string
  value: string
}

const GROUP_ACCENT: Record<string, string> = {
  triggers: 'text-primary',
  conditions: 'text-amber-500',
  actions: 'text-sky-500',
}

const GROUP_ICON_CHIP: Record<string, string> = {
  triggers: 'bg-primary/15',
  conditions: 'bg-amber-500/15',
  actions: 'bg-sky-500/15',
}

export function Palette({
  onAdd,
}: {
  /** Called on click-add; drag uses the HTML5 dataTransfer payload instead. */
  onAdd: (payload: PaletteDropPayload) => void
}) {
  const handleDragStart = (e: DragEvent<HTMLDivElement>, payload: PaletteDropPayload) => {
    e.dataTransfer.setData(DND_MIME, JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="flex w-60 shrink-0 flex-col gap-4 overflow-y-auto pr-1">
      {PALETTE_GROUPS.map((group) => (
        <div key={group.id}>
          <p
            className={cn(
              'mb-2 text-[10px] font-semibold uppercase tracking-widest',
              GROUP_ACCENT[group.id] ?? 'text-muted-foreground',
            )}
          >
            {group.label}
          </p>
          <div className="space-y-1.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon] ?? Plus
              return (
                <div
                  key={item.value}
                  draggable
                  onDragStart={(e) => handleDragStart(e, { group: group.id, value: item.value })}
                  onClick={() => onAdd({ group: group.id, value: item.value })}
                  title={`${item.hint ?? item.label} — drag onto the canvas or click to add`}
                  className="group flex cursor-grab items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2 transition-colors hover:border-ring/60 hover:bg-secondary/60 active:cursor-grabbing"
                >
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-md',
                      GROUP_ICON_CHIP[group.id] ?? 'bg-muted',
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-foreground">
                      {item.label}
                    </span>
                    {item.hint ? (
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {item.hint}
                      </span>
                    ) : null}
                  </span>
                  <Plus className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
