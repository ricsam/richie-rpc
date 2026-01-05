import { createClient } from '@richie-rpc/client';
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
    console.log(`✅ Found ${listResponse.data.users.length} users`);
    console.log(`   Total: ${listResponse.data.total}`);

    // Test 2: Get a specific user
    console.log('\n2️⃣ Testing getUser...');
    const getUserResponse = await client.getUser({ params: { id: '1' } });
    if (getUserResponse.status === 200) {
      console.log(`✅ Got user: ${getUserResponse.data.name}`);
      console.log(`   Email: ${getUserResponse.data.email}`);
    } else {
      throw new Error('Expected 200 status');
    }

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
    console.log(`✅ Created user with ID: ${createResponse.data.id}`);
    console.log(`   Name: ${createResponse.data.name}`);
    const newUserId = createResponse.data.id;

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
    console.log(`✅ Updated user age to: ${updateResponse.data.age}`);

    // Test 5: Get the updated user
    console.log('\n5️⃣ Testing getUser (updated)...');
    const getUpdatedResponse = await client.getUser({ params: { id: newUserId } });
    if (getUpdatedResponse.status === 200) {
      console.log(`✅ Confirmed age: ${getUpdatedResponse.data.age}`);
    } else {
      throw new Error('Expected 200 status');
    }

    // Test 6: Delete the user
    console.log('\n6️⃣ Testing deleteUser...');
    await client.deleteUser({ params: { id: newUserId } });
    console.log('✅ Deleted user successfully');

    // Test 7: Try to get deleted user (should 404)
    console.log('\n7️⃣ Testing getUser (deleted, should 404)...');
    const deletedResponse = await client.getUser({ params: { id: newUserId } });
    if (deletedResponse.status === 404) {
      console.log('✅ Correctly returned 404 for deleted user');
    } else {
      console.log('❌ Expected status 404 but got', deletedResponse.status);
      throw new Error('Expected 404 status');
    }

    // Test 8: Test validation error
    console.log('\n8️⃣ Testing validation error...');
    try {
      await client.createUser({
        body: {
          name: '', // Invalid: empty name
          email: 'invalid-email', // Invalid: not an email
          // biome-ignore lint/suspicious/noExplicitAny: intentionally testing validation
        } as any,
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
      console.log(`✅ Uploaded ${uploadResponse.data.uploadedCount} files`);
      console.log(`   Total size: ${uploadResponse.data.totalSize} bytes`);
      console.log(`   Filenames: ${uploadResponse.data.filenames.join(', ')}`);
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
