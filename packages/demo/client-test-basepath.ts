import { createClient } from '@richie-rpc/client';
import { usersContract } from './contract';

// Create a client that talks to a server with basePath
const client = createClient(usersContract, {
  baseUrl: 'http://localhost:3001/api',
  validateRequest: true,
  validateResponse: true,
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

    console.log('✅ All basePath tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testBasePath();

