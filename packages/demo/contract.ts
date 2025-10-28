import { defineContract } from '@richie-rpc/core';
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
    method: 'GET',
    path: '/users',
    query: z.object({
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
    responses: {
      200: UserListSchema,
    },
  },

  // Get a single user
  getUser: {
    method: 'GET',
    path: '/users/:id',
    params: z.object({
      id: z.string(),
    }),
    responses: {
      200: UserSchema,
      404: ErrorSchema,
    },
  },

  // Create a new user
  createUser: {
    method: 'POST',
    path: '/users',
    body: CreateUserSchema,
    responses: {
      201: UserSchema,
      400: ErrorSchema,
    },
  },

  // Update a user
  updateUser: {
    method: 'PUT',
    path: '/users/:id',
    params: z.object({
      id: z.string(),
    }),
    body: UpdateUserSchema,
    responses: {
      200: UserSchema,
      404: ErrorSchema,
      400: ErrorSchema,
    },
  },

  // Delete a user
  deleteUser: {
    method: 'DELETE',
    path: '/users/:id',
    params: z.object({
      id: z.string(),
    }),
    responses: {
      204: z.object({}).strict(),
      404: ErrorSchema,
    },
  },
});

export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
