import * as esbuild from 'esbuild'

const BuildType = {
    debug: 0,
    test: 1,
    release: 2
}

const type = BuildType[(process.argv[2] || '').toLocaleLowerCase()] || BuildType.debug;
if (type === BuildType.test) {
    await esbuild.build({
        entryPoints: ['./test/index.ts'],
        bundle: true,
        mainFields: ["main"],
        outfile: './dist/test.js',
        platform: 'node',
        treeShaking: true,
        sourcemap: true
    });
} else {
    const result = await esbuild.build({
        entryPoints: ['./src/index.ts'],
        bundle: true,
        mainFields: ["main"],
        outdir: './dist',
        platform: 'node',
        treeShaking: type === BuildType.release,
        sourcemap: true,
        minify: type === BuildType.release,
        metafile: true
    });

    await esbuild.build({
        entryPoints: ['./src/index.ts'],
        bundle: true,
        outdir: './dist',
        mainFields: ["main"],
        platform: 'node',
        format: "esm",
        treeShaking: type === BuildType.release,
        sourcemap: true,
        minify: type === BuildType.release,
        outExtension: {".js": ".mjs"}
    });

    console.log(await esbuild.analyzeMetafile(result.metafile));
}

