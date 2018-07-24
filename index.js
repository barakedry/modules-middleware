'use strict';

const fs = require('fs');
const path = require('path');
const replace = require('stream-replace');
const send = require('send');
const parseUrl = require('parseurl');
const mime = require('mime');

function getPackageProperties(packagePath, cb) {
    const packageJsonFilePath = path.join(path.dirname(packagePath), 'package.json');

    fs.readFile(packageJsonFilePath, (err, data) => {
        if (err) throw err;
        cb(JSON.parse(data));
    });
}


function createMiddleware(module, options = {}) {

    const packageToPath = {};
    const pathToUrl = {};
    const urlToPath = {};
    const moduleUrls = [];
    let packagesHierarchy;

    options = Object.assign({
        modulesDirectoryUrlName: 'node_modules', // path of imports modules will start with this string
        clientEntryPaths: {}
    }, options);

    function scanPackage(packagePath, hierarchy, cb) {
        let url;

        const pkHierarchy = hierarchy.join('/');
        if (pkHierarchy) {
            packageToPath[pkHierarchy] = packagePath;
        }
        url = pathToUrl[packagePath];

        if (url) {
            cb();
        } else {
            if (hierarchy.length) {
                url = hierarchy.join('/' + options.modulesDirectoryUrlName + '/') + '/';
                moduleUrls.push(url);
                pathToUrl[packagePath] = url;
                urlToPath[url] = packagePath;
            }

            getPackageProperties(packagePath, function (properties) {

                const paths = [path.posix.dirname(packagePath)];
                const dependencies = properties.dependencies ? Object.keys(properties.dependencies) : [];
                if (!dependencies || dependencies.length === 0) {
                    return cb();
                }

                let stillScanning = dependencies.length;

                dependencies.forEach((pkName) => {

                    try {
                        const subPackagePath = require.resolve(pkName, { paths });
                        if (subPackagePath) {
                            scanPackage(subPackagePath, hierarchy.concat(pkName), () => {
                                stillScanning--;
                                if (stillScanning === 0) {
                                    cb();
                                }
                            });
                        }

                    } catch (e) {
                        stillScanning--;
                        if (stillScanning === 0) {
                            cb();
                        }
                        console.error(e);
                    }

                });
            });
        }
    }

    function findPackage(lookup) {

        for (let i = packagesHierarchy.length -1; i >= 0; i--) {
            if (lookup.indexOf(packagesHierarchy[i]) === 0) {
                return packagesHierarchy[i];
            }
        }
    }

    function replaceLogic(startWith, packageBase) {
        return function (fullMatch, qouteChar) {

            let sourceImportUrl = fullMatch.split(qouteChar)[1];
            let url = pathToUrl[packageToPath[packageBase]];
            let relativePath = '';

            let lookup;
            if (packageBase) {
                lookup = path.posix.join(packageBase, sourceImportUrl);
            } else {
                lookup = sourceImportUrl;
            }


            let packageH = findPackage(lookup);
            if (packageH) {
                relativePath = lookup.substr(packageH.length + 1);
                url = pathToUrl[packageToPath[packageH]];
            }

            let pathParts = [
                startWith,
                qouteChar,
                '/',
                options.modulesDirectoryUrlName,
                '/',
                url
            ];


            if (relativePath) {
                pathParts.push(relativePath);
            }

            pathParts.push(qouteChar);
            return pathParts.join('');
        };
    }


    const baseModulePath = require.resolve(module);
    const moduleDirectory = path.dirname(baseModulePath);

    getPackageProperties(baseModulePath, () => {
        scanPackage(baseModulePath, [], () => {
            packagesHierarchy = Object.keys(packageToPath);
        });
    });


    function filePathByRequestUrlPath(pathname) {
        let moduleBaseURL;
        for (let i = moduleUrls.length -1; i >=0; i--) {
            if (pathname.indexOf(moduleUrls[i]) !== -1) {
                moduleBaseURL = moduleUrls[i];
                break;
            }
        }

        if (!moduleBaseURL) {
            return {file: path.join(moduleDirectory, pathname)};
        } else {
            const basename = pathname.substr(pathname.indexOf(moduleBaseURL) + moduleBaseURL.length);
            let file = urlToPath[moduleBaseURL];
            if (basename) {
                file = path.join(path.dirname(urlToPath[moduleBaseURL]), basename);
            }

            return {
                url: moduleBaseURL,
                file
            };
        }
    }


    return function serveModuleFiles(req, res) {

        let pathname = parseUrl(req).pathname;
        let file, transform;
        let root = moduleDirectory;
        let { modulesDirectoryUrlName } = options;
        let packageLookupHierarchy = '';

        if (!pathname || pathname === '/') {
            file = baseModulePath;
        } else {
            let url;
            ({file, url} = filePathByRequestUrlPath(pathname));

            if (url) {
                // module base by extracted client url
                packageLookupHierarchy = url.split(modulesDirectoryUrlName + '/').filter(p => p).join('/');
            }
        }

        let unresolved = file;
        try {
            file = require.resolve(unresolved, {paths: [root]});
        } catch  (e) {
            file = unresolved;
        }


        let extension = path.posix.extname(file);
        transform = extension === '.js' || extension === '.jsm' || extension === '.html' || extension === '.htm';
        const replaceFromPath = replace(/from ('|")(\w|@).*('|")/gm, replaceLogic('from ',  packageLookupHierarchy));
        const replaceImportPath = replace(/import ('|")(\w|@).*('|")/gm, replaceLogic('import ', packageLookupHierarchy));

        if (transform) {

            // Check if the file exists in the current directory, and if it is writable.
            fs.access(file, fs.constants.F_OK | fs.constants.R_OK, (err) => {

                const exists = !err;

                if (exists) {
                    const type = mime.getType(file);
                    if (type) {
                        res.setHeader('Content-Type', type);
                    }

                    fs.createReadStream(file)
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
