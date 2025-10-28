import path from 'node:path';
import { $ } from 'bun';

// Packages to restore
const PACKAGES = ['core', 'server', 'openapi', 'client'];

const restorePackage = async (packageName: string) => {
  const packageDir = path.join(__dirname, '..', 'packages', packageName);
  console.log(`\n🔄 Restoring @richie-rpc/${packageName}...`);

  // Remove build artifacts
  await $`rm -rf dist`.cwd(packageDir).nothrow();
  await $`rm -f tsconfig.build.json tsconfig.types.json`.cwd(packageDir).nothrow();

  console.log(`  ✅ Cleaned build artifacts`);
};

const main = async () => {
  console.log('🔄 Restoring Richie RPC packages to development state...');
  console.log('=========================================================\n');

  // Restore all packages
  for (const pkg of PACKAGES) {
    await restorePackage(pkg);
  }

  // Restore package.json files from git
  console.log('\n🔄 Restoring package.json files from git...');
  await $`git checkout packages/*/package.json`.nothrow();

  // Reinstall dependencies to restore workspace links
  console.log('\n📦 Reinstalling dependencies...');
  await $`bun install`;

  console.log('\n✨ All packages restored to development state!');
  console.log('\n📝 You can now continue development normally.');
};

main().catch((error) => {
  console.error('Restore failed:', error);
  process.exit(1);
});
