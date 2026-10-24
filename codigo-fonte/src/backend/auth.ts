import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'axis-rdo-secret-default-key-change';

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  nome: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'GESTOR' | 'CAMPO' | 'LEITOR';
  isSuperAdmin?: boolean;
  tenantNome?: string;
  plano?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

// -------------------------------------------------------------
// HASHING E SENHAS
// -------------------------------------------------------------
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// -------------------------------------------------------------
// JWT TOKENS
// -------------------------------------------------------------
export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      nome: user.nome,
      role: user.role,
      isSuperAdmin: Boolean(user.isSuperAdmin || user.role === 'SUPERADMIN'),
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// HELPER PARA EXTRAÇÃO DE USUÁRIO DA REQUISIÇÃO
// -------------------------------------------------------------
export function getUserFromRequest(req: Request): AuthUser | null {
  let token = (req as any).cookies?.['axis_auth_token'];
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return null;
  return verifyToken(token);
}

// -------------------------------------------------------------
// MIDDLEWARE DE AUTENTICAÇÃO
// -------------------------------------------------------------
export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  let token = req.cookies?.['axis_auth_token'];

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado. Faça login para continuar.' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Sessão expirada ou inválida. Faça login novamente.' });
  }

  req.user = user;
  next();
}

// -------------------------------------------------------------
// CONTROLE DE NÍVEIS DE ACESSO (RBAC)
// -------------------------------------------------------------
export function requireRole(allowedRoles: ('SUPERADMIN' | 'ADMIN' | 'GESTOR' | 'CAMPO' | 'LEITOR')[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    if (req.user.isSuperAdmin || req.user.role === 'SUPERADMIN' || allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      error: `Acesso negado. Ação permitida apenas para os perfis: ${allowedRoles.join(', ')}.`,
    });
  };
}

export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Acesso não autorizado. Faça login.' });
  }

  if (!req.user.isSuperAdmin && req.user.role !== 'SUPERADMIN') {
    return res.status(403).json({ error: 'Acesso restrito à gestão da Axis Consultoria e Planejamento.' });
  }

  next();
}
