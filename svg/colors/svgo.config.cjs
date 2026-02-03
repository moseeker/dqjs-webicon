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
          inlineStyles: {
            onlyMatchedOnce: false,
          },
          removeDoctype: true,
          removeViewBox: false,
        },
      },
    },
    'prefixIds',
    'reusePaths',
  ],
};
