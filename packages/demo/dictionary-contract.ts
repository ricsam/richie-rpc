import { defineContract, Status } from '@richie-rpc/core';
import { z } from 'zod';

// Define schemas
const DictionaryEntrySchema = z.object({
  id: z.string(),
  word: z.string(),
  definition: z.string(),
  partOfSpeech: z.string().optional(),
  example: z.string().optional(),
});

const CreateDictionaryEntrySchema = z.object({
  word: z.string().min(1),
  definition: z.string().min(1),
  partOfSpeech: z.string().optional(),
  example: z.string().optional(),
});

const DictionaryEntryListSchema = z.object({
  entries: z.array(DictionaryEntrySchema),
});

const ErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});

// Define the contract
export const dictionaryContract = defineContract({
  // Get dictionary entries with optional search
  getDictionaryEntries: {
    method: 'GET',
    path: '/dictionary',
    query: z.object({
      search: z.string().optional(),
    }),
    responses: {
      [Status.OK]: DictionaryEntryListSchema,
    },
  },

  // Create a new dictionary entry
  createDictionaryEntry: {
    method: 'POST',
    path: '/dictionary',
    body: CreateDictionaryEntrySchema,
    responses: {
      [Status.Created]: DictionaryEntrySchema,
      [Status.BadRequest]: ErrorSchema,
    },
  },

  // Delete a dictionary entry
  deleteDictionaryEntry: {
    method: 'DELETE',
    path: '/dictionary/:id',
    params: z.object({
      id: z.string(),
    }),
    responses: {
      [Status.NoContent]: z.object({}).strict(),
      [Status.NotFound]: ErrorSchema,
    },
  },
});

export type DictionaryEntry = z.infer<typeof DictionaryEntrySchema>;
export type CreateDictionaryEntry = z.infer<typeof CreateDictionaryEntrySchema>;


