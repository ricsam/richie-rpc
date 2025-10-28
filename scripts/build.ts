import { $, Glob } from 'bun';
import fs from 'fs/promises';
import path from 'path';

// Packages to build (excluding demo which is not published)
const PACKAGES = ['core', 'server', 'openapi', 'client'];

const buildPackage = async (packageName: string) => {
  const packageDir = path.join(__dirname, '..', 'packages', packageName);
  console.log(`\n📦 Building @rfetch/${packageName}...`);

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
          lib: ['ESNext'],
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
        exclude: ['node_modules', 'dist'],
        include: ['index.ts'],
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
  const bunBuildFile = async (src: string, outdir: string, type: 'cjs' | 'mjs') => {
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

              // Replace relative imports with extension
              content = content.replace(
                /(im|ex)port\s[\w{}/*\s,]+from\s['"](?:\.\.?\/)+?[^.'"]+(?=['"];?)/gm,
                `$&.${extension}`,
              );

              // Replace dynamic imports
              content = content.replace(
                /import\(['"](?:\.\.?\/)+?[^.'"]+(?=['"];?)/gm,
                `$&.${extension}`,
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

  // Clean dist directory
  await $`rm -rf dist`.cwd(packageDir).nothrow();

  // Build all formats in parallel
  const success = (
    await Promise.all([
      bunBuildFile(path.join(packageDir, 'index.ts'), '.', 'mjs'),
      bunBuildFile(path.join(packageDir, 'index.ts'), '.', 'cjs'),
      runTsc('tsconfig.types.json'),
    ])
  ).every((s) => s);

  if (!success) {
    throw new Error(`Failed to build @rfetch/${packageName}`);
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

  // Remove dev-only fields
  delete publishPackageJson.devDependencies;

  // Update dependencies to remove workspace protocol
  if (publishPackageJson.dependencies) {
    for (const [dep, ver] of Object.entries(publishPackageJson.dependencies)) {
      if (typeof ver === 'string' && ver.startsWith('workspace:')) {
        // Get the actual version from the dependency's package.json
        const depPackageName = dep.replace('@rfetch/', '');
        if (PACKAGES.includes(depPackageName)) {
          const depPackageJson = await Bun.file(
            path.join(__dirname, '..', 'packages', depPackageName, 'package.json'),
          ).json();
          publishPackageJson.dependencies[dep] = `^${depPackageJson.version}`;
        }
      }
    }
  }

  // Set module type and exports
  delete publishPackageJson.type;
  Object.assign(publishPackageJson, {
    main: './dist/cjs/index.cjs',
    module: './dist/mjs/index.mjs',
    types: './dist/types/index.d.ts',
    exports: {
      '.': {
        types: './dist/types/index.d.ts',
        require: './dist/cjs/index.cjs',
        import: './dist/mjs/index.mjs',
      },
    },
    publishConfig: {
      access: 'public',
    },
    files: ['dist', 'README.md'],
  });

  // Write the publish-ready package.json
  await Bun.write(
    path.join(packageDir, 'package.json'),
    JSON.stringify(publishPackageJson, null, 2),
  );

  console.log(`  ✅ package.json updated for publishing`);
  console.log(`✨ Finished building @rfetch/${packageName} v${version}`);
};

// Main build process
const main = async () => {
  console.log('🚀 Building RFetch packages for npm publishing...');
  console.log('================================================\n');

  for (const pkg of PACKAGES) {
    try {
      await buildPackage(pkg);
    } catch (error) {
      console.error(`❌ Failed to build @rfetch/${pkg}:`, error);
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
  console.log('\n   Or use: bun run publish:all\n');
};

main().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
