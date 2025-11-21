import path from 'node:path';
import { $ } from 'bun';

// Packages to typecheck
const PACKAGES = ['core', 'server', 'openapi', 'client', 'demo', 'react-query'];

const typecheckPackage = async (packageName: string) => {
  const packageDir = path.join(__dirname, '..', 'packages', packageName);
  console.log(`\n📝 Type checking @richie-rpc/${packageName}...`);

  const { stdout, stderr, exitCode } = await $`bunx --bun tsc --noEmit`.cwd(packageDir).nothrow();

  if (exitCode !== 0) {
    console.error(`❌ Type errors in @richie-rpc/${packageName}:`);
    console.error(stderr.toString());
    console.log(stdout.toString());
    return false;
  }

  const output = stdout.toString();
  if (output.trim() !== '') {
    console.log(output);
  }

  console.log(`  ✅ No type errors`);
  return true;
};

const main = async () => {
  console.log('🔍 Type checking all Richie RPC packages...');
  console.log('============================================\n');

  let allPassed = true;

  for (const pkg of PACKAGES) {
    const passed = await typecheckPackage(pkg);
    if (!passed) {
      allPassed = false;
    }
  }

  if (!allPassed) {
    console.error('\n❌ Type checking failed in one or more packages');
    process.exit(1);
  }

  console.log('\n✨ All packages passed type checking!');
};

main().catch((error) => {
  console.error('Type checking failed:', error);
  process.exit(1);
});
