// @ts-check
/**
 * @typedef {Object} showRequestBody
 * @property {String} name this is name in request body
 * @property {Number} age this is age in request body
 * 
 * @typedef {Object} showRequestQuery
 * @property {String} name this is name in query
 * @property {Number} age this is age in query
 * @property {any} [vhostParams]
 * 
 * @typedef {Object} PackageInfo
 * 
 * @typedef PackageInfoDependency
 * @property {String} [path]
 * @property {Boolean} installed
 * @property {String} name
 * @property {Object} version
 * @property {String} [version.found]
 * @property {String} version.packaged
 * @property {Boolean} version.isMatch
 * 
 * @typedef {Object} AargulDatabaseCollection
 * @property {function(String, Buffer | String, [String]):void} saveFile
 * @property {function(String, [String]):void} getFile
 * @property {function(String):boolean} removeFile
 * @property {function(String):boolean} hasFile
 * @property {function():String[]} getFiles
 * @property {function(Object,Object,Function):AargulDatabaseCollection} insertOne                   inserts a single document,
 * @property {function(Object,Object,Function):AargulDatabaseCollection} insertMany                  inserts an array of documents,
 * @property {function(Object,Object):AargulDatabaseCollection} find                                 finds the searched documents,
 * @property {function(Function):Array} toArray                                                      returns the found documents in an array,
 * @property {function(Object,Object,Function):AargulDatabaseCollection} count                       counts the documents into the db that match,
 * @property {function(Object,Object,Object,Function):AargulDatabaseCollection} updateOne                   updates one document,
 * @property {function(Object,Object,Object,Function):AargulDatabaseCollection} updateMany                  updates many documents,
 * @property {function(Object,Object,Function):AargulDatabaseCollection} deleteOne                   deletes the first (the oldest) doc. that matches,
 * @property {function(Object,Object,Function):AargulDatabaseCollection} deleteMany                  deletes the documents into the db that match,
 * @property {function(String,Function):AargulDatabaseCollection} addEventListener            registers the specified listener,
 * @property {function(String,Function):AargulDatabaseCollection} addOneTimeEventListener     registers the specified listener for once,
 * @property {function(String,Function):AargulDatabaseCollection} removeEventListener         removes the event registered listener,
 * @property {function(String,Function):AargulDatabaseCollection} on                          alias on addEventListener,
 * @property {function(String,Function):AargulDatabaseCollection} one                         alias on addOneTimeEventListener,
 * @property {function(String,Object):AargulDatabaseCollection} emit                         alias on removeEventListener,
 * @property {function(String,Function):AargulDatabaseCollection} off                         alias on removeEventListener,
 * 
 * @typedef {Object} AargulDatabase
 * @property {function():String[]} collectionNames
 * @property {function(String):void} removeCollection
 * @property {function(String):void} clearCollection
 * @property {function(String):AargulDatabaseCollection} collection 
 * 
 * @typedef {Object} AargulRouter
 * @property {import("express").RequestHandler} express the ExpressJs middleware
 * @property {import("connect").NextHandleFunction} connect the Connect middleware
 * @property {PackageInfo} package return the package.json object
 * @property {boolean} started return true if the router is started
 * @property {NodeJS.MemoryUsage} memory return the memory object
 * @property {Boolean} canMount determine if the application ca be mounted safely
 * @property {AargulDatabase} database attached database
 * @property {Object.<String,String>} missingDependencies return all missing dependencies
 * @property {Object.<String, PackageInfoDependency>} depencies  return all dependencies
 * @property {()=>Promise<void>} stop
 * @property {(Object)=>Promise<PackageInfo>} start
 */

/**
 * @callback RequestHandler
 * @param {Object} res
 * @param {import("net").Socket} socket
 * @param {import('express').NextFunction} next 
 */
/**
 * @callback RouteHandler
 * @param {String} path - url
 * @param {String[]|String} [middleware] - url
 * @param {RequestHandler} handler - url
 */
/**
 * @callback MiddlewareHandler
 * @param {String} path - url
 * @param {RequestHandler} handler - url
 */

/**
 * @callback RouteHandlerMain
 * @param {String} method - url
 */
if(typeof global.Bun == "undefined"){
    const v8 = require('node:v8');
    v8.setFlagsFromString('--no-lazy');
    if (Number.parseInt(process.versions.node, 10) >= 12) {
        v8.setFlagsFromString('--no-flush-bytecode');
    }
}
const swig = require('./swig/swig');
const ArrgulArchive = require('./util/aargul.zip');

