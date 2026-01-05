import { createDocsResponse, generateOpenAPISpec } from '@richie-rpc/openapi';
import { createRouter, RouteNotFoundError, Status, ValidationError } from '@richie-rpc/server';
import dictionaryHtml from './dictionary.html';
import { type DictionaryEntry, dictionaryContract } from './dictionary-contract';

// Simple context
type AppContext = {
  appName: string;
  version: string;
};

const appConfig: AppContext = {
  appName: 'Richie RPC Dictionary Demo',
  version: '1.0.0',
};

// In-memory database
const entries: Map<string, DictionaryEntry> = new Map();
let nextId = 1;

// Seed some initial data
entries.set('1', {
  id: '1',
  word: 'serendipity',
  definition: 'The occurrence and development of events by chance in a happy or beneficial way.',
  partOfSpeech: 'noun',
  example: 'A fortunate stroke of serendipity brought the two old friends together.',
});

entries.set('2', {
  id: '2',
  word: 'ephemeral',
  definition: 'Lasting for a very short time.',
  partOfSpeech: 'adjective',
  example: 'The ephemeral beauty of cherry blossoms.',
});

entries.set('3', {
  id: '3',
  word: 'eloquent',
  definition: 'Fluent or persuasive in speaking or writing.',
  partOfSpeech: 'adjective',
  example: 'She gave an eloquent speech at the conference.',
});

// Create router with handlers
const dictionaryRouter = createRouter<typeof dictionaryContract, AppContext>(
  dictionaryContract,
  {
    getDictionaryEntries: async ({ query }) => {
      let allEntries = Array.from(entries.values());

      // Filter by search query if provided
      if (query?.search) {
        const searchLower = query.search.toLowerCase();
        allEntries = allEntries.filter(
          (entry) =>
            entry.word.toLowerCase().includes(searchLower) ||
            entry.definition.toLowerCase().includes(searchLower) ||
            entry.partOfSpeech?.toLowerCase().includes(searchLower) ||
            entry.example?.toLowerCase().includes(searchLower),
        );
      }

      return {
        status: Status.OK,
        body: {
          entries: allEntries,
        },
      };
    },

    createDictionaryEntry: async ({ body }) => {
      const id = String(nextId++);
      const entry: DictionaryEntry = {
        id,
        ...body,
      };

      entries.set(id, entry);

      return {
        status: Status.Created,
        body: entry,
      };
    },

    deleteDictionaryEntry: async ({ params }) => {
      const entry = entries.get(params.id);

      if (!entry) {
        return {
          status: Status.NotFound,
          body: {
            error: 'Not Found',
            message: `Dictionary entry with id ${params.id} not found`,
          },
        };
      }

      entries.delete(params.id);

      return {
        status: Status.NoContent,
        body: {} as Record<string, never>,
      };
    },
  },
  {
    basePath: '/api',
    context: async () => appConfig,
  },
);

// Generate OpenAPI spec
const openAPISpec = generateOpenAPISpec(dictionaryContract, {
  info: {
    title: 'Dictionary API',
    version: '1.0.0',
    description: 'A simple dictionary management API',
  },
  servers: [
    {
      url: `http://${process.env.HOST || 'localhost'}:${process.env.PORT || '3001'}/api`,
      description: 'Development server',
    },
  ],
});

// Create docs HTML
const docsHtml = createDocsResponse('/openapi.json', {
  title: 'Dictionary API Documentation',
});

// Start server
const server = Bun.serve({
  port: Number.parseInt(process.env.PORT || '3001', 10),
  routes: {
    '/openapi.json': Response.json(openAPISpec),
    '/docs': docsHtml,
    '/api/*': async (request) => {
      try {
        return await dictionaryRouter.handle(request);
      } catch (error) {
        if (error instanceof ValidationError) {
          return Response.json(
            {
              error: 'Validation Error',
              field: error.field,
              issues: error.issues,
            },
            { status: 400 },
          );
        }
        if (error instanceof RouteNotFoundError) {
          return Response.json({ error: 'Not Found' }, { status: 404 });
        }
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
      }
    },
    '/': dictionaryHtml,
  },
});

console.log(`🚀 Dictionary server running at http://localhost:${server.port}`);
console.log(`⚛️  Dictionary Demo at http://localhost:${server.port}/`);
console.log(`📚 API Docs available at http://localhost:${server.port}/docs`);
console.log(`📄 OpenAPI Spec at http://localhost:${server.port}/openapi.json`);


