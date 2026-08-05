"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import useSWR, { mutate } from "swr"
import { ArrowUp, Check, Copy, PanelLeftOpen, Sparkles } from "lucide-react"
import { ModelSelector, MODELS, MODES, type ModelOption } from "@/components/model-selector"
import { LaikaSidebar, type Conversation } from "@/components/laika-sidebar"
import { laikaApi } from "@/lib/laika-api"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  pending?: boolean
}

const DEMO_REPLY =
  "Ceci est une interface de démonstration (backend Adam hors ligne). Lance le serveur Flask pour obtenir de vraies réponses du modèle."

export function LaikaChat() {
  const { data: modelsData, error: modelsError } = useSWR("adam:models", () => laikaApi.listModels(), {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  })
  const online = !!modelsData && !modelsError

  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [search, setSearch] = useState("")
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [model, setModel] = useState(MODELS[0].id)
  const [mode, setMode] = useState(MODES[0].id)
  const [pending, setPending] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const [localConvs, setLocalConvs] = useState<Conversation[]>([])
  const [localMsgs, setLocalMsgs] = useState<Record<string, Message[]>>({})

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const modelOptions: ModelOption[] = useMemo(() => {
    if (!online || !modelsData?.models?.length) return MODELS
    return modelsData.models.map((name) => ({
      id: name,
      name,
      description: name === modelsData.current ? "Point de contrôle actif" : "Point de contrôle",
      icon: <Sparkles className="size-4" />,
    }))
  }, [online, modelsData])

  useEffect(() => {
    if (online && modelsData?.current) setModel(modelsData.current)
  }, [online, modelsData?.current])

  const chatsKey = online ? ["adam:chats", search, favoritesOnly] : null
  const { data: remoteChats } = useSWR(chatsKey, async () => {
    const list = search.trim() ? await laikaApi.searchChats(search.trim()) : await laikaApi.listChats()
    return favoritesOnly ? list.filter((c) => c.favorite) : list
  })

  const conversations: Conversation[] = useMemo(() => {
    if (online) {
      return (remoteChats ?? []).map((c) => ({ id: c.id, title: c.title, favorite: c.favorite }))
    }
    let list = localConvs
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((c) => c.title.toLowerCase().includes(q))
    if (favoritesOnly) list = list.filter((c) => c.favorite)
    return list
  }, [online, remoteChats, localConvs, search, favoritesOnly])

  const activeChatKey = online && activeId ? ["adam:chat", activeId] : null
  const { data: activeChat } = useSWR(activeChatKey, () => laikaApi.getChat(activeId!))

  const baseMessages: Message[] = useMemo(() => {
    if (online) {
      return (activeChat?.messages ?? []).map((m, i) => ({
        id: `${activeId}-${i}`,
        role: m.role === "adam" ? "assistant" : "user",
        content: m.text,
      }))
    }
    return activeId ? (localMsgs[activeId] ?? []) : []
  }, [online, activeChat, activeId, localMsgs])

  const messages: Message[] = useMemo(() => {
    if (!pending) return baseMessages
    return [
      ...baseMessages,
      { id: "pending-user", role: "user", content: pending },
      { id: "pending-adam", role: "assistant", content: "…", pending: true },
    ]
  }, [baseMessages, pending])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  function revalidateChats() {
    mutate((key) => Array.isArray(key) && key[0] === "adam:chats")
  }

  function startNewConversation() {
    setActiveId(null)
    setInput("")
  }

  async function handleSelectModel(id: string) {
    setModel(id)
    if (online) {
      try {
        await laikaApi.selectModel(id)
      } catch {
        // ignore
      }
    }
  }

  async function deleteConversation(id: string) {
    if (online) {
      try {
        await laikaApi.deleteChat(id)
      } catch {
        // ignore
      }
      revalidateChats()
      if (activeId === id) mutate(["adam:chat", id], undefined, false)
    } else {
      setLocalConvs((prev) => prev.filter((c) => c.id !== id))
      setLocalMsgs((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
    if (activeId === id) {
      setActiveId(null)
      setInput("")
    }
  }

  async function toggleFavorite(id: string) {
    if (online) {
      try {
        await laikaApi.toggleFavorite(id)
      } catch {
        // ignore
      }
      revalidateChats()
    } else {
      setLocalConvs((prev) => prev.map((c) => (c.id === id ? { ...c, favorite: !c.favorite } : c)))
    }
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || sending) return
    setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"

    if (online) {
      setSending(true)
      setPending(text)
      try {
        let id = activeId
        if (!id) {
          const chat = await laikaApi.createChat()
          id = chat.id
          setActiveId(id)
        }
        await laikaApi.sendMessage(id, text, mode)
        await mutate(["adam:chat", id])
        revalidateChats()
      } catch {
        // ignore
      } finally {
        setPending(null)
        setSending(false)
      }
      return
    }

    let convId = activeId
    if (!convId) {
      convId = crypto.randomUUID()
      const title = text.length > 40 ? text.slice(0, 40) + "…" : text
      setLocalConvs((prev) => [{ id: convId as string, title, favorite: false }, ...prev])
      setActiveId(convId)
    }
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text }
    const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: DEMO_REPLY }
    setLocalMsgs((prev) => ({
      ...prev,
      [convId as string]: [...(prev[convId as string] ?? []), userMsg, assistantMsg],
    }))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const composing = e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229
    if (e.key === "Enter" && !e.shiftKey && !composing) {
      e.preventDefault()
      sendMessage()
    }
  }

  function autoGrow(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 200) + "px"
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <LaikaSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={startNewConversation}
        onDelete={deleteConversation}
        onToggleFavorite={toggleFavorite}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        search={search}
        onSearchChange={setSearch}
        favoritesOnly={favoritesOnly}
        onToggleFavoritesOnly={() => setFavoritesOnly((v) => !v)}
        online={online}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 px-6">
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Afficher les conversations"
              className="-ml-2 flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <PanelLeftOpen className="size-5" />
            </button>
          )}
          <img src="/laika-logo.png" alt="Laîka" className="h-5 w-auto" />
        </header>

        {hasMessages ? (
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="group flex items-start gap-3">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary">
                      <LaikaMark />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 text-sm font-medium text-muted-foreground">Laîka</div>
                      <div className="rounded-2xl bg-card px-4 py-3 text-sm leading-relaxed text-card-foreground">
                        {m.pending ? <TypingDots /> : m.content}
                      </div>
                      {!m.pending && <CopyButton content={m.content} />}
                    </div>
                  </div>
                ),
              )}
              <div ref={bottomRef} />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-4">
            <img src="/laika-logo.png" alt="Laîka" className="h-20 w-auto md:h-24" />
            <p className="mt-6 text-muted-foreground">Comment puis-je t&apos;aider ?</p>
          </div>
        )}

        <div className="px-4 pb-6">
          <div className="mx-auto w-full max-w-3xl">
            <div className="rounded-3xl border border-border bg-card/60 p-3 shadow-xl shadow-black/30 backdrop-blur">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={autoGrow}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Écris à Laîka…"
                className="max-h-52 w-full resize-none bg-transparent px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <div className="mt-2 flex items-end justify-between gap-2">
                <ModelSelector
                  model={model}
                  mode={mode}
                  models={modelOptions}
                  onModelChange={handleSelectModel}
                  onModeChange={setMode}
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  aria-label="Envoyer"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
                >
                  <ArrowUp className="size-5" />
                </button>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Laîka peut se tromper. Vérifie les informations importantes.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="Laîka écrit">
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
    </span>
  )
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copié" : "Copier la réponse"}
      className="mt-1.5 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copié" : "Copier"}
    </button>
  )
}

function LaikaMark() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 text-foreground"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.75"
    >
      <path
        d="M14.2 14.2H17V6.9375C17 4.76288 15.2371 3 13.0625 3H5.8V5.8M14.2 14.2V7.79063L7.79062 14.2H14.2ZM14.2 14.2V17H6.9375C4.76288 17 3 15.2371 3 13.0625V5.8H5.8M5.8 5.8V12.2313L12.2313 5.8H5.8Z"
        strokeLinejoin="round"
      />
    </svg>
  )
}
