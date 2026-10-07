import * as esbuild from 'esbuild';
import process from 'node:process';
import console from 'node:console';

const BuildType = {
    debug: 0,
    test: 1,
    release: 2
};

const requested = (process.argv[2] ?? '').toLocaleLowerCase();
let type = BuildType.debug;
if (requested === 'test')
    type = BuildType.test;
else if (requested === 'release')
    type = BuildType.release;

// Node 18–22 cannot parse native decorators. esbuild leaves them in place
// unless this feature is marked unsupported.
const supported = { decorators: false };
if (type === BuildType.test) {
    await esbuild.build({
        entryPoints: ['./test/index.ts'],
        bundle: true,
        mainFields: ['main'],
        outfile: './dist/index.test.js',
        platform: 'node',
        supported,
        treeShaking: true,
        sourcemap: true,
        sourcesContent: true
    });
} else {
    const result = await esbuild.build({
        entryPoints: ['./src/index.ts'],
        bundle: true,
        mainFields: ['main'],
        outdir: './dist',
        platform: 'node',
        supported,
        treeShaking: type === BuildType.release,
        sourcemap: true,
        sourcesContent: false,
        minify: type === BuildType.release,
        metafile: true
    });

    await esbuild.build({
        entryPoints: ['./src/index.ts'],
        bundle: true,
        outdir: './dist',
        mainFields: ['main'],
        platform: 'node',
        format: 'esm',
        supported,
        treeShaking: type === BuildType.release,
        sourcemap: true,
        sourcesContent: false,
        minify: type === BuildType.release,
        outExtension: { '.js': '.mjs' }
    });

    console.log(await esbuild.analyzeMetafile(result.metafile));
}