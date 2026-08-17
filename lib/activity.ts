export type LocalActivity = {
  id: string;
  staff: string;       // endpoint name
  category: string;    // Registry / Terminal
  amount: number;
  status: string;
  time: string;
  source?: string;
};

export function appendLocalActivity(item: LocalActivity) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem("opayque_tx");
    const existing = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(existing) ? existing : [];
    const next = [item, ...list.filter((x: any) => x?.id !== item.id)].slice(0, 30);
    window.localStorage.setItem("opayque_tx", JSON.stringify(next));
    window.dispatchEvent(new Event("opayque_tx_updated"));
  } catch (e) {
    console.warn("appendLocalActivity failed", e);
  }
}