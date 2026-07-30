import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import type { TransactionData, TransactionAnalytics } from "@/lib/domain/transaction/types"
import * as txService from "@/lib/domain/transaction/service"

interface TransactionState {
  transactions: TransactionData[]
  analytics: TransactionAnalytics
  loading: boolean
  error: string | null
  lastFetched: string | null
}

interface TransactionActions {
  fetch: (dateFilter?: string) => Promise<void>
  create: (tx: TransactionData, userId: string, userName: string) => Promise<TransactionData>
  update: (id: string, tx: Partial<TransactionData>) => Promise<void>
  remove: (id: string) => Promise<void>
  updateStatus: (id: string, status: TransactionData["status"]) => Promise<void>
  getById: (id: string) => TransactionData | undefined
  clear: () => void
}

type TransactionStore = TransactionState & TransactionActions

export const useTransactionStore = create<TransactionStore>()(
  subscribeWithSelector((set, get) => ({
    transactions: [],
    analytics: {
      total: 0,
      totalRevenue: 0,
      totalExpenses: 0,
      netRevenue: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      jenisCount: {},
      jenisRevenue: {},
      metodeRevenue: {},
      metodeCount: {},
      staffStats: {},
    },
    loading: false,
    error: null,
    lastFetched: null,

    fetch: async (dateFilter?: string) => {
      set({ loading: true, error: null })
      try {
        const transactions = await txService.fetchAllTransactions(dateFilter)
        const analytics = txService.computeAnalytics(transactions)
        set({ transactions, analytics, loading: false, lastFetched: new Date().toISOString() })
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : "Unknown error", loading: false })
      }
    },

    create: async (tx, userId, userName) => {
      const result = await txService.createTransaction(tx, userId, userName)
      set((state) => {
        const updated = [result, ...state.transactions]
        return {
          transactions: updated,
          analytics: txService.computeAnalytics(updated),
        }
      })
      return result
    },

    update: async (id, payload) => {
      await txService.updateTransaction(id, payload)
      set((state) => {
        const updated = state.transactions.map((t) =>
          t.id === id ? { ...t, ...payload } : (t as TransactionData),
        )
        return {
          transactions: updated as TransactionData[],
          analytics: txService.computeAnalytics(updated as TransactionData[]),
        }
      })
    },

    remove: async (id) => {
      await txService.deleteTransaction(id)
      set((state) => {
        const updated = state.transactions.filter((t) => t.id !== id)
        return {
          transactions: updated,
          analytics: txService.computeAnalytics(updated),
        }
      })
    },

    updateStatus: async (id, status) => {
      await txService.updateTransactionStatus(id, status)
      set((state) => {
        const updated = state.transactions.map((t) =>
          t.id === id ? { ...t, status } : t,
        )
        return {
          transactions: updated,
          analytics: txService.computeAnalytics(updated),
        }
      })
    },

    getById: (id) => get().transactions.find((t) => t.id === id),

    clear: () =>
      set({
        transactions: [],
          analytics: {
            total: 0, totalRevenue: 0, totalExpenses: 0, netRevenue: 0,
            active: 0, completed: 0, cancelled: 0,
            jenisCount: {}, jenisRevenue: {}, metodeRevenue: {}, metodeCount: {}, staffStats: {},
          },
        loading: false,
        error: null,
        lastFetched: null,
      }),
  })),
)