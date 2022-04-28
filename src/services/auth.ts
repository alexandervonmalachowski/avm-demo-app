import jwt from "jsonwebtoken";
import jwkToPem from "jwk-to-pem";
import fetch from "node-fetch";
import { inspect } from "util";

import { AuthenticatedUser } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const print = (v: any) => console.log(inspect(v, false, null, false));

export class HttpError extends Error {
  status: number;
  constructor(status: number, message?: string) {
    super(message);
    this.status = status;
  }
}

export type AuthService = {
  verifyAuthorizationBearer(headers?: AuthHeader): ValidatedHeader;
  requireUser(headers?: AuthHeader): AuthenticatedUser;
};

export type AuthHeader = {
  authorization?: string;
};

export type ValidatedHeader =
  | {
      opaque: true;
      token: string;
    }
  | {
      opaque: false;
      token: string;
      verifiedToken: VerifiedToken;
    };

export type VerifiedToken = {
  oid: string;
  roles: string[];
  preferred_username: string;
  name: string;
} & Record<string, unknown>;

export function verifiedTokenToHomeTestUser(
  token: VerifiedToken
): AuthenticatedUser {
  return {
    adId: token.oid,
    email: token.preferred_username,
    name: token.name,
  };
}

export default async (
  openIdUrl: string,
  clientId: string
): Promise<AuthService> => {
  // Fetch openId configuration
  const openIdConf = await fetch(openIdUrl, {
    headers: { "Content-Type": "application/json" },
  }).then((r) => r.json());
  print({ openIdConf });
  const { jwks_uri, id_token_signing_alg_values_supported } = openIdConf;

  // Fetch public key
  type ADKey = jwkToPem.JWK & { kid: string };
  const jwks: { keys: ADKey[] } = await fetch(jwks_uri, {
    headers: { "Content-Type": "application/json" },
  }).then((r) => r.json());
  if (!Array.isArray(jwks?.keys)) {
    throw new Error(`No jwks found at ${jwks_uri}`);
  }

  const verifyAuthorizationBearer = (headers?: AuthHeader): ValidatedHeader => {
    // Read token from header
    const authorizationHeader = headers?.authorization;
    if (authorizationHeader == null || authorizationHeader == "") {
      throw new Error("Missing authorization header.");
    }
    const [type, token] = authorizationHeader.split(" ");
    if (type != "Bearer") {
      throw new Error("Authorization header does not contain bearer token.");
    }

    // Decode Token
    print({ token });
    const decodedToken = jwt.decode(token, { complete: true });
    print({ decodedToken });
    if (decodedToken == null) {
      throw new Error("Unexpected decoding result.");
    }

    // Check if the token is intended for our service
    if (
      decodedToken.payload &&
      typeof decodedToken.payload !== "string" &&
      decodedToken.payload?.aud != clientId
    ) {
      return {
        opaque: true,
        token,
      };
    }

    // Find correct public key
    const kid = decodedToken.header?.kid;
    const key = jwks.keys.find((k) => k.kid === kid);
    print({ key });
    if (key == null) {
      throw new Error("Missing public key for token.");
    }

    // Convert json object o PEM
    const jwkPem = jwkToPem(key);
    print({ jwkPem });

    // Verify against the key
    const verifiedToken = jwt.verify(token, jwkPem, {
      algorithms: id_token_signing_alg_values_supported,
    });
    print({ verifiedToken });
    if (verifiedToken == null || typeof verifiedToken == "string") {
      throw new Error("Unexpected verification result.");
    }

    return {
      opaque: false,
      token,
      verifiedToken: verifiedToken as VerifiedToken,
    };
  };

  const requireUser = (headers?: AuthHeader) => {
    try {
      print({ headers });
      const authenticated = verifyAuthorizationBearer(headers);
      print({ authenticated });
      if (authenticated.opaque) {
        throw new Error("Unable to validate authentication header.");
      }
      return verifiedTokenToHomeTestUser(authenticated.verifiedToken);
    } catch (err) {
      if (err instanceof Error) {
        throw new HttpError(401, err.message);
      }
      throw new HttpError(401, "Unexpected authentication error.");
    }
  };

  return { verifyAuthorizationBearer, requireUser };
};
