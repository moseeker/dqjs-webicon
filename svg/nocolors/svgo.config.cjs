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
        },
      },
    },
    'prefixIds',
    'reusePaths',
    'removeStyleElement',
    {
      name: 'mergePaths',
      params: {
        force: true,
      },
    },
    // Remove fill attributes so CSS color can control icon color
    {
      name: 'removeAttrs',
      params: {
        attrs: '(fill)',
      },
    },
  ],
};
