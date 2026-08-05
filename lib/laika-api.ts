const API_BASE = process.env.NEXT_PUBLIC_ADAM_API_URL ?? "http://localhost:5000"

export type AdamMessage = {
  role: "user" | "adam"
  text: string
  mode?: string
}

export type AdamChat = {
  id: string
  title: string
  favorite: boolean
  updated_at: string
  model_checkpoint?: string
  messages: AdamMessage[]
  history_ids: number[]
}

export type AdamChatSummary = {
  id: string
  title: string
  favorite: boolean
  updated_at: string
}

export type AdamModelsResponse = {
  models: string[]
  current: string | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    throw new Error(`Adam API error ${res.status} on ${path}`)
  }
  return res.json() as Promise<T>
}

export const laikaApi = {
  listModels: () => request<AdamModelsResponse>("/api/models"),

  selectModel: (name: string) =>
    request<{ current: string }>("/api/models/select", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  listChats: () => request<AdamChatSummary[]>("/api/chats"),

  searchChats: (query: string) =>
    request<AdamChatSummary[]>(`/api/chats/search?q=${encodeURIComponent(query)}`),

  createChat: () => request<AdamChat>("/api/chats", { method: "POST" }),

  getChat: (id: string) => request<AdamChat>(`/api/chats/${id}`),

  deleteChat: (id: string) => request<{ ok: boolean }>(`/api/chats/${id}`, { method: "DELETE" }),

  toggleFavorite: (id: string) =>
    request<{ favorite: boolean }>(`/api/chats/${id}/favorite`, { method: "POST" }),

  sendMessage: (id: string, message: string, mode = "normal") =>
    request<{ reply: string; title: string; web_used: boolean }>(`/api/chats/${id}/message`, {
      method: "POST",
      body: JSON.stringify({ message, mode }),
    }),
}
