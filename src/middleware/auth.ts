import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { config } from '../config/index.js';
import { UnauthorizedError } from './errorHandler.js';
import { logger } from '../config/logger.js';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  groups?: string[];
  [key: string]: unknown;
}

// JWKS client for Cognito token validation
const jwksClient = jwksRsa({
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 10,
  jwksUri: `https://cognito-idp.${config.aws.region}.amazonaws.com/${config.cognito.userPoolId}/.well-known/jwks.json`,
});

// Get signing key from JWKS
const getSigningKey = (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback): void => {
  if (!header.kid) {
    callback(new Error('Missing kid in token header'));
    return;
  }

  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
};

// Verify Cognito token
const verifyCognitoToken = (token: string): Promise<AuthenticatedUser> => {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getSigningKey,
      {
        algorithms: ['RS256'],
        issuer: `https://cognito-idp.${config.aws.region}.amazonaws.com/${config.cognito.userPoolId}`,
      },
      (err, decoded) => {
        if (err) {
          reject(err);
          return;
        }

        const payload = decoded as jwt.JwtPayload;
        resolve({
          id: payload.sub || '',
          email: payload.email || payload['cognito:username'] || '',
          groups: payload['cognito:groups'] || [],
          ...payload,
        });
      }
    );
  });
};

// Verify local JWT token (for development)
const verifyLocalToken = (token: string): Promise<AuthenticatedUser> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, config.jwt.secret, (err, decoded) => {
      if (err) {
        reject(err);
        return;
      }

      const payload = decoded as jwt.JwtPayload;
      resolve({
        id: payload.sub || payload.id || '',
        email: payload.email || '',
        groups: payload.groups || [],
        ...payload,
      });
    });
  });
};

// Authentication middleware
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No authentication token provided');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('Invalid authentication token format');
    }

    let user: AuthenticatedUser;

    // Use Cognito in production, local JWT in development
    if (config.isProduction && config.cognito.userPoolId) {
      user = await verifyCognitoToken(token);
    } else {
      user = await verifyLocalToken(token);
    }

    req.user = user;
    next();
  } catch (error) {
    logger.debug('Authentication failed:', error);
    next(new UnauthorizedError('Invalid or expired authentication token'));
  }
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      if (token) {
        if (config.isProduction && config.cognito.userPoolId) {
          req.user = await verifyCognitoToken(token);
        } else {
          req.user = await verifyLocalToken(token);
        }
      }
    }

    next();
  } catch (error) {
    next();
  }
};

// Require specific groups/roles
export const requireGroups = (...requiredGroups: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const userGroups = req.user.groups || [];
    const hasRequiredGroup = requiredGroups.some((group) =>
      userGroups.includes(group)
    );

    if (!hasRequiredGroup) {
      next(new UnauthorizedError('Insufficient permissions'));
      return;
    }

    next();
  };
};
