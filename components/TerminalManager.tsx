"use client";

import React from "react";
import type { Terminal } from "@/lib/types";

interface TerminalManagerProps {
  terminals?: Terminal[];
  setTerminals?: React.Dispatch<React.SetStateAction<Terminal[]>>;
}

export default function TerminalManager(_props: TerminalManagerProps) {
  return null;
}
