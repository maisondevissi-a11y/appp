"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, ChevronRight, Sparkles, Zap, Brain, Search, Feather } from "lucide-react"
import { cn } from "@/lib/utils"

export type ModelOption = {
  id: string
  name: string
  description: string
  icon: React.ReactNode
}

export type ModeOption = {
  id: string
  name: string
  description: string
  icon: React.ReactNode
}

export const MODELS: ModelOption[] = [
  {
    id: "core",
    name: "Laîka Core",
    description: "Le modèle le plus complet et polyvalent",
    icon: <Sparkles className="size-4" />,
  },
  {
    id: "mini",
    name: "Laîka Mini",
    description: "Rapide et léger pour les tâches simples",
    icon: <Feather className="size-4" />,
  },
]

export const MODES: ModeOption[] = [
  {
    id: "normal",
    name: "Normal",
    description: "Réponses équilibrées et directes",
    icon: <Zap className="size-4" />,
  },
  {
    id: "pro",
    name: "Pro",
    description: "Génère plusieurs réponses et garde la meilleure",
    icon: <Brain className="size-4" />,
  },
  {
    id: "web",
    name: "Recherche web",
    description: "Cherche des informations à jour sur le web",
    icon: <Search className="size-4" />,
  },
]

type Props = {
  model: string
  mode: string
  models?: ModelOption[]
  onModelChange: (id: string) => void
  onModeChange: (id: string) => void
}

export function ModelSelector({ model, mode, models, onModelChange, onModeChange }: Props) {
  const [open, setOpen] = useState(false)
  const [modeHover, setModeHover] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const modelList = models && models.length > 0 ? models : MODELS
  const selectedModel = modelList.find((m) => m.id === model) ?? modelList[0]
  const selectedMode = MODES.find((m) => m.id === mode) ?? MODES[0]

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    if (open) {
      document.addEventListener("mousedown", onPointerDown)
      document.addEventListener("keydown", onKey)
    }
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          setModeHover(false)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary",
          open && "bg-secondary",
        )}
      >
        <span className="text-muted-foreground">{selectedModel.icon}</span>
        <span className="font-medium">{selectedModel.name}</span>
        <span className="text-muted-foreground/60">·</span>
        <span className="text-muted-foreground">{selectedMode.name}</span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-50 mb-2 w-80 origin-bottom-left rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl shadow-black/50"
        >
          <div className="px-2.5 pb-1.5 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Modèle
          </div>
          {modelList.map((m) => (
            <MenuRow
              key={m.id}
              icon={m.icon}
              name={m.name}
              description={m.description}
              selected={m.id === model}
              onClick={() => {
                onModelChange(m.id)
                setOpen(false)
              }}
            />
          ))}

          <div className="mx-2 my-1.5 h-px bg-border" />

          <div
            className="group/mode relative"
            onMouseEnter={() => setModeHover(true)}
            onMouseLeave={() => setModeHover(false)}
          >
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-accent"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent bg-primary text-primary-foreground">
                {selectedMode.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Mode
                </span>
                <span className="block truncate text-sm font-medium text-foreground">{selectedMode.name}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>

            {modeHover && (
              <div
                role="menu"
                className="absolute bottom-0 left-full z-50 ml-1 w-72 origin-bottom-left overflow-hidden rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl shadow-black/50"
              >
                <div className="px-2.5 pb-1.5 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Mode
                </div>
                {MODES.map((m) => (
                  <MenuRow
                    key={m.id}
                    icon={m.icon}
                    name={m.name}
                    description={m.description}
                    selected={m.id === mode}
                    onClick={() => {
                      onModeChange(m.id)
                      setModeHover(false)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MenuRow({
  icon,
  name,
  description,
  selected,
  onClick,
}: {
  icon: React.ReactNode
  name: string
  description: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-accent"
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground",
          selected && "border-transparent bg-primary text-primary-foreground",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">{description}</span>
      </span>
      {selected && <Check className="size-4 shrink-0 text-foreground" />}
    </button>
  )
}
