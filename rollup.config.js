import fs from 'fs'
import alias from 'rollup-plugin-alias'
import memory from 'rollup-plugin-memory'
import babel from 'rollup-plugin-babel'
import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import replace from 'rollup-plugin-replace'
import es3 from 'rollup-plugin-es3'

const babelRc = JSON.parse(fs.readFileSync('.babelrc'))
let pkg = JSON.parse(fs.readFileSync('./package.json'))

let external = Object.keys(pkg.peerDependencies || {}).concat(
  Object.keys(pkg.dependencies || {})
)

let format = process.env.FORMAT === 'es' ? 'es' : 'umd'

babelRc.plugins.push('external-helpers')

export default {
  input: 'src/index.js',
  output: {
    name: pkg.amdName,
    sourcemap: true,
    file: format === 'es' ? pkg.module : pkg.main,
    format,
  },
  exports: format === 'es' ? null : 'default',
  external,
  useStrict: false,
  globals: {
    preact: 'preact',
    redux: 'Redux',
  },
  plugins: [
    format === 'umd' &&
      memory({
        path: 'src/index.js',
        contents: "export { default } from './index';",
      }),
    {
      // This insane thing transforms Lodash CommonJS modules to ESModules. Doing so shaves 500b (20%) off the library size.
      load: function(id) {
        if (id.match(/\blodash\b/)) {
          return fs
            .readFileSync(id, 'utf8')
            .replace(
              /\b(?:var\s+)?([\w$]+)\s*=\s*require\((['"])(.*?)\2\)\s*[,;]/g,
              'import $1 from $2$3$2;'
            )
            .replace(/\bmodule\.exports\s*=\s*/, 'export default ')
        }
      },
    },
    alias({
      'react-redux': 'node_modules/react-redux/src/index.js',
      react: __dirname + '/src/compat.js',
      invariant: __dirname + '/src/empty.js',
      'prop-types': __dirname + '/src/prop-types.js',
    }),
    babel({
      babelrc: false,
      presets: [
        [
          'es2015',
          {
            loose: true,
            modules: false,
          },
        ],
      ].concat(babelRc.presets.slice(1)),
      plugins: babelRc.plugins,
    }),
    nodeResolve({
      jsnext: true,
      main: true,
      preferBuiltins: false,
    }),
    commonjs({
      include: ['node_modules/**'],
      exclude: ['node_modules/react-redux/**'],
    }),
    replace({ 'process.env.NODE_ENV': JSON.stringify('production') }),
    es3(),
  ].filter(Boolean),
}
