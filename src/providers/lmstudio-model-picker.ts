import inquirer from 'inquirer';
import chalk from 'chalk';
import { ModelCategory, ModelEntry, getCategories, getAllModels, getModelById } from './lmstudio-model-catalog.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const FAVORITES_FILE = path.join(os.homedir(), '.graphyn', 'lmstudio-favorites.json');

export interface PickerResult {
  modelId: string;
  model: ModelEntry;
}

type ChoiceValue = string;

interface ChoiceOption {
  name: string;
  value: ChoiceValue;
  short: string;
}

function loadFavorites(): string[] {
  try {
    if (fs.existsSync(FAVORITES_FILE)) {
      return JSON.parse(fs.readFileSync(FAVORITES_FILE, 'utf8'));
    }
  } catch {
    // Ignore read errors
  }
  return [];
}

function saveFavorites(favorites: string[]): void {
  const dir = path.dirname(FAVORITES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FAVORITES_FILE, JSON.stringify(favorites, null, 2));
}

function markAsFavorite(modelId: string): void {
  const favorites = loadFavorites();
  if (!favorites.includes(modelId)) {
    favorites.push(modelId);
    saveFavorites(favorites);
  }
}

export async function showModelPicker(baseUrl: string = 'http://localhost:1234'): Promise<PickerResult | null> {
  const favorites = loadFavorites();
  const categories = getCategories();
  const allModels = getAllModels();

  let downloadedIds: string[] = [];
  try {
    const resp = await fetch(`${baseUrl}/v1/models`);
    if (resp.ok) {
      const data = await resp.json() as { data: Array<{ id: string }> };
      downloadedIds = data.data?.map(m => m.id) || [];
    }
  } catch {
    // LM Studio not reachable
  }

  const favoriteModels = allModels.filter(m => favorites.includes(m.id));
  const favoriteChoices: (ChoiceOption | inquirer.Separator)[] = favoriteModels.length > 0
    ? [new inquirer.Separator(chalk.yellow.bold('── Your Favorites ──')), ...favoriteModels.map(m => {
        const isDownloaded = downloadedIds.includes(m.id);
        const status = isDownloaded ? chalk.green(' [loaded]') : chalk.dim(' [not loaded]');
        return {
          name: `${chalk.yellow('⭐')} ${m.name.padEnd(32)} ${chalk.dim(`${m.params} · ${m.contextWindow}`)}${status}`,
          value: m.id,
          short: m.name,
        };
      })]
    : [];

  const allChoices: (ChoiceOption | inquirer.Separator)[] = [];
  for (const cat of categories) {
    allChoices.push(new inquirer.Separator(chalk.cyan.bold(`── ${cat.icon} ${cat.label} ──`)));
    allChoices.push(...cat.models.map(m => {
      const isFavorite = favorites.includes(m.id);
      const isDownloaded = downloadedIds.includes(m.id);
      const status = isDownloaded ? chalk.green(' [loaded]') : chalk.dim(' [not loaded]');
      const star = isFavorite ? chalk.yellow('⭐') : '  ';
      return {
        name: `${star} ${m.name.padEnd(32)} ${chalk.dim(`${m.params} · ${m.contextWindow}`)}${status}`,
        value: m.id,
        short: m.name,
      };
    }));
  }

  console.log('');
  console.log(chalk.bold.cyan('  ╔══════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('  ║       LM Studio — Model Selector           ║'));
  console.log(chalk.bold.cyan('  ╚══════════════════════════════════════════════╝'));
  console.log(chalk.dim('  Select a model to load into LM Studio'));
  console.log(chalk.dim('  ⭐ = favorite  |  [loaded] = already in memory'));
  console.log('');

  const { modelId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'modelId',
      message: 'Choose a model:',
      choices: [...favoriteChoices, ...allChoices],
      pageSize: 20,
    },
  ]);

  const model = getModelById(modelId);
  if (!model) return null;

  if (!favorites.includes(modelId)) {
    const { addToFavorites } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addToFavorites',
        message: `Add "${model.name}" to your favorites?`,
        default: true,
      },
    ]);
    if (addToFavorites) {
      markAsFavorite(modelId);
    }
  }

  return { modelId, model };
}

export async function loadModelIntoLMStudio(modelId: string, baseUrl: string = 'http://localhost:1234'): Promise<{ success: boolean; error?: string }> {
  try {
    const resp = await fetch(`${baseUrl}/v1/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        options: {
          context_length: 8192,
          gpu_layers: -1,
        },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { success: false, error: `Failed to load model: ${resp.status} ${text}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function waitForModelReady(modelId: string, baseUrl: string = 'http://localhost:1234', maxWaitMs: number = 120000): Promise<{ ready: boolean; error?: string }> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const resp = await fetch(`${baseUrl}/v1/models`);
      if (resp.ok) {
        const data = await resp.json() as { data: Array<{ id: string }> };
        const loaded = data.data?.find(m => m.id === modelId);
        if (loaded) return { ready: true };
      }
    } catch {
      // Retry
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  return { ready: false, error: `Model did not load within ${maxWaitMs / 1000}s` };
}
