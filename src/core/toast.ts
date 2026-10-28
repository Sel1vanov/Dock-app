/**
 * Короткие уведомления об успешной операции («Заявка опубликована»).
 * ViewModel вызывает showToast(), а компонент ToastHost (views) показывает сообщение.
 */
export type ToastTone = 'success' | 'info' | 'danger';

export interface ToastMessage {
  id: number;
  text: string;
  tone: ToastTone;
}

type Listener = (toast: ToastMessage) => void;

const listeners = new Set<Listener>();
let nextId = 1;

export function showToast(text: string, tone: ToastTone = 'success'): void {
  const toast = { id: nextId++, text, tone };
  listeners.forEach((l) => l(toast));
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
