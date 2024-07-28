import * as esbuild from 'esbuild';
import process from 'node:process';
import console from 'node:console';

const BuildType = {
    debug: 0,
    test: 1,
    release: 2
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const type = BuildType[(process.argv[2] || '').toLocaleLowerCase()] || BuildType.debug;
if (type === BuildType.test)
    await esbuild.build({
        entryPoints: ['./test/index.ts'],
        bundle: true,
        mainFields: ['main'],
        outfile: './dist/index.test.js',
        platform: 'node',
        treeShaking: true,
        sourcemap: true,
        sourcesContent: true
    });
else {
    const result = await esbuild.build({
        entryPoints: ['./src/index.ts'],
        bundle: true,
        mainFields: ['main'],
        outdir: './dist',
        platform: 'node',
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
        treeShaking: type === BuildType.release,
        sourcemap: true,
        sourcesContent: false,
        minify: type === BuildType.release,
        outExtension: { '.js': '.mjs' }
    });

    console.log(await esbuild.analyzeMetafile(result.metafile));
}