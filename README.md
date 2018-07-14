# modules-middleware
[![NPM Version][npm-image]][npm-url]

Express middleware for serving node modules to client side.  
Useful for serving client side apps structued as node module package, containing a package.json and dependencies.

modules-middleware:
* Serves sources and static assets from the module directory
* Serves sources and static assets of module dependencies defined in package.json (resolves using node's require.resolve starting from the module directory)
* works perfectly with [monorepos](https://github.com/babel/babel/blob/master/doc/design/monorepo.md)
* transforms package names to valid browser ES6 paths when serving source files (.js, .jsm and .html) for module source files and depenecies source files.  
for example, a js module containing an ES6 import such as:  
`import {Element} from '@polymer/polymer';`  will transform into  
`import {Element} from '/node_modules/@polymer/polymer';`



## Install

```sh
$ npm install modules-middleware
```
or
```sh
$ yarn add modules-middleware
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

#### with monorepo
if you are using a monorepo containing a package of your client side code you may use require.resolve as the module path

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
