"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface OguriLogoProps {
  className?: string;
}

/**
 * OguriCap-inspired minimal logo: circular face + twin "ear" shapes.
 * Uses currentColor so it adapts to the surrounding text color.
 */
export const OguriLogo: React.FC<OguriLogoProps> = ({ className }) => {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("block", className)}
    >
      {/* Base circle (head) */}
      <circle cx="32" cy="34" r="18" fill="currentColor" opacity="0.9" />

      {/* Face mask */}
      <path
        d="M20 34c0 7.2 5.4 13 12 13s12-5.8 12-13c0-2-0.4-3.9-1.2-5.6C41 26 36.8 24 32 24s-9 2-10.8 4.4C20.4 30.1 20 32 20 34z"
        fill="white"
        opacity="0.94"
      />

      {/* Fringe */}
      <path
        d="M24 26c1.8-2.4 4.6-4 8-4s6.2 1.6 8 4c-1.6 0.4-3.4 0.6-5.3 0.6-2.2 0-4.3-0.3-6.7-0.7C26.4 26.7 25.2 26.4 24 26z"
        fill="currentColor"
        opacity="0.85"
      />

      {/* Left ear */}
      <path
        d="M20 10c-3 3-5 8.2-5 13l6 3c0.6-4.8 2.4-9.3 4.5-12.2L20 10z"
        fill="currentColor"
        opacity="0.9"
      />

      {/* Right ear */}
      <path
        d="M44 10c3 3 5 8.2 5 13l-6 3c-0.6-4.8-2.4-9.3-4.5-12.2L44 10z"
        fill="currentColor"
        opacity="0.9"
      />

      {/* Hairband stripe */}
      <path
        d="M23 14c2.4-2 5.6-3.2 9-3.2s6.6 1.2 9 3.2l-2 2.8C36.8 15.2 34.6 14.6 32 14.6s-4.8 0.6-6.9 2.2L23 14z"
        fill="currentColor"
        opacity="0.6"
      />

      {/* Tiny highlight */}
      <circle cx="26" cy="32" r="2" fill="currentColor" opacity="0.35" />
      <circle cx="38" cy="32" r="2" fill="currentColor" opacity="0.35" />
    </svg>
  );
};
