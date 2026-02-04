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
          // Disable convertPathData - causes crashes on complex paths (e.g., id-card-h-1.svg)
          // SVGO bug: reflectPoint fails on malformed/complex path data
          convertPathData: false,
        },
      },
    },
    'prefixIds',
    // NOTE: Removed 'reusePaths' - can cause visual artifacts with complex icons
    // NOTE: Removed 'mergePaths' with force:true - was causing line breaks and crossing errors
    'removeStyleElement',
    // Custom plugin to handle fill/stroke attributes for nocolors icons:
    // 1. Remove fill colors from paths (let CSS control via currentColor)
    // 2. Replace stroke colors with "currentColor" (so CSS color property controls it)
    // 3. Keep/add fill="none" on stroke-based elements to prevent CSS fill
    {
      name: 'handleColorsForNocolors',
      fn: () => ({
        element: {
          enter: (node) => {
            const fill = node.attributes.fill;
            const stroke = node.attributes.stroke;
            
            // Replace stroke color with currentColor (not remove, so CSS doesn't add stroke to all elements)
            if (stroke && stroke !== 'none') {
              node.attributes.stroke = 'currentColor';
            }
            
            // If element has stroke-width (stroke element), ensure fill="none"
            if (node.attributes['stroke-width']) {
              node.attributes.fill = 'none';
              return;
            }
            
            // Remove fill attribute from non-stroke elements
            if (fill) {
              delete node.attributes.fill;
            }
          },
        },
      }),
    },
  ],
};
