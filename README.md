# modules-middleware
[![NPM Version][npm-image]][npm-url]

express middleware for serving node modules to client side,|
This is useful for serving client side apps structued as node package module, containing a package.json with npm dependencies.

* Serves module directory assets 
* Serves dependecies the package.json using require.resolve starting from the root module.
* transforms .js, .jsm and .html es6 module imports specifying package name to a valid browser ES6 path.
(eg: ``` import {Element} from '@polymer/polyer';``` transforms into ``` import {Element} from '/node_modules/@polymer/polyer';```)
* works perfectly with monorepos


## Install

This is a [Node.js](https://nodejs.org/en/) module available through the
[npm registry](https://www.npmjs.com/). Installation is done using the
[`npm install` command](https://docs.npmjs.com/getting-started/installing-npm-packages-locally):

```sh
$ npm install modules-middleware
```

## API

<!-- eslint-disable no-unused-vars -->

```js
var modulesMiddleware = require('modules-middleware')
```

### modulesMiddleware(modulePath, options)

Create a new middleware function to serve files from within a given module path. 

#### Options
##### moduleNamePrefix

The prefix of packages urls for transformed client side sources, defaults to "node_modules".


### Serving using express

This is a simple example of using Express.

```js
var express = require('express')
var modulesMiddleware = require('modules-middleware')

var app = express()

app.use(modulesMiddleware('./frontend'));
app.listen(3000)
```

if you are using a monorepo containing a package of your client side code

```js
var express = require('express')
var modulesMiddleware = require('modules-middleware')

var app = express()

app.use(modulesMiddleware(require.resolve('my-client-app'));
app.listen(3000)
```

## License

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/modules-middleware.svg
[npm-url]: https://npmjs.org/package/modules-middleware
