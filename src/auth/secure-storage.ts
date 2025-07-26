import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Secure storage for OAuth tokens
 * Uses OS-specific encryption when available, falls back to encrypted file storage
 */
export class SecureTokenStorage {
  private storageDir: string;
  private keyPath: string;
  private algorithm = 'aes-256-gcm';
  
  constructor() {
    // Use XDG_CONFIG_HOME or fallback to ~/.config
    const configDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    this.storageDir = path.join(configDir, 'graphyn-cli');
    this.keyPath = path.join(this.storageDir, '.key');
    
    // Ensure directory exists with secure permissions
    this.ensureSecureDirectory();
  }
  
  /**
   * Store tokens securely
   */
  async store(tokens: any): Promise<void> {
    try {
      // Get or create encryption key
      const key = await this.getOrCreateKey();
      
      // Encrypt tokens
      const encrypted = await this.encrypt(JSON.stringify(tokens), key);
      
      // Write encrypted data
      const tokenPath = path.join(this.storageDir, 'tokens.enc');
      fs.writeFileSync(tokenPath, encrypted, { mode: 0o600 });
      
      console.log('Tokens stored securely');
    } catch (error) {
      console.error('Failed to store tokens securely:', error);
      throw new Error('Failed to store authentication tokens');
    }
  }
  
  /**
   * Retrieve tokens from secure storage
   */
  async retrieve(): Promise<any | null> {
    try {
      const tokenPath = path.join(this.storageDir, 'tokens.enc');
      
      if (!fs.existsSync(tokenPath)) {
        return null;
      }
      
      // Read encrypted data
      const encrypted = fs.readFileSync(tokenPath, 'utf8');
      
      // Get encryption key
      const key = await this.getOrCreateKey();
      
      // Decrypt tokens
      const decrypted = await this.decrypt(encrypted, key);
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to retrieve tokens:', error);
      return null;
    }
  }
  
  /**
   * Clear stored tokens
   */
  async clear(): Promise<void> {
    try {
      const tokenPath = path.join(this.storageDir, 'tokens.enc');
      if (fs.existsSync(tokenPath)) {
        // Overwrite with random data before deletion
        const size = fs.statSync(tokenPath).size;
        const randomData = crypto.randomBytes(size);
        fs.writeFileSync(tokenPath, randomData);
        fs.unlinkSync(tokenPath);
      }
    } catch (error) {
      console.error('Failed to clear tokens:', error);
    }
  }
  
  /**
   * Ensure storage directory exists with secure permissions
   */
  private ensureSecureDirectory(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true, mode: 0o700 });
    }
    
    // Verify permissions
    const stats = fs.statSync(this.storageDir);
    const mode = stats.mode & parseInt('777', 8);
    if (mode !== parseInt('700', 8)) {
      fs.chmodSync(this.storageDir, 0o700);
    }
  }
  
  /**
   * Get or create encryption key
   */
  private async getOrCreateKey(): Promise<Buffer> {
    if (fs.existsSync(this.keyPath)) {
      // Read existing key
      const keyData = fs.readFileSync(this.keyPath);
      return keyData;
    }
    
    // Generate new key
    const key = crypto.randomBytes(32);
    
    // Store key with secure permissions
    fs.writeFileSync(this.keyPath, key, { mode: 0o600 });
    
    return key;
  }
  
  /**
   * Encrypt data using AES-256-GCM
   */
  private async encrypt(text: string, key: Buffer): Promise<string> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv) as crypto.CipherGCM;
    
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Combine iv + authTag + encrypted
    const combined = Buffer.concat([iv, authTag, encrypted]);
    
    return combined.toString('base64');
  }
  
  /**
   * Decrypt data using AES-256-GCM
   */
  private async decrypt(encryptedText: string, key: Buffer): Promise<string> {
    const combined = Buffer.from(encryptedText, 'base64');
    
    // Extract components
    const iv = combined.slice(0, 16);
    const authTag = combined.slice(16, 32);
    const encrypted = combined.slice(32);
    
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv) as crypto.DecipherGCM;
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  }
  
  /**
   * Check if running with elevated privileges (security check)
   */
  static isElevated(): boolean {
    return process.getuid && process.getuid() === 0;
  }
  
  /**
   * Get secure storage implementation based on platform
   */
  static async getPlatformStorage(): Promise<SecureTokenStorage> {
    // For now, use the same implementation for all platforms
    // In the future, could integrate with:
    // - macOS Keychain
    // - Windows Credential Manager
    // - Linux Secret Service API
    
    if (SecureTokenStorage.isElevated()) {
      throw new Error('Cannot use secure storage with elevated privileges');
    }
    
    return new SecureTokenStorage();
  }
}