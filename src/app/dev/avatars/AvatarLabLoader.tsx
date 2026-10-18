"use client";

import dynamic from "next/dynamic";

export const AvatarLabLoader = dynamic(() => import("./AvatarLab").then((m) => m.AvatarLab), { ssr: false });
