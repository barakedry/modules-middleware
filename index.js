'use strict';

const fs = require('fs');
const path = require('path');
const replace = require('stream-replace');
const send = require('send');
const parseUrl = require('parseurl');
const mime = require('mime');


function createResolvePaths(modulePath) {
    const paths = [];
    let dir = path.dirname(modulePath);
    let lastIndexOfSlash;
    do {
        lastIndexOfSlash = dir.lastIndexOf('/');

        // go up one level
        if (lastIndexOfSlash !== -1) {
            paths.push(path.join(dir, 'node_modules'));
            dir = dir.substr(0, lastIndexOfSlash);
        }
    } while (lastIndexOfSlash !== -1);

    return paths;
}

function getPackageDescriptor(module, modulePath, cb) {
    if (!modulePath) {
        throw new Error('could not resolve ' + module);
    }

    const packageJsonFilePath = path.join(path.dirname(modulePath), 'package.json');

    fs.readFile(packageJsonFilePath, (err, data) => {
        if (err) throw err;
        cb(JSON.parse(data));
    });


}

function replaceLogic(startWith, pathPrefix) {
    return function (fullMatch, qouteSign) {
        const packageName = fullMatch.split(qouteSign)[1];
        let pathParts = [startWith, qouteSign , '/', pathPrefix, '/', packageName];
        const endsWithFileExtOrSlash = /.*(\/|\.\w{1,4})+$/gm;
        if (!endsWithFileExtOrSlash.test(packageName)) {
            pathParts.push('/');
        }
        pathParts.push(qouteSign);
        return pathParts.join('');
    };
}


function createMiddleware(module, options = {}) {

    const resolvedModulePath = {};
    const baseModulePath = require.resolve(module);
    const moduleDirectory = path.dirname(baseModulePath);
    const paths = createResolvePaths(baseModulePath);

    let modules = [];
    let moduleClientPaths = [];

    options = Object.assign({
        moduleNamePrefix: 'node_modules', // path of imports modules will start with this string
        clientEntryPaths: {}
    }, options);


    getPackageDescriptor(module, baseModulePath, function (packageDescriptor) {
        const {dependencies} = packageDescriptor;
        Object.keys(dependencies).forEach((moduleName) => {

            let modulePath = require.resolve(moduleName, {paths});
            if (options.clientEntryPaths[moduleName]) {
                modulePath = path.join(path.dirname(modulePath), options.clientEntryPaths[moduleName]);
            }

            resolvedModulePath[moduleName] = modulePath;
            moduleClientPaths.push(path.join('/', options.moduleNamePrefix, moduleName));
            modules.push(moduleName);
        });

    });

    function moduleByRequestPath(pathname) {
        return moduleClientPaths.findIndex(d => {
            return pathname.indexOf(d) !== -1
        });
    }

    return function serveModuleFiles(req, res) {

        let pathname = parseUrl(req).pathname;
        let filePath, transform;
        let root = moduleDirectory;

        if (!pathname || pathname === '/') {
            filePath = baseModulePath;
        } else {
            const moduleIndex = moduleByRequestPath(pathname);

            if (moduleIndex !== -1) {
                const moduleName = modules[moduleIndex];
                let moduleFilePath = resolvedModulePath[modules[moduleIndex]];
                root = path.dirname(moduleFilePath);
                pathname = pathname.substr(pathname.indexOf(modules[moduleIndex]) + moduleName.length);
                if (!pathname || pathname === '/') {
                    pathname = path.basename(moduleFilePath);
                }
            }

            filePath = path.join(root, pathname);
        }

        let extention = path.extname(filePath);
        if (!extention) {
            extention = '.js';
            filePath += extention;
        }

        transform = extention === '.js' || extention === '.jsm' || extention === '.html' || extention === '.htm';
        const replaceFromPath = replace(/from ('|")(\w|@).*('|")/gm, replaceLogic('from ', options.moduleNamePrefix));
        const replaceImportPath = replace(/import ('|")(\w|@).*('|")/gm, replaceLogic('import ', options.moduleNamePrefix));

        if (transform) {

            // Check if the file exists in the current directory, and if it is writable.
            fs.access(filePath, fs.constants.F_OK | fs.constants.R_OK, (err) => {

                const exists = !err;

                if (exists) {
                    const type = mime.getType(filePath);
                    if (type) {
                        res.setHeader('Content-Type', type);
                    }

                    fs.createReadStream(filePath)
                        .pipe(replaceFromPath)
                        .pipe(replaceImportPath)
                        .pipe(res);
                } else {
                    const sendStream = send(req, pathname, {root});
                    sendStream.pipe(res);
                }

            });

        } else {
            const sendStream = send(req, pathname, {root});
            sendStream.pipe(res);
        }
    };
}

module.exports = createMiddleware;
