import { notFound } from "next/navigation";
import { AvatarLabLoader } from "./AvatarLabLoader";

export default function AvatarLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AvatarLabLoader />;
}
