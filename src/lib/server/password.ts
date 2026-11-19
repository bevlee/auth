import { compare } from "bcryptjs";
import { hashPassword, verifyPassword } from "better-auth/crypto";

export const passwordOptions = {
  hash: hashPassword,
  async verify(credentials: Parameters<typeof verifyPassword>[0]): Promise<boolean> {
    try {
      if (/^\$2[ab]\$/.test(credentials.hash)) {
        return await compare(credentials.password, credentials.hash);
      }
      return await verifyPassword(credentials);
    } catch {
      return false;
    }
  },
};
