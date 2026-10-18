import * as THREE from "three";

// World units are metres. The table's curved edge is centred on the origin;
// the dealer stands at -Z facing +Z and players sit around the +Z arc.

export const TABLE_Y = 0.8;
export const TABLE_R = 1.6;
export const TABLE_BACK = 0.55;
export const RAIL_R = 0.09;
export const SEAT_R = 2.12;
export const STOOL_TOP = 0.62;
export const BET_R = 1.18;
export const INSURANCE_R = 0.86;
export const CARD_R = 0.74;
export const CARD_W = 0.2;
export const CARD_H = CARD_W / 0.7;
export const CARD_T = 0.004;
export const CHIP_R = 0.05;
export const CHIP_H = 0.014;

export const DEALER_POS = new THREE.Vector3(0, 0, -1.05);
export const DEALER_CARDS = new THREE.Vector3(0.05, TABLE_Y, -0.08);
export const SHOE_POS = new THREE.Vector3(1.05, TABLE_Y, -0.3);
export const DISCARD_POS = new THREE.Vector3(-1.05, TABLE_Y, -0.3);
export const TRAY_POS = new THREE.Vector3(0, TABLE_Y, -0.4);

export function seatAngle(index: number, seats: number): number {
  const span = seats >= 6 ? 140 : seats >= 4 ? 118 : 86;
  const start = 90 - span / 2;
  const step = seats > 1 ? span / (seats - 1) : 0;
  return THREE.MathUtils.degToRad(start + index * step);
}

export function polar(angle: number, r: number, y = 0): THREE.Vector3 {
  return new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
}

/** rotation.y that makes a +Z-facing model look at the table centre. */
export function facingCenter(angle: number): number {
  return Math.atan2(-Math.cos(angle), -Math.sin(angle));
}

/** The seated player's right-hand direction on the table plane. */
export function playerRight(angle: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle));
}

export interface ViewBasis {
  /** Screen-right direction on the table plane. */
  right: THREE.Vector3;
  /** Screen-up direction on the table plane (away from the camera). */
  up: THREE.Vector3;
  /** rotation.y that makes a flat card read upright for this camera. */
  cardYaw: number;
}

export function viewBasis(cameraZSign: number): ViewBasis {
  // Camera on +Z looking at -Z: right is +X, up is -Z. Mirrored otherwise.
  const up = new THREE.Vector3(0, 0, -cameraZSign);
  const right = new THREE.Vector3(cameraZSign, 0, 0);
  return { right, up, cardYaw: Math.atan2(-up.x, -up.z) };
}

/** Where card `k` of hand `h` (of `n`) sits for the seat at `angle`. */
export function playerCardPosition(angle: number, h: number, n: number, k: number, view: ViewBasis): THREE.Vector3 {
  const base = polar(angle, CARD_R, TABLE_Y);
  const spread = n > 1 ? (n - 1) / 2 - h : 0;
  base.addScaledVector(playerRight(angle), spread * (CARD_W * 1.7));
  base.addScaledVector(view.right, k * CARD_W * 0.32);
  base.addScaledVector(view.up, -k * CARD_H * 0.16);
  base.y += 0.002 + k * CARD_T;
  return base;
}

export function dealerCardPosition(k: number, view: ViewBasis): THREE.Vector3 {
  const base = DEALER_CARDS.clone();
  base.addScaledVector(view.right, (k - 0.5) * CARD_W * 0.62);
  base.y += 0.002 + k * CARD_T;
  return base;
}

/** Bet spot for hand `h` of `n` (split hands sit next to their cards). */
export function betPosition(angle: number, h: number, n: number): THREE.Vector3 {
  const base = polar(angle, BET_R, TABLE_Y);
  if (n > 1) base.addScaledVector(playerRight(angle), ((n - 1) / 2 - h) * (CARD_W * 1.7));
  return base;
}

export const SIDE_SPOT_R = BET_R + 0.22;
export const SIDE_SPOT_RADIUS = 0.046;

/** Small side-bet circle `index` (0..3) next to a seat's main bet. */
export function sideSpotPosition(angle: number, index: number): THREE.Vector3 {
  return polar(angle, SIDE_SPOT_R, TABLE_Y).addScaledVector(playerRight(angle), (index - 1.5) * 0.105);
}

/** Spot on the rail where a player's own chips rest. */
export function stackPosition(angle: number): THREE.Vector3 {
  return polar(angle, TABLE_R - 0.16, TABLE_Y).addScaledVector(playerRight(angle), 0.24);
}
