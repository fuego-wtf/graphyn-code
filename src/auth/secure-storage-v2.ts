import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

/**
 * Interface for secure token storage implementations
 */
export interface ISecureTokenStorage {
  store(tokens: any, context?: string): Promise<void>;
  retrieve(context?: string): Promise<any | null>;
  clear(context?: string): Promise<void>;
  listContexts?(): Promise<string[]>;
}

/**
 * Token metadata for lifecycle management
 */
export interface SecureToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType: string;
  scope?: string;
  metadata?: {
    storedAt: Date;
    lastUsed: Date;
    source: string;
    version: string;
  };
}

/**
 * Audit logger for security events
 */
class SecurityAuditLogger {
  private logPath: string;
  
  constructor() {
    const configDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    const logDir = path.join(configDir, 'graphyn-cli', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true, mode: 0o700 });
    }
    this.logPath = path.join(logDir, 'security-audit.log');
  }
  
  async log(event: {
    action: string;
    context?: string;
    success: boolean;
    error?: string;
    metadata?: any;
  }): Promise<void> {
    const entry = {
      timestamp: new Date().toISOString(),
      pid: process.pid,
      ...event
    };
    
    try {
      fs.appendFileSync(
        this.logPath,
        JSON.stringify(entry) + '\n',
        { mode: 0o600 }
      );
    } catch {
      // Silently fail - don't break token operations for logging
    }
  }
}

/**
 * Base class for secure token storage
 */
export abstract class BaseSecureTokenStorage implements ISecureTokenStorage {
  protected audit = new SecurityAuditLogger();
  
  abstract store(tokens: any, context?: string): Promise<void>;
  abstract retrieve(context?: string): Promise<any | null>;
  abstract clear(context?: string): Promise<void>;
  
  /**
   * Check environment variables first (for CI/CD)
   */
  protected async checkEnvironment(): Promise<any | null> {
    const envToken = process.env.GRAPHYN_TOKEN || process.env.GRAPHYN_API_KEY;
    const envRefresh = process.env.GRAPHYN_REFRESH_TOKEN;
    
    if (envToken) {
      await this.audit.log({
        action: 'token.retrieve.env',
        success: true
      });
      
      return {
        apiKey: envToken,
        accessToken: envToken,
        refreshToken: envRefresh,
        tokenType: 'Bearer',
        source: 'environment',
        valid: true
      };
    }
    
    return null;
  }
}

/**
 * OS-native keychain storage (macOS and Windows)
 */
export class KeychainTokenStorage extends BaseSecureTokenStorage {
  private service = 'com.graphyn.cli';
  private keychainAvailable: boolean | null = null;
  
  constructor(private fallback?: ISecureTokenStorage) {
    super();
  }
  
  private async isAvailable(): Promise<boolean> {
    if (this.keychainAvailable !== null) {
      return this.keychainAvailable;
    }
    
    try {
      if (process.platform === 'darwin') {
        // Check if security command is available
        execSync('which security', { stdio: 'ignore' });
        this.keychainAvailable = true;
      } else if (process.platform === 'win32') {
        // Check if cmdkey is available
        execSync('where cmdkey', { stdio: 'ignore' });
        this.keychainAvailable = true;
      } else {
        this.keychainAvailable = false;
      }
    } catch {
      this.keychainAvailable = false;
    }
    
    return this.keychainAvailable;
  }
  
  async store(tokens: any, context: string = 'default'): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Check environment first
      const envTokens = await this.checkEnvironment();
      if (envTokens) {
        await this.audit.log({
          action: 'token.store.skipped',
          context,
          success: true,
          metadata: { reason: 'environment_variable' }
        });
        return;
      }
      
      if (!(await this.isAvailable()) && this.fallback) {
        return this.fallback.store(tokens, context);
      }
      
      const account = `${this.service}:${context}`;
      const data = JSON.stringify({
        ...tokens,
        metadata: {
          storedAt: new Date(),
          version: '2.0',
          source: 'keychain'
        }
      });
      
      if (process.platform === 'darwin') {
        await this.storeMacOS(account, data);
      } else if (process.platform === 'win32') {
        await this.storeWindows(account, data);
      } else {
        throw new Error('Keychain not available on this platform');
      }
      
