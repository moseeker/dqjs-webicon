module.exports = {
  js2svg: {
    indent: 2,
    pretty: false,
  },
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          inlineStyles: false,
          removeDoctype: true,
          removeViewBox: false,
          // Disable aggressive path merging to prevent line breaking/crossing issues
          mergePaths: false,
          // Be conservative with path data conversion to preserve visual fidelity
          convertPathData: {
            floatPrecision: 3,
            transformPrecision: 5,
            makeArcs: false,  // Disable arc conversion which can cause visual issues
          },
        },
      },
    },
    'prefixIds',
    // NOTE: Removed 'reusePaths' - can cause visual artifacts with complex icons
    // NOTE: Removed 'mergePaths' with force:true - was causing line breaks and crossing errors
    'removeStyleElement',
    // Remove fill attributes so CSS color can control icon color
    {
      name: 'removeAttrs',
      params: {
        attrs: '(fill)',
      },
    },
  ],
};
