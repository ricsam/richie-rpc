import path from 'node:path';
import { $, Glob } from 'bun';

if (!process.env.CI) {
  throw new Error('This script is only meant to be run in CI');
}

// Packages to build (excluding demo which is not published)
const PACKAGES = ['core', 'server', 'openapi', 'client', 'react-query'];

interface RootMetadata {
  author: string;
  license: string;
  repository: { type: string; url: string };
  bugs?: { url: string };
  homepage?: string;
  keywords: string[];
  description: string;
}

const buildPackage = async (packageName: string, rootMetadata: RootMetadata) => {
  const packageDir = path.join(__dirname, '..', 'packages', packageName);
  console.log(`\n📦 Building @richie-rpc/${packageName}...`);

  const packageJson = await Bun.file(path.join(packageDir, 'package.json')).json();

  // Create build-specific tsconfig.json
  await Bun.write(
    path.join(packageDir, 'tsconfig.build.json'),
    JSON.stringify(
      {
        compilerOptions: {
          allowJs: true,
          allowSyntheticDefaultImports: true,
          target: 'ESNext',
          declaration: true,
          esModuleInterop: true,
          inlineSourceMap: false,
          lib: ['ESNext', 'DOM'],
          listEmittedFiles: false,
          listFiles: false,
          moduleResolution: 'bundler',
          noFallthroughCasesInSwitch: true,
          pretty: true,
          resolveJsonModule: true,
          rootDir: '.',
          skipLibCheck: true,
          strict: true,
          traceResolution: false,
        },
        compileOnSave: false,
        exclude: ['node_modules', 'dist', '**/*.test.ts'],
        include: ['**/*.ts'],
      },
      null,
      2,
    ),
  );

  // Create types-specific tsconfig
  await Bun.write(
    path.join(packageDir, 'tsconfig.types.json'),
    JSON.stringify(
      {
        extends: './tsconfig.build.json',
        compilerOptions: {
          declaration: true,
          outDir: 'dist/types',
          emitDeclarationOnly: true,
          declarationDir: 'dist/types',
        },
      },
      null,
      2,
    ),
  );

  // TypeScript compilation for type declarations
  const runTsc = async (tsconfig: string) => {
    const { stdout, stderr, exitCode } = await $`bunx --bun tsc -p ${tsconfig}`
      .cwd(packageDir)
      .nothrow();

    if (exitCode !== 0) {
      console.error(stderr.toString());
      console.log(stdout.toString());
      return false;
    }
    const output = stdout.toString();
    if (output.trim() !== '') {
      console.log(output);
    }
    console.log(`  ✅ Type declarations generated`);
    return true;
  };

  // Build with Bun for both formats
  const bunBuildFile = async (src: string, _outdir: string, type: 'cjs' | 'mjs') => {
    const result = await Bun.build({
      entrypoints: [src],
      outdir: path.join(packageDir, 'dist', type),
      sourcemap: 'external',
      format: type === 'mjs' ? 'esm' : 'cjs',
      packages: 'external',
      external: ['*'],
      naming: `[name].${type}`,
      target: 'bun',
      plugins: [
        {
          name: 'extension-plugin',
          setup(build) {
            build.onLoad({ filter: /\.tsx?$/, namespace: 'file' }, async (args) => {
              let content = await Bun.file(args.path).text();
              const extension = type;

              // Replace relative imports with extension (handles both extensionless and .ts/.tsx imports)
              content = content.replace(
                /((?:im|ex)port\s[\w{}/*\s,]+from\s['"](?:\.\.?\/)+[^'"]+?)(?:\.tsx?)?(?=['"])/gm,
                `$1.${extension}`,
              );

              // Replace dynamic imports
              content = content.replace(
                /(import\(['"](?:\.\.?\/)+[^'"]+?)(?:\.tsx?)?(?=['"])/gm,
                `$1.${extension}`,
              );

              return {
                contents: content,
                loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts',
              };
            });
          },
        },
      ],
    });

    result.logs.forEach((log) => {
      console.log(`  [${log.level}] ${log.message}`);
    });

    if (!result.success) {
      return false;
    }

    return true;
  };

  // Recursive build function for all .ts files
  const runBunBundleRec = async (type: 'cjs' | 'mjs') => {
    const tsGlob = new Glob('**/*.ts');
    for await (const file of tsGlob.scan({
      cwd: packageDir,
    })) {
      // Skip test files, declaration files, and dist folder
      if (file.endsWith('.test.ts') || file.endsWith('.d.ts') || file.startsWith('dist/')) {
        continue;
      }
      // Get the directory part of the relative path to preserve folder structure
      const relativeDir = path.dirname(file);
      await bunBuildFile(path.join(packageDir, file), relativeDir, type);
    }
    return true;
  };

  // Clean dist directory
  await $`rm -rf dist`.cwd(packageDir).nothrow();

  // Build all formats in parallel
  const success = (
    await Promise.all([
      runBunBundleRec('mjs'),
      runBunBundleRec('cjs'),
      runTsc('tsconfig.types.json'),
    ])
  ).every((s) => s);

  if (!success) {
    throw new Error(`Failed to build @richie-rpc/${packageName}`);
  }

  console.log(`  ✅ CJS bundle created`);
  console.log(`  ✅ MJS bundle created`);

  // Create package.json in dist folders
  const version = packageJson.version;

  for (const [folder, type] of [
    ['dist/cjs', 'commonjs'],
    ['dist/mjs', 'module'],
  ] as const) {
    await Bun.write(
      path.join(packageDir, folder, 'package.json'),
      JSON.stringify(
        {
          name: packageJson.name,
          version,
          type,
        },
        null,
        2,
      ),
    );
  }

  // Update main package.json for publishing
  const publishPackageJson = { ...packageJson };

  // Inject metadata from root package.json
  publishPackageJson.author = rootMetadata.author;
  publishPackageJson.license = rootMetadata.license;
  publishPackageJson.repository = rootMetadata.repository;
  publishPackageJson.bugs = rootMetadata.bugs;
  publishPackageJson.homepage = rootMetadata.homepage;
  publishPackageJson.keywords = rootMetadata.keywords;

  // Add package-specific description if not present
  if (!publishPackageJson.description) {
    const descriptions: Record<string, string> = {
      core: 'Core contract definitions and type utilities for Richie RPC',
      server: 'Server implementation for Bun.serve with automatic validation',
      openapi: 'OpenAPI 3.1 specification generator for Richie RPC contracts',
      client: 'Type-safe fetch client for Richie RPC contracts',
      reactQuery: 'React Query hooks for Richie RPC contracts',
    };
    publishPackageJson.description = descriptions[packageName] || rootMetadata.description;
  }

  // Remove dev-only fields and dependencies (using peerDependencies instead)
  delete publishPackageJson.devDependencies;
  delete publishPackageJson.dependencies;

  // Update peerDependencies to remove workspace protocol
  if (publishPackageJson.peerDependencies) {
    for (const [dep, ver] of Object.entries(publishPackageJson.peerDependencies)) {
      if (typeof ver === 'string' && ver.startsWith('workspace:')) {
        // Get the actual version from the dependency's package.json
        const depPackageName = dep.replace('@richie-rpc/', '');
        if (PACKAGES.includes(depPackageName)) {
          const depPackageJson = await Bun.file(
            path.join(__dirname, '..', 'packages', depPackageName, 'package.json'),
          ).json();
          publishPackageJson.peerDependencies[dep] = `^${depPackageJson.version}`;
        }
      }
    }
  }

  // Set module type and exports
  delete publishPackageJson.type;
  publishPackageJson.main = './dist/cjs/index.cjs';
  publishPackageJson.module = './dist/mjs/index.mjs';
  publishPackageJson.types = './dist/types/index.d.ts';
  publishPackageJson.exports = {
    '.': {
      types: './dist/types/index.d.ts',
      require: './dist/cjs/index.cjs',
      import: './dist/mjs/index.mjs',
    },
  };
  publishPackageJson.publishConfig = {
    access: 'public',
  };
  publishPackageJson.files = ['dist', 'README.md'];

  // Write the publish-ready package.json
  await Bun.write(
    path.join(packageDir, 'package.json'),
    JSON.stringify(publishPackageJson, null, 2),
  );

  console.log(`  ✅ package.json updated for publishing`);
  console.log(`✨ Finished building @richie-rpc/${packageName} v${version}`);
};

// Main build process
const main = async () => {
  console.log('🚀 Building Richie RPC packages for npm publishing...');
  console.log('======================================================\n');

  // Load root package.json for metadata
  const rootPackageJson = await Bun.file(path.join(__dirname, '..', 'package.json')).json();
  const rootMetadata = {
    author: rootPackageJson.author,
    license: rootPackageJson.license,
    repository: rootPackageJson.repository,
    bugs: rootPackageJson.bugs,
    homepage: rootPackageJson.homepage,
    keywords: rootPackageJson.keywords,
    description: rootPackageJson.description,
  };

  for (const pkg of PACKAGES) {
    try {
      await buildPackage(pkg, rootMetadata);
    } catch (error) {
      console.error(`❌ Failed to build @richie-rpc/${pkg}:`, error);
      process.exit(1);
    }
  }

  console.log('\n✨ All packages built successfully!');
  console.log('\n📝 Next steps:');
  console.log('  1. Review the built packages in packages/*/dist');
  console.log('  2. Test the packages locally if needed');
  console.log('  3. Publish with: npm publish packages/core');
  console.log('                   npm publish packages/server');
  console.log('                   npm publish packages/openapi');
  console.log('                   npm publish packages/client');
  console.log('                   npm publish packages/react-query');
  console.log('\n   Or use: bun run publish:all\n');
};

main().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