      await this.audit.log({
        action: 'token.store',
        context,
        success: true,
        metadata: { duration: Date.now() - startTime }
      });
    } catch (error) {
      await this.audit.log({
        action: 'token.store',
        context,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (this.fallback) {
        return this.fallback.store(tokens, context);
      }
      throw error;
    }
  }
  
  async retrieve(context: string = 'default'): Promise<any | null> {
    const startTime = Date.now();
    
    try {
      // Check environment first
      const envTokens = await this.checkEnvironment();
      if (envTokens) {
        return envTokens;
      }
      
      if (!(await this.isAvailable()) && this.fallback) {
        return this.fallback.retrieve(context);
      }
      
      const account = `${this.service}:${context}`;
      let data: string;
      
      if (process.platform === 'darwin') {
        data = await this.retrieveMacOS(account);
      } else if (process.platform === 'win32') {
        data = await this.retrieveWindows(account);
      } else {
        throw new Error('Keychain not available on this platform');
      }
      
      await this.audit.log({
        action: 'token.retrieve',
        context,
        success: true,
        metadata: { duration: Date.now() - startTime }
      });
      
      const parsed = JSON.parse(data);
      
      // Update last used
      if (parsed.metadata) {
        parsed.metadata.lastUsed = new Date();
      }
      
      return parsed;
    } catch (error) {
      await this.audit.log({
        action: 'token.retrieve',
        context,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (this.fallback) {
        return this.fallback.retrieve(context);
      }
      return null;
    }
  }
  
  async clear(context: string = 'default'): Promise<void> {
    try {
      if (!(await this.isAvailable()) && this.fallback) {
        return this.fallback.clear(context);
      }
      
      const account = `${this.service}:${context}`;
      
      if (process.platform === 'darwin') {
        await this.clearMacOS(account);
      } else if (process.platform === 'win32') {
        await this.clearWindows(account);
      }
      
      await this.audit.log({
        action: 'token.clear',
        context,
        success: true
      });
    } catch (error) {
      await this.audit.log({
        action: 'token.clear',
        context,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (this.fallback) {
        return this.fallback.clear(context);
      }
    }
  }
  
  private async storeMacOS(account: string, data: string): Promise<void> {
    const encoded = Buffer.from(data).toString('base64');
    
    // Delete existing first
    try {
      execSync(
        `security delete-generic-password -a "${account}" -s "${this.service}" 2>/dev/null`,
        { stdio: 'ignore' }
      );
    } catch {
      // Ignore if doesn't exist
    }
    
    // Add new password
    execSync(
      `security add-generic-password -a "${account}" -s "${this.service}" -w "${encoded}" -U`,
      { stdio: 'ignore' }
    );
  }
  
  private async retrieveMacOS(account: string): Promise<string> {
    const result = execSync(
      `security find-generic-password -a "${account}" -s "${this.service}" -w`,
      { encoding: 'utf8' }
    ).trim();
    
    return Buffer.from(result, 'base64').toString('utf8');
  }
  
  private async clearMacOS(account: string): Promise<void> {
    execSync(
      `security delete-generic-password -a "${account}" -s "${this.service}"`,
      { stdio: 'ignore' }
    );
  }
  
  private async storeWindows(account: string, data: string): Promise<void> {
    // Use cmdkey for Windows Credential Manager
    const target = `${this.service}/${account}`;
    const encoded = Buffer.from(data).toString('base64');
    
    // PowerShell script to store credentials
    const script = `
      $target = '${target}';
      $password = ConvertTo-SecureString '${encoded}' -AsPlainText -Force;
      $cred = New-Object System.Management.Automation.PSCredential($target, $password);
      $cred | Export-Clixml -Path "$env:TEMP\\graphyn-temp-cred.xml";
      cmdkey /add:$target /user:$target /pass:'${encoded}';
      Remove-Item "$env:TEMP\\graphyn-temp-cred.xml" -Force;
    `;
    
    execSync(`powershell -Command "${script}"`, { stdio: 'ignore' });
  }
  
  private async retrieveWindows(account: string): Promise<string> {
    const target = `${this.service}/${account}`;
    
    // PowerShell script to retrieve credentials
    const script = `
      $target = '${target}';
      $cred = Get-StoredCredential -Target $target;
      if ($cred) {
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($cred.Password);
        $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR);
        Write-Output $plain;
      }
    `;
    
    const result = execSync(`powershell -Command "${script}"`, { encoding: 'utf8' }).trim();
    return Buffer.from(result, 'base64').toString('utf8');
  }
  
  private async clearWindows(account: string): Promise<void> {
    const target = `${this.service}/${account}`;
    execSync(`cmdkey /delete:${target}`, { stdio: 'ignore' });
  }
}

/**
 * Linux Secret Service storage
 */
export class SecretServiceTokenStorage extends BaseSecureTokenStorage {
  private service = 'Graphyn CLI';
  private available: boolean | null = null;
  
  constructor(private fallback?: ISecureTokenStorage) {
    super();
  }
  
  private async isAvailable(): Promise<boolean> {
    if (this.available !== null) {
      return this.available;
    }
    
    try {
      execSync('which secret-tool', { stdio: 'ignore' });
      this.available = true;
    } catch {
      this.available = false;
    }
    
    return this.available;
  }
  
  async store(tokens: any, context: string = 'default'): Promise<void> {
    if (!(await this.isAvailable()) && this.fallback) {
      return this.fallback.store(tokens, context);
    }
    
    const data = JSON.stringify({
      ...tokens,
      metadata: {
        storedAt: new Date(),
        version: '2.0',
        source: 'secret-service'
      }
    });
    
    const attributes = `service "${this.service}" account "${context}"`;
    
    try {
      execSync(
        `echo '${data}' | secret-tool store --label="Graphyn CLI OAuth Token" ${attributes}`,
        { stdio: 'ignore' }
      );
      
      await this.audit.log({
        action: 'token.store',
        context,
        success: true
      });
    } catch (error) {
      await this.audit.log({
        action: 'token.store',
        context,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (this.fallback) {
        return this.fallback.store(tokens, context);
      }
      throw error;
    }
  }
  
  async retrieve(context: string = 'default'): Promise<any | null> {
    // Check environment first
    const envTokens = await this.checkEnvironment();
    if (envTokens) {
      return envTokens;
    }
    
    if (!(await this.isAvailable()) && this.fallback) {
      return this.fallback.retrieve(context);
    }
    
    const attributes = `service "${this.service}" account "${context}"`;
    
    try {
      const result = execSync(
        `secret-tool lookup ${attributes}`,
        { encoding: 'utf8' }
      ).trim();
      
      if (!result) {
        return null;
      }
      
      await this.audit.log({
        action: 'token.retrieve',
        context,
        success: true
      });
      
      return JSON.parse(result);
    } catch {
      if (this.fallback) {
        return this.fallback.retrieve(context);
      }
      return null;
    }
  }
  
  async clear(context: string = 'default'): Promise<void> {
    if (!(await this.isAvailable()) && this.fallback) {
      return this.fallback.clear(context);
    }
    
    const attributes = `service "${this.service}" account "${context}"`;
    
    try {
      execSync(`secret-tool clear ${attributes}`, { stdio: 'ignore' });
      
      await this.audit.log({
        action: 'token.clear',
        context,
        success: true
      });
    } catch (error) {
      if (this.fallback) {
        return this.fallback.clear(context);
      }
    }
  }
}

/**
 * Encrypted file storage with proper key derivation
 */
export class EncryptedFileTokenStorage extends BaseSecureTokenStorage {
  private storageDir: string;
  private saltPath: string;
  private algorithm = 'aes-256-gcm';
  private iterations = 600000; // OWASP 2023 recommendation
  
  constructor() {
    super();
    const configDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    this.storageDir = path.join(configDir, 'graphyn-cli', 'secure');
    this.saltPath = path.join(this.storageDir, '.salt');
    
    this.ensureSecureDirectory();
  }
  
  async store(tokens: any, context: string = 'default'): Promise<void> {
    try {
      // Check environment first
      const envTokens = await this.checkEnvironment();
      if (envTokens) {
        return;
      }
      
      const key = await this.deriveKey(context);
      const data = JSON.stringify({
        ...tokens,
        metadata: {
          storedAt: new Date(),
          version: '2.0',
          source: 'encrypted-file'
        }
      });
      
      const encrypted = await this.encrypt(data, key);
      const tokenPath = path.join(this.storageDir, `${context}.enc`);
      
      fs.writeFileSync(tokenPath, encrypted, { mode: 0o600 });
      
      await this.audit.log({
        action: 'token.store',
        context,
        success: true
      });
    } catch (error) {
      await this.audit.log({
        action: 'token.store',
        context,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  async retrieve(context: string = 'default'): Promise<any | null> {
    try {
      // Check environment first
      const envTokens = await this.checkEnvironment();
      if (envTokens) {
        return envTokens;
      }
      
      const tokenPath = path.join(this.storageDir, `${context}.enc`);
      
      if (!fs.existsSync(tokenPath)) {
        return null;
      }
      
      const key = await this.deriveKey(context);
      const encrypted = fs.readFileSync(tokenPath, 'utf8');
      const decrypted = await this.decrypt(encrypted, key);
      
      await this.audit.log({
        action: 'token.retrieve',
        context,
        success: true
      });
      
      return JSON.parse(decrypted);
    } catch (error) {
      await this.audit.log({
        action: 'token.retrieve',
        context,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
  
  async clear(context: string = 'default'): Promise<void> {
    try {
      const tokenPath = path.join(this.storageDir, `${context}.enc`);
      
      if (fs.existsSync(tokenPath)) {
        // Overwrite with random data before deletion
        const size = fs.statSync(tokenPath).size;
        const randomData = crypto.randomBytes(size);
        fs.writeFileSync(tokenPath, randomData);
        fs.unlinkSync(tokenPath);
      }
      
      await this.audit.log({
        action: 'token.clear',
        context,
        success: true
      });
    } catch (error) {
      await this.audit.log({
        action: 'token.clear',
        context,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  async listContexts(): Promise<string[]> {
    try {
      const files = fs.readdirSync(this.storageDir);
      return files
        .filter(f => f.endsWith('.enc'))
        .map(f => f.replace('.enc', ''));
    } catch {
      return [];
    }
  }
  
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
  
  private async getSalt(): Promise<Buffer> {
    if (fs.existsSync(this.saltPath)) {
      return fs.readFileSync(this.saltPath);
    }
    
    // Generate new salt
    const salt = crypto.randomBytes(32);
    fs.writeFileSync(this.saltPath, salt, { mode: 0o600 });
    return salt;
  }
  
  private async deriveKey(context: string): Promise<Buffer> {
    const salt = await this.getSalt();
    
    // Derive key from multiple sources
    const sources = [
      os.userInfo().username,
      os.hostname(),
      process.env.USER || '',
      context,
      'graphyn-cli-v2'
    ];
    
    const password = sources.join(':');
    
    return crypto.pbkdf2Sync(
      password,
      salt,
      this.iterations,
      32,
      'sha256'
    );
  }
  
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
}

/**
 * Main secure token storage factory
 */
export class SecureTokenStorageV2 {
  private static instance: ISecureTokenStorage | null = null;
  
  static async getInstance(): Promise<ISecureTokenStorage> {
    if (this.instance) {
      return this.instance;
    }
    
    // Check for elevated privileges
    if (process.getuid && process.getuid() === 0) {
      throw new Error('Cannot use secure storage with elevated privileges (running as root)');
    }
    
    // Create chain of responsibility
    const encryptedFile = new EncryptedFileTokenStorage();
    let storage: ISecureTokenStorage;
    
    if (process.platform === 'darwin' || process.platform === 'win32') {
      storage = new KeychainTokenStorage(encryptedFile);
    } else if (process.platform === 'linux') {
      storage = new SecretServiceTokenStorage(encryptedFile);
    } else {
      storage = encryptedFile;
    }
    
    this.instance = storage;
    return storage;
  }
  
  /**
   * Migration helper from old storage format
   */
  static async migrateFromV1(): Promise<boolean> {
    try {
      // Import old storage
      const { SecureTokenStorage: OldStorage } = await import('./secure-storage.js');
      const oldStorage = new OldStorage();
      
      // Try to retrieve old tokens
      const oldTokens = await oldStorage.retrieve();
      if (!oldTokens) {
        return false;
      }
      
      console.log('Found tokens in old storage format.');
      console.log('Migrating to new secure storage...');
      
      // Get new storage
      const newStorage = await this.getInstance();
      
      // Backup old tokens
      const backupPath = path.join(
        os.homedir(),
        '.config',
        'graphyn-cli',
        'backup-tokens.json'
      );
      fs.writeFileSync(
        backupPath,
        JSON.stringify(oldTokens, null, 2),
        { mode: 0o600 }
      );
      console.log(`Backup saved to: ${backupPath}`);
      
      // Store in new format
      await newStorage.store(oldTokens);
      
      // Verify
      const retrieved = await newStorage.retrieve();
      if (retrieved) {
        // Clear old storage
        await oldStorage.clear();
        console.log('Migration successful!');
        return true;
      }
      
      throw new Error('Failed to verify migrated tokens');
    } catch (error) {
      console.error('Migration failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }
}

// Export convenience functions
export async function getSecureTokenStorage(): Promise<ISecureTokenStorage> {
  return SecureTokenStorageV2.getInstance();
}

export async function migrateTokenStorage(): Promise<boolean> {
  return SecureTokenStorageV2.migrateFromV1();
}