const transpiler = new Bun.Transpiler({
    tsconfig: await Bun.file('./tsconfig.json').text(),
    loader: 'tsx',
});

const code  = await Bun.file('./src/test.tsx').text();

console.log(transpiler.transformSync(code));

export {}