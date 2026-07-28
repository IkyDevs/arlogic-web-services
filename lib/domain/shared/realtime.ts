import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

type TableName = "layanan" | "layanan_items" | "service_orders" | "service_items" | "service_timeline" | "notifications"
type EventType = "INSERT" | "UPDATE" | "DELETE"

export type RealtimeCallback = (payload: {
  event: EventType
  table: TableName
  new: Record<string, unknown> | null
  old: Record<string, unknown> | null
}) => void

interface Subscription {
  id: string
  table: TableName
  event: EventType
  callback: RealtimeCallback
  filter?: string
  channel: RealtimeChannel
}

class RealtimeService {
  private static instance: RealtimeService
  private subscriptions: Map<string, Subscription> = new Map()
  private clients: Map<string, ReturnType<typeof createClient>> = new Map()

  static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService()
    }
    return RealtimeService.instance
  }

  subscribe(
    table: TableName,
    event: EventType,
    callback: RealtimeCallback,
    filter?: string,
  ): string {
    const id = `${table}:${event}:${filter || "*"}`
    if (this.subscriptions.has(id)) return id

    const supabase = createClient()
    const channel = supabase
      .channel(`realtime-${id}`)
      .on(
        "postgres_changes",
        { event, schema: "public", table, filter },
        (payload) => {
          callback({
            event,
            table,
            new: payload.new as Record<string, unknown> | null,
            old: payload.old as Record<string, unknown> | null,
          })
        },
      )
      .subscribe()

    this.subscriptions.set(id, { id, table, event, callback, filter, channel })
    return id
  }

  subscribeToTable(
    table: TableName,
    events: EventType[],
    callback: RealtimeCallback,
    filter?: string,
  ): string[] {
    return events.map((event) => this.subscribe(table, event, callback, filter))
  }

  subscribeToLayanan(
    callback: RealtimeCallback,
    filter?: string,
  ): () => void {
    const ids = this.subscribeToTable("layanan", ["INSERT", "UPDATE", "DELETE"], callback, filter)
    return () => ids.forEach((id) => this.unsubscribe(id))
  }

  subscribeToServiceOrders(
    callback: RealtimeCallback,
    filter?: string,
  ): () => void {
    const ids = this.subscribeToTable("service_orders", ["INSERT", "UPDATE", "DELETE"], callback, filter)
    return () => ids.forEach((id) => this.unsubscribe(id))
  }

  subscribeToNotifications(
    userId: string,
    callback: RealtimeCallback,
  ): () => void {
    const ids = [
      this.subscribe("notifications", "INSERT", callback, `user_id=eq.${userId}`),
      this.subscribe("notifications", "UPDATE", callback, `user_id=eq.${userId}`),
    ]
    return () => ids.forEach((id) => this.unsubscribe(id))
  }

  subscribeToServiceItems(
    callback: RealtimeCallback,
    filter?: string,
  ): () => void {
    const ids = this.subscribeToTable("service_items", ["INSERT", "UPDATE", "DELETE"], callback, filter)
    return () => ids.forEach((id) => this.unsubscribe(id))
  }

  unsubscribe(id: string): void {
    const sub = this.subscriptions.get(id)
    if (sub) {
      const supabase = createClient()
      supabase.removeChannel(sub.channel)
      this.subscriptions.delete(id)
    }
  }

  unsubscribeAll(): void {
    for (const [id] of this.subscriptions) {
      this.unsubscribe(id)
    }
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys())
  }
}

export const realtimeService = RealtimeService.getInstance()