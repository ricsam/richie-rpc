import { createClient, ErrorResponse } from '@richie-rpc/client';
import { usersContract } from './contract';

// Create typesafe client
const client = createClient(usersContract, {
  baseUrl: 'http://localhost:3000/api',
});

// Test the API
async function runTests() {
  console.log('🧪 Running client integration tests...\n');

  try {
    // Test 1: List users
    console.log('1️⃣ Testing listUsers...');
    const listResponse = await client.listUsers({ query: {} });
    console.log(`✅ Found ${listResponse.payload.users.length} users`);
    console.log(`   Total: ${listResponse.payload.total}`);

    // Test 2: Get a specific user
    console.log('\n2️⃣ Testing getUser...');
    const getUserResponse = await client.getUser({ params: { id: '1' } });
    console.log(`✅ Got user: ${getUserResponse.payload.name}`);
    console.log(`   Email: ${getUserResponse.payload.email}`);

    // Test 3: Create a new user
    console.log('\n3️⃣ Testing createUser...');
    const createResponse = await client.createUser({
      body: {
        name: 'Charlie Brown',
        email: 'charlie@example.com',
        age: 42,
      },
    });
    if (createResponse.status !== 201) {
      throw new Error('Expected 201 status');
    }
    console.log(`✅ Created user with ID: ${createResponse.payload.id}`);
    console.log(`   Name: ${createResponse.payload.name}`);
    const newUserId = createResponse.payload.id;

    // Test 4: Update the user
    console.log('\n4️⃣ Testing updateUser...');
    const updateResponse = await client.updateUser({
      params: { id: newUserId },
      body: {
        age: 43,
      },
    });
    if (updateResponse.status !== 200) {
      throw new Error('Expected 200 status');
    }
    console.log(`✅ Updated user age to: ${updateResponse.payload.age}`);

    // Test 5: Get the updated user
    console.log('\n5️⃣ Testing getUser (updated)...');
    const getUpdatedResponse = await client.getUser({ params: { id: newUserId } });
    console.log(`✅ Confirmed age: ${getUpdatedResponse.payload.age}`);

    // Test 6: Delete the user
    console.log('\n6️⃣ Testing deleteUser...');
    await client.deleteUser({ params: { id: newUserId } });
    console.log('✅ Deleted user successfully');

    // Test 7: Try to get deleted user (should throw ErrorResponse with 404)
    console.log('\n7️⃣ Testing getUser (deleted, should 404)...');
    try {
      await client.getUser({ params: { id: newUserId } });
      console.log('❌ Should have thrown ErrorResponse');
      throw new Error('Expected ErrorResponse');
    } catch (error: unknown) {
      if (error instanceof ErrorResponse && error.status === 404) {
        console.log('✅ Correctly threw ErrorResponse with 404');
      } else {
        throw error;
      }
    }

    // Test 8: Test validation error
    console.log('\n8️⃣ Testing validation error...');
    try {
      await client.createUser({
        body: {
          name: '', // Invalid: empty name
          email: 'invalid-email', // Invalid: not an email
          // biome-ignore lint/suspicious/noExplicitAny: intentionally testing validation
        },
      });
      console.log('❌ Should have thrown validation error');
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ClientValidationError' && 'field' in error) {
        console.log('✅ Correctly caught validation error');
        console.log(`   Field: ${(error as { field: string }).field}`);
      } else {
        throw error;
      }
    }

    // Test 9: Test abort signal
    console.log('\n9️⃣ Testing abort signal...');
    try {
      const abortController = new AbortController();
      const promise = client.listUsers({
        query: {},
        abortSignal: abortController.signal,
      });
      // Abort immediately
      abortController.abort();
      await promise;
      console.log('❌ Should have thrown abort error');
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('✅ Correctly caught abort error');
      } else {
        throw error;
      }
    }

    // Test 10: File upload with nested files
    console.log('\n🔟 Testing uploadDocuments (formData with nested files)...');
    const file1 = new File(['hello world'], 'doc1.txt', { type: 'text/plain' });
    const file2 = new File(['test content'], 'doc2.txt', { type: 'text/plain' });

    const uploadResponse = await client.uploadDocuments({
      body: {
        documents: [
          { file: file1, name: 'Document 1', tags: ['important', 'test'] },
          { file: file2, name: 'Document 2' },
        ],
        category: 'test-category',
      },
    });

    if (uploadResponse.status === 201) {
      console.log(`✅ Uploaded ${uploadResponse.payload.uploadedCount} files`);
      console.log(`   Total size: ${uploadResponse.payload.totalSize} bytes`);
      console.log(`   Filenames: ${uploadResponse.payload.filenames.join(', ')}`);
    } else {
      throw new Error('Expected 201 status');
    }

    console.log('\n✨ All tests passed!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
runTests().catch(console.error);
