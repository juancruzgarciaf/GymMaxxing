import crypto from "crypto";

type TokenUser = {
  id: number;
  email: string;
  username: string;
  tipo_usuario: string;
};

type TokenPayload = TokenUser & {
  exp: number;
};

const base64UrlEncode = (value: string) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const base64UrlDecode = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
};

const getSecret = () => process.env.AUTH_TOKEN_SECRET || "gymmaxxing-dev-secret";

export const createAuthToken = (user: TokenUser, expiresInHours = 24) => {
  const header = { alg: "HS256", typ: "JWT" };
  const payload: TokenPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + expiresInHours * 60 * 60,
  };

  const headerPart = base64UrlEncode(JSON.stringify(header));
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const content = `${headerPart}.${payloadPart}`;

  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(content)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${content}.${signature}`;
};

export const verifyAuthToken = (token: string) => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const headerPart = parts[0];
  const payloadPart = parts[1];
  const signature = parts[2];

  if (!headerPart || !payloadPart || !signature) {
    return null;
  }
  const content = `${headerPart}.${payloadPart}`;
  const expectedSignature = crypto
    .createHmac("sha256", getSecret())
    .update(content)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart)) as TokenPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};
