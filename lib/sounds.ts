const cache = new Map<string, HTMLAudioElement>();

function preload(src: string): HTMLAudioElement {
  let audio = cache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audio.preload = "auto";
    cache.set(src, audio);
  }
  return audio;
}

function play(src: string, volume = 0.5) {
  if (typeof window === "undefined") return;
  try {
    const audio = preload(src).cloneNode(true) as HTMLAudioElement;
    audio.volume = volume;
    audio.play().catch(() => {});
  } catch {
    /* silent fail — user hasn't interacted yet */
  }
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const CARD_DEAL_SOUNDS = [
  "/sounds/card-deal.ogg",
  "/sounds/card-deal-2.ogg",
  "/sounds/card-deal-3.ogg",
];

const CHIP_PLACE_SOUNDS = [
  "/sounds/chip-place.ogg",
  "/sounds/chip-place-2.ogg",
];

export const sounds = {
  cardDeal() {
    play(pickRandom(CARD_DEAL_SOUNDS), 0.4);
  },

  chipPlace() {
    play(pickRandom(CHIP_PLACE_SOUNDS), 0.45);
  },

  chipsCollect() {
    play("/sounds/chips-collect.ogg", 0.5);
  },

  chipsStack() {
    play("/sounds/chips-stack.ogg", 0.4);
  },

  cardShuffle() {
    play("/sounds/card-shuffle.ogg", 0.35);
  },

  win() {
    play("/sounds/win.ogg", 0.4);
  },

  lose() {
    play("/sounds/lose.ogg", 0.3);
  },

  blackjack() {
    play("/sounds/win.ogg", 0.5);
  },

  push() {
    play("/sounds/chips-collect.ogg", 0.3);
  },

  turn() {
    play(pickRandom(CHIP_PLACE_SOUNDS), 0.25);
  },

  bust() {
    play("/sounds/chips-stack.ogg", 0.35);
  },

  preloadAll() {
    for (const src of [
      ...CARD_DEAL_SOUNDS,
      ...CHIP_PLACE_SOUNDS,
      "/sounds/chips-collect.ogg",
      "/sounds/chips-stack.ogg",
      "/sounds/card-shuffle.ogg",
      "/sounds/win.ogg",
      "/sounds/lose.ogg",
    ]) {
      preload(src);
    }
  },
};
