import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    email?: string;
    name?: string;
    role?: {
      id: number;
      name: string;
    };
    permissions?: string[];
  }
}

