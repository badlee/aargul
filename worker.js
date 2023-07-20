const http = require("http");
const swig = require('./swig/swig');
const { encrypt,decrypt, getByteScript,  extendSwigEnv, decodeBase64FileName, encodeBase64FileName } = require("./util");
const MimeType = require('./util/mimetype');
const AargulArchive = require('./util/aargul.zip');
const PicoDB = require('./util/picodb');
const EventEmitter = require('./util/EventEmitter');
const {match}  = require('./util/path-to-regexp')

const pth = require("path");
var httpServer = require('./http')
const preact = require("./util/preact");
const preactToString = require("./util/preact-to-string");
const { Readable } = require('stream');
var p = process.env.NODE_PATH;
try{
    p = JSON.parse(process.env.NODE_PATH ||"[]");
}catch(e){}
p = typeof p == "string" ? [p] : p;
if(Array.isArray(p)){
    p.forEach(p=>require.main.paths.unshift(p))
}
let [file, applicationContext, options, getOnlyPackageInfo] = [
    JSON.parse(Buffer.from(process.argv[2], "hex")),
    process.argv[5] == "1" ? {} : JSON.parse(Buffer.from(process.argv[3], "hex")),
    JSON.parse(Buffer.from(process.argv[4], "hex")),
    process.argv[5] == "1"
];
var archive = new AargulArchive(file);
var cache = {};
function getFileConent(filename, hashPath) {
    var hash = archive.getEntry(hashPath || ("/hash/" + filename.replace(/^\//, "")))?.getData();
    if (hash) {
        try {
            return decrypt(archive.getEntry(filename)?.getData(), hash);
        } catch (error) {
            throw new Error("Corrupted file");
        }
    }
}

var METHODS = http.METHODS.concat("SSE", "WS");
// load packageInfoJS
var packageInfoJS = 'cGFja2FnZUluZm8uanM=';
var packageInfoJSHash = archive.getEntry("/hash/" + packageInfoJS)?.getData();
PicoDB.plugin({
    messenger: function () {
        var event = new EventEmitter();
        return {
            subscribe: event.on.bind(event),
            subscribeOnce: event.once.bind(event),
            unsubscribe: event.off.bind(event),
            publish: event.emit.bind(event),
        }
    }
});
var _database = archive.getEntry(encrypt("pico.db", packageInfoJSHash.toString("utf-8")).toString("hex"))?.getData() ?? {};
var _collections = {}, _removed = {}, _files = {}, TTL, saveDB = function () {
    clearTimeout(TTL);
    TTL = setTimeout(() => {
        try {
            Object.keys(_removed).forEach(key => _database[key] = undefined); // disable removed collections
            archive.getEntry(encrypt("pico.db", packageInfoJSHash.toString("utf-8")).toString("hex"))?.setData(
                encrypt(Buffer.from(JSON.stringify(_database), "utf-8"), packageInfoJSHash.toString("utf-8"))
            );
            archive.writeFile(file); // save File
        } catch (error) {

        }
    }, 500);
};
var database = {
    collectionNames() {
        return Object.keys(_database).map(name => decodeBase64FileName(name));
    },
    removeCollection(name) {
        name = encodeBase64FileName(name);
        _removed[name] = true;
        delete _database[name];
        _collections[name]._db.data = [];
        delete _collections[name];
        saveDB();
    },
    clearCollection(name) {
        name = encodeBase64FileName(name);
        _files[name] = _files[name] || {};
        Object.keys(_files[name]).forEach((filepath) => {
            archive.deleteFile(filepath);
        })
        _database[name] = [];
        _collections[name]._db.data = _database[name];
        delete _files[name];
        saveDB();
    },
    collection(name) {
        name = encodeBase64FileName(name);
        delete _removed[name];
        var has = _collections.hasOwnProperty(name);
        // @ts-ignore
        _collections[name] = _collections[name] || PicoDB();
        if (!has) {
            _files[name] = _files[name] || {};
            _database[name] = _database[name] || [];
            _collections[name]._db.data = _database[name];
            _collections[name].saveFile = async function (filename, buffer, mime) {
                var filepath = pth.join("/fs", name, encodeBase64FileName(filename));
                await archive.addFile(
                    filepath,
                    buffer,
                    mime || MimeType.catalog[".dat"]
                );
                var has = _files[name].hasOwnProperty(filename);
                _files[name][filename] = filepath;

                _collections[name].emit.publish(has ? 'updateFile' : 'addFile', filename);
                _collections[name].emit.publish('saveFile', filename);
                _collections[name].emit("_change");
            };
            _collections[name].removeFile = async function (filename) {
                if (_files[name][filename]) {
                    archive.deleteFile(_files[name][filename]);
                    _collections[name].emit.publish('deleteFile', filename);
                    _collections[name].emit("_change");
                    return true;
                }
                return false;
            };
            _collections[name].getFile = async function (filename, mime) {
                if (_files[name][filename]) {
                    var entry = await archive.getEntry(_files[name][filename]);
                    if (entry) {
                        var dat = entry.getData();
                        dat.mime = dat.comment || mime || MimeType.catalog[".dat"];
                        return dat;
                    }
                }
                return null;
            };
            archive.getEntries.forEach(function (entry) {
                if (entry.entryName.search(pth.join("/fs", name)) === 0) {
                    var filename = entry.entryName.replace(pth.join("/fs", name), "");
                    _files[name][decodeBase64FileName(filename)] = entry.entryName;
                }
            });
            _collections[name].hasFile = async function (filename) {
                return _files[name].hasOwnProperty(filename);
            };
            _collections[name].getFiles = async function () {
                return Object.keys(_files[name]);
            };
            _collections[name].on("_change", saveDB);
        }
        return _collections[name];
    }
};

let packageInfo = {
    /** @type {PackageInfo} */
    exports: {}
};
var d = getFileConent(packageInfoJS);
if (!d || !_database) {
    throw new Error("Corrupted file");
}
getByteScript("package.json", d).runInNewContext({
    module: packageInfo,
    exports: packageInfo.exports
});
packageInfo.exports = {
    ...packageInfo.exports,
    assetsRootUri: options.assetsRootUri ?? packageInfo.exports?.assetsRootUri ?? "",
    vhost: options.vhost ?? packageInfo.exports?.vhost ?? [],
    logFormat: options.logFormat ?? packageInfo.exports?.view?.logFormat ?? "",
    trimBlocks: options.trimBlocks ?? packageInfo.exports?.view?.trimBlocks ?? true,
    lstripBlocks: options.lstripBlocks ?? packageInfo.exports?.view?.lstripBlocks ?? true,
    autoescape: options.autoescape ?? packageInfo.exports?.view?.autoescape ?? true,
    cors : {
        origin: options?.cors?.origin ?? packageInfo.exports?.cors?.origin ?? '*',
        methods: options?.cors?.methods ?? packageInfo.exports?.cors?.methods ?? 'GET,HEAD,PUT,PATCH,POST,DELETE',
        preflightContinue: options?.cors?.preflightContinue ?? packageInfo.exports?.cors?.preflightContinue ?? false,
        optionsSuccessStatus: options?.cors?.optionsSuccessStatus ?? packageInfo.exports?.cors?.optionsSuccessStatus ?? 204
    },
    tags: {
        blockStart: packageInfo.exports?.tags?.blockStart ?? '{%',
        blockEnd: packageInfo.exports?.tags?.blockEnd ?? '%}',
        variableStart: packageInfo.exports?.tags?.variableStart ?? '{{',
        variableEnd: packageInfo.exports?.tags?.variableEnd ?? '}}',
        commentStart: packageInfo.exports?.tags?.commentStart ?? '{#',
        commentEnd: packageInfo.exports?.tags?.commentEnd ?? '#}',
    }
};

d = getFileConent(encodeBase64FileName("templates.compiled.js"));
var loader;
if (d) {
    var b = {
        window: { nunjucksPrecompiled: {}, },
        exports: {}
    };
    getByteScript("templates.compiled.js", d).runInNewContext({
        module: b,
        exports: b.exports,
    });
    // @ts-ignore
    loader = swig.loaders.memory(b.exports)
}

swig.setDefaults({
    cache: "memory",
    locals: {},
    cmtControls: [options?.tags?.commentStart ?? packageInfo.exports?.tags?.commentStart ?? '{#', options?.tags?.commentEnd ?? packageInfo.exports?.tags?.commentEnd ?? '#}'],
    varControls: [options?.tags?.variableStart ?? packageInfo.exports?.tags?.variableStart ?? '{{', options?.tags?.variableEnd ?? packageInfo.exports?.tags?.variableEnd ?? '}}'],
    tagControls: [options?.tags?.blockStart ?? packageInfo.exports?.tags?.blockStart ?? '{%', options?.tags?.blockEnd ?? packageInfo.exports?.tags?.blockEnd ?? '%}'],
    autoescape: packageInfo.exports?.view?.autoescape ?? true,
    loader
});

// INIT APPLICTION
var app = httpServer({
    readStreamFile(path){
        var b = getFileConent(encodeBase64FileName(path).replace(/^\//, ""))
        if(!b) throw new Error("File Not Found");
        return [b.length,Readable.from(b)];
    },
    existFile(path){
        return !!archive.getEntry("/hash/" + encodeBase64FileName(path).replace(/^\//, ""));
    },
    corsOptions : packageInfo.exports.cors,
    logFormat : packageInfo.exports.logFormat,
});
// add swig as template render
app.view('html', swig.renderStringOrFile);
// CORS
app.header(function($){
    $.nextRoute()
});


// STATIC FILES
app.footer(function($){
    try {
        var pathname = $.url.pathname;
        var exists = /^(app_)?logo\.png$/.test(pathname) || !!files.assets[pathname];
        var mimeType = MimeType.lookup(pathname);
        var dateOffset = 604800000;
        // if no route was specified there is an extension and mimeType is not binary
        if(exists){
            // set header
            $.header('Content-Type', mimeType);
            $.status(200);
            var source = options.path + $.url.pathname;
            var modified_since = new Date($.headers['if-modified-since']).getTime();
            var last_modified = new Date(archive.stats.mtime).getTime()

            // file was modified
            if(!$.headers['if-modified-since'] || last_modified > modified_since){
                var data = /^(app_)?logo\.png$/.test(pathname) ? getFileConent(encodeBase64FileName("logo.png")) :  getFileConent(files.assets[pathname], files.hash[pathname]);
                if(!data){
                    $.status(error.status || 500, 'File not found');
                    return $.return();
                }
                $.header('Last-Modified', new Date(archive.stats.mtime).toUTCString())
                $.header('Expires', new Date(new Date().getTime() + dateOffset).toUTCString())
                $.header('Cache-Control', 'public')
                // // disable compression
                
                // $.header('Content-Length', Buffer.byteLength(data),)
                // $.status(Buffer.byteLength(data) ? 200 : 204);
                // $.header('Content-Length', Buffer.byteLength(data),)
                // $.status(Buffer.byteLength(data) ? 200 : 204);
                // $.passed = false;
                // $.responded = true;
                // $.response.end(data)
                // return $.return();
                var encoding = $.header("accept-encoding") ? (($.header("accept-encoding") ?? "").split(/[ ]*,[ ]*/).indexOf("gzip") == -1 ? "deflate" :"gzip") : "";
                var key = encoding+" "+source;
                if(encoding){
                    if(cache.hasOwnProperty(key)){
                        $.header('Content-Length', cache[key].size);
                        $.status(cache[key].size ? 200 : 204);
                        $.header('Content-Encoding', encoding)
                        $.header('Vary', 'Accept-Encoding')
                        $.passed = false;
                        $.responded = true;
                        $.response.end(cache[key].data)
                        $.return()
                    }else{
                        require('zlib')[encoding](data, function(error, data){
                            if(error) throw error
                            cache[key] = {data, size : Buffer.byteLength(data)};
                            $.header('Content-Length', Buffer.byteLength(data),)
                            $.status(Buffer.byteLength(data) ? 200 : 204);
                            $.header('Content-Encoding', encoding)
                            $.header('Vary', 'Accept-Encoding')
                            $.passed = false;
                            $.responded = true;
                            $.response.end(data)
                            $.return()
                        })
                    }
                } else {
                        $.passed = false;
                        $.responded = true;
                        $.header('Content-Length', Buffer.byteLength(data),)
                        $.status(Buffer.byteLength(data) ? 200 : 204);
                        $.response.end(data)
                        $.return()
                }
            
            } else {
                // not modified
                $.status(304)
                $.responded = true;
                $.response.end()
                $.return()
            }
        } else {
            $.nextRoute()
        }
    } catch (error) {
        console.error("ERROR",error)
        // not modified
        $.status(500)
        $.responded = true;
        $.response.end("SERVER ERROR")
        $.return()
    }
})
var files = {
    /** @type {Object.<String,String>} */
    hash: {},
    /** @type {Object.<String,String>} */
    lib: {},
    /** @type {Object.<String,String>} */
    assets: {},
    /** @type {Object.<String,Object.<String, RequestHandler>>} */
    routes: {},
    /** @type {Object.<String,Set>} */
    uri: {},
    /** @type {Object.<String, RequestHandler>} */
    middlewares: {},
    /** @types {Object.<String, vm.Script>} */
    scripts: {}
}

var view = {};
Object.defineProperties(view, {
    addFilter: {
        configurable: false,
        enumerable: true,
        writable: false,
        value: (name, func) => swig.setFilter(name, func)
    },
    addGlobal: {
        configurable: false,
        enumerable: true,
        writable: false,
        value: (name, func) => swig.defineGlobal(name, func)
    },
    getGlobal: {
        configurable: false,
        enumerable: true,
        writable: false,
        // @ts-ignore
        value: (name, func) => swig.getGlobal(name)
    },
    render: {
        configurable: false,
        enumerable: true,
        writable: false,
        value: (name, ctx) => swig.renderFile(name, ctx)
    },
    renderString: {
        configurable: false,
        enumerable: true,
        writable: false,
        value: (code, ctx) => swig.render(code, ctx)
    },
});
Object.freeze(view);
swig.defineGlobal("ENV", process.env);
// sort files
var entries = {};
archive.getEntries().forEach(function (entry) {
    var entryName = decodeBase64FileName(entry.entryName);
    entries[entryName] = entry.entryName
});
var e = Object.keys(entries).sort((a,b)=>{
    if(/^\/hash/.test(a) && !/^\/hash/.test(b)){
        return -1;
    }else if(!/^\/hash/.test(a) && /^\/hash/.test(b)){
        return 1;
    }else {
        return a < b? -1 : (a == b ? 0 : 1);
    }
});
var libs = {}
var definedRouter = null;
var vmEnv = {
    database,
    MimeType,
    view,
    packageInfo : packageInfo.exports,
    require: (name) => {
        if ((packageInfo.exports.dependencies || {}).hasOwnProperty(name)) {
            try {
                return require(name);
            } catch (error) {
                // throw `module ${name} not installed`;
                throw new Error(error);
            }
        }
        // try to load lib
        var pathname = `${name}`.replace(/^(@|\.\.\/lib)\//, '/lib/');
        if(libs[pathname]){
            return libs[pathname];
        }else if(files.lib[pathname]){
            var data = getFileConent(files.lib[pathname], files.hash[pathname]);
            if(data){
                var script = getByteScript(pathname, data);
                var module = {
                    exports : {},
                    id : pth.dirname(pathname),
                    path : pth.dirname(pathname),
                    paths : ["/lib","/node_modules"],
                    filename : pth.dirname(pathname),
                    type : "aargul-lib"
                }
                script.runInNewContext({
                    module: module,
                    __dirname : pth.dirname(pathname),
                    __filename : pathname,
                    id : pathname,
                    exports: module.exports,
                    ...vmEnv
                });
                libs[pathname] = module.exports
                return libs[pathname];
            }
        }
        throw new Error("Uncaught Error: Cannot load an external module '" + name + "'");
    },
    ...(getOnlyPackageInfo ? { STATE : "CONFIG" } : { STATE : "RUNNING",application: applicationContext }),
    setTimeout,
    setInterval,
    setImmediate,
    clearInterval,
    clearImmediate,
    clearTimeout,
    debug : console.debug.bind(console),
    console,
    preact : {
        ...preact,
        renderString : preactToString.render
    },
}
vmEnv.createElement = vmEnv.preact.createElement;
vmEnv.Fragment = vmEnv.preact.Fragment;
vmEnv.Component = vmEnv.preact.Component;
vmEnv.cloneElement = vmEnv.preact.cloneElement;
vmEnv.createRef = vmEnv.preact.createRef;
vmEnv.dumpElement = vmEnv.preact.renderString;
vmEnv.global = vmEnv;
vmEnv.globalThis = vmEnv;
Object.defineProperties(vmEnv, {
    httpServer : {
        get(){
            return app; 
        }
    },
    router : {
        set(value){
            if(typeof value == "function"){
                definedRouter = value;
            }
        }
    }
});
var boostrap = getFileConent(encodeBase64FileName("index.js"));
if(boostrap){
  getByteScript(vmEnv.packageInfo.main, boostrap).runInNewContext(vmEnv);
  delete vmEnv.packageInfo.main;
}
// readonly Object
const _target = Symbol("packageInfo");
var _packageInfo = new Proxy(vmEnv.packageInfo,{
  get(t,p){
    if(p == _target) return t;
    return p in t ? t[p] : undefined;
  }
});
delete vmEnv.packageInfo;
Object.defineProperty(vmEnv, "packageInfo",{
  get(){
    return _packageInfo
  }
});
if(!getOnlyPackageInfo){
    e.forEach(function (entryName) {
        var entry = archive.getEntry(entries[entryName]);
        if (/^\/hash/.test(entryName)) {
            files.hash[entryName.replace(/^\/hash/, '')] = entry.entryName;
        } else if (/^\/lib\//.test(entryName)) {
            files.lib[entryName] = entry.entryName;
        } else if (/^\/assets/.test(entryName)) {
            files.assets[entryName.replace(/^\/hash/, '')] = entry.entryName;
        } else if (/^\/views/.test(entryName) && /\.(tag|filter)$/.test(entryName)) {
            extendSwigEnv(swig, entryName + ".js", getByteScript(entryName, getFileConent(entry.entryName, files.hash[entryName])));
        } else if (/^\/middlewares/.test(entryName)) {
            var module = {
                exports: {}
            };
            var script = getByteScript(entryName, getFileConent(entry.entryName, files.hash[entryName]));
            script.runInNewContext({
                ...vmEnv,
                module: module,
                exports: module.exports,
            });
            if (typeof module.exports == "function") { // ignore non functions
                // @ts-ignore
                files.middlewares[entryName.replace(/^\/middlewares/, "")] = module.exports;
                files.scripts[entryName] = script;
            } else {
                // @ts-ignore
                script = undefined;
            }
        } else if (/^\/routes/.test(entryName)) {
            var module = {
                exports: {}
            };
            var script = getByteScript(entryName, getFileConent(entry.entryName, files.hash[entryName]));
            script.runInNewContext({
                ...vmEnv,
                module: module,
                exports: module.exports,
            });
            if (typeof module.exports == "object") { // ignore non functions
                files.scripts[entryName] = script;
                // @ts-ignore
                var middlewares = module.exports?.middlewares ?? {};
                // @ts-ignore
                delete module.exports.middlewares;
                Object.keys(module.exports).forEach(method => {
                    var uri = entryName.replace(/^\/routes/, "").replace(/\/index$/, "/");
                    files.routes[uri] = files.routes[uri] || app.resource(uri) ;
                    if (METHODS.indexOf(method.toUpperCase()) != -1 &&  typeof module.exports[method] !== "function") return;
                    middlewares[method] = typeof middlewares[method] == "string" ? [middlewares[method]] : (Array.isArray(middlewares[method]) ? middlewares[method] : [])
                    middlewares.all = typeof middlewares.all == "string" ? [middlewares.all] : (Array.isArray(middlewares.all) ? middlewares.all : [])
                    var m = middlewares[method].concat(middlewares.all).map(fn =>{
                        fn = "/"+fn.replace(/^\//,"");
                        return files.middlewares[fn];
                    }).filter(x => typeof x == "function");
                    files.uri[uri] = files.uri[uri] ?? new Set();
                    files.uri[uri].add(method);
                    files.routes[uri][method.toLowerCase()](entryName.replace(/^\/routes/, "").replace(/\/index$/, "/"),...m,module.exports[method]);
                })
            } else {
                // @ts-ignore
                script = undefined;
            }
        }
    });
    var messages = new EventEmitter();
    messages.once("init",({ack})=>{
        try {
            ack(null, {
                ..._packageInfo[_target],
                routes :  Object.keys(files.uri).map((uri)=>`[${Array.from(files.uri[uri]).join("|").toUpperCase()}] ${uri}`),
                logo : "data:image/png;base64,"+getFileConent(encodeBase64FileName("logo.png")).toString("base64")
            });
        } catch (error) {
            ack(error,null);
        }
    })
    messages.on("memory",({ack})=>{
        ack(null, process.memoryUsage());
    })
    messages.on("socket",async ({data:req, socket, ack})=>{
        req = req[0];
        const res = new http.ServerResponse(req);
        res.assignSocket(socket);
        var vhostOk = (_packageInfo.vhost || []).length == 0;
        if (!vhostOk) {
            vhostOk = (_packageInfo.vhost || []).find(vhost => {
                var vh = match(vhost);
                // @ts-ignore
                var m = vh(req.hostname);
                if (m) {
                    // @ts-ignore
                    req.vhostParams = m.params;
                    return m;
                }
                const body = req.method.toUpperCase() +" "+ req.path+ " Not found";
                res
                .writeHead(404, {
                    'Content-Length': Buffer.byteLength(body),
                    'Content-Type': 'text/plain',
                })
                .end(body);
                return false;
            })
        } else if(typeof definedRouter == "function") {
            (new Promise((okFn)=>{
                var r = definedRouter(req,res, ack);
                okFn(r);
            }))
                .then(res=>ack(null, res))
                .catch(err=>ack(err, null));
        } else {
            app.handler(req,res,ack);
        }
    });
    process.on('message', (m, socket) => {
        if(socket){
            socket.on("error",(error)=>{
                if(error.code != 'ECONNRESET'){
                    console.error("ERR SOCKET HANGUP",m, error.code);
                }
            })
        }
        var ack = (error, data)=>{
            process.send({
                id: m?.id || m?.type || (typeof m == "string" ? m : "") || (error ? "error": "message"),
                error,
                data
            });
        }
        try{
            messages.emit(m?.type || (typeof m == "string" ? m : "") || "message",{ack,data : m?.data ?? m, socket});
        }catch(err){
            ack(err?.message || err)
        }
    });
}else{
    process.send({
        id: "getOnlyPackageInfo",
        error : null,
        data : {
            ..._packageInfo[_target],
            routes : Object.keys(files.uri).map((uri)=>`[${Array.from(files.uri[uri]).join("|").toUpperCase()}] ${uri}`),
            logo : "data:image/png;base64,"+getFileConent(encodeBase64FileName("logo.png")).toString("base64")
        }
    });
}

process.addListener("uncaughtException", (err)=>console.error(err))
process.addListener("unhandledRejection", (err)=>console.error(err))