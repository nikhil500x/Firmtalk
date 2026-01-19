import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Token Service
 * Handles generation and validation of secure tokens for user invitations
 */

export class TokenService {
  /**
   * Generate a secure random token for invitation
   * @returns {string} A secure URL-safe token
   */
  static generateInvitationToken(): string {
    // Generate a UUID v4 token (URL-safe and collision-resistant)
    return uuidv4();
  }

  /**
   * Hash a token for secure storage
   * @param {string} token - The plain token to hash
   * @returns {string} Hashed token
   */
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Verify if a token matches its hash
   * @param {string} token - The plain token
   * @param {string} hashedToken - The hashed token from database
   * @returns {boolean} True if token matches
   */
  static verifyToken(token: string, hashedToken: string): boolean {
    const hash = this.hashToken(token);
    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(hashedToken)
    );
  }

  /**
   * Check if a token has expired
   * @param {Date} expiresAt - The expiration date
   * @returns {boolean} True if token is expired
   */
  static isTokenExpired(expiresAt: Date): boolean {
    return new Date() > new Date(expiresAt);
  }

  /**
   * Generate expiration date for invitation token
   * @param {number} hours - Hours until expiration (default: 48)
   * @returns {Date} Expiration date
   */
  static getExpirationDate(hours: number = 48): Date {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + hours);
    return expiresAt;
  }
}

