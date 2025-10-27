import { isDevelopmentEnvironment, isTestEnvironment } from "@/lib/constants";

const HTTPS_PROTOCOL = "https:";
const HTTPS_HEADER_VALUE = "https";

type RequestLike =
  | Request
  | {
      headers?: { get(name: string): string | null } | null;
      nextUrl?: { protocol?: string };
      url?: string | URL;
    }
  | null
  | undefined;

type HeadersLike = { get(name: string): string | null } | null | undefined;

const getHeaders = (request?: RequestLike): HeadersLike => {
  if (!request) {
    return undefined;
  }

  if (request instanceof Request) {
    return request.headers;
  }

  if (request && "headers" in request) {
    return request.headers ?? undefined;
  }

  return undefined;
};

const getProtocolFromHeader = (headers: HeadersLike) => {
  const forwardedProto = headers?.get?.("x-forwarded-proto");

  if (!forwardedProto) {
    return undefined;
  }

  return forwardedProto.split(",")[0]?.trim();
};

const getProtocolFromRequest = (request?: RequestLike) => {
  if (!request) {
    return undefined;
  }

  if (request instanceof Request) {
    try {
      return new URL(request.url).protocol;
    } catch (error) {
      return undefined;
    }
  }

  if (request?.nextUrl?.protocol) {
    return request.nextUrl.protocol;
  }

  if (typeof request?.url === "string" || request?.url instanceof URL) {
    try {
      return new URL(request.url).protocol;
    } catch (error) {
      return undefined;
    }
  }

  return undefined;
};

const getProtocolFromEnv = () => {
  const configuredUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;

  if (!configuredUrl) {
    return undefined;
  }

  try {
    return new URL(configuredUrl).protocol;
  } catch (error) {
    return undefined;
  }
};

export const shouldUseSecureCookies = (request?: RequestLike) => {
  if (isDevelopmentEnvironment || isTestEnvironment) {
    return false;
  }

  const protocolFromHeader = getProtocolFromHeader(getHeaders(request));

  if (protocolFromHeader) {
    return protocolFromHeader === HTTPS_HEADER_VALUE;
  }

  const protocolFromRequest = getProtocolFromRequest(request);

  if (protocolFromRequest) {
    return protocolFromRequest === HTTPS_PROTOCOL;
  }

  const protocolFromEnv = getProtocolFromEnv();

  if (protocolFromEnv) {
    return protocolFromEnv === HTTPS_PROTOCOL;
  }

  return false;
};
