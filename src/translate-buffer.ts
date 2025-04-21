/**
 * Sibilant - Clipboard Translation Tool
 * 
 * IMPORTANT CONFIGURATION NOTE:
 * For notifications to work properly in Focus Mode:
 * 1. Open System Settings > Notifications & Focus
 * 2. Select your Focus Mode (e.g., Work)
 * 3. Under "Allowed Notifications", add:
 *    - Terminal.app (or iTerm2)
 *    - Terminal Notifier
 * 
 * Without this configuration, notifications will be silent and only appear
 * in the notification center when manually opened.
 */

import clipboardy from 'clipboardy';
import OpenAI from 'openai';
import config from 'config';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface OpenAIConfig {
  type: 'cloud';
  title: string;
  apiKey: string;
  model: string;
}

interface LocalTranslateConfig {
  type: 'local';
  title: string;
  command: string;
  args: string[];
}

type ProviderConfig = OpenAIConfig | LocalTranslateConfig;

interface ProvidersConfig {
  [key: string]: ProviderConfig;
}

interface TranslationConfig {
  provider: string;
  targetLanguage: string;
}

interface AppConfig {
  providers: ProvidersConfig;
  translation: TranslationConfig;
}

interface TranslationProvider {
  translate(text: string, targetLanguage: string): Promise<string>;
}

class OpenAITranslationProvider implements TranslationProvider {
  private readonly config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    this.config = config;
  }

  async translate(text: string, targetLanguage: string): Promise<string> {
    const client = new OpenAI({
      apiKey: this.config.apiKey,
    });

    const response = await client.chat.completions.create({
      model: this.config.model,
      messages: [
        {
          role: "user",
          content: `Translate the following text to [${targetLanguage}]: ${text}`,
        },
      ],
    });

    const translation = response.choices[0].message?.content?.trim();
    if (!translation) {
      throw new Error('No translation found in the response');
    }

    return translation;
  }
}

class LocalTranslationProvider implements TranslationProvider {
  private readonly config: LocalTranslateConfig;

  constructor(config: LocalTranslateConfig) {
    this.config = config;
  }

  async translate(text: string, targetLanguage: string): Promise<string> {
    try {
      const args = this.config.args.map(arg =>
        arg.replace('{text}', text)
          .replace('{targetLanguage}', targetLanguage)
      );

      const { stdout, stderr } = await execAsync(`${this.config.command} ${args.join(' ')}`);

      if (stderr) {
        console.warn(`Translation CLI (${this.config.title}) stderr:`, stderr);
      }

      return stdout.trim();
    } catch (error) {
      console.error(`Error executing translation CLI (${this.config.title}):`, error);
      throw new Error(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

function createTranslationProvider(translationConfig: TranslationConfig): TranslationProvider {
  const providers = config.get<ProvidersConfig>('providers');
  const provider = providers[translationConfig.provider];

  if (!provider) {
    throw new Error(`Provider '${translationConfig.provider}' not found`);
  }

  switch (translationConfig.provider) {
    case 'open-ai':
      return new OpenAITranslationProvider(provider as OpenAIConfig);
    case 'local-translate':
      return new LocalTranslationProvider(provider as LocalTranslateConfig);
    default:
      throw new Error(`Unsupported provider: ${translationConfig.provider}`);
  }
}

async function showNotification(title: string, message: string) {
  const scriptFile = `/tmp/sibilant-dialog-${Date.now()}.scpt`;

  const script = `
    on run argv
      set theText to item 1 of argv
      set theTitle to item 2 of argv
      
      tell application "System Events"
        activate
        display dialog theText with title theTitle buttons {"OK", "Copy"} default button "OK" giving up after 30
        set buttonPressed to button returned of result
        
        -- Play sound based on button pressed
        if buttonPressed is "Copy" then
          set the clipboard to theText
        end if
      end tell
    end run
  `;

  await execAsync(`echo '${script}' > "${scriptFile}"`);

  await execAsync(`osascript "${scriptFile}" "${message.replace(/"/g, '\\"')}" "${title.replace(/"/g, '\\"')}"`);

  await execAsync(`rm "${scriptFile}"`);
}

async function translateText() {
  try {
    await execAsync('afplay /System/Library/Sounds/Purr.aiff');

    const translationConfig = config.get<TranslationConfig>('translation');
    const text = await clipboardy.read();
    const provider = createTranslationProvider(translationConfig);
    const translation = await provider.translate(text, translationConfig.targetLanguage);

    await clipboardy.write(translation);
    console.log('Translation copied to clipboard:', translation);

    await execAsync('afplay /System/Library/Sounds/Hero.aiff');
    await showNotification('Translation Complete', translation);

  } catch (error) {
    console.error('Error translating text:', error);
    await showNotification('Translation Error', error instanceof Error ? error.message : 'Unknown error occurred');
    throw error;
  }
}

// Function to translate image from clipboard
async function translateImage() {
  try {
    // Placeholder for image handling
    console.log('Image translation is not supported with clipboardy. Please use a different method to handle images.');
  } catch (error) {
    console.error('Error translating image:', error);
  }
}

translateText();
// translateImage();
