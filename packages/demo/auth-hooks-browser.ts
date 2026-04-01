import { createClient } from '@richie-rpc/client';
import { usersContract } from './contract';
import { streamingContract } from './streaming-contract';

type HookRecorder = {
  sentTokens: string[];
  responseTokens: string[];
  statuses: number[];
  contentTypes: string[];
  headers: () => Promise<Record<string, string>>;
  onResponse: (response: Response) => Promise<void>;
};

function createHookRecorder(initialToken: string): HookRecorder {
  let currentToken = initialToken;
  const sentTokens: string[] = [];
  const responseTokens: string[] = [];
  const statuses: number[] = [];
  const contentTypes: string[] = [];

  return {
    sentTokens,
    responseTokens,
    statuses,
    contentTypes,
    async headers() {
      sentTokens.push(currentToken);
      return {
        authorization: currentToken,
      };
    },
    async onResponse(response) {
      statuses.push(response.status);

      const contentType = response.headers.get('content-type');
      if (contentType) {
        contentTypes.push(contentType);
      }

      const nextToken = response.headers.get('x-demo-session');
      if (nextToken) {
        responseTokens.push(nextToken);
        currentToken = nextToken;
      }
    },
  };
}

async function runStandardScenario() {
  const hooks = createHookRecorder('Bearer standard-0');
  const client = createClient(usersContract, {
    baseUrl: '/api',
    headers: hooks.headers,
    onResponse: hooks.onResponse,
  });

  const first = await client.authListUsers({});
  const second = await client.authListUsers({});

  return {
    sentTokens: hooks.sentTokens,
    responseTokens: hooks.responseTokens,
    statuses: hooks.statuses,
    total: second.payload.total,
    firstStatus: first.status,
    secondStatus: second.status,
  };
}

async function runUploadScenario() {
  const hooks = createHookRecorder('Bearer upload-0');
  const client = createClient(usersContract, {
    baseUrl: '/api',
    headers: hooks.headers,
    onResponse: hooks.onResponse,
  });
  const progressEvents: number[] = [];

  const response = await client.authUploadDocuments({
    body: {
      documents: [
        {
          file: new File(['x'.repeat(100000)], 'auth-upload.txt', { type: 'text/plain' }),
          name: 'Auth Upload',
        },
      ],
      category: 'auth-hooks',
    },
    onUploadProgress: (event) => {
      progressEvents.push(event.progress);
    },
  });

  return {
    sentTokens: hooks.sentTokens,
    responseTokens: hooks.responseTokens,
    statuses: hooks.statuses,
    uploadedCount: response.payload.uploadedCount,
    progressEvents,
  };
}

async function runDownloadScenario() {
  const hooks = createHookRecorder('Bearer download-0');
  const client = createClient(usersContract, {
    baseUrl: '/api',
    headers: hooks.headers,
    onResponse: hooks.onResponse,
  });
  const progressEvents: number[] = [];

  const response = await client.authDownloadFile({
    params: { fileId: 'doc-1' },
    onDownloadProgress: (event) => {
      progressEvents.push(event.progress);
    },
  });

  if (response.status !== 200) {
    throw new Error(`Expected download success, received ${response.status}`);
  }

  return {
    sentTokens: hooks.sentTokens,
    responseTokens: hooks.responseTokens,
    statuses: hooks.statuses,
    fileName: response.payload.name,
    fileSize: response.payload.size,
    progressEvents,
  };
}

async function runStreamingScenario() {
  const hooks = createHookRecorder('Bearer streaming-0');
  const client = createClient(streamingContract, {
    baseUrl: '/streaming',
    headers: hooks.headers,
    onResponse: hooks.onResponse,
  });

  const stream = await client.authAiChat({
    body: {
      prompt: 'stream auth hook verification',
    },
  });

  const result = await new Promise<{
    chunks: string;
    final?: { totalTokens: number; completionTime: number };
  }>((resolve, reject) => {
    const chunks: string[] = [];
    let settled = false;

    const cleanup = () => {
      unsubscribeChunk();
      unsubscribeClose();
      unsubscribeError();
    };

    const finish = (payload: {
      chunks: string;
      final?: { totalTokens: number; completionTime: number };
    }) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(payload);
    };

    const unsubscribeChunk = stream.on('chunk', (chunk) => {
      chunks.push(chunk.text);
    });
    const unsubscribeClose = stream.on('close', (final) => {
      finish({
        chunks: chunks.join(''),
        final,
      });
    });
    const unsubscribeError = stream.on('error', (error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error);
    });
  });

  return {
    sentTokens: hooks.sentTokens,
    responseTokens: hooks.responseTokens,
    statuses: hooks.statuses,
    contentTypes: hooks.contentTypes,
    chunks: result.chunks,
    final: result.final,
  };
}

declare global {
  interface Window {
    __authHooksTest?: {
      runStandardScenario: typeof runStandardScenario;
      runUploadScenario: typeof runUploadScenario;
      runDownloadScenario: typeof runDownloadScenario;
      runStreamingScenario: typeof runStreamingScenario;
    };
  }
}

window.__authHooksTest = {
  runStandardScenario,
  runUploadScenario,
  runDownloadScenario,
  runStreamingScenario,
};

export {};
