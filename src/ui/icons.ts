/** Zlatá mince s rybkou (místo emoji 🪙, které je v Apple fontu stříbrné). */
export const COIN_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10.5" fill="#f2b705"/><circle cx="12" cy="12" r="10.5" fill="none" stroke="#b7800a" stroke-width="1.6"/><circle cx="12" cy="12" r="7.6" fill="#ffd54a" stroke="#d99a06" stroke-width="1"/><path d="M7.2 12c1.4-2 3.1-3 5-3 1.9 0 3.4 1 4.4 3-1 2-2.5 3-4.4 3-1.9 0-3.6-1-5-3Z" fill="#c98a04"/><path d="M7.4 12 5.6 10.4v3.2Z" fill="#c98a04"/><circle cx="14.4" cy="11.4" r=".75" fill="#ffe89a"/></svg>';

export const coinHTML = `<span class="coin">${COIN_SVG}</span>`;
