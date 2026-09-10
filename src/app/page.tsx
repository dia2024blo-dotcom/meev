"use client";

import dynamic from "next/dynamic";
import { MeevSplash } from "@/components/meev/logo";

// Code-splitting (spec §2.2): the whole super-app ships as its own lazy chunk.
const MeevApp = dynamic(() => import("@/components/meev/app").then((m) => m.MeevApp), {
  loading: () => <MeevSplash />,
  ssr: false,
});

export default function Page() {
  return <MeevApp />;
}
