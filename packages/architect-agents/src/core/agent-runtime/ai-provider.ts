/**
 * AI Provider Factory
 * Zero-dependency, lightweight adapter for multiple LLM endpoints.
 */

export interface AIProvider {
  /**
   * Translates an explicit AI prompt along with the existing file content
   * into a newly unified source code string.
   */
  executeRefactoringPrompt(fileContent: string, prompt: string): Promise<string>;
}

// ── API Response Types (Fase 2.3 — eliminates `data: any`) ──────────

/** OpenAI Chat Completion response shape. */
interface OpenAIResponse {
  choices: Array<{ message: { content: string } }>;
}

/** Anthropic Messages API response shape. */
interface AnthropicResponse {
  content: Array<{ text: string }>;
}

/** Google Gemini generateContent response shape. */
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

export class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private apiUrl: string;

  constructor(apiKey: string, model: string = 'gpt-4o', apiUrl = 'https://api.openai.com/v1/chat/completions') {
    this.apiKey = apiKey;
    this.model = model;
    this.apiUrl = apiUrl;
  }

  async executeRefactoringPrompt(fileContent: string, prompt: string): Promise<string> {
    const systemPrompt = `You are a strict, top-tier Software Architect AI modifying code.
Return ONLY the fully rewritten source code. Never use markdown code blocks (\`\`\`).
Do NOT include explanations or prefix/suffix text. Your complete response must be purely the new raw code content.`;

    const userMessage = `${prompt}\n\nCurrent file content:\n\n${fileContent}`;

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API Error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    let newCode = data.choices[0]!.message.content.trim();
    
    // Safety check just in case LLM injected markdown blocks
    if (newCode.startsWith('```') && newCode.endsWith('```')) {
      const lines = newCode.split('\n');
      lines.shift(); // Remove first line (```language)
      lines.pop(); // Remove last line (```)
      newCode = lines.join('\n');
    }
    
    return newCode;
  }
}

export class AnthropicProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || process.env['ANTHROPIC_MODEL_NAME'] || 'claude-3-5-sonnet-20241022';
  }

  async executeRefactoringPrompt(fileContent: string, prompt: string): Promise<string> {
    const systemPrompt = `You are a strict Software Architect AI modifying code. Return ONLY the fully rewritten source code. Never use markdown code blocks (\`\`\`). Do NOT include any conversational text.`;
    const userMessage = `${prompt}\n\n<current_file>\n${fileContent}\n</current_file>`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        max_tokens: 8192,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API Error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    let newCode = data.content[0]!.text.trim();
    if (newCode.startsWith('```') && newCode.endsWith('```')) {
      const lines = newCode.split('\n');
      lines.shift(); lines.pop();
      newCode = lines.join('\n');
    }
    return newCode;
  }
}

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async executeRefactoringPrompt(fileContent: string, prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    
    const systemPrompt = 'You are a strict Software Architect AI modifying code. Return ONLY the fully rewritten source code without markdown formatting or conversational filler.';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          { role: 'user', parts: [{ text: `${prompt}\n\nFile Content:\n\n${fileContent}` }] }
        ],
        generationConfig: { temperature: 0.1 }
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let newCode = candidate.trim();
    
    if (newCode.startsWith('```') && newCode.endsWith('```')) {
      const lines = newCode.split('\n');
      lines.shift(); lines.pop();
      newCode = lines.join('\n');
    }
    return newCode;
  }
}

export class ModelProviderFactory {
  static getAvailableProviders(): string[] {
    const list: string[] = [];
    if (process.env['ANTHROPIC_API_KEY']) list.push('Anthropic (Claude)');
    if (process.env['OPENAI_API_KEY']) list.push('OpenAI/Compatible');
    if (process.env['GEMINI_API_KEY']) list.push('Gemini');
    return list;
  }

  static createSpecificProvider(providerType: string): AIProvider {
    if (providerType.includes('Anthropic') && process.env['ANTHROPIC_API_KEY']) {
      return new AnthropicProvider(process.env['ANTHROPIC_API_KEY']);
    }
    if (providerType.includes('OpenAI') && process.env['OPENAI_API_KEY']) {
      const model = process.env['OPENAI_MODEL_NAME'] || 'gpt-4o';
      const apiUrl = process.env['OPENAI_BASE_URL']
        ? `${process.env['OPENAI_BASE_URL']!.replace(/\/$/, '')}/chat/completions`
        : undefined;
      return new OpenAIProvider(process.env['OPENAI_API_KEY']!, model, apiUrl);
    }
    if (providerType.includes('Gemini') && process.env['GEMINI_API_KEY']) {
      return new GeminiProvider(process.env['GEMINI_API_KEY']);
    }
    throw new Error(`Provider ${providerType} not configured or missing API key.`);
  }

  static createProvider(): AIProvider {
    if (process.env['ANTHROPIC_API_KEY']) {
      return new AnthropicProvider(process.env['ANTHROPIC_API_KEY']);
    }

    if (process.env['OPENAI_API_KEY']) {
      // Allow overriding API URL for OpenAI compatibles (e.g. DeepSeek, Groq, local LMStudio)
      const model = process.env['OPENAI_MODEL_NAME'] || 'gpt-4o';
      const apiUrl = process.env['OPENAI_BASE_URL']
        ? `${process.env['OPENAI_BASE_URL']!.replace(/\/$/, '')}/chat/completions`
        : undefined;
      return new OpenAIProvider(process.env['OPENAI_API_KEY']!, model, apiUrl);
    }

    if (process.env['GEMINI_API_KEY']) {
      return new GeminiProvider(process.env['GEMINI_API_KEY']);
    }

    throw new Error('No AI API Key found in environment variables. Define OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY to execute AI-based refactoring.');
  }
}
