import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export const generateToken = (userId: string): string => {
  const signOptions: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };

  return jwt.sign(
    { userId },
    env.JWT_SECRET,
    signOptions
  );
};
