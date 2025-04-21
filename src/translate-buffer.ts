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
import { OpenAI } from 'openai';
import config from 'config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Clipboard } from '@napi-rs/clipboard';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import path from 'path';
import { existsSync, readFileSync, unlinkSync } from 'fs';

const execAsync = promisify(exec);
const nativeClipboard = new Clipboard();
const TMP_IMAGE_PATH = path.join(process.cwd(), 'tmp_clipboard.png');

interface ProviderConfig {
  type: string;
  title: string;
  [key: string]: any;
}

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
  playSound(soundFile: string): Promise<void>;
}

interface ImageTranslationResult {
  text: string;
  translation: string;
}

interface AlfredResponse {
  alfredworkflow: {
    variables: {
      should_copy: boolean;
    };
  };
}

abstract class BaseTranslationProvider implements TranslationProvider {
  protected readonly config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async playSound(soundFile: string): Promise<void> {
    try {
      await execAsync(`afplay /System/Library/Sounds/${soundFile}.aiff`);
    } catch (error) {
      console.warn(`[${this.config.title}] Failed to play sound ${soundFile}:`, error);
    }
  }

  abstract translate(text: string, targetLanguage: string): Promise<string>;
}

class OpenAITranslationProvider extends BaseTranslationProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  async translateImage(imageData: string, targetLanguage: string): Promise<ImageTranslationResult> {
    const startTime = Date.now();
    console.log(`[${this.config.title}] Starting image translation to ${targetLanguage}...`);
    console.log(`[${this.config.title}] Using model: ${this.config.model}`);

    const client = new OpenAI({
      apiKey: this.config.apiKey,
    });

    const message: ChatCompletionMessageParam = {
      role: "user",
      content: [
        {
          type: "text",
          text: `Please recognize the text in this image and translate it to ${targetLanguage}. Return the result in JSON format without any additional markup with two fields: 'text' (original text) and 'translation' (translated text).`
        },
        {
          type: "image_url",
          image_url: {
            url: imageData
          }
        }
      ]
    };

    const response = await client.chat.completions.create({
      model: this.config.model,
      messages: [message],
      max_tokens: 1000
    });

    const result = response.choices[0].message?.content;
    if (!result) {
      throw new Error('No translation found in the response');
    }

    try {
      const parsedResult = JSON.parse(result) as ImageTranslationResult;
      const duration = Date.now() - startTime;
      console.log(`[${this.config.title}] Image translation completed in ${duration}ms`);
      return parsedResult;
    } catch (error) {
      throw new Error('Failed to parse translation result');
    }
  }

  async translate(text: string, targetLanguage: string): Promise<string> {
    const startTime = Date.now();
    console.log(`[${this.config.title}] Starting translation to ${targetLanguage}...`);
    console.log(`[${this.config.title}] Using model: ${this.config.model}`);

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

    const duration = Date.now() - startTime;
    console.log(`[${this.config.title}] Translation completed in ${duration}ms`);
    console.log(`[${this.config.title}] Input length: ${text.length} chars`);
    console.log(`[${this.config.title}] Output length: ${translation.length} chars`);

    return translation;
  }
}

