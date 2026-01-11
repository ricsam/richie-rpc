/**
 * Dictionary React Example
 *
 * This file demonstrates a dictionary search application using @richie-rpc/react-query.
 *
 * To run this example:
 * 1. Install dependencies: bun add @tanstack/react-query react react-dom
 * 2. Start the dictionary server: bun run dictionary-server.ts
 * 3. Use this code in your React application
 */

import { createClient } from '@richie-rpc/client';
import { createTanstackQueryApi } from '@richie-rpc/react-query';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import React, { type FormEvent, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { dictionaryContract } from './dictionary-contract';

// Create the client
const client = createClient(dictionaryContract, {
  baseUrl: '/api',
});

// Create TanStack Query API from the client and contract
const api = createTanstackQueryApi(client, dictionaryContract);

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

/**
 * Dictionary App Component
 * Demonstrates search, create, and delete operations
 */
function DictionaryApp() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newDefinition, setNewDefinition] = useState('');
  const [newPartOfSpeech, setNewPartOfSpeech] = useState('');
  const [newExample, setNewExample] = useState('');
  const queryClient = useQueryClient();

  const deferredSearch = React.useDeferredValue(searchQuery);
  const response = api.getDictionaryEntries.useSuspenseQuery({
    queryKey: ['getDictionaryEntries', deferredSearch],
    queryData: { query: { search: deferredSearch || undefined } },
  });
  const entries = response.data.data.entries;

  const createEntry = api.createDictionaryEntry.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['getDictionaryEntries'] });
      setNewWord('');
      setNewDefinition('');
      setNewPartOfSpeech('');
      setNewExample('');
      setIsDialogOpen(false);
    },
  });

  const deleteEntry = api.deleteDictionaryEntry.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['getDictionaryEntries'] });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (newWord.trim() && newDefinition.trim()) {
      createEntry.mutate({
        body: {
          word: newWord.trim(),
          definition: newDefinition.trim(),
          partOfSpeech: newPartOfSpeech.trim() || undefined,
          example: newExample.trim() || undefined,
        },
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      deleteEntry.mutate({ params: { id } });
    }
  };

  return (
    <div className="dictionary-app">
      <div className="dictionary-container">
        <div className="dictionary-header">
          <div className="header-title">
            <span className="icon">📖</span>
            <h1>Dictionary</h1>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setIsDialogOpen(true)}>
            ➕ Add Entry
          </button>
        </div>

        <p className="description">Search and manage your personal dictionary entries.</p>

        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search words or definitions..."
            className="search-input"
          />
        </div>

        <div className="separator" />

        <div className="entries-container">
          {entries.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📖</span>
              <p>
                {searchQuery
                  ? 'No entries found matching your search.'
                  : 'No dictionary entries yet. Add your first entry!'}
              </p>
            </div>
          ) : (
            entries.map(
              (entry: {
                id: string;
                word: string;
                definition: string;
                partOfSpeech?: string;
                example?: string;
              }) => (
                <div key={entry.id} className="entry-card">
                  <div className="entry-content">
                    <div className="entry-header">
                      <h3 className="entry-word">{entry.word}</h3>
                      {entry.partOfSpeech && <span className="badge">{entry.partOfSpeech}</span>}
                    </div>
                    <p className="entry-definition">{entry.definition}</p>
                    {entry.example && (
                      <div className="entry-example">
                        <p className="example-text">"{entry.example}"</p>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-delete"
                    onClick={() => handleDelete(entry.id)}
                    disabled={deleteEntry.isPending}
                    title="Delete entry"
                  >
                    🗑️
                  </button>
                </div>
              ),
            )
          )}
        </div>
      </div>

      {isDialogOpen && (
        <button
          type="button"
          className="dialog-overlay"
          onClick={() => setIsDialogOpen(false)}
          aria-label="Close dialog"
        >
          <div
            className="dialog-content"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="dialog-header">
              <h2>Add New Entry</h2>
              <button type="button" className="btn-close" onClick={() => setIsDialogOpen(false)}>
                ✕
              </button>
            </div>
            <p className="dialog-description">
              Create a new dictionary entry with word and definition.
            </p>
            <form onSubmit={handleSubmit} className="entry-form">
              <div className="form-group">
                <label htmlFor="word">Word *</label>
                <input
                  id="word"
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  placeholder="e.g., serendipity"
                  disabled={createEntry.isPending}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="definition">Definition *</label>
                <textarea
                  id="definition"
                  value={newDefinition}
                  onChange={(e) => setNewDefinition(e.target.value)}
                  placeholder="The meaning of the word..."
                  disabled={createEntry.isPending}
                  rows={3}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="partOfSpeech">Part of Speech</label>
                <input
                  id="partOfSpeech"
                  type="text"
                  value={newPartOfSpeech}
                  onChange={(e) => setNewPartOfSpeech(e.target.value)}
                  placeholder="e.g., noun, verb, adjective"
                  disabled={createEntry.isPending}
                />
              </div>
              <div className="form-group">
                <label htmlFor="example">Example</label>
                <textarea
                  id="example"
                  value={newExample}
                  onChange={(e) => setNewExample(e.target.value)}
                  placeholder="Example sentence using this word..."
                  disabled={createEntry.isPending}
                  rows={2}
                />
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={createEntry.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createEntry.isPending || !newWord.trim() || !newDefinition.trim()}
                >
                  {createEntry.isPending ? 'Adding...' : 'Add Entry'}
                </button>
              </div>
              {createEntry.error && (
                <div className="error-message">Error: {createEntry.error.message}</div>
              )}
            </form>
          </div>
        </button>
      )}
    </div>
  );
}

