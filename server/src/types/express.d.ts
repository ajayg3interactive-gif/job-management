export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      // Set by requireAuth
      user?: AuthUser;
    }
  }
}
