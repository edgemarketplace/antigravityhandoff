"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type OrderRow = {
  id: string;
  stripe_session_id: string | null;
  customer_email: string | null;
  status: string;
  currency: string;
  amount_total: number | null;
  printify_order_id: string | null;
  fulfillment_attempts: number;
  fulfillment_error: string | null;
  created_at: string;
  paid_at: string | null;
};

type RealtimeOrdersPanelProps = {
  tenantId: string;
  tenantSlug: string;
  initialOrders: OrderRow[];
};

function formatMoney(amount: number | null, currency: string) {
  if (amount === null) return "—";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function RealtimeOrdersPanel({ tenantId, tenantSlug, initialOrders }: RealtimeOrdersPanelProps) {
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const canUseRealtime = Boolean(supabaseUrl && supabaseAnonKey);

  const refreshOrders = useCallback(async () => {
    const response = await fetch(`/api/admin/orders?tenant=${tenantSlug}`, { cache: "no-store" });
    const payload = (await response.json()) as {
      success: boolean;
      orders?: OrderRow[];
      message?: string;
    };

    if (!response.ok || !payload.success) {
      throw new Error(payload.message ?? "Failed to load tenant orders.");
    }

    setOrders(payload.orders ?? []);
  }, [tenantSlug]);

  useEffect(() => {
    let closed = false;

    async function boot() {
      try {
        await refreshOrders();
      } catch (error) {
        if (!closed) {
          setStatusMessage(error instanceof Error ? error.message : "Failed to load tenant orders.");
        }
      }
    }

    void boot();

    return () => {
      closed = true;
    };
  }, [refreshOrders]);

  useEffect(() => {
    if (!canUseRealtime || !supabaseUrl || !supabaseAnonKey) {
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const channel = supabase
      .channel(`orders-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `tenant_id=eq.${tenantId}`,
        },
        async () => {
          try {
            await refreshOrders();
            setStatusMessage("Realtime order update received.");
          } catch (error) {
            setStatusMessage(error instanceof Error ? error.message : "Failed refreshing realtime orders.");
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canUseRealtime, supabaseAnonKey, supabaseUrl, refreshOrders, tenantId]);

  const empty = useMemo(() => orders.length === 0, [orders.length]);

  return (
    <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Orders</h2>
        <p className="text-xs tracking-[0.14em] text-zinc-500 uppercase">Realtime tenant order table</p>
      </div>

      {!canUseRealtime ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          Realtime not enabled: set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
        </p>
      ) : null}

      {statusMessage ? <p className="text-sm text-zinc-600 dark:text-zinc-300">{statusMessage}</p> : null}

      {empty ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
          No orders found yet for tenant `{tenantSlug}`.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs tracking-[0.14em] text-zinc-500 uppercase dark:border-zinc-800">
                <th className="px-2 py-2">Order</th>
                <th className="px-2 py-2">Customer</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Total</th>
                <th className="px-2 py-2">Fulfillment</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="px-2 py-2">
                    <p className="font-mono text-xs">{order.id.slice(0, 8)}</p>
                    <p className="text-[11px] text-zinc-500">{new Date(order.created_at).toLocaleString()}</p>
                  </td>
                  <td className="px-2 py-2">{order.customer_email ?? "—"}</td>
                  <td className="px-2 py-2">{order.status}</td>
                  <td className="px-2 py-2">{formatMoney(order.amount_total, order.currency)}</td>
                  <td className="px-2 py-2">
                    {order.printify_order_id ? (
                      <span className="text-emerald-600 dark:text-emerald-400">Submitted ({order.printify_order_id})</span>
                    ) : order.fulfillment_error ? (
                      <span className="text-rose-600 dark:text-rose-400">Failed: {order.fulfillment_error}</span>
                    ) : (
                      <span className="text-zinc-500">Pending ({order.fulfillment_attempts})</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
