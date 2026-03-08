const DEFAULT_BACKEND_ORIGIN = "http://localhost:8000";

function getFallbackBackendOrigin() {
  if (typeof window === "undefined") {
    return DEFAULT_BACKEND_ORIGIN;
  }

  return `${window.location.protocol}//${window.location.hostname}:8000`;
}

export function getBackendOrigin() {
  return process.env.NEXT_PUBLIC_API_URL || getFallbackBackendOrigin();
}

export function getBackendApiUrl(path: string) {
  return `${getBackendOrigin()}/api/${path.replace(/^\/+/, "")}`;
}

export function getBackendWebSocketUrl(path: string) {
  const httpOrigin = getBackendOrigin();
  const wsOrigin = httpOrigin.startsWith("https://")
    ? httpOrigin.replace("https://", "wss://")
    : httpOrigin.replace("http://", "ws://");

  return `${wsOrigin}/api/${path.replace(/^\/+/, "")}`;
}