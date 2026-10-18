// Curated third-party assets. Every source below is CC0 (public domain).

/** Voxel avatars from 100Avatars R1/R2 by Polygonal Mind (CC0). [id, source name] */
export const AVATARS = [
  ["robert", "Robert"],
  ["mikel", "Mikel"],
  ["chad", "Chad"],
  ["olivia", "Olivia"],
  ["udom", "Udom"],
  ["erika", "Erika"],
  ["lydia", "Lydia"],
  ["retroman", "Retroman"],
  ["ro", "Ro"],
  ["samuela", "Samuela"],
  ["oldmoustache", "OldMoustache"],
  ["mafiossini", "Mafiossini"],
  ["kate", "Kate"],
  ["wizzir", "Wizzir"],
  ["baldman", "Baldman"],
  ["dracula", "Dracula"],
  ["shiro", "Shiro"],
  ["jennifer", "Jennifer"],
  ["jimmy", "Jimmy"],
  ["kyle", "Kyle"],
  ["david", "David"],
  ["polydancer", "Polydancer"],
  ["amazonas", "Amazonas"],
  ["clown", "Clown"],
  ["witch", "Witch"],
  ["astronaut", "Astronaut"],
  ["saintclaus", "SaintClaus"],
  ["captainlobster", "CaptainLobster"],
  ["cappy", "Cappy"],
  ["rose", "Rose"],
  ["mister", "Mister"],
  ["coolpirate", "CoolPirate"],
  ["moongirl", "MoonGirl"],
  ["hodlerking", "HodlerKing"],
  ["coolmoneybag", "CoolMoneyBag"],
  ["bizdude", "Bizdude"],
];

/** The dealer is not selectable by players. */
export const DEALER_AVATAR = "bizdude";

export const AVATAR_LISTS = [
  "https://raw.githubusercontent.com/toxsam/open-source-avatars/main/data/avatars/100avatars-r1.json",
  "https://raw.githubusercontent.com/toxsam/open-source-avatars/main/data/avatars/100avatars-r2.json",
];

export const ZIPS = {
  // Quaternius Universal Animation Library 1 & 2, Standard (CC0, OpenGameArt release)
  ual1: "https://opengameart.org/sites/default/files/universal_animation_librarystandard.zip",
  ual2: "https://opengameart.org/sites/default/files/universal_animation_library_2standard.zip",
  // Kenney (CC0)
  "kenney-casino-audio": "https://opengameart.org/sites/default/files/kenney_casino-audio.zip",
  "kenney-cards": "https://opengameart.org/sites/default/files/playing-cards-pack_0.zip",
  "kenney-boardgame": "https://opengameart.org/sites/default/files/boardgamePack_v2.zip",
};

const KAYKIT = "https://raw.githubusercontent.com/KayKit-Game-Assets";

/** KayKit by Kay Lousberg (CC0). */
export const KAYKIT_FILES = {
  "kaykit/Knight.glb": `${KAYKIT}/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures/Characters/gltf/Knight.glb`,
};

export const FURNITURE = [
  "chair_stool",
  "armchair",
  "couch_pillows",
  "lamp_standing",
  "lamp_table",
  "cactus_medium_A",
  "cactus_small_B",
  "pictureframe_large_A",
  "pictureframe_large_B",
  "rug_rectangle_stripes_A",
  "rug_oval_A",
  "shelf_B_large_decorated",
  "table_low",
  "table_small",
];
export const FURNITURE_BASE = `${KAYKIT}/KayKit-Furniture-Bits-1.0/main/addons/kaykit_furniture_bits/Assets/gltf`;

export const RESTAURANT = ["pillar_A", "table_round_A_small", "jar_A_small", "jar_C_small", "plate_small"];
export const RESTAURANT_BASE = `${KAYKIT}/KayKit-Restaurant-Bits-1.0/main/addons/kaykit_restaurant_bits/Assets/gltf`;

/** Clips baked onto the avatar skeleton: [output name, source, source clip]. */
export const CLIPS = [
  ["sit_idle", "ual1", "Sitting_Idle_Loop"],
  ["sit_talk", "ual1", "Sitting_Talking_Loop"],
  ["sit_enter", "ual1", "Sitting_Enter"],
  ["sit_exit", "ual1", "Sitting_Exit"],
  ["idle", "ual1", "Idle_Loop"],
  ["talk", "ual1", "Idle_Talking_Loop"],
  ["interact", "ual1", "Interact"],
  ["pickup", "ual1", "PickUp_Table"],
  ["dance", "ual1", "Dance_Loop"],
  ["hit_head", "ual1", "Hit_Head"],
  ["walk", "ual1", "Walk_Formal_Loop"],
  ["yes", "ual2", "Yes"],
  ["no", "ual2", "Idle_No_Loop"],
  ["fold_arms", "ual2", "Idle_FoldArms_Loop"],
  ["drink", "ual2", "Consume"],
  ["lean", "ual2", "Idle_Rail_Loop"],
  ["lean_call", "ual2", "Idle_Rail_Call"],
  ["cheer", "kaykit", "Cheer"],
  ["sit_chair", "kaykit", "Sit_Chair_Idle"],
  ["use_item", "kaykit", "Use_Item"],
  ["flinch", "kaykit", "Hit_A"],
];
