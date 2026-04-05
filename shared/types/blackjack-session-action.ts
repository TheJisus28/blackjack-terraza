import {
  PLAYER_ACTION,
  type PlayerAction,
} from "@/game/simulation/blackjack";

/** Server / client meta actions (not in-hand moves). */
export const SESSION_META = {
  START_GAME: "start_game",
  AUTO_CLEAR: "auto_clear",
  AUTO_DEAL: "auto_deal",
  AUTO_INSURANCE: "auto_insurance",
  INSURANCE_ACCEPT: "insurance_accept",
  INSURANCE_DECLINE: "insurance_decline",
  AUTO_REBUY_RESULTS: "auto_rebuy_results",
  REBUY: "rebuy",
  /** Between rounds: keep chips, skip betting until sit in */
  WATCH_TABLE: "watch_table",
  SIT_IN: "sit_in",
  /** End of dealer-natural reveal pause → settle hands */
  AUTO_RESOLVE_DEALER_BJ: "auto_resolve_dealer_bj",
} as const;

export type SessionMetaAction =
  (typeof SESSION_META)[keyof typeof SESSION_META];

/** All string keys sent on the action wire (player moves + meta). */
export const SESSION_ACTION = {
  ...PLAYER_ACTION,
  ...SESSION_META,
} as const;

export type BlackjackSessionAction = PlayerAction | SessionMetaAction;

export const SESSION_TIMER_ACTION = {
  AUTO_CLEAR: SESSION_META.AUTO_CLEAR,
  AUTO_DEAL: SESSION_META.AUTO_DEAL,
  AUTO_INSURANCE: SESSION_META.AUTO_INSURANCE,
  AUTO_REBUY_RESULTS: SESSION_META.AUTO_REBUY_RESULTS,
  AUTO_RESOLVE_DEALER_BJ: SESSION_META.AUTO_RESOLVE_DEALER_BJ,
} as const;

export type BlackjackSessionTimerAction =
  (typeof SESSION_TIMER_ACTION)[keyof typeof SESSION_TIMER_ACTION];
