import path from 'node:path';
import { $ } from 'bun';

// Packages to publish in order (respecting dependencies)
const PACKAGES = ['core', 'server', 'openapi', 'client'];

const publishPackage = async (packageName: string) => {
  const packageDir = path.join(__dirname, '..', 'packages', packageName);
  console.log(`\n📦 Publishing @richie-rpc/${packageName}...`);

  const { stdout, stderr, exitCode } = await $`npm publish`.cwd(packageDir).nothrow();

  if (exitCode !== 0) {
    console.error(`❌ Failed to publish @richie-rpc/${packageName}`);
    console.error(stderr.toString());
    return false;
  }

  console.log(stdout.toString());
  console.log(`✅ Published @richie-rpc/${packageName}`);
  return true;
};

const main = async () => {
  console.log('🚀 Publishing Richie RPC packages to npm...');
  console.log('============================================\n');

  // Check if packages are built
  for (const pkg of PACKAGES) {
    const packageDir = path.join(__dirname, '..', 'packages', pkg);
    const distExists = await Bun.file(path.join(packageDir, 'dist', 'cjs', 'index.cjs')).exists();

    if (!distExists) {
      console.error(`❌ Package @richie-rpc/${pkg} is not built. Run 'bun run build' first.`);
      process.exit(1);
    }
  }

  // Publish packages in order
  for (const pkg of PACKAGES) {
    const success = await publishPackage(pkg);
    if (!success) {
      console.error('\n❌ Publishing failed. Stopping.');
      process.exit(1);
    }

    // Wait a bit between publishes to ensure npm registry updates
    if (pkg !== PACKAGES[PACKAGES.length - 1]) {
      console.log('  ⏳ Waiting 3 seconds before next publish...');
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  console.log('\n✨ All packages published successfully!');
  console.log('\n📦 Published packages:');
  for (const pkg of PACKAGES) {
    console.log(`  - @richie-rpc/${pkg}`);
  }
};

main().catch((error) => {
  console.error('Publishing failed:', error);
  process.exit(1);
});
