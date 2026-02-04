// Colors SVG: Minimal processing to preserve original appearance
// These icons keep their original colors and cannot be styled via CSS
module.exports = {
  js2svg: {
    indent: 2,
    pretty: false,
  },
  plugins: [
    // Only do safe cleanup, disable all path/shape transformations
    {
      name: 'preset-default',
      params: {
        overrides: {
          // Preserve everything that affects visual appearance
          removeViewBox: false,
          convertPathData: false,      // Don't modify path data
          convertShapeToPath: false,   // Don't convert shapes
          mergePaths: false,           // Don't merge paths
          collapseGroups: false,       // Don't collapse groups (may have transforms)
          convertTransform: false,     // Don't modify transforms
          inlineStyles: false,         // Don't inline styles
          minifyStyles: false,         // Don't minify styles
        },
      },
    },
    // Prefix IDs to avoid conflicts when multiple icons on same page
    'prefixIds',
    // NOTE: Removed 'reusePaths' - can cause visual artifacts
  ],
};
