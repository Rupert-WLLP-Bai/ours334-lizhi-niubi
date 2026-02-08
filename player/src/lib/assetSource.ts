export type AssetSource = "local" | "cloud";

function sanitizePrefix(prefix: string): string {
  return prefix.replace(/^\/+|\/+$/g, "");
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, "");
}

export function getAssetSource(env: NodeJS.ProcessEnv = process.env): AssetSource {
  return env.ASSET_SOURCE === "cloud" ? "cloud" : "local";
}

export function getAssetPrefix(env: NodeJS.ProcessEnv = process.env): string {
  return sanitizePrefix(env.ASSET_PREFIX || "albums");
}

export function getAssetBaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  if (!env.ASSET_BASE_URL) return null;
  const trimmed = trimTrailingSlash(env.ASSET_BASE_URL.trim());
  return trimmed.length > 0 ? trimmed : null;
}

export function isCloudAssetSource(env: NodeJS.ProcessEnv = process.env): boolean {
  return getAssetSource(env) === "cloud";
}

export function buildCloudAssetUrl(
  albumName: string,
  fileName: string,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const baseUrl = getAssetBaseUrl(env);
  if (!baseUrl) return null;

  const prefix = getAssetPrefix(env);
  const encodedPrefixSegments = prefix
    .split("/")
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment));

  const segments = [
    ...encodedPrefixSegments,
    encodeURIComponent(albumName),
    encodeURIComponent(fileName),
  ];

  return `${baseUrl}/${segments.join("/")}`;
}

export function isCloudflareS3ApiEndpointUrl(value: string): boolean {
  try {
    return new URL(value).hostname.endsWith(".r2.cloudflarestorage.com");
  } catch {
    return false;
  }
}
