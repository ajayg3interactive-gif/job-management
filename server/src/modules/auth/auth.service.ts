import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { BCRYPT_COST, REMEMBER_ME_SECONDS } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { prisma } from '../../utils/prisma.js';
import type { AuthUser } from '../../types/express.js';
import type { LoginInput } from './auth.schema.js';

// Compared against when the email is unknown, so the response time does not
// reveal whether an account exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

const userSelect = { id: true, name: true, email: true, isActive: true } as const;

const toAuthUser = (user: { id: number; name: string; email: string }): AuthUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
});

export async function login({ email, password, rememberMe }: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { ...userSelect, passwordHash: true },
  });

  // Always run a bcrypt compare, whether or not the user exists.
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  // Unknown email, wrong password and inactive user all look identical.
  if (!user || !passwordMatches || !user.isActive) {
    throw AppError.invalidCredentials();
  }

  // env.JWT_EXPIRES_IN is a free-form string such as "1d"; jsonwebtoken validates it at sign time.
  const expiresIn: SignOptions['expiresIn'] = rememberMe
    ? REMEMBER_ME_SECONDS
    : (env.JWT_EXPIRES_IN as SignOptions['expiresIn']);

  const token = jwt.sign({}, env.JWT_SECRET, { subject: String(user.id), expiresIn });

  return { user: toAuthUser(user), token };
}

// Returns the active user the token belongs to, or null if the token is bad
// or the user no longer exists or was deactivated.
export async function getUserFromToken(token: string): Promise<AuthUser | null> {
  let userId: number;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload === 'string' || !payload.sub) return null;
    userId = Number(payload.sub);
  } catch {
    return null;
  }
  if (!Number.isInteger(userId)) return null;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
  if (!user || !user.isActive) return null;

  return toAuthUser(user);
}