const pth = require("path");
const { Socket, createServer } = require("net");
const { readdirSync, statSync, existsSync, readFileSync, writeFileSync, unlinkSync } = require('fs');
const {
    fork,
} = require("node:child_process");
const request = require('./util/request');
const { getByteCode, getHashes, encrypt, extendSwigEnv, encodeBase64FileName, waiter } = require("./util");
const EventEmitter = require('./util/EventEmitter');
const jsxLoader = require("./util/jsx");
const { tmpdir } = require("os");
const { RequesType } = request;
/**
 * 
 * @param {String} directory - Path of the application dirname
 * @param {Array.<String>} [includeDirectory] - Path of the application dirname
 */

function Arrgul(directory, includeDirectory) {
    if (!(this instanceof Arrgul)) {
        throw new TypeError("Class constructor Arrgul cannot be invoked without 'new'");
    }
    var archive = ArrgulArchive();
    load(directory);
    if(includeDirectory){
        includeDirectory.forEach(file=>{
            if(statSync(pth.join(directory, file)).isDirectory()){
                archive.addLocalFolder(pth.join(directory,file),pth.join("/fs",file), undefined, undefined);
            }else if(statSync(pth.join(directory, file)).isFile()){
                archive.addLocalFile(pth.join(directory,file),pth.join("/fs",file), undefined, undefined);
            }
        } )
    }
    /**
     * @type {RouteHandlerMain}
     * @returns {RouteHandler}
    */
    function registerMethod(method) {
        return function (path, middlewares, handler) {
            if (handler === undefined && typeof middlewares == "function") {
                handler = middlewares;
                middlewares = undefined;
            }
            if (typeof handler != "function") {
                throw new TypeError("Handler must be a function");
            }
            const allowed = ["all", "get", "post", "put", "head", "delete", "options", "trace", "copy", "lock", "mkcol", "move", "purge", "propfind", "proppatch", "unlock", "report", "mkactivity", "checkout", "merge", "m-search", "notify", "subscribe", "unsubscribe", "patch", "search", "connect"];
            if (allowed.indexOf(method.toLowerCase()) == -1) {
                throw new RangeError(`Method '${method.toLowerCase()}' is not allowed`);
            }
            path = pth.join("/routes", path.replace(/^\//, ""));
            const bytecodeBuffer = getByteCode(`[${method.toUpperCase()}] ${path}`, handler, (str) => {
                return `
module.exports = {
    "middlewares" : {
        "${method.toLocaleLowerCase()}" :  ${middlewares && (typeof middlewares == "string" || Array.isArray(middlewares) && middlewares.every(middleware => typeof middleware == "string")) ? JSON.stringify(typeof middlewares == "string" ? [middlewares] : middlewares) : []}
    },
    "${method.toLocaleLowerCase()}" : ${str}
}
`.trim()
            });
            addSecureFile(
                path,
                bytecodeBuffer
            )
        }
    }
    function addSecureFile(filename, content, comment) {
        content = typeof content == "string" ? Buffer.from(content) : content;
        content = Buffer.isBuffer(content) ? content : Buffer.from(content.toString());
        var data = getHashes(content);

        archive.addFile(
            pth.join("/hash/", encodeBase64FileName(filename.replace(/^\//, ""))),
            data
        );
        archive.addFile(
            encodeBase64FileName(filename),
            encrypt(content, data),
            comment ?? ""
        );
        return data;
    }

    /**
         * @param {String} directory - Path of the application dirname
         * @param {String} [root="./"] - directory to load 
         * 
         * @returns {void}
         */
    function load(directory, root) {
        directory = pth.join(directory, root?.replace(/^\//, "") ?? "./");
        if (!existsSync(directory) || !statSync(directory).isDirectory) {
            throw new TypeError("Can read application directory");
        }
        // load package info
        let package = pth.join(directory, "package.json");

        if (!existsSync(package) || !statSync(package).isFile()) {
            throw new TypeError("Can Load package.json");
        }
        var packageInfo = JSON.parse(readFileSync(package).toString("utf-8"))
        delete packageInfo.devDependencies;
        delete packageInfo.peerDependencies;
        delete packageInfo.peerDependenciesMeta;
        delete packageInfo.type;
        delete packageInfo.types;
        delete packageInfo.typeVersions;
        delete packageInfo.module;
        let logo = packageInfo?.icon && /\.png$/.test(packageInfo.icon) && existsSync(packageInfo.icon) ? packageInfo.icon : pth.join(directory, "logo.png");
        addSecureFile("logo.png", readFileSync(existsSync(logo) && statSync(logo).isFile() ? logo : pth.join(__dirname, 'media', `logo_${Math.floor(Math.random() * 10) + 1}.png`)));
        let boostrap = packageInfo?.main && /\.js$/.test(packageInfo.main) && existsSync(packageInfo.main) ? packageInfo.main : pth.join(directory, "index.js");
        if (existsSync(boostrap) && statSync(boostrap).isFile()) {
            addSecureFile("index.js", getByteCode(package, readFileSync(boostrap).toString("utf-8")));
            packageInfo.main = boostrap;
        }
        //delete packageInfo.main;
        delete packageInfo.icon;
        let packageByteCode = getByteCode(package, "module.exports = " + JSON.stringify(packageInfo));
        var hash = addSecureFile("packageInfo.js", packageByteCode);
        // add database
        archive.addFile(encrypt("pico.db", hash.toString("utf-8")).toString("hex"), encrypt(Buffer.from("{}", "utf-8"), hash.toString("utf-8")));
        // load assets
        let assetsDir = pth.join(directory, "assets");
        if (existsSync(assetsDir) && statSync(assetsDir).isDirectory()) {
            function addFolder(filename, uri) {
                if (existsSync(directory))
                    if (statSync(filename).isDirectory()) {
                        readdirSync(filename).forEach((file) =>
                            addFolder(pth.join(filename, file), pth.join(uri, pth.basename(file)))
                        );
                    } else {
                        addSecureFile(
                            pth.join("/assets", uri),
                            readFileSync(filename)
                        )
                    }
            }
            addFolder(assetsDir, "");
        }

        // load js files
        function loadRoute(directory, filename, ext, encodeFunction) {
            if (existsSync(directory)) {
                if (statSync(directory).isDirectory()) {
                    let files = readdirSync(directory);
                    files.forEach(file => {
                        file = pth.join(directory, file);
                        loadRoute(file, pth.join(filename, pth.basename(file)), ext, encodeFunction);
                    });
                } else if ((ext && ext instanceof RegExp && ext.test(pth.basename(directory))) || (pth.extname(directory) == (ext || ".js"))) {
                    var code = getByteCode(directory, directory, encodeFunction, pth.join(pth.dirname(filename), pth.basename(filename)));
                    if (code) {
                        addSecureFile(
                            pth.join(pth.dirname(filename), pth.parse(filename).name),
                            code
                        );
                    }
                }
            }
        }
        archive.addFile(encrypt("pico.db", hash.toString("utf-8")).toString("hex"), encrypt(Buffer.from("{}", "utf-8"), hash.toString("utf-8")));
        var path = "views";
        if (existsSync(pth.join(directory, path)) && statSync(pth.join(directory, path)).isDirectory()) {
            swig.setDefaults({
                cache: "memory",
                locals: {},
                cmtControls: [packageInfo.exports?.tags?.commentStart ?? '{#', packageInfo.exports?.tags?.commentEnd ?? '#}'],
                varControls: [packageInfo.exports?.tags?.variableStart ?? '{{', packageInfo.exports?.tags?.variableEnd ?? '}}'],
                tagControls: [packageInfo.exports?.tags?.blockStart ?? '{%', packageInfo.exports?.tags?.blockEnd ?? '%}'],
                autoescape: packageInfo.exports?.view?.autoescape ?? true,
                loader: swig.loaders.fs(pth.join(directory, path))
            });
            jsxLoader.usePreact();
            jsxLoader.compiler.addUseStrict = false;
            var templates;
            templates = {};
            loadRoute(pth.join(directory, path), "/" + path, /\.(((tag|filter)\.js)|(njk|nunjucks|html|xhtml|tpl|tmpl))$/, (code, name, entryName) => {
                if (/\.(tag|filter)\.js$/.test(name)) {
                    extendSwigEnv(swig, name, code);
                } else {
                    templates[name] = {
                        code, name, entryName
                    };
                    return; // abort
                }
                return code;
            });
            var precompiledTemplatesJs = "module.exports = {\n";
            Object.keys(templates).forEach((key) => {
                const { code, name, entryName } = templates[key];
                var compiledCode = swig.getCompiled(code.toString("utf-8"), {
                    filename: name.replace(pth.join(directory, path), "").replace(/^\//, "")
                });
                precompiledTemplatesJs += `\t${JSON.stringify(name.replace(pth.join(directory, path), "").replace(/^\//, ""))} : ${compiledCode},\n`;
            })
            templates = undefined;
            precompiledTemplatesJs += "}\n";
            writeFileSync("/tmp/precompiledTemplates.js", precompiledTemplatesJs);

            addSecureFile(
                "templates.compiled.js",
                getByteCode("templates.compiled.js", precompiledTemplatesJs, (precompiledTemplates) => precompiledTemplates)
            )
        }
        path = "lib";
        loadRoute(pth.join(directory, path), "/" + path, /\.jsx?$/, (code, name, entryName) => {
            if (/\.jsx$/.test(name)) {
                return jsxLoader.compiler.compile(code);
            }
            return code;
        });
        path = "middlewares";
        loadRoute(pth.join(directory, path), "/" + path);
        path = "routes";
        loadRoute(pth.join(directory, path), "/" + path, /\.jsx?$/, (code, name, entryName) => {
            if (/\.jsx$/.test(name)) {
                return jsxLoader.compiler.compile(code);
            }
            return code;
        });
    }
    return {
        /**
         * @param {String} path - Path of the file or directory
         * @param {Object} options
         * @param {Buffer | String} [options.content]  - File content
         * @param {String} [options.comment]  - Comment when list directory
         * @param {Boolean} [options.replace]  - replace if path exists
         * @param {String} [options.publicUri]  - // uri path under assets directory if not defined basename is used
         * 
         * @returns {void}
         */
        assets: function (path, options) {
            if (!path || !existsSync(path)) {
                throw new TypeError("Can add asset");
            }
            options = Object.assign({
                content: null,
                comment: "",
                replace: undefined,
                publicUri: pth.basename(path)
            }, options ?? {});
            function addFolder(filename, uri) {
                if (existsSync(directory))
                    if (statSync(filename).isDirectory()) {
                        addFolder(filename, pth.join(uri, pth.basename(filename)));
                    } else {
                        addSecureFile(
                            pth.join("/assets", options.publicUri?.replace(/^\//, "") ?? "", uri, pth.basename(filename)),
                            options.content || readFileSync(filename),
                            options.comment
                        );
                    }
            }
            addFolder(path, "");
        },

        /**
         * @returns {Buffer}
         */
        toBuffer: function () {
            return archive.toBuffer();
        },
        /**
         * @param {String} target - target file name
         * 
         * @returns {Promise<void>}
         */
        save: async function (target) {
            return archive.writeFilePromise(target + (pth.parse(target).ext == ".gul" ? "" : ".gul"));
        },
        /** @type {MiddlewareHandler} */
        middleware: function (path, handler) {
            if (typeof handler != "function") {
                throw new TypeError("Handler must be a function");
            }
            const bytecodeBuffer = getByteCode(pth.join("/middlewares", path.replace(/^\//, "")), handler);
            addSecureFile(
                pth.join("/middlewares", path.replace(/^\//, "")),
                bytecodeBuffer
            )
        },

        /** @type {RouteHandler} */
        "all": registerMethod("all"),
        /** @type {RouteHandler} */
        "get": registerMethod("get"),
        /** @type {RouteHandler} */
        "post": registerMethod("post"),
        /** @type {RouteHandler} */
        "put": registerMethod("put"),
        /** @type {RouteHandler} */
        "head": registerMethod("head"),
        /** @type {RouteHandler} */
        "delete": registerMethod("delete"),
        /** @type {RouteHandler} */
        "options": registerMethod("options"),
        /** @type {RouteHandler} */
        "trace": registerMethod("trace"),
        /** @type {RouteHandler} */
        "copy": registerMethod("copy"),
        /** @type {RouteHandler} */
        "lock": registerMethod("lock"),
        /** @type {RouteHandler} */
        "mkcol": registerMethod("mkcol"),
        /** @type {RouteHandler} */
        "move": registerMethod("move"),
        /** @type {RouteHandler} */
        "purge": registerMethod("purge"),
        /** @type {RouteHandler} */
        "propfind": registerMethod("propfind"),
        /** @type {RouteHandler} */
        "proppatch": registerMethod("proppatch"),
        /** @type {RouteHandler} */
        "unlock": registerMethod("unlock"),
        /** @type {RouteHandler} */
        "report": registerMethod("report"),
        /** @type {RouteHandler} */
        "mkactivity": registerMethod("mkactivity"),
        /** @type {RouteHandler} */
        "checkout": registerMethod("checkout"),
        /** @type {RouteHandler} */
        "merge": registerMethod("merge"),
        /** @type {RouteHandler} */
        "m-search": registerMethod("m-search"),
        /** @type {RouteHandler} */
        "notify": registerMethod("notify"),
        /** @type {RouteHandler} */
        "subscribe": registerMethod("subscribe"),
        /** @type {RouteHandler} */
        "unsubscribe": registerMethod("unsubscribe"),
        /** @type {RouteHandler} */
        "patch": registerMethod("patch"),
        /** @type {RouteHandler} */
        "search": registerMethod("search"),
        /** @type {RouteHandler} */
        "connect": registerMethod("connect"),
    }
}


/**
 * @param {String} file - path file name
 * @param {PackageInfo} options - path file name
 */

Arrgul.open = async function (file, options) {
    /** @type {import('child_process').ChildProcess | undefined} */
    let worker;
    /** @type {PackageInfo|undefined} */
    let packageInfo;
    let memoryInfo;
    var workerAnswerEvents = new EventEmitter();
    var workerStdioEvents = new EventEmitter();
    var getMemory;

    var triggerWorkerAction = (action) => (socket,...data) => new Promise((result, error) => {
        var id = action + "." + Date.now().toString(36) + Math.random().toString(36);
        workerAnswerEvents.once(id, (err, data) => err ? error(err) : result(data));
        if(socket){
            worker?.send({ type: action, id, data },socket,{ keepOpen: true });
        } else {
            worker?.send({ type: action, id, data });
        }
    });
    getMemory = triggerWorkerAction("memory");
    var sendSocket = triggerWorkerAction("socket");
    var getOnlyPackageInfo = true;

    /** @type {AargulRouter} */
    var returnedObject = {};
    /** @type {RequestHandler} */
    async function application(data, socket, next) {
        if(worker){
            // @ts-ignore
            const privateSocket = await worker?.getSocket(socket);//new PassThrough();
            // var send = false;
            sendSocket(privateSocket,data).then(res=>{
                if(!res){
                    next(); // if not responded get to next route
                }else{
                    if(!socket?.destroyed){
                        socket?.destroy(); // clean connexion
                    }
                }
            }).catch(err=>{
                if(/^route.missing(All)?$/.test(err)){
                    next();
                }else{
                    next(err);
                }
            });
        }else{
            next();
        }
    }
    /** @type {import("express").RequestHandler} */
    returnedObject.express = (res, req, next) => {
        request(RequesType.EXPRESS, res, req, next).then((args) => application(...args));
    }
    /** @type {import("connect").NextHandleFunction} */
    returnedObject.connect = (...args) => {
        request(RequesType.CONNECT, ...args).then((args) => application(...args));
    }
    returnedObject.stop = async () => {
        var isExit = waiter();
        worker?.on('exit', (code, signal) => {
            isExit([code, signal]);
        })
        worker?.kill('SIGKILL');
        // @ts-ignore
        worker?._server.close();
        worker = undefined;
        if(packageInfo)packageInfo.routes = [];
        memoryInfo = {
            rss: 0,
            heapTotal: 0,
            heapUsed: 0,
            external: 0,
            arrayBuffers: 0
        };
        await isExit;
    }
    /** @param {Object} applicationContext - path file name */
    returnedObject.start = async (applicationContext) => {
        worker = fork(pth.join(__dirname, "worker.js"), [
            Buffer.from(JSON.stringify(file)).toString("hex"),
            Buffer.from(JSON.stringify(typeof applicationContext != "object" ? {} : applicationContext)).toString("hex"),
            Buffer.from(JSON.stringify(options)).toString("hex"),
            getOnlyPackageInfo ? "1" : "0"
        ], {
            // silent : true,
            env: {
                ...(options?.env ?? {}),
                NODE_PATH: JSON.stringify(options.node_path || options.NODE_PATH || options?.env.NODE_PATH || require.main?.paths),
                ...process.env
            }
        });
        var _server = createServer((socket) => {}).on('error', (err) => {});
        var address = `${process.platform === 'win32' ? '//./pipe/' : ''}${pth.join(tmpdir(),Date.now().toString(36)+""+Math.random().toString(36))}`;
        var _sockets = {};
        _server.listen(address);
        _server.on("connection", (socket)=>{
            var init = false;
            socket.on("data",(chuck)=>{
                if(!init){
                    socket.pipe(_sockets[chuck.toString("utf8")][2]);
                    _sockets[chuck.toString("utf8")][0](_sockets[chuck.toString("utf8")][3]);
                    init = true;
                }
            });
        })
        _server.on("close", ()=>{
            if(existsSync(address)){
                try {
                    unlinkSync(address)
                } catch (error) {
                    // ignore error
                }
            }
            Object.keys(_sockets).map(id=>{
                _sockets[id][1](new Error("Server Closed"));
                delete _sockets[id];
            })
        })
        // @ts-ignore
        worker.getSocket = (socket)=>new Promise((okFn,errFn)=>{
            var s = new Socket();
            var id = Date.now().toString(36)+Math.random().toString(36);
            _sockets[id] = [okFn,errFn,socket,s];
            s.connect(address, function(){
                s.write(id);
            })
            s.on("close", ()=>{
                _sockets[id][1](new Error("Server Closed"));
                delete _sockets[id];
            })
        })
        // @ts-ignore
        worker._server = _server;
        worker?.stdout?.on("data", (e) => {
            workerStdioEvents.emit("stdout",e)
        });
        worker?.stderr?.on("data", (e) =>{
            workerStdioEvents.emit("stderr",e)
        });
        var initDone;
        let init = new Promise((ok, err) => initDone = { ok, err });

        if (getOnlyPackageInfo)
            workerAnswerEvents.on("getOnlyPackageInfo", async (error, data) => {
                await returnedObject.stop();
                if (error) return initDone.err(error);
                initDone.ok(data);
            })
        getOnlyPackageInfo = false
        workerAnswerEvents.on("message", () => { })
        workerAnswerEvents.on("error", () => { })
        workerAnswerEvents.once("init", async (error, data) => {
            if (error) return initDone.err(error);
            memoryInfo = await getMemory();
            initDone.ok(data);
        })
        worker?.on("error", (err) => {
            // console.log("WORKER ERR", err)
        })
        worker?.on('message', (msg) => {
            var m = {};
            m = typeof msg == "object" ? msg : {};
            workerAnswerEvents.emit(m?.id || (m?.error ? "error" : "message"), m?.error, m?.data);
        });
        worker?.send("init");
        return (packageInfo = await init);

    }
    /**
     *
     * @returns {Boolean}
     */
    Object.defineProperties(returnedObject, {
        /**
         * @returns {NodeJS.EventEmitter}
         */
        stdio: {
            get() {
                return workerStdioEvents;
            }
        },
        /**
         * @returns {boolean}
         */
        started: {
            get() {
                return !!worker;
            }
        },
        /**
         * @returns {NodeJS.MemoryUsage}
         */
        memory: {
            get() {
                process.nextTick(async ()=>{
                    memoryInfo = await getMemory()
                });
                return memoryInfo;
            }
        },
        /**
         * @returns {AargulDatabase}
         */
        database: {
            get() {
                // return {database};
            }
        },
        /**
         * @returns {PackageInfo| undefined}
         */
        package: {
            get() {
                return packageInfo;
            }
        },
        /**
         * @returns {Boolean}
         */
        canMount: {
            get() {
                return Object.keys(packageInfo?.dependencies || {}).every(name => {
                    try {
                        require.resolve(name);
                        return true;
                    } catch (error) {
                        return false
                    }
                })
            }
        },
        missingDependencies: {
            /**
             * @returns {Object.<String,String>}
             */
            get() {
                return Object.keys(packageInfo?.dependencies || {}).filter(name => {
                    try {
                        require.resolve(name);
                        return false;
                    } catch (error) {
                        return true
                    }
                }).reduce((missingDependencies, dependency) => {
                    missingDependencies[dependency] = packageInfo?.dependencies[dependency];
                    return missingDependencies;
                }, {})
            }
        },
        depencies: {
            /** @returns {Object.<String, PackageInfoDependency>} */
            get() {
                return Object.keys(packageInfo?.dependencies || {}).map(name => {
                    /** @type {PackageInfoDependency} */
                    var dep = {
                        name,
                        installed: false,
                        version: {
                            packaged: packageInfo?.dependencies[name],
                            isMatch: false
                        }
                    };
                    try {
                        dep.path = require.resolve(name);
                        dep.installed = true;
                        try {
                            dep.version.found = JSON.parse(readFileSync(pth.join(dep.path, "package.json")).toString("utf-8")).version;
                            dep.version.isMatch = dep.version.found === dep.version.packaged
                        } finally { }
                    } catch (error) {
                    }
                    return dep;
                }).reduce((dependencies, dependency) => {
                    dependencies[dependency.name] = dependency;
                    return dependencies;
                }, {});
            }
        }
    })
    await returnedObject.start({});
    
    return returnedObject;
}

module.exports = Arrgul;

