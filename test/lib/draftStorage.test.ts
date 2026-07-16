import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// Mock indexedDB
const idbStore = new Map<string, any>();
const mockDB = {
  objectStoreNames: { contains: () => false },
  createObjectStore: () => {},
  transaction: (storeName: string, mode: string) => ({
    objectStore: (name: string) => ({
      put: (value: any, key?: string) => {
        const tx = { oncomplete: null as any, onerror: null as any };
        idbStore.set(key ?? String(Date.now()), value);
        setTimeout(() => tx.oncomplete?.(), 0);
        return { result: key };
      },
      get: (key: string) => {
        const req = { result: idbStore.get(key), onsuccess: null as any, onerror: null as any };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      },
      delete: (key: string) => {
        idbStore.delete(key);
        return { onsuccess: null, onerror: null };
      },
      openCursor: () => {
        const entries = Array.from(idbStore.entries());
        let idx = 0;
        const req = {
          result: null as any,
          onsuccess: null as any,
        };
        setTimeout(() => {
          if (idx < entries.length) {
            req.result = {
              key: entries[idx][0],
              continue: () => { idx++; setTimeout(() => req.onsuccess?.(), 0); },
              delete: () => idbStore.delete(entries[idx - 1][0]),
            };
            req.onsuccess();
          } else {
            req.result = null;
            req.onsuccess();
          }
        }, 0);
        return req;
      },
    }),
    oncomplete: null as any,
    onerror: null as any,
  }),
  close: () => {},
};

Object.defineProperty(globalThis, "indexedDB", {
  value: {
    open: () => {
      const req = { result: mockDB, onupgradeneeded: null as any, onsuccess: null as any, onerror: null as any };
      setTimeout(() => {
        req.onupgradeneeded?.();
        req.onsuccess?.();
      }, 0);
      return req;
    },
  },
});

const {
  saveDraftTextSync,
  clearDraft,
  hasDraft,
} = await import("@/lib/draftStorage");

describe("draftStorage (localStorage-based functions)", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("saveDraftTextSync saves data to localStorage", () => {
    saveDraftTextSync("testForm", "user1", { name: "test" });
    const result = localStorageMock.getItem("draft_testForm_user1");
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.data.name).toBe("test");
    expect(parsed.userId).toBe("user1");
  });

  it("hasDraft returns true after saveDraftTextSync", () => {
    saveDraftTextSync("testForm", "user1", { name: "test" });
    expect(hasDraft("testForm", "user1")).toBe(true);
  });

  it("hasDraft returns false for non-existent draft", () => {
    expect(hasDraft("nonexistent", "user1")).toBe(false);
  });

  it("hasDraft returns false for different user", () => {
    saveDraftTextSync("testForm", "user1", { name: "test" });
    expect(hasDraft("testForm", "user2")).toBe(false);
  });

  it("clearDraft removes the draft", () => {
    saveDraftTextSync("testForm", "user1", { name: "test" });
    expect(hasDraft("testForm", "user1")).toBe(true);
    clearDraft("testForm", "user1");
    expect(hasDraft("testForm", "user1")).toBe(false);
  });

  it("clearDraft only removes specified form's draft", () => {
    saveDraftTextSync("formA", "user1", { a: 1 });
    saveDraftTextSync("formB", "user1", { b: 2 });
    clearDraft("formA", "user1");
    expect(hasDraft("formA", "user1")).toBe(false);
    expect(hasDraft("formB", "user1")).toBe(true);
  });

  it("saveDraftTextSync overwrites existing draft", () => {
    saveDraftTextSync("testForm", "user1", { name: "first" });
    saveDraftTextSync("testForm", "user1", { name: "second" });
    const parsed = JSON.parse(localStorageMock.getItem("draft_testForm_user1")!);
    expect(parsed.data.name).toBe("second");
  });
});
