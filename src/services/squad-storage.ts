import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface AgentConfig {
  id: string;
  name: string;
  emoji?: string;
  role: string;
  systemPrompt?: string;
  capabilities?: string[];
  skills?: Record<string, number>;
  metadata?: Record<string, any>;
}

export interface LocalSquad {
  id: string;
  name: string;
  description?: string;
  agents: AgentConfig[];
  created_at: string;
  last_used?: string;
  workspace: string;
}

export class SquadStorage {
  private storagePath: string;

  constructor() {
    const graphynDir = path.join(os.homedir(), '.graphyn');
    this.storagePath = path.join(graphynDir, 'squads.json');
  }

  private async ensureStorageDir(): Promise<void> {
    const dir = path.dirname(this.storagePath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async loadSquads(): Promise<LocalSquad[]> {
    try {
      await this.ensureStorageDir();
      const data = await fs.readFile(this.storagePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is invalid, return empty array
      return [];
    }
  }

  private async saveSquads(squads: LocalSquad[]): Promise<void> {
    await this.ensureStorageDir();
    await fs.writeFile(this.storagePath, JSON.stringify(squads, null, 2));
  }

  async saveSquad(squad: LocalSquad): Promise<void> {
    const squads = await this.loadSquads();
    
    // Update existing squad or add new one
    const existingIndex = squads.findIndex(s => s.id === squad.id);
    if (existingIndex >= 0) {
      squads[existingIndex] = {
        ...squads[existingIndex],
        ...squad,
        last_used: new Date().toISOString()
      };
    } else {
      squads.push(squad);
    }
    
    await this.saveSquads(squads);
  }

  async getSquad(id: string): Promise<LocalSquad | null> {
    const squads = await this.loadSquads();
    return squads.find(s => s.id === id) || null;
  }

  async listSquads(): Promise<LocalSquad[]> {
    const squads = await this.loadSquads();
    // Sort by last_used (most recent first) or created_at
    return squads.sort((a, b) => {
      const aTime = a.last_used || a.created_at;
      const bTime = b.last_used || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }

  async updateLastUsed(id: string): Promise<void> {
    const squad = await this.getSquad(id);
    if (squad) {
      squad.last_used = new Date().toISOString();
      await this.saveSquad(squad);
    }
  }

  async deleteSquad(id: string): Promise<void> {
    const squads = await this.loadSquads();
    const filtered = squads.filter(s => s.id !== id);
    await this.saveSquads(filtered);
  }

  async getSquadsByWorkspace(workspace: string): Promise<LocalSquad[]> {
    const squads = await this.loadSquads();
    return squads.filter(s => s.workspace === workspace);
  }

  async exportSquad(id: string, exportPath: string): Promise<void> {
    const squad = await this.getSquad(id);
    if (!squad) {
      throw new Error(`Squad with id ${id} not found`);
    }
    
    const exportData = {
      ...squad,
      exported_at: new Date().toISOString(),
      version: '1.0'
    };
    
    await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));
  }

  async importSquad(importPath: string): Promise<LocalSquad> {
    const data = await fs.readFile(importPath, 'utf-8');
    const importedSquad = JSON.parse(data);
    
    // Generate new ID to avoid conflicts
    const newSquad: LocalSquad = {
      ...importedSquad,
      id: `imported_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      created_at: new Date().toISOString(),
      last_used: undefined,
      workspace: process.cwd()
    };
    
    await this.saveSquad(newSquad);
    return newSquad;
  }
}