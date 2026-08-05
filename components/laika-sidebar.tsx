"use client"

import { Plus, MessageSquare, Trash2, PanelLeftClose, Search, Star, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type Conversation = {
  id: string
  title: string
  favorite?: boolean
}

type Props = {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onToggleFavorite: (id: string) => void
  open: boolean
  onToggle: () => void
  search: string
  onSearchChange: (value: string) => void
  favoritesOnly: boolean
  onToggleFavoritesOnly: () => void
  online: boolean
}

export function LaikaSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onToggleFavorite,
  open,
  onToggle,
  search,
  onSearchChange,
  favoritesOnly,
  onToggleFavoritesOnly,
  online,
}: Props) {
  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out",
        open ? "w-72" : "w-0 border-r-0",
      )}
    >
      <div className="flex w-72 shrink-0 items-center justify-between px-5 pb-2 pt-5">
        <div className="flex items-center gap-2">
          <img src="/laika-logo.png" alt="Laîka" className="h-6 w-auto" />
          <span
            title={online ? "Connecté au modèle Adam" : "Mode démonstration (backend hors ligne)"}
            className={cn("size-2 rounded-full", online ? "bg-emerald-500" : "bg-muted-foreground/40")}
          />
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Masquer les conversations"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <PanelLeftClose className="size-5" />
        </button>
      </div>

      <div className="flex w-72 shrink-0 flex-col gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent/40 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent"
        >
          <Plus className="size-4" />
          Nouvelle conversation
        </button>

        <div className="flex items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent/30 px-3 py-2 focus-within:border-ring">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher…"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Effacer la recherche"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleFavoritesOnly}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
            favoritesOnly
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent",
          )}
        >
          <Star className={cn("size-4", favoritesOnly && "fill-current")} />
          Favoris
        </button>
      </div>

      <nav className="mt-4 w-72 flex-1 overflow-y-auto px-3 pb-4">
        {conversations.length === 0 ? (
          <p className="px-2 pt-2 text-xs text-muted-foreground">
            {favoritesOnly
              ? "Aucun favori."
              : search
                ? "Aucun résultat."
                : "Aucune conversation enregistrée."}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {conversations.map((c) => (
              <li key={c.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg py-2 pl-2.5 pr-16 text-left text-sm transition-colors hover:bg-sidebar-accent",
                    activeId === c.id ? "bg-sidebar-accent font-medium" : "text-muted-foreground",
                  )}
                >
                  <MessageSquare className="size-4 shrink-0" />
                  <span className="truncate">{c.title}</span>
                </button>
                <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(c.id)}
                    aria-label={c.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-md transition-opacity hover:bg-sidebar-accent",
                      c.favorite
                        ? "text-amber-400 opacity-100"
                        : "text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100",
                    )}
                  >
                    <Star className={cn("size-4", c.favorite && "fill-current")} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    aria-label={`Supprimer la conversation « ${c.title} »`}
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  )
}
