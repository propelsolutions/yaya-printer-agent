import { platform } from "node:os";

export type PrintHostPlatform = "win32" | "darwin" | "linux" | "other";

export function getPrintHostPlatform(): PrintHostPlatform {
  const hostPlatform = platform();
  if (hostPlatform === "win32" || hostPlatform === "darwin" || hostPlatform === "linux") {
    return hostPlatform;
  }

  return "other";
}

export function usesWindowsPrintSpooler(): boolean {
  return getPrintHostPlatform() === "win32";
}

export function usesCups(): boolean {
  return getPrintHostPlatform() === "darwin" || getPrintHostPlatform() === "linux";
}
