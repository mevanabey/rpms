"use client";

/**
 * DOM helpers used by the flow engine. RHF-safe input setting, retrying
 * selector lookup, simulated typing, and click that survives missing nodes.
 */

/** Wait until a selector resolves an element, or timeout. */
export async function waitForSelector(
  selector: string,
  timeoutMs = 5000,
): Promise<Element | null> {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const el = document.querySelector(selector);
    if (el) return el;
    await delay(50);
  }
  return null;
}

export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Set a value on an input / textarea so React Hook Form picks it up.
 * Uses the native setter so React's synthetic event listeners fire.
 */
export function setReactValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const proto =
    el.tagName === "TEXTAREA"
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Type characters one at a time so the user sees the field fill. */
export async function simulatedType(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  msPerChar = 28,
): Promise<void> {
  el.focus();
  let acc = "";
  for (const ch of value) {
    acc += ch;
    setReactValue(el, acc);
    // Small jitter so it doesn't feel mechanical.
    await delay(msPerChar + Math.random() * msPerChar * 0.3);
  }
}

/** Click a HTMLElement, with fallback to dispatched MouseEvent. */
export function clickElement(el: Element): void {
  if ("click" in el && typeof (el as HTMLElement).click === "function") {
    (el as HTMLElement).click();
    return;
  }
  el.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    }),
  );
}

/**
 * Open a shadcn Select dropdown and click an option whose `data-value`
 * matches `value`. Falls back to text-content match.
 */
export async function selectOption(
  triggerSelector: string,
  value: string,
): Promise<boolean> {
  const trigger = await waitForSelector(triggerSelector);
  if (!trigger) return false;
  clickElement(trigger);
  // Radix Select renders content in a portal under [role=listbox].
  const list = await waitForSelector('[role="listbox"]', 2000);
  if (!list) return false;
  await delay(120);
  // Try data-value first, then text fallback.
  let option =
    list.querySelector<HTMLElement>(`[data-value="${CSS.escape(value)}"]`) ??
    null;
  if (!option) {
    const items = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'));
    option =
      items.find(
        (it) => it.textContent?.trim().toLowerCase() === value.toLowerCase(),
      ) ?? null;
  }
  if (!option) return false;
  clickElement(option);
  return true;
}

/** Get bounding rect of an element relative to the viewport. */
export function rectOf(el: Element | null): DOMRect | null {
  if (!el) return null;
  return el.getBoundingClientRect();
}
