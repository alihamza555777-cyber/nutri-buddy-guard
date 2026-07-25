import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (value: string | undefined) => void = () => {};
  let runIdResolved = false;
  const runIdReady = new Promise<string | undefined>((resolve) => {
    resolveRunId = resolve;
  });

  const publishRunId = (value?: string) => {
    const nextRunId = value?.trim() || undefined;
    if (!runId && nextRunId) {
      runId = nextRunId;
    }
    if (!runIdResolved) {
      runIdResolved = true;
      resolveRunId(runId);
    }
  };
  if (runId) publishRunId(runId);

  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      }

      try {
        const response = await fetch(input, { ...init, headers });
        publishRunId(response.headers.get(LOVABLE_AIG_RUN_ID_HEADER) ?? undefined);
        return response;
      } catch (error) {
        publishRunId(undefined);
        throw error;
      }
    },
    getRunId: () => runId,
    waitForRunId: () => (runId ? Promise.resolve(runId) : runIdReady),
  };
}

export function createLovableAiGatewayProvider(
  apiKey: string,
  initialRunId?: string,
  options?: { structuredOutputs?: boolean },
) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
  const isGoogleKey = apiKey.startsWith("AIzaSy") || apiKey.startsWith("AQ.");

  const provider = createOpenAICompatible({
    name: isGoogleKey ? "google-gemini" : "lovable",
    baseURL: isGoogleKey
      ? "https://generativelanguage.googleapis.com/v1beta/openai"
      : "https://ai.gateway.lovable.dev/v1",
    apiKey: isGoogleKey ? apiKey : undefined,
    supportsStructuredOutputs: options?.structuredOutputs ?? false,
    headers: isGoogleKey
      ? {
          "x-goog-api-key": apiKey,
        }
      : {
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "vercel-ai-sdk",
        },
    fetch: runIdFetch.fetch,
  });

  // When going direct to Google, strip the "google/" routing prefix
  // that Lovable's gateway uses. Google expects just "gemini-2.0-flash".
  const wrappedProvider = isGoogleKey
    ? Object.assign(
        (modelId: string) => provider(modelId.replace(/^google\//, "")),
        provider,
      )
    : provider;

  return Object.assign(wrappedProvider, {
    getRunId: runIdFetch.getRunId,
    waitForRunId: runIdFetch.waitForRunId,
  });
}

export function getLovableAiGatewayRunId(request: Request) {
  return request.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim() || undefined;
}
