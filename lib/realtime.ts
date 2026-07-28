import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

type TableName = "layanan" | "layanan_items" | "service_orders";
type EventType = "INSERT" | "UPDATE" | "DELETE";

type RealtimeCallback = (payload: any) => void;

interface Subscription {
  table: TableName;
  event: EventType;
  callback: RealtimeCallback;
  channel: RealtimeChannel;
}

class RealtimeService {
  private static instance: RealtimeService;
  private subscriptions: Map<string, Subscription> = new Map();

  static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  private getClient(): SupabaseClient {
    return createClient();
  }

  subscribe(
    table: TableName,
    event: EventType,
    callback: RealtimeCallback,
    filter?: string,
  ): string {
    const id = `${table}:${event}:${filter || "*"}`;

    if (this.subscriptions.has(id)) return id;

    const supabase = this.getClient();
    const channel = supabase
      .channel(`realtime-${id}`)
      .on(
        "postgres_changes",
        { event, schema: "public", table, filter },
        (payload) => {
          callback(payload);
        },
      )
      .subscribe();

    this.subscriptions.set(id, { table, event, callback, channel });
    return id;
  }

  unsubscribe(id: string): void {
    const sub = this.subscriptions.get(id);
    if (sub) {
      const supabase = this.getClient();
      supabase.removeChannel(sub.channel);
      this.subscriptions.delete(id);
    }
  }

  unsubscribeAll(): void {
    for (const [id] of this.subscriptions) {
      this.unsubscribe(id);
    }
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }
}

export const realtimeService = RealtimeService.getInstance();

export function useTransactionRealtime(onChange: () => void): () => void {
  const service = realtimeService;

  const ids = [
    service.subscribe("layanan", "INSERT", onChange),
    service.subscribe("layanan", "UPDATE", onChange),
    service.subscribe("layanan", "DELETE", onChange),
  ];

  return () => {
    ids.forEach((id) => service.unsubscribe(id));
  };
}