/**
 * Main App Component with Suspense boundary
 */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="app">
        <Suspense fallback={<div className="loading">Loading dictionary...</div>}>
          <DictionaryApp />
        </Suspense>
      </div>
    </QueryClientProvider>
  );
}

if (typeof document !== 'undefined') {
  const root = document.getElementById('root');
  if (root) {
    const reactRoot = createRoot(root);
    reactRoot.render(<App />);

    // Handle HMR
    if (import.meta.hot) {
      import.meta.hot.accept();
      import.meta.hot.dispose(() => {
        reactRoot.unmount();
      });
    }
  }
}

// Styles
const styles = `
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background: linear-gradient(to bottom right, #f5f5f5, #e0e0e0);
    min-height: 100vh;
  }

  .app {
    min-height: 100vh;
    padding: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dictionary-container {
    width: 100%;
    max-width: 800px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    padding: 2rem;
  }

  .dictionary-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .header-title .icon {
    font-size: 1.5rem;
  }

  .header-title h1 {
    font-size: 1.75rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  .description {
    color: #666;
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
  }

  .search-container {
    position: relative;
    margin-bottom: 1rem;
  }

  .search-icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 1rem;
    color: #999;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 0.75rem 0.75rem 2.5rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
    transition: border-color 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: #4a90e2;
  }

  .separator {
    height: 1px;
    background: #e0e0e0;
    margin: 1.5rem 0;
  }

  .entries-container {
    max-height: 500px;
    overflow-y: auto;
    padding-right: 0.5rem;
  }

  .entry-card {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    margin-bottom: 0.75rem;
    background: #fafafa;
    transition: box-shadow 0.2s;
  }

  .entry-card:hover {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .entry-content {
    flex: 1;
  }

  .entry-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .entry-word {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  .badge {
    padding: 0.25rem 0.5rem;
    background: #e0e0e0;
    border-radius: 4px;
    font-size: 0.75rem;
    color: #666;
  }

  .entry-definition {
    color: #555;
    font-size: 0.9rem;
    line-height: 1.5;
    margin-bottom: 0.5rem;
  }

  .entry-example {
    margin-top: 0.5rem;
    padding-left: 0.75rem;
    border-left: 2px solid #e0e0e0;
  }

  .example-text {
    font-size: 0.85rem;
    font-style: italic;
    color: #666;
  }

  .btn-delete {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    padding: 0.5rem;
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  .btn-delete:hover:not(:disabled) {
    opacity: 1;
  }

  .btn-delete:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #999;
  }

  .empty-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 1rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: #4a90e2;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #357abd;
  }

  .btn-secondary {
    background: #e0e0e0;
    color: #333;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #d0d0d0;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .dialog-content {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 1.5rem;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .dialog-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #999;
    padding: 0.25rem;
  }

  .btn-close:hover {
    color: #333;
  }

  .dialog-description {
    color: #666;
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }

  .entry-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-weight: 500;
    font-size: 0.9rem;
    color: #333;
  }

  .form-group input,
  .form-group textarea {
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 0.9rem;
    font-family: inherit;
    transition: border-color 0.2s;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #4a90e2;
  }

  .form-group input:disabled,
  .form-group textarea:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
  }

  .form-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }

  .error-message {
    color: #d32f2f;
    font-size: 0.85rem;
    margin-top: 0.5rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: #666;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}
