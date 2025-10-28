import path from 'node:path';
import { $ } from 'bun';

// Packages to publish in order (respecting dependencies)
const PACKAGES = ['core', 'server', 'openapi', 'client'];

const checkIfPublished = async (packageName: string): Promise<boolean> => {
  const packageDir = path.join(__dirname, '..', 'packages', packageName);
  const packageJson = await Bun.file(path.join(packageDir, 'package.json')).json();
  const name = packageJson.name;
  const version = packageJson.version;

  const { exitCode } = await $`npm view ${name}@${version} version`.nothrow().quiet();

  if (exitCode === 0) {
    console.log(`  ⏭️  ${name}@${version} already published - skipping`);
    return true;
  }

  console.log(`  ✓ ${name}@${version} needs publishing`);
  return false;
};

const publishPackage = async (packageName: string) => {
  const packageDir = path.join(__dirname, '..', 'packages', packageName);
  const packageJson = await Bun.file(path.join(packageDir, 'package.json')).json();

  console.log(`\n📦 Publishing ${packageJson.name}@${packageJson.version}...`);

  const { stdout, stderr, exitCode } = await $`npm publish`.cwd(packageDir).nothrow();

  if (exitCode !== 0) {
    console.error(`❌ Failed to publish ${packageJson.name}`);
    console.error(stderr.toString());
    return false;
  }

  console.log(stdout.toString());
  console.log(`✅ Published ${packageJson.name}@${packageJson.version}`);
  return true;
};

const main = async () => {
  console.log('🚀 Publishing Richie RPC packages to npm...');
  console.log('============================================\n');

  // Check if packages are built
  console.log('📋 Checking build status...');
  for (const pkg of PACKAGES) {
    const packageDir = path.join(__dirname, '..', 'packages', pkg);
    const distExists = await Bun.file(path.join(packageDir, 'dist', 'cjs', 'index.cjs')).exists();

    if (!distExists) {
      console.error(`❌ Package @richie-rpc/${pkg} is not built. Run 'bun run build' first.`);
      process.exit(1);
    }
  }
  console.log('✅ All packages built\n');

  // Check which packages need publishing
  console.log('📋 Checking npm registry...');
  const toPublish: string[] = [];
  for (const pkg of PACKAGES) {
    const alreadyPublished = await checkIfPublished(pkg);
    if (!alreadyPublished) {
      toPublish.push(pkg);
    }
  }

  if (toPublish.length === 0) {
    console.log('\n⏭️  All packages already published at current versions');
    console.log('💡 Bump versions in package.json files to publish new versions');
    return;
  }

  console.log(`\n📦 Publishing ${toPublish.length} package(s)...\n`);

  // Publish packages in order
  const published: string[] = [];
  for (const pkg of toPublish) {
    const success = await publishPackage(pkg);
    if (!success) {
      console.error('\n❌ Publishing failed. Stopping.');
      process.exit(1);
    }

    published.push(pkg);

    // Wait after publishing core (others may depend on it)
    if (pkg === 'core' && toPublish.length > 1) {
      console.log('  ⏳ Waiting 5 seconds for npm registry to update...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.log('\n✨ Publishing complete!');
  console.log(`\n📦 Published ${published.length} package(s):`);
  for (const pkg of published) {
    const packageDir = path.join(__dirname, '..', 'packages', pkg);
    const packageJson = await Bun.file(path.join(packageDir, 'package.json')).json();
    console.log(`  ✅ ${packageJson.name}@${packageJson.version}`);
  }
};

main().catch((error) => {
  console.error('Publishing failed:', error);
  process.exit(1);
});
