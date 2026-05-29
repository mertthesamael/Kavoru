import * as jose from "jose";
import { config } from "../../config";
import { JWT_ALGORITHM, JWT_TTL } from "../../constants/jwt";
import {
  InvalidBodyError,
  NotAuthorizedError,
} from "../../models/errors/http-error";
import type { TokenPayload } from "./types";

export abstract class AuthService {
  static async validateToken(
    token: string | undefined,
  ): Promise<TokenPayload | null> {
    if (!token) throw InvalidBodyError("Token is required");

    try {
      const { payload } = await jose.jwtVerify(
        token,
        new TextEncoder().encode(config.env.jwt.secret),
      );
      return payload as unknown as TokenPayload;
    } catch {
      throw NotAuthorizedError("Invalid token");
    }
  }

  static async generateToken(payload: TokenPayload): Promise<string> {
    const secret = new TextEncoder().encode(config.env.jwt.secret);
    return await new jose.SignJWT(payload as unknown as jose.JWTPayload)
      .setProtectedHeader({ alg: JWT_ALGORITHM })
      .setIssuedAt()
      .setExpirationTime(JWT_TTL)
      .sign(secret);
  }
}
