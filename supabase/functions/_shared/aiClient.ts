type AiProvider = "groq" | "google" | "openai";
type AiTask = "text" | "vision";

type OpenAiTextContent = { type: "text"; text: string };
type OpenAiImageContent = { type: "image_url"; image_url: { url: string } };
type ChatContent = string | Array<OpenAiTextContent | OpenAiImageContent>;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: ChatContent;
}

interface AiRequest {
  messages: ChatMessage[];
  task?: AiTask;
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
}

interface GooglePart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
}

const DEFAULT_MODELS: Record<AiProvider, Record<AiTask, string>> = {
  groq: {
    text: "llama-3.3-70b-versatile",
    vision: "qwen/qwen3.6-27b",
  },
  google: {
    text: "gemini-1.5-flash",
    vision: "gemini-1.5-flash",
  },
  openai: {
    text: "gpt-4o-mini",
    vision: "gpt-4o-mini",
  },
};

function getProvider(): AiProvider {
  const configured = (Deno.env.get("AI_PROVIDER") || "groq").toLowerCase();
  if (["groq", "google", "openai"].includes(configured)) {
    return configured as AiProvider;
  }
  return "groq";
}

function getModel(provider: AiProvider, task: AiTask): string {
  const generic = Deno.env.get(task === "vision" ? "AI_MODEL_VISION" : "AI_MODEL_TEXT");
  const providerSpecific = Deno.env.get(`${provider.toUpperCase()}_MODEL_${task === "vision" ? "VISION" : "TEXT"}`);
  return generic || providerSpecific || DEFAULT_MODELS[provider][task];
}

function getApiKey(provider: AiProvider): string {
  const envName = `${provider.toUpperCase()}_API_KEY`;
  const key = Deno.env.get(envName);
  if (!key) {
    throw new Error(`${envName} no esta configurada.`);
  }
  return key;
}

function getOpenAiCompatibleEndpoint(provider: Exclude<AiProvider, "google">): string {
  if (provider === "groq") return "https://api.groq.com/openai/v1/chat/completions";
  return "https://api.openai.com/v1/chat/completions";
}

export async function callAi({ messages, task = "text", jsonMode = false, temperature = 0.2, maxTokens = 1200 }: AiRequest): Promise<string> {
  const provider = getProvider();
  if (provider === "google") {
    return callGoogleAi({ messages, task, jsonMode, temperature, maxTokens });
  }
  return callOpenAiCompatible(provider, { messages, task, jsonMode, temperature, maxTokens });
}

async function callOpenAiCompatible(
  provider: Exclude<AiProvider, "google">,
  { messages, task, jsonMode, temperature, maxTokens }: Required<AiRequest>,
): Promise<string> {
  const model = getModel(provider, task);
  const shouldUseResponseFormat = jsonMode
    && !(provider === "groq" && task === "vision" && !model.startsWith("qwen/"));
  const response = await fetch(getOpenAiCompatibleEndpoint(provider), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey(provider)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      ...(provider === "groq"
        ? { max_completion_tokens: maxTokens }
        : { max_tokens: maxTokens }),
      ...(shouldUseResponseFormat ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[AI:${provider}]`, response.status, body);
    if (response.status === 429) throw new Error("El servicio de IA esta saturado. Intenta nuevamente en unos minutos.");
    if (response.status === 401) throw new Error("La API key de IA no es valida.");
    if (response.status === 402) throw new Error("No hay creditos disponibles para el servicio de IA.");
    throw new Error("No se pudo completar la solicitud de IA.");
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "";
}

async function callGoogleAi(
  { messages, task, jsonMode, temperature, maxTokens }: Required<AiRequest>,
): Promise<string> {
  const model = getModel("google", task);
  const systemMessage = messages.find((message) => message.role === "system")?.content;
  const conversation = messages.filter((message) => message.role !== "system");

  const contents = await Promise.all(conversation.map(async (message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: await toGoogleParts(message.content),
  })));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${getApiKey("google")}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(systemMessage ? { systemInstruction: { parts: await toGoogleParts(systemMessage) } } : {}),
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    console.error("[AI:google]", response.status, body);
    if (response.status === 429) throw new Error("El servicio de IA esta saturado. Intenta nuevamente en unos minutos.");
    if (response.status === 401 || response.status === 403) throw new Error("La API key de Google AI no es valida.");
    throw new Error("No se pudo completar la solicitud de IA.");
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
}

async function toGoogleParts(content: ChatContent): Promise<GooglePart[]> {
  if (typeof content === "string") return [{ text: content }];

  const parts: GooglePart[] = [];
  for (const item of content) {
    if (item.type === "text") {
      parts.push({ text: item.text });
    } else {
      parts.push(await imageUrlToGooglePart(item.image_url.url));
    }
  }
  return parts;
}

async function imageUrlToGooglePart(url: string): Promise<GooglePart> {
  if (url.startsWith("data:")) {
    const [meta, data] = url.split(",", 2);
    const mimeType = meta.match(/^data:(.*?);base64$/)?.[1] || "image/jpeg";
    return { inline_data: { mime_type: mimeType, data } };
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error("No se pudo leer la imagen para analizarla.");
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { inline_data: { mime_type: contentType, data: bytesToBase64(bytes) } };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
