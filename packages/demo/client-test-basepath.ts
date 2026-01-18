import { createClient } from '@richie-rpc/client';
import { usersContract } from './contract';

// Create a client that talks to a server with basePath
const client = createClient(usersContract, {
  baseUrl: 'http://localhost:3001/api',
  validateRequest: true,
  parseResponse: true,
});

async function testBasePath() {
  console.log('🧪 Testing basePath support...\n');

  try {
    // Test 1: List users
    console.log('📋 Listing users...');
    const listResponse = await client.listUsers({});
    console.log(`   Status: ${listResponse.status}`);
    console.log(`   Found ${listResponse.data.total} users`);
    console.log(`   Users:`, listResponse.data.users);
    console.log();

    // Test 2: Get a specific user
    console.log('👤 Getting user with ID "1"...');
    const getResponse = await client.getUser({ params: { id: '1' } });
    console.log(`   Status: ${getResponse.status}`);
    if (getResponse.status === 200) {
      console.log(`   User:`, getResponse.data);
    }
    console.log();

    // Test 3: Create a new user
    console.log('➕ Creating a new user...');
    const createResponse = await client.createUser({
      body: {
        name: 'BasePath Test User',
        email: 'basepath@example.com',
        age: 42,
      },
    });
    console.log(`   Status: ${createResponse.status}`);
    if (createResponse.status === 201) {
      console.log(`   Created user:`, createResponse.data);

      // Test 4: Update the user
      const userId = createResponse.data.id;
      console.log();
      console.log(`✏️  Updating user ${userId}...`);
      const updateResponse = await client.updateUser({
        params: { id: userId },
        body: { age: 43 },
      });
      console.log(`   Status: ${updateResponse.status}`);
      if (updateResponse.status === 200) {
        console.log(`   Updated user:`, updateResponse.data);
      }

      // Test 5: Delete the user
      console.log();
      console.log(`🗑️  Deleting user ${userId}...`);
      const deleteResponse = await client.deleteUser({ params: { id: userId } });
      console.log(`   Status: ${deleteResponse.status}`);
    }
    console.log();

    // Test 6: File upload with nested files
    console.log('📁 Testing file upload with nested files...');
    const file1 = new File(['hello world'], 'doc1.txt', { type: 'text/plain' });
    const file2 = new File(['test content'], 'doc2.txt', { type: 'text/plain' });

    const uploadResponse = await client.uploadDocuments({
      body: {
        documents: [
          { file: file1, name: 'Document 1', tags: ['important'] },
          { file: file2, name: 'Document 2' },
        ],
        category: 'basepath-test',
      },
    });
    console.log(`   Status: ${uploadResponse.status}`);
    if (uploadResponse.status === 201) {
      console.log(`   Uploaded: ${uploadResponse.data.uploadedCount} files`);
      console.log(`   Total size: ${uploadResponse.data.totalSize} bytes`);
      console.log(`   Filenames: ${uploadResponse.data.filenames.join(', ')}`);
    }
    console.log();

    console.log('✅ All basePath tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testBasePath();