class LibreTranslateProvider extends BaseTranslationProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  private async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/languages`);
      return response.ok;
    } catch (error) {
      console.error(`[${this.config.title}] Health check failed:`, error);
      return false;
    }
  }

  async translate(text: string, targetLanguage: string): Promise<string> {
    const startTime = Date.now();
    console.log(`[${this.config.title}] Starting translation to ${targetLanguage}...`);
    console.log(`[${this.config.title}] Using endpoint: ${this.config.baseUrl}`);

    try {
      // Check service health
      console.log(`[${this.config.title}] Checking service health...`);
      const isHealthy = await this.checkHealth();
      if (!isHealthy) {
        await this.playSound('Sosumi');
        throw new Error('Service is not available. Please make sure the service is running on port 9012.');
      }
      console.log(`[${this.config.title}] Service is healthy`);

      const response = await fetch(`${this.config.baseUrl}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({
          q: text,
          source: 'auto',
          target: targetLanguage,
          format: 'text'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API error: ${response.statusText}${errorData.error ? ` - ${errorData.error}` : ''}`);
      }

      const data = await response.json();
      if (!data.translatedText) {
        throw new Error('No translation found in the response');
      }

      const duration = Date.now() - startTime;
      console.log(`[${this.config.title}] Translation completed in ${duration}ms`);
      console.log(`[${this.config.title}] Input length: ${text.length} chars`);
      console.log(`[${this.config.title}] Output length: ${data.translatedText.length} chars`);

      return data.translatedText;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[${this.config.title}] Translation failed after ${duration}ms:`, error);
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
      return new OpenAITranslationProvider(provider as ProviderConfig);
    case 'libre-translate':
      return new LibreTranslateProvider(provider as ProviderConfig);
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
  const startTime = Date.now();
  try {
    const translationConfig = config.get<TranslationConfig>('translation');
    const providers = config.get<ProvidersConfig>('providers');
    const provider = providers[translationConfig.provider];

    console.log(`[Sibilant] Using provider: ${provider.title} (${translationConfig.provider})`);
    console.log(`[Sibilant] Target language: ${translationConfig.targetLanguage}`);

    const text = await clipboardy.read();
    console.log(`[Sibilant] Clipboard content length: ${text.length} chars`);

    const translationProvider = createTranslationProvider(translationConfig);
    const translation = await translationProvider.translate(text, translationConfig.targetLanguage);

    await clipboardy.write(translation);
    console.log('[Sibilant] Translation copied to clipboard');

    await showNotification('Translation Complete', translation);

    const totalDuration = Date.now() - startTime;
    console.log(`[Sibilant] Total operation completed in ${totalDuration}ms`);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Sibilant] Operation failed after ${duration}ms:`, error);
    await showNotification('Translation Error', error instanceof Error ? error.message : 'Unknown error occurred');
    throw error;
  }
}

async function getClipboardImage(): Promise<string | null> {
  try {
    await execAsync(`pngpaste "${TMP_IMAGE_PATH}"`);

    if (!existsSync(TMP_IMAGE_PATH)) {
      console.error('❌ Image not found in clipboard.');
      return null;
    }

    const imageBuffer = readFileSync(TMP_IMAGE_PATH);
    const base64 = imageBuffer.toString('base64');

    unlinkSync(TMP_IMAGE_PATH);

    return `data:image/jpg;base64,${base64}`;
  } catch (error) {
    console.error('Error getting clipboard image:', error);
    return null;
  }
}

async function translateImage() {
  const startTime = Date.now();
  try {
    const translationConfig = config.get<TranslationConfig>('translation');
    const providers = config.get<ProvidersConfig>('providers');
    const provider = providers[translationConfig.provider];

    if (translationConfig.provider !== 'open-ai') {
      throw new Error('Image translation is only supported with OpenAI provider');
    }

    console.log(`[Sibilant] Using provider: ${provider.title} (${translationConfig.provider})`);
    console.log(`[Sibilant] Target language: ${translationConfig.targetLanguage}`);

    // Get image data from clipboard using pngpaste
    const imageData = await getClipboardImage();
    if (!imageData) {
      throw new Error('No image found in clipboard');
    }

    const translationProvider = createTranslationProvider(translationConfig) as OpenAITranslationProvider;
    const result = await translationProvider.translateImage(imageData, translationConfig.targetLanguage);

    await clipboardy.write(result.translation);
    console.log('[Sibilant] Translation copied to clipboard');

    const message = `Original: ${result.text}\n\nTranslation: ${result.translation}`;
    await showNotification('Image Translation Complete', message);

    const totalDuration = Date.now() - startTime;
    console.log(`[Sibilant] Total operation completed in ${totalDuration}ms`);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Sibilant] Operation failed after ${duration}ms:`, error);
    await showNotification('Translation Error', error instanceof Error ? error.message : 'Unknown error occurred');
    throw error;
  }
}

async function detectClipboardContent(): Promise<'text' | 'image' | 'unknown'> {
  try {
    // Try to get image first since text is always available
    try {
      const imageBuffer = nativeClipboard.getImage();
      if (imageBuffer && imageBuffer.length > 0) {
        return 'image';
      }
    } catch (error) {
      // No image in clipboard, continue to check text
    }

    // Check for text content
    const content = await clipboardy.read();
    if (content && content.trim().length > 0) {
      return 'text';
    }

    return 'unknown';
  } catch (error) {
    console.error('Error detecting clipboard content:', error);
    return 'unknown';
  }
}

async function main() {
  try {
    const contentType = await detectClipboardContent();

    // If running in Alfred, output control response first
    if (process.env.alfred_workflow_bundleid) {
      const alfredResponse: AlfredResponse = {
        alfredworkflow: {
          variables: {
            should_copy: contentType === 'text' // Only copy if it's text
          }
        }
      };
      console.log(JSON.stringify(alfredResponse));
    }

    switch (contentType) {
      case 'text':
        await translateText();
        break;
      case 'image':
        await translateImage();
        break;
      default:
        throw new Error('Unsupported clipboard content type');
    }
  } catch (error) {
    console.error('Translation failed:', error);
    await showNotification('Translation Error', error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

main();
