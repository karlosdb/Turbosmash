"use client";

import { useEvent } from "@/lib/context";

type TestModeWrapperProps = {
  feature?: "demoButtons" | "randomizeButtons" | "debugInfo" | "devTools" | "experimentalFeatures";
  children: React.ReactNode;
};

export default function TestModeWrapper({ feature, children }: TestModeWrapperProps) {
  const { isTestModeEnabled } = useEvent();

  if (!isTestModeEnabled(feature)) {
    return null;
  }

  return <>{children}</>;
}