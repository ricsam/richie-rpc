import { defineContract, Status } from '@richie-rpc/core';
import { z } from 'zod';

// Define schemas
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().int().min(0).optional(),
});

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().min(0).optional(),
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  age: z.number().int().min(0).optional(),
});

const ErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});

const UserListSchema = z.object({
  users: z.array(UserSchema),
  total: z.number(),
});

// Define the contract
export const usersContract = defineContract({
  // List all users
  listUsers: {
    type: 'standard',
    method: 'GET',
    path: '/users',
    query: z.object({
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
    responses: {
      [Status.OK]: UserListSchema,
    },
  },

  // Get a single user
  getUser: {
    type: 'standard',
    method: 'GET',
    path: '/users/:id',
    params: z.object({
      id: z.string(),
    }),
    responses: {
      [Status.OK]: UserSchema,
      [Status.NotFound]: ErrorSchema,
    },
  },

  // Create a new user
  createUser: {
    type: 'standard',
    method: 'POST',
    path: '/users',
    body: CreateUserSchema,
    responses: {
      [Status.Created]: UserSchema,
      [Status.BadRequest]: ErrorSchema,
    },
  },

  // Update a user
  updateUser: {
    type: 'standard',
    method: 'PUT',
    path: '/users/:id',
    params: z.object({
      id: z.string(),
    }),
    body: UpdateUserSchema,
    responses: {
      [Status.OK]: UserSchema,
      [Status.NotFound]: ErrorSchema,
      [Status.BadRequest]: ErrorSchema,
    },
  },

  // Delete a user
  deleteUser: {
    type: 'standard',
    method: 'DELETE',
    path: '/users/:id',
    params: z.object({
      id: z.string(),
    }),
    responses: {
      [Status.NoContent]: z.object({}).strict(),
      [Status.NotFound]: ErrorSchema,
    },
  },

  // Custom status code example
  teapot: {
    type: 'standard',
    method: 'GET',
    path: '/teapot',
    responses: {
      418: z.object({
        message: z.string(),
        isTeapot: z.boolean(),
        appInfo: z.object({
          name: z.string(),
          version: z.string(),
          darkModeEnabled: z.boolean(),
        }),
      }),
    },
  },

  // File upload with nested files
  uploadDocuments: {
    type: 'standard',
    method: 'POST',
    path: '/upload',
    contentType: 'multipart/form-data',
    body: z.object({
      documents: z.array(
        z.object({
          file: z.instanceof(File),
          name: z.string(),
          tags: z.array(z.string()).optional(),
        }),
      ),
      category: z.string(),
    }),
    responses: {
      [Status.Created]: z.object({
        uploadedCount: z.number(),
        totalSize: z.number(),
        filenames: z.array(z.string()),
      }),
    },
  },

  // File download
  downloadFile: {
    type: 'download',
    method: 'GET',
    path: '/files/:fileId',
    params: z.object({
      fileId: z.string(),
    }),
    errorResponses: {
      [Status.NotFound]: ErrorSchema,
    },
  },
});

export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
