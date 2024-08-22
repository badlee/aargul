
/** 
 * @typedef AargulArchive 
 *
 * @property {(mode?: number | undefined) => boolean} access
 * @property {String | null} filename
 * @property {import('fs').Stats | null} stats
 * @property {(entry: any, pass: any) => any} readFile
 * @property {(entry: any, callback: any) => void} readFileAsync
 * @property {(entry: any, encoding: any) => any} readAsText
 * @property {(entry: any, callback: any, encoding: Object) => void} readAsTextAsync
 * @property {(entry: any) => void} deleteFile
 * @property {(comment: any) => void} addZipComment
 * @property {() => any} getZipComment
 * @property {(entry: any, comment: any) => void} addEntryComment
 * @property {(entry: any) => any} getEntryComment
 * @property {(entryName: any, content: any) => void} updateFile
 * @property {(localPath: any, archivePath: any, zipName: any, comment: any) => void} addLocalFile
 * @property {(localPath: any, archivePath: any, filter: any, attr: number | any) => void} addLocalFolder
 * @property {(localPath: any, callback: any, archivePath: any, filter: any) => void} addLocalFolderAsync
 * @property {(localPath: string, props: { archivePath: string; filter: RegExp | Function; }) => Promise<any>} addLocalFolderPromise
 * @property {(entryName: string, content: Buffer | string, comment?: string | undefined, attr?: number | any) => void} addFile
 * @property {() => Array.<Entry>} getEntries
 * @property {(name: any) => Entry|null} getEntry
 * @property {() => number} getEntryCount
 * @property {(callback: any) => any} forEach
 * @property {(entry: any, targetPath: any, maintainEntryPath: any, overwrite: any, keepOriginalPermission: any, outFileName: any) => boolean} extractEntryTo
 * @property {(pass: any) => boolean} test
 * @property {(targetPath: any, overwrite: any, keepOriginalPermission: any, pass: any) => void} extractAllTo
 * @property {(targetPath: any, overwrite: any, keepOriginalPermission: any, callback: any) => void} extractAllToAsync
 * @property {(targetFileName: any, callback?: any, ...args: any[]) => void} writeFile
 * @property {(targetFileName: any, props: any) => Promise<any>} writeFilePromise
 * @property {(targetFileName: any, props: any, callback: any) => void | Promise<any>} save
 * @property {() => Promise<any>} toBufferPromise
 * @property {typeof toBuffer} toBuffer
 * @property {typeof toBuffer} toBuffer
 * */

const { join } = require('path');
const { Stats,constants } = require('fs');
const { isArrayBufferView } = require("util/types");
const { patchFs } = require('../fs-monkey');
const { Readable, Writable } = require('stream');

const Entry = require("./entry");
const FS_PREFIX = /^\/+(tmp|fs)\/+/i;
const _fd = Symbol("FsFakeFD");
const _fd_index = Symbol("FsFakeFD_INDEX");
const _fs = Symbol("FsFake");
const _fs_fn = Symbol("FsFakeFunctions");
const _fs_files = Symbol("FsFakeFILES");

/**
 * 
 * constructor FsError({ path, syscall, error, errno, message }?: {
    path: any;
    syscall: any;
    error: any;
    errno: any;
    message: any;
}): FsError
 */

/**
 * @typedef EntryWriteDataOptions
 * @property {String} [pass]
 * @property {Number} [offset]
 * @property {Number} [length]
 * @property {Number | null} [position]
 * {pass: any, offset?: number, length?: number, position?: number | null}
 */

/** 
 * @typedef Entry
 * @property {String} entryName
 * @property {Buffer} rawEntryName
 * @property {String} name
 * @property {Buffer} extra
 * @property {String} comment
 * @property {Boolean} isDirectory
 * @property {Buffer} header
 * @property {Object} attr
 * @property {(value: Buffer,options:EntryWriteDataOptions) => Number} writeData
 * @property {() => any} getCompressedData
 * @property {(pass: any) => Buffer} getData
 * @property {(value: Buffer) => void} setData
 * @property {(callback: any, pass: any) => void} getDataAsync
 * @property {()=>Buffer} packHeader
 * @property {()=>String} toString
 * @property {() => {entryName: string; name: string; comment: string; isDirectory: boolean; header: any; compressedData: string; data: string;}} toJSON
 */
/**
 * Synchronously tests a user's permissions for the file or
 * directory specified by `path`.
 * @param {String | Buffer | URL} path
 * @returns {String}
 */
function getPathName(path){
    if(path instanceof Buffer){
        path = path.toString("utf8").replace(/\/+/g,"/").replace(/^\//,"");
    }
    var hasSlash = false;
    if(typeof path == "string"){
        try {
            path = path.replace(process.cwd(),"");
            path = new URL(path);
        } catch (error) {
            // ingnore    
        }
    }
    if(/^\/hash/.test(path)){
        return path;
    }

    if(path instanceof URL){
        path.href = path.href
            .replace(process.cwd(),"")
            .replace(path.protocol,"")
            .replace(/\/+/g,"/").replace(/^\//,"")
        path = ["app:","file:"].includes(path.protocol) ? join("fs",path.href) : (
            ["tmp:","temp:"].includes(path.protocol) ? join("/tmp",path.href) : (
                ""
            )
        );
    }else if(typeof path == "string"){
        path = join(/^\/*tmp/.test(path)? "/tmp" : "fs",path.toString("utf8").replace(/^\/*(fs|tmp)/,"").replace(/\/+/g,"/").replace(/^\//,""));
    }else{
        path =  "";
    }
    return path.replace(/\/+/g,"/");
}
function maybeCallback(cb, name='callback') {
    if (typeof value !== 'function')
    (new FsError({message : `${name} is not a function`,error: "ERR_INVALID_ARG_TYPE"})).throw;  
    return cb;
  }
/**
 * @param {*} value
 * @param {string} name
 * @param {number} [min]
 * @param {number} [max]
 * @returns {void}
 */
const validateInteger = (value, name, min, max) => {
    min = typeof min == "number" ? min : Number.MIN_SAFE_INTEGER;
    max = typeof max == "number" ? max : Number.MAX_SAFE_INTEGER;
      // The defaults for min and max correspond to the limits of 32-bit integers.
      if (typeof value !== 'number')
        (new FsError({message : `${name} is not a number`,error: "ERR_INVALID_ARG_TYPE"})).throw;
    if (!Number.isInteger(value))
        (new FsError({message : `${name} is not an integer`,error: "ERR_OUT_OF_RANGE"})).throw;
    if (value < min || offset > max)
        (new FsError({message : `${name} must be in >= ${min} and <= ${max}`,error: "ERR_OUT_OF_RANGE"})).throw;
};
function stringToFlags(flags, name = 'flags') {
    if (typeof flags === 'number') {
        validateInteger(flags, name, -2147483648, 2147483647);
      return flags;
    }
  
    if (flags == null) {
      return FsFake.constants.O_RDONLY;
    }
  
    switch (flags) {
      case 'r' : return FsFake.constants.O_RDONLY;
      case 'rs' : // Fall through.
      case 'sr' : return FsFake.constants.O_RDONLY | FsFake.constants.O_SYNC;
      case 'r+' : return FsFake.constants.O_RDWR;
      case 'rs+' : // Fall through.
      case 'sr+' : return FsFake.constants.O_RDWR | FsFake.constants.O_SYNC;
  
      case 'w' : return FsFake.constants.O_TRUNC | FsFake.constants.O_CREAT | FsFake.constants.O_WRONLY;
      case 'wx' : // Fall through.
      case 'xw' : return FsFake.constants.O_TRUNC | FsFake.constants.O_CREAT | FsFake.constants.O_WRONLY | FsFake.constants.O_EXCL;
  
      case 'w+' : return FsFake.constants.O_TRUNC | FsFake.constants.O_CREAT | FsFake.constants.O_RDWR;
      case 'wx+': // Fall through.
      case 'xw+': return FsFake.constants.O_TRUNC | FsFake.constants.O_CREAT | FsFake.constants.O_RDWR | FsFake.constants.O_EXCL;
  
      case 'a' : return FsFake.constants.O_APPEND | FsFake.constants.O_CREAT | FsFake.constants.O_WRONLY;
      case 'ax' : // Fall through.
      case 'xa' : return FsFake.constants.O_APPEND | FsFake.constants.O_CREAT | FsFake.constants.O_WRONLY | FsFake.constants.O_EXCL;
      case 'as' : // Fall through.
      case 'sa' : return FsFake.constants.O_APPEND | FsFake.constants.O_CREAT | FsFake.constants.O_WRONLY | FsFake.constants.O_SYNC;
  
      case 'a+' : return FsFake.constants.O_APPEND | FsFake.constants.O_CREAT | FsFake.constants.O_RDWR;
      case 'ax+': // Fall through.
      case 'xa+': return FsFake.constants.O_APPEND | FsFake.constants.O_CREAT | FsFake.constants.O_RDWR | FsFake.constants.O_EXCL;
      case 'as+': // Fall through.
      case 'sa+': return FsFake.constants.O_APPEND | FsFake.constants.O_CREAT | FsFake.constants.O_RDWR | FsFake.constants.O_SYNC;
    }
    (new FsError({message : `Invalid flags ${flags}`,error: "ERR_INVALID_ARG_VALUE"})).throw;
  }

/**
 * Class FsFakeError
 * @extends Error
 * 
 * @property {type} throw - Throw the error
 */
class FsError extends Error{
    /**
     * @param {Object | String} [options]
     * @param {String} [options.path]
     * @param {String} [options.dest]
     * @param {String} [options.syscall]
     * @param {String} [options.error]
     * @param {number} [options.errno]
     * @param {String} [options.message]
     */
    constructor(options){
        super(typeof options == "string"? options : ((options ? options.message : "") || `${(options ? options.error : "") || "FSERROR"}`));

        if(typeof options == "string"){
            options = {message: options};
        }

        if(typeof options != "object"){
            options = {};
        }

        const {path,dest, syscall, error, errno, message } = options;
        /**
         * Error Class Name
         * @type {String}
         * @private
         */
        this.name = "FsError";

        /**
         * Error Name
         * @type {String}
         * @public
         */
        this.code = error ?? "FSERROR";

        /**
         * Error Message
         * @type {String}
         * @public
         */
        this.message = message ?? this.code;

        /**
         * Error Code
         * @type {number}
         * @public
         */
        this.errno = errno;

        /**
         * Syscall Function Name
         * @type {String}
         * @public
         */
        this.syscall = syscall;

        /**
         * File Path
         * @type {String}
         * @public
         */
        this.path = path ? ((path ?? "").replace(FS_PREFIX,"/")): undefined;

        /**
         * File Path
         * @type {String}
         * @public
         */
        this.dest = dest ? ((dest ?? "").replace(FS_PREFIX,"/")): undefined;

        /**
         * Throws the FsError
         * @type {void}
         * @public
         */
        this.throw = (void 0);

        Object.defineProperty(this,"throw",{
            get(){
                var e = new Error();
                var r = JSON.parse(JSON.stringify(this));
                Object.keys(r).forEach(k=>e[k] = r[k]);
                e.name = this.name;
                e.message = this.message;
                var s = e.stack.split("\n");
                s.splice(1,1);
                e.stack = s.join("\n");
                throw e;
            },
            enumerable : false,
            configurable : false
        })

        /**
         * Throws the FsError
         * @type {string}
         * @public
         */
        this.stack = "";
        Object.defineProperty(this,"stack",{
            get(){
                var e = new Error();
                var r = JSON.parse(JSON.stringify(this));
                Object.keys(r).forEach(k=>e[k] = r[k]);
                e.name = this.name;
                e.message = this.message;
                var s = e.stack.split("\n");
                s.splice(1,1);
                return s.join("\n");
            },
            enumerable : false,
            configurable : false
        })
    }
    /**
     * Update Error Data
     * @param {Object | String} [options]
     * @param {String} [options.path]
     * @param {String} [options.dest]
     * @param {String} [options.syscall]
     * @param {String} [options.error]
     * @param {number} [options.errno]
     * @param {String} [options.message]
     * 
     * @returns {FsError} this
     */
    update(options){
        if(typeof options == "string"){
            options = {message: options};
        }
        if(typeof options == "object"){
            options = {};
        }
        const {path,dest, syscall, error, errno, message } = options;
        if(syscall)
            this.syscall = syscall;
        if(error)
            this.error = error;
        if(errno)
            this.errno = errno;
        if(message)
            this.message = message;
        if(dest)
            this.dest = dest.replace(FS_PREFIX,"/");
        if(path)
            this.path = path.replace(FS_PREFIX,"/");
        return this;
    }
}

class FsFake {
    
    /** @param {AargulArchive} archive */
    constructor(archive){
        /** @type {Map.<Number,{entry:Entry, position: Number, flags : Number}>} */
        this[_fd] = new Map();
        this.unpatch = patchFs(this); // replace fs
        var TTL;
        var tmp = new Entry();
        tmp.entryName = "/tmp/";
        /** @type {Object.<String,Entry>} */
        this[_fs_files] = {
            "/tmp" : tmp,
            "/tmp/" : tmp,
        };
        /** @type {Number} */
        this[_fd_index] = 1;
        /** @type {Object.<String,Function>} */
        this[_fs_fn] = {
            unlink : (path)=>{
                var i = this[_fs_fn].getEntry(path);
                if(i && !i.isDirectory){
                    if(/^\/tmp\//.test(i.entryName)){
                        delete this[_fs_files][i.entryName];
                    }else{
                        archive.deleteFile(i);
                    }
                    return this[_fs](); // save
                }else if(i && i.isDirectory){
                    (new FsError({path,syscall: "open",error: "EISDIR",errno: 21})).throw;
                }
                (new FsError({path:dir,syscall: "unlink",error: "ENOENT",errno: 2})).throw;
            },
            rmDir : (path, force)=>{
                var i = this[_fs_fn].getEntry(path);
                if(i && i.isDirectory){
                    var files = this[_fs_fn].getEntries(entry=>
                        entry.entryName.search(i.entryName) == 0
                    )
                    if(force && files.length){
                        files.forEach(entry=>{
                            if(!entry.isDirectory){
                                this[_fs_fn].unlink(entry.entryName);
                            }else{
                                if(/^\/tmp\//.test(entry.entryName)){
                                    delete this[_fs_files][entry.entryName];
                                }else{
                                    archive.deleteFile(entry);
                                }
                            }
                        })
                    } if(files.length){
                        (new FsError({path:path,syscall: "mkdir",error: "ENOTEMPTY",errno: -66})).throw;
                    }
                    if(/^\/tmp\//.test(i.entryName)){
                        delete this[_fs_files][i.entryName];
                    }else{
                        archive.deleteFile(i);
                    }
                    return this[_fs](); // save
                }else if(i && !i.isDirectory){
                    (new FsError({path:path,syscall: "mkdir",error: "ENOTDIR",errno: 20})).throw;
                }
                (new FsError({path:path,syscall: "rmDir",error: "ENOENT",errno: 2})).throw;
            },
            mkdir : (entryName,  mode, recursive)=>{
                var path = getPathName(entryName);
                var prev = "/";
                var parts = path.replace(/^\//,"").split("/");
                parts.slice(0,-1).forEach(dir=>{
                    var dir = join(prev,dir);
                    var i = this[_fs_fn].getEntry(dir);
                    if(!i && recursive){
                        this[_fs_fn].addFile(dir+"/",null)
                    }else if(!i){
                        (new FsError({path:dir,syscall: "mkdir",error: "ENOENT",errno: 2})).throw;
                    }else if(i && !i.isDirectory){
                        (new FsError({path:dir,syscall: "mkdir",error: "ENOTDIR",errno: 20})).throw;
                    }
                });
                this[_fs_fn].addFile((path+"/"),null);// create directory
                return this[_fs_fn].getEntry(path+"/")?.entryName?.replace(FS_PREFIX,"/");
            },
            addFile: (entryName,  content, comment, attr)=>{
                var path = getPathName(entryName);
                if(path){
                    if(/^\/tmp\//.test(path)){
                        let entry = this[_fs_files][path];
                        const update = entry != null;

                        // prepare new entry
                        if (!update) {
                            // @ts-ignore
                            entry = new Entry();
                            entry.entryName = entryName;
                        }
                        entry.comment = comment || "";

                        const isStat = "object" === typeof attr && attr instanceof Stats;

                        // last modification time from file stats
                        if (isStat) {
                            entry.header.time = attr.mtime;
                        }

                        // Set file attribute
                        var fileattr = entry.isDirectory ? 0x10 : 0; // (MS-DOS directory flag)

                        // extended attributes field for Unix
                        // set file type either S_IFDIR / S_IFREG
                        let unix = entry.isDirectory ? 0x4000 : 0x8000;

                        if (isStat) {
                            // File attributes from file stats
                            unix |= 0xfff & attr.mode;
                        } else if ("number" === typeof attr) {
                            // attr from given attr values
                            unix |= 0xfff & attr;
                        } else {
                            // Default values:
                            unix |= entry.isDirectory ? 0o755 : 0o644; // permissions (drwxr-xr-x) or (-r-wr--r--)
                        }

                        fileattr = (fileattr | (unix << 16)) >>> 0; // add attributes

                        entry.attr = fileattr;

                        entry.setData(content);
                        if(!update){
                            this[_fs_files][path] = entry;
                        }
                    }else{
                        archive.addFile(path,content,comment,attr);
                    }
                }
                return this[_fs]();// save
            },
            getEntry : (entryName)=>{
                var path = getPathName(entryName);
                if(/^fs\/node_modules\//.test(path)){
                    return this.unpatch.readFileSync(path.replace(/^fs/, process.cwd()));
                }
                console.log("READ FILE", path,entryName)
                if(path){
                    var entry = /^\/(tmp\/|tmp$)/.test(path) ? this[_fs_files][path] : archive.getEntry(path);
                    if(entry){
                        entry.writeData = (buffer,{pass, offset, length, position} = {}) => {
                            if(typeof buffer == "string" ) buffer = Buffer.from(buffer);
                            if (!isArrayBufferView(buffer)) {
                                (new FsError({message : `Buffer must be Buffer, TypedArray, DataView or String`,syscall: "write",error: "ERR_OUT_OF_RANGE"})).throw;
                            }
                            var written = Buffer.alloc(0);
                            if (position === undefined)
                                position = null;
                            if (offset == null) {
                                offset = 0;
                            } else {
                                validateInteger(offset, "Offset", Number.MIN_SAFE_VALUE, Number.MAX_SAFE_VALUE);
                            }
                            if (typeof length !== 'number')
                                length = buffer.byteLength - offset;
                            if (offset > byteLength) {
                                (new FsError({message : `Offset must be <= ${byteLength}`,syscall: "write",error: "ERR_OUT_OF_RANGE"})).throw;
                            }
                        
                            if (length > byteLength - offset) {
                                (new FsError({message : `Offset must be <= ${byteLength - offset}`,syscall: "write",error: "ERR_OUT_OF_RANGE"})).throw;
                            }
                        
                            if (length < 0) {
                                (new FsError({message : `Length must be >= 0`,syscall: "write",error: "ERR_OUT_OF_RANGE"})).throw;
                            }
                            // valid int32
                            validateInteger(length, "Length", -2147483648, 2147483647);
                            entry.setData(Buffer.concat([
                                entry.getData(pass).subarray(0,position ?? (entry.getData(pass).length)),
                                (written = buffer.subarray(offset??0,Math.min(buffer.length, (offset??0)+(length??buffer.length)))),
                                entry.getData(pass).subarray(
                                    Math.min(
                                        entry.getData(pass).length,
                                        (length ?? buffer.length)+(
                                            position ?? (entry.getData(pass).length-1)
                                        )
                                    )
                                )
                            ]));
                            var isDirectory = entry.isDirectory;
                            Object.defineProperty(entry, "isDirectory",{
                                get(){
                                    console.log("Check directory...",(new FsError("CHECK DIRECTORY")).stack);
                                    return isDirectory;
                                }
                            })
                            return written;
                        }
                        return entry;
                    }
                }
                return null;
            },
            getEntries: (filter)=>{
                return (filter && typeof filter == "function" ? Object.values(this[_fs_files]).concat(archive.getEntries()).filter(filter) :  Object.values(this[_fs_files]).concat(archive.getEntries()))
                    .sort((a,b)=>a.entryName.localeCompare(b.entryName))
                    .map(({entryName})=>this[_fs_fn].getEntry(entryName));
            },
            access: (mode)=>{
                return archive.access(mode, 'access');
            },
            archiveStat: ()=>{
                return archive.stats;
            },
            isArchivePath: (path)=>{
                return path == archive.filename;
            }
        };
        this[_fs] = function () {
            clearTimeout(TTL);
            TTL = setTimeout(() => {
                try {
                    archive.save(); // save File
                } catch (error) {
        
                }
            }, 50);
        };
    }
    // sync
    /**
     * Synchronously tests a user's permissions for the file or
     * directory specified by `path`.
     * @param {string | Buffer | URL} path
     * @param {number} [mode]
     * @returns {void}
     */
    accessSync(path, mode){
        if(this[_fs_fn].getEntry(path)){
            if(this[_fs_fn].access(mode)){
                return;
            }
        }
        (new FsError({path,syscall: "access",error: "ENOENT",errno: -2})).throw;
    }
    /**
     * Synchronously appends data to a file.
     * @param {string | Buffer | URL | number} path
     * @param {string | Buffer} data
     * @param {{
     *   encoding?: string | null;
     *   mode?: number;
     *   flag?: string;
     *   } | string} [options]
     * @returns {void}
    **/
    appendFileSync(path, data, options){
        var item = this[_fs_fn].getEntry(path);
        if (item && !item.isDirectory) {
            var b = Buffer.concat(item.getData(),typeof data == "string" ? Buffer.from(data) : (data instanceof Buffer ? data : Buffer.alloc(0)));
            if(b.length){
                item.setData(b);
                return this[_fs](); //save
            }
            return; // skip
        }else if (item && item.isDirectory){
            (new FsError({path,syscall: "open",error: "EISDIR",errno: 21})).throw;
        }
        (new FsError({path,syscall: "appendFile",error: "ENOENT",errno: -2})).throw;
    }
    /**
     * Synchronously changes the permissions of a file.
     * @param {string | Buffer | URL} path
     * @param {string | number} mode
     * @returns {void}
     */
    chmodSync(path, mode){
        var item = this[_fs_fn].getEntry(path);
        if (item) {
            return; // skip
        }
        (new FsError({path,syscall: "chmod",error: "ENOENT",errno: -2})).throw;
    }
    /**
     * Synchronously changes the owner and group
     * of a file.
     * @param {string | Buffer | URL} path
     * @param {number} uid
     * @param {number} gid
     * @returns {void}
     */
    chownSync(path, uid, gid){
        var item = this[_fs_fn].getEntry(path);
        if (item) {
            return; // skip
        }
        (new FsError({path,syscall: "chown",error: "ENOENT",errno: -2})).throw;
    }
    /**
     * Synchronously closes the file descriptor.
     * @param {number} fd
     * @returns {void}
     */
    closeSync(fd){
        if(!this[_fd].has(fd)){
            (new FsError({path:dir,syscall: "close",error: "EBADF",errno: -9})).throw;
        }else{
            this[_fd].delete(fd);
        }
    }

    /**
     * Closes the file descriptor.
     * @param {number} fd
     * @param {(err?: Error) => any} [callback]
     * @returns {void}
     */
    close(fd, callback){
        if (typeof callback !== 'function') {
            callback = ()=>{};
        }
        new Promise((ok)=>{
            ok(this.closeSync(fd));
        }).then(res=>callback(undefined,res)).catch(err=>callback(err));
    }

    /**
     * Synchronously opens a file.
     * @param {string | Buffer | URL} path
     * @param {string | number} [flags]
     * @param {string | number} [mode]
     * @returns {number}
     */
    openSync(path, flags, mode) {
        flags = stringToFlags(flags);
        var i = this[_fs_fn].getEntry(path);
        if(i && i.isDirectory){
            (new FsError({path:dir,syscall: "open",error: "EISDIR",errno: 21})).throw;
        }else if(!i){
            if((flags & FsFake.constants.O_RDWR) !== FsFake.constants.O_RDWR){
                this[_fs_fn].addFile(path, Buffer.alloc(0)) // create empty file
            }else
                (new FsError({path:dir,syscall: "open",error: "ENOENT",errno: 2})).throw;
        }
        var fd = this[_fd_index]++;
        this[_fd].set(fd,{entry:i, position : 0, flags});
        return fd;
    }

    /**
     * Asynchronously opens a file.
     * @param {string | Buffer | URL} path
     * @param {string | number} [flags]
     * @param {string | number} [mode]
     * @param {(
     *   err?: Error,
     *   fd?: number
     *   ) => any} callback
     * @returns {void}
     */
    open(path, flags, mode, callback) {
        if (typeof callback !== 'function') {
            callback = ()=>{};
        }
        new Promise((ok)=>{
            ok(this.openSync(path, flags, mode));
        }).then(res=>callback(undefined,res)).catch(err=>callback(err));
    }

    /**
     * Synchronously writes `buffer` to the
     * specified `fd` (file descriptor).
     * @param {number} fd
     * @param {Buffer | TypedArray | DataView | string} buffer
     * @param {{
     *   offset?: number, length?: number, position?: number | null
     * } | number} [offsetOrOptions]
     * @returns {number}
     */
    writeSync(fd, buffer, offsetOrOptions, length, position) {
        var entry = this[_fd].get(fd);
        if(entry){
            let offset = offsetOrOptions;
            if (typeof offset === 'object') {
                ({
                    offset = 0,
                    length = buffer.byteLength - offset,
                    position = null,
                } = offsetOrOptions ?? {});
            }
            entry.entry.writeData(buffer,{
                offset,
                length,
                position
            });
            return written.length;
        }
        (new FsError({path:dir,syscall: "write",error: "EBADF",errno: -9})).throw;
    }

    /**
     * Writes `buffer` to the specified `fd` (file descriptor).
     * @param {number} fd
     * @param {Buffer | TypedArray | DataView | string} buffer
     * @param {number | {
     *   offset?: number, length?: number, position?: number | null
     * }} [offsetOrOptions]
     * @param {number} [length]
     * @param {number | null} [position]
     * @param {(
     *   err?: Error,
     *   bytesWritten?: number;
     *   buffer?: Buffer | TypedArray | DataView
     * ) => any} callback
     * @returns {void}
     */
    write(fd, buffer, offsetOrOptions, length, position, callback) {
        callback = maybeCallback(callback || position || length);
        if (typeof callback !== 'function') {
            callback = ()=>{};
        }
        let offset = offsetOrOptions;
        if (typeof offset === 'object') {
            ({
                offset = 0,
                length = buffer.byteLength - offset,
                position = null,
            } = offsetOrOptions ?? {});
        }
        
        new Promise((ok)=>{
            ok(this.writeSync(fd, buffer, offsetOrOptions, length, position));
        }).then(res=>callback(undefined, res, buffer)).catch(err=>callback(err));
    }
    
    /**
     * Synchronously copies `src` to `dest`. By
     * default, `dest` is overwritten if it already exists.
     * @param {string | Buffer | URL} src
     * @param {string | Buffer | URL} dest
     * @param {number} [mode]
     * @returns {void}
     */
    copyFileSync(src, dest, mode){
        var error = new FsError({path:src ,syscall: "copyFile", error: "ENOENT", errno: -2});
        var item = this[_fs_fn].getEntry(src);
        if (item && item.isDirectory){
            error.update({error: "EISDIR",errno:  21}).throw;
        } else if (item) {
            var itemDest = this[_fs_fn].getEntry(dest);
            if (itemDest && itemDest.isDirectory){
                error.update({path:dest,error: "EISDIR",errno:  21}).throw;
            }
            if(itemDest){
                // delete it and replace
                itemDest.setData(item.getData());
                itemDest.comment = item.comment;
                itemDest.attr = item.attr;
            }else{
                this[_fs_fn].addFile(dest,item.getData(),item.comment,item.attr);
            }
            return this[_fs](); //save
        }
        error.update({path : src}).throw;
    }
    /**
     * Synchronously copies `src` to `dest`. `src` can be a file, directory, or
     * symlink. The contents of directories will be copied recursively.
     * @param {string | URL} src
     * @param {string | URL} dest
     * @param {object} [options]
     * @returns {void}
     */
    cpSync(src, dest, options){
        let {errorOnExist,filter,force,recursive,mode} = Object.assign({mode:0, errorOnExist:false,filter : (src, dest)=>true,force:true,recursive: false},options ?? {})
        var error = new FsError({path:src,syscall: "cp",error: "ENOENT",errno: -2});;
        var item = this[_fs_fn].getEntry(src);
        if (item && item.isDirectory){
            var itemDest = this[_fs_fn].getEntry(dest);
            if (itemDest && !itemDest.isDirectory){
                error.update({path:dest,error: "EISDIR",errno:  21}).throw;
            }
            //
            this[_fs_fn].getEntries().forEach((entry)=>{
                if(entry.entryName.search(src) == 0){ // if is subdir or files
                    var destPath = entry.entryName.replace(item.entryName, itemDest.entryName);
                    var i =  this[_fs_fn].getEntry(destPath)
                    if(i && i.isDirectory && entry.isDirectory){
                        return; //skip
                    }else if(i && !i.isDirectory && entry.isDirectory){
                        return; //skip
                    }else if(i && i.isDirectory && !entry.isDirectory){
                        return; //skip
                    }
                    // copy only if is new file or existing file
                    try {
                        this.cpSync(entry.entryName, destPath, {errorOnExist,filter,force,recursive,mode});
                    } catch (error) {
                        if(error instanceof FsError && error.errno == 13){
                            return // skip error
                        }
                        throw error;
                    }
                }
            })
        } else if (item) {
            var itemDest = this[_fs_fn].getEntry(dest);
            if (itemDest && itemDest.isDirectory){
                error.update({path:dest,error: "ENOTDIR",errno:  20}).throw;
            }
            if(item && errorOnExist && !force){
                error.update({path:dest,error: "EEXIST",errno:  17, message : `File ${dest} exists`}).throw;
            }
            if(item && filter && typeof filter == "function" && !filter(src, dest)){
                error.update({path:dest,error: "EACCES",errno:  13, message : `Access rejected by filter function`}).throw;
            }else{
                this.copyFileSync(src, dest,mode);
            }
        }
        error.update({path : src}).throw;
    }
    // [TODO] fs.existsSync never throws, it only returns true or false.
    // Since fs.existsSync never throws, users have established
    // the expectation that passing invalid arguments to it, even like
    // [TODO] fs.existsSync(), would only get a false in return, so we cannot signal
    // validation errors to users properly out of compatibility concerns.
    // TODO(joyeecheung): deprecate the never-throw-on-invalid-arguments behavior
    /**
     * Synchronously tests whether or not the given path exists.
     * @param {string | Buffer | URL} path
     * @returns {boolean}
     */
    existsSync(path){
        return !!this[_fs_fn].getEntry(path);
    }
    /**
     * Synchronously sets the permissions on the file.
     * @param {number} fd
     * @param {string | number} mode
     * @returns {void}
     */
    fchmodSync(fd, mode){
        return this.chmodSync(this[_fd].get(fd));
    }
    /**
     * Synchronously sets the owner of the file.
     * @param {number} fd
     * @param {number} uid
     * @param {number} gid
     * @returns {void}
     */
    fchownSync(fd, uid, gid){
        return this.chownSync(this[_fd].get(fd),uid, gid);
    }

    /**
     * Sets the owner of the file.
     * @param {number} fd
     * @param {number} uid
     * @param {number} gid
     * @param {(err?: Error) => any} callback
     * @returns {void}
     */
    fchown(fd, uid, gid, callback){
        if (typeof callback !== 'function') {
            callback= ()=>{};
        }
        new Promise((ok)=>{
            ok(this.fchownSync(fd, uid, gid))
        }).then(res=>callback(undefined,res)).catch(err=>callback(err));
    }
    /**
     * Synchronously forces all currently queued I/O operations
     * associated with the file to the operating
     * system's synchronized I/O completion state.
     * @param {number} fd
     * @returns {void}
     */
    fdatasyncSync(fd){
        // TODO
    }
    /**
     * Synchronously creates a directory.
     * @param {string | Buffer | URL} path
     * @param {{
     *      recursive?: boolean;
    *       mode?: string | number;
    *   } | number} [options]
    * @returns {string | void}
    */
    mkdirSync(path, options){
        return this[_fs_files].mkdir(path, options.mode, options.recursive);
    }

    /**
     * Asynchronously creates a directory.
     * @param {string | Buffer | URL} path
     * @param {{
     *   recursive?: boolean;
     *   mode?: string | number;
     *   } | number} [options]
     * @param {(err?: Error) => any} callback
     * @returns {void}
     */
    mkdir(path, options, callback){
        new Promise((ok)=>{
            let mode = 0o777;
            let recursive = false;
            if (typeof options === 'function') {
                [callback, options] = [options, callback];
            }
            if (typeof options === 'number' || typeof options === 'string') {
                mode = options;
            } else if (options) {
                if (options.recursive !== undefined)
                recursive = options.recursive;
                if (options.mode !== undefined)
                mode = options.mode;
            }
            ok(this[_fs_files].mkdir(path, mode, recursive));
        }).then(data=>callback(undefined, data)).catch(err=>callback(err));
    }
    /**
     * Synchronously creates a unique temporary directory.
     * @param {string} prefix
     * @param {string | { encoding?: string; }} [options]
     * @returns {string}
     */
    mkdtempSync(prefix, options){
        if(!prefix || typeof prefix !== "string"){
            new FsError({message : `The "prefix" argument must be of type string.Received ${typeof prefix === null ? "null" : typeof prefix}`,syscall: "mkdtemp",error: "ERR_INVALID_ARG_TYPE"}).throw
        }
        return this.mkdirSync(`temp:${prefix}${Date.now().toString(36)}${Math.random().toString(36).substring(2)}`);
    }

    /**
     * Creates a unique temporary directory.
     * @param {string} prefix
     * @param {string | { encoding?: string; }} [options]
     * @param {(
     *   err?: Error,
     *   directory?: string
     *   ) => any} callback
     * @returns {void}
     */
    mkdtemp(prefix, options, callback){
        if (typeof options === 'function') {
            [callback, options] = [options, callback];
        }
        new Promise((ok)=>{
            ok(this.mkdtempSync(prefix,options))
        }).then(res=>callback(undefined,res)).catch(err=>callback(err));
    }

    // [TODO] fs.opendirSync(path[, options])
    // [TODO] fs.openSync(path[, flags[, mode]])
    // [TODO] fs.readlinkSync(path[, options])
    // [TODO] fs.realpathSync(path[, options])
    // [TODO] fs.realpathSync.native(path[, options])
    // [TODO] 
    // [TODO] 
    // [TODO] 
    // [TODO] 
    // [TODO] 
    // [TODO] 
    // [TODO] 
    /**
     * Synchronously reads the contents of a directory.
     * @param {string | Buffer | URL} path
     * @param {string | {
     *   encoding?: string;
     *   withFileTypes?: boolean;
     *   recursive?: boolean;
     *   }} [options]
     * @returns {string | Buffer[] | Dirent[]}
     */
    readdirSync(path, options){
        path = getPathName(path);
        return this[_fs_fn].getEntries(entry=>
            entry.entryName.search(path+"/") == 0 &&  
            entry.entryName.replace(path+"/","").split("/") == 1
        ).map(entry=>entry.name);
    }

    /**
     * Reads the contents of a directory.
     * @param {string | Buffer | URL} path
     * @param {string | {
     *   encoding?: string;
     *   withFileTypes?: boolean;
     *   }} [options]
     * @param {(
     *   err?: Error,
     *   files?: string[] | Buffer[] | Direct[];
     *   ) => any} callback
     * @returns {void}
     */
    
    readdir(path, options, callback) {
        if (typeof options === 'function') {
            [callback, options] = [options, callback];
        }
        new Promise((ok)=>{
            ok(this.readdirSync(path,options))
        }).then(res=>callback(undefined,res)).catch(err=>callback(err));
    }
    /**
     * Synchronously reads the entire contents of a file.
     * @param {string | Buffer | URL | number} path
     * @param {{
     *   encoding?: string | null;
     *   flag?: string;
     *   }} [options]
     * @returns {string | Buffer}
     */
    readFileSync(path, options){
        /** @type {Entry} */
        var entry = this[_fs_fn].getEntry(path);
        
        if(!entry.isDirectory){
            return options?.encoding ? entry.getData().toString(options.encoding) : entry.getData();
        } else if(entry.isDirectory){
            new FsError({path:path ,syscall: "readFile",error: "EISDIR",errno:  21}).throw
        }
        new FsError({path:path ,syscall: "readFile", error: "ENOENT", errno: -2}).throw
    }

    /**
     * Asynchronously reads the entire contents of a file.
     * @param {string | Buffer | URL | number} path
     * @param {{
     *   encoding?: string | null;
     *   flag?: string;
     *   signal?: AbortSignal;
     *   } | string} [options]
     * @param {(
     *   err?: Error,
     *   data?: string | Buffer
     *   ) => any} callback
     * @returns {void}
     */
    readFile(path, options, callback) {
        if (typeof options === 'function') {
            [callback, options] = [options, callback];
        }
        new Promise((ok)=>{
            ok(this.readFileSync(path,options))
        }).then(res=>callback(undefined,res)).catch(err=>callback(err));
    }

    /**
     * Synchronously removes a file or symbolic link.
     * @param {string | Buffer | URL} path
     * @returns {void}
     */
    unlinkSync(path) {
        this[_fs_fn].unlink(path);
    }

    /**
     * Asynchronously removes a file or symbolic link.
     * @param {string | Buffer | URL} path
     * @param {(err?: Error) => any} callback
     * @returns {void}
     */
    unlink(path, callback) {
        if (typeof callback !== 'function') {
            callback = ()=>{};
        }
        new Promise((ok)=>{
            ok(this.unlinkSync(path));
        }).then(res=>callback(undefined,res)).catch(err=>callback(err));
    }

    /**
 * Synchronously removes a directory.
 * @param {string | Buffer | URL} path
 * @param {{
 *   maxRetries?: number;
    *   recursive?: boolean;
    *   retryDelay?: number;
    *   }} [options]
    * @returns {void}
    */
    rmdirSync(path, options) {
        return this[_fs_fn].rmDir(path, options.recursive);
    }

    /**
     * Asynchronously removes a directory.
     * @param {string | Buffer | URL} path
     * @param {{
     *   maxRetries?: number;
     *   recursive?: boolean;
     *   retryDelay?: number;
     *   }} [options]
     * @param {(err?: Error) => any} callback
     * @returns {void}
     */
    rmdir(path, options, callback) {
        if (typeof options === 'function') {
            [callback, options] = [options, callback];
        }
        new Promise((ok)=>{
            ok(this.rmdirSync(path, data, options))
        }).then(res=>callback(undefined,res)).catch(err=>callback(err));
    }

    /**
     * Synchronously removes files and
     * directories (modeled on the standard POSIX `rm` utility).
     * @param {string | Buffer | URL} path
     * @param {{
     *   force?: boolean;
     *   maxRetries?: number;
     *   recursive?: boolean;
     *   retryDelay?: number;
     *   }} [options]
     * @returns {void}
     */
    rmSync(path, options) {
        var i = this[_fs_fn].getEntry(path);
        if(i && i.isDirectory){
            return this.rmdirSync(path, options);
        }else if(i && !i.isDirectory){
            return this.unlinkSync(path, options);
        }
        (new FsError({path:path,syscall: "rmDir",error: "ENOENT",errno: 2})).throw;
    }

    /**
     * Asynchronously removes a directory.
     * @param {string | Buffer | URL} path
     * @param {{
     *   maxRetries?: number;
     *   recursive?: boolean;
     *   retryDelay?: number;
     *   }} [options]
     * @param {(err?: Error) => any} callback
     * @returns {void}
     */
    rm(path, options, callback) {
        if (typeof options === 'function') {
            [callback, options] = [options, callback];
        }
        new Promise((ok)=>{
            ok(this.rmSync(path, data, options))
        }).then(res=>callback(undefined,res)).catch(err=>callback(err));
    }


    /**
     * Synchronously renames file at `oldPath` to
     * the pathname provided as `newPath`.
     * @param {string | Buffer | URL} src
     * @param {string | Buffer | URL} dest
     * @returns {void}
     */
    renameSync(src, dest) {
        var error = new FsError({path : src ,syscall: "rename", error: "ENOENT", errno: -2});
        var item = this[_fs_fn].getEntry(src);
        if (item && item.isDirectory){
            var files = this.readdirSync(src);
            if(files.length){
                error.update({error: "ENOTEMPTY",errno:  -66, syscall: "rename"}).throw;
            }
        }
        if (item) {
            var itemDest = this[_fs_fn].getEntry(dest);
            if (item.isDirectory && itemDest && !itemDest.isDirectory){
                error.update({dest,error: "ENOTDIR",errno:  20}).throw;
            }else if (item.isDirectory && itemDest && itemDest.isDirectory && this.readdirSync(src).length){
                error.update({path:dest, error: "ENOTEMPTY",errno:  -66, syscall: "rename"}).throw;
            }else if (!item.isDirectory && itemDest && itemDest.isDirectory){
                error.update({dest,error: "EISDIR",errno:  21}).throw;
            }
            if(itemDest){
                // delete it and replace
                itemDest.setData(item.getData());
                itemDest.comment = item.comment;
                itemDest.attr = item.attr;
            }else{
                this[_fs_fn].addFile(dest,item.getData(),item.comment,item.attr);
            }
            this[_fs_fn].unlink(item.entryName); // remove old
            return this[_fs](); //save
        }
        error.throw;
    }

    /**
     * Synchronously renames file at `oldPath` to
     * the pathname provided as `newPath`.
     * @param {string | Buffer | URL} src
     * @param {string | Buffer | URL} dest
     * @param {(err?: Error) => any} callback
     * @returns {void}
     */
    rename(src, dest, callback) {
        if (typeof callback !== 'function') {
            callback = ()=>{};
        }
        new Promise((ok)=>{
            ok(this.renameSync(src, dest));
        }).then(res=>callback(undefined,res)).catch(err=>callback(err));
    }
    /**
     * Truncates the file.
     * @param {string | Buffer | URL} path
     * @param {number} [length]
     * @param {(err?: Error) => any} callback
     * @returns {void}
     */
    truncateSync(path, length) {
        var error = new FsError({path ,syscall: "truncate", error: "ENOENT", errno: -2});
        /** @type {Entry} */
        var item = this[_fs_fn].getEntry(path);
        if (item && item.isDirectory){
            error.update({dest,error: "EISDIR",errno:  21}).throw;
        }else if (item) {
            length = Math.max(0, length ?? 0);
            validateInteger(length, "Length", -2147483648, 2147483647);
            item.setData(item.getData().subarray(0,length));
            return this[_fs](); //save
        }
        error.throw;
    }
    /**
     * Truncates the file.
     * @param {string | Buffer | URL} path
     * @param {number} [length]
     * @param {(err?: Error) => any} callback
     * @returns {void}
     */
    truncate(path, length, callback) {
        if (typeof length === 'function') {
            [callback, length] = [length, callback];
        }
        new Promise((ok)=>{
            ok(this.truncateSync(path, length, options))
        }).then(res=>callback(undefined,res)).catch(err=>callback(err));
    }
    /**
     * Synchronously writes data to the file.
     * @param {string | Buffer | URL | number} path
     * @param {string | Buffer | TypedArray | DataView} data
     * @param {{
     *   encoding?: string | null;
     *   mode?: number;
     *   flag?: string;
     *   } | string} [options]
     * @returns {void}
     */
    writeFileSync(path, data, options) {
        var item = this[_fs_fn].getEntry(path);
        if ((item && !item.isDirectory ) || !item) {
            this[_fs_fn].addFile(path, typeof data == "string" ? Buffer.from(data, options.encoding) : data);
        }else if (item && item.isDirectory){
            (new FsError({path,syscall: "open",error: "EISDIR",errno: 21})).throw;
        }
    }

    /**
     * Asynchronously writes data to the file.
     * @param {string | Buffer | URL | number} path
     * @param {string | Buffer | TypedArray | DataView} data
     * @param {{
     *   encoding?: string | null;
     *   mode?: number;
     *   flag?: string;
     *   signal?: AbortSignal;
     *   } | string} [options]
     * @param {(err?: Error) => any} callback
     * @returns {void}
     */
    writeFile(path, data, options, callback) {
        if (typeof options === 'function') {
            [callback, options] = [options, callback];
        }
        new Promise((ok)=>{
            ok(this.writeFileSync(path, data, options))
        }).then(res=>callback(undefined,res)).catch(err=>callback(err));
    }

    /**
     * Synchronously retrieves the `fs.Stats`
     * for the `path`.
     * @param {string | Buffer | URL | number} path
     * @param {{
     *   bigint?: boolean;
     *   throwIfNoEntry?: boolean;
     *   }} [options]
     * @returns {Stats}
     */
    statSync(path, options = { bigint: false, throwIfNoEntry: true }) {
        /** @type {Entry} */
        var entry = typeof path == "number" ? this[_fd][path] : this[_fs_fn].getEntry(path);
        if(!entry){
            if(options.throwIfNoEntry ==false) return undefined;
            new FsError({path : typeof path == "number" ? `FD#${path}` : path ,syscall: "stat", error: "ENOENT", errno: -2}).throw;
        }
        var stats = {
            dev: options.bigint ? BigInt(0) : 0,
            nlink: options.bigint ? BigInt(0) : 0,
            uid: options.bigint ? BigInt(0) : 0,
            gid: options.bigint ? BigInt(0) : 0,
            rdev: options.bigint ? BigInt(0) : 0,
            blksize: options.bigint ? BigInt(0) : 0,
            ino: options.bigint ? BigInt(0) : 0,
            blocks: options.bigint ? BigInt(0) : 0,
            mode: options.bigint ? BigInt(entry.attr) : entry.attr,
            size: options.bigint ? BigInt(entry.getData().byteLength) : entry.getData().byteLength,
            atimeMs: options.bigint ? BigInt(entry.header.time.getTime()) : entry.header.time.getTime(),
            mtimeMs: options.bigint ? BigInt(entry.header.time.getTime()) : entry.header.time.getTime(),
            ctimeMs: options.bigint ? BigInt(entry.header.time.getTime()) : entry.header.time.getTime(),
            birthtimeMs: options.bigint ? BigInt(entry.header.time.getTime()) : entry.header.time.getTime(),
            atime: options.bigint ? BigInt(entry.header.time) : entry.header.time,
            mtime: options.bigint ? BigInt(entry.header.time) : entry.header.time,
            ctime: options.bigint ? BigInt(entry.header.time) : entry.header.time,
            birthtime: options.bigint ? BigInt(entry.header.time) : entry.header.time,
        };
        stats.isBlockDevice = ()=>false;
        stats.isCharacterDevice = ()=>false;
        stats.isDirectory = ()=>entry.isDirectory;
        stats.isFIFO = ()=>false;
        stats.isFile = ()=>!entry.isDirectory;
        stats.isSocket = ()=>false;
        stats.isSymbolicLink = ()=>false;
        Object.setPrototypeOf(stats, Stats); // stats is Stats object
        return stats;
    }
    /**
     * Asynchronously gets the stats of a file.
     * @param {string | Buffer | URL} path
     * @param {{ bigint?: boolean; }} [options]
     * @param {(
     *   err?: Error,
     *   stats?: Stats
     * ) => any} callback
     * @returns {void}
     **/
    stat(path, options = { bigint: false }, callback) {
        if (typeof options === 'function') {
            [callback, options] = [options, callback];
        }
        new Promise((ok)=>{
            ok(this.statSync(path, options));
        }).then(res=>callback(undefined,res)).catch(err=>callback(err));
    }

    /**
     * Synchronously retrieves the `fs.Stats` for
     * the symbolic link referred to by the `path`.
     * @param {string | Buffer | URL} path
     * @param {{
    *   bigint?: boolean;
    *   throwIfNoEntry?: boolean;
    *   }} [options]
    * @returns {Stats}
    */
    lstatSync(path, options = { bigint: false, throwIfNoEntry: true }) {
        return this.statSync(path, options);
    }
    /**
     * Retrieves the `fs.Stats` for the symbolic link
     * referred to by the `path`.
     * @param {string | Buffer | URL} path
     * @param {{ bigint?: boolean; }} [options]
     * @param {(
     *   err?: Error,
     *   stats?: Stats
     *   ) => any} callback
     * @returns {void}
     **/
    lstat(path, options = { bigint: false }, callback) {
        if (typeof options === 'function') {
            [callback, options] = [options, callback];
        }
        new Promise((ok)=>{
            ok(this.lstatSync(path, options));
        }).then(res=>callback(undefined,res)).catch(err=>callback(err));
    }

    /**
     * Synchronously retrieves the `fs.Stats` for
     * the file descriptor.
     * @param {number} fd
     * @param {{
     *   bigint?: boolean;
     *   }} [options]
     * @returns {Stats}
     */
    fstatSync(fd, options = { bigint: false }) {
        validateInteger(fd,"File descriptor", -2147483648, 2147483647);
        return this.statSync(fd, options);
    }

    /**
     * Invokes the callback with the `fs.Stats`
     * for the file descriptor.
     * @param {number} fd
     * @param {{ bigint?: boolean; }} [options]
     * @param {(
     *   err?: Error,
     *   stats?: Stats
     *   ) => any} callback
     * @returns {void}
     */
    fstat(fd, options = { bigint: false }, callback) {
        if (typeof options === 'function') {
            [callback, options] = [options, callback];
        }
        new Promise((ok)=>{
            ok(this.fstatSync(path, options));
        }).then(res=>callback(undefined,res)).catch(err=>callback(err));
    }
    /**
     * Creates a readable stream with a default `highWaterMark`
     * of 64 KiB.
     * @param {string | Buffer | URL} path
     * @param {string | {
    *   flags?: string;
    *   encoding?: string;
    *   fd?: number | FileHandle;
    *   mode?: number;
    *   autoClose?: boolean;
    *   emitClose?: boolean;
    *   start: number;
    *   end?: number;
    *   highWaterMark?: number;
    *   fs?: object | null;
    * }} [options]
    * @returns {ReadStream}
    */
    createReadStream(path, options) {
        if(typeof path == "object" && (options === null || options === undefined || typeof options == "string")){
            [path, options] = [options, path];
        }
        /** @type {Entry} */
        var item = options.fd ? this[_fd][options.fd] : this[_fs_fn].getEntry(path);
        if ((item && !item.isDirectory )) {
            const readable = new Readable()
            readable._read = () => {} // _read is required but you can noop it
            var position = Math.max(0, start ?? 0);
            end = Math.min(end ?? item.getData().length, item.getData().length);
            var length = options.highWaterMark ?? (64 * 1024);
            var read = ()=>{
                process.nextTick(()=>{
                    position = position + length;
                    if((position + length) < item.getData().length){
                        readable.push(item.getData().subarray(position,Math.min(item.getData().length, position + length) ))
                        read();
                    }else {
                        readable.push(null);
                        if((options.autoClose ?? true)){
                            readable.destroy();
                            if(options.emitClose){
                                readable.emit("close");
                            }
                        }
                    }
                })
            }
            process.nextTick(()=>{
                read(); // start to read buffer
                readable.emit("open");
            })
            return readable;    
        }else if (item && item.isDirectory){
            (new FsError({path,syscall: "open",error: "EISDIR",errno: 21})).throw;
        }if(!item){
            (new FsError({path:path,syscall: "rmDir",error: "ENOENT",errno: 2})).throw;
        }
   }

   /**
    * Creates a write stream.
    * @param {string | Buffer | URL} path
    * @param {string | {
    *   flags?: string;
    *   encoding?: string;
    *   fd?: number | FileHandle;
    *   mode?: number;
    *   autoClose?: boolean;
    *   emitClose?: boolean;
    *   start: number;
    *   fs?: object | null;
    *   }} [options]
    * @returns {WriteStream}
    */
   createWriteStream(path, options) {
        if(typeof path == "object" && (options === null || options === undefined || typeof options == "string")){
            [path, options] = [options, path];
        }
        /** @type {Entry} */
        var item = options.fd ? this[_fd][options.fd] : this[_fs_fn].getEntry(path);
        if ((item && !item.isDirectory )) {
            var position = Math.max(0, start ?? 0);
            const writable = new Writable({
                write: function(chunk, encoding, next) {
                    var written = item.writeData(chunk, {
                        position
                    });
                    position += written.length;
                    next();
                }
            });
            process.nextTick(()=>{
                writable.emit("open");
            })
            return writable;    
        }else if (item && item.isDirectory){
            (new FsError({path,syscall: "open",error: "EISDIR",errno: 21})).throw;
        }if(!item){
            (new FsError({path:path,syscall: "rmDir",error: "ENOENT",errno: 2})).throw;
        }
   }
    // [TODO] fs.statSync(path[, options])
    // [TODO] fs.statfsSync(path[, options])
    // [TODO] fs.symlinkSync(target, path[, type])
    // [TODO] fs.truncateSync(path[, len])
    // [TODO] fs.utimesSync(path, atime, mtime)    
    // [TODO] fs.readSync(fd, buffer, offset, length[, position])
    // [TODO] fs.readSync(fd, buffer[, options])
    // [TODO] fs.readvSync(fd, buffers[, position])
    // [TODO] fs.writeSync(fd, buffer, offset[, length[, position]])
    // [TODO] fs.writeSync(fd, buffer[, options])
    // [TODO] fs.writeSync(fd, string[, position[, encoding]])
    // [TODO] fs.writevSync(fd, buffers[, position])


    // [TODO] fs.fsyncSync(fd)
    // [TODO] fs.ftruncateSync(fd[, len])
    // [TODO] fs.futimesSync(fd, atime, mtime)
    // [TODO] fs.lchmodSync(path, mode)
    // [TODO] fs.lchownSync(path, uid, gid)
    // [TODO] fs.lutimesSync(path, atime, mtime)
    // [TODO] fs.linkSync(existingPath, newPath)


    // // async 
    // [TODO] fs.access(path[, mode], callback)
    // [TODO] fs.appendFile(path, data[, options], callback)
    // [TODO] fs.chmod(path, mode, callback)
    // File modes
    // [TODO] fs.chown(path, uid, gid, callback)
    // [TODO] fs.copyFile(src, dest[, mode], callback)
    // [TODO] fs.cp(src, dest[, options], callback)
    // [TODO] fs.createReadStream(path[, options])
    // [TODO] fs.createWriteStream(path[, options])
    // [TODO] fs.exists(path, callback)
    // [TODO] fs.fchmod(fd, mode, callback)
    // [TODO] fs.fchown(fd, uid, gid, callback)
    // [TODO] fs.fdatasync(fd, callback)
    // [TODO] fs.fstat(fd[, options], callback)
    // [TODO] fs.fsync(fd, callback)
    // [TODO] fs.ftruncate(fd[, len], callback)
    // [TODO] fs.futimes(fd, atime, mtime, callback)
    // [TODO] fs.lchmod(path, mode, callback)
    // [TODO] fs.lchown(path, uid, gid, callback)
    // [TODO] fs.lutimes(path, atime, mtime, callback)
    // [TODO] fs.link(existingPath, newPath, callback)
    // [TODO] fs.lstat(path[, options], callback)
    // [TODO] fs.mkdir(path[, options], callback)
    // [TODO] fs.mkdtemp(prefix[, options], callback)
    // [TODO] fs.open(path[, flags[, mode]], callback)
    // [TODO] fs.openAsBlob(path[, options])
    // [TODO] fs.opendir(path[, options], callback)
    // [TODO] fs.read(fd, buffer, offset, length, position, callback)
    // [TODO] fs.read(fd[, options], callback)
    // [TODO] fs.read(fd, buffer[, options], callback)
    // File descriptors
    // Performance Considerations
    // [TODO] fs.readlink(path[, options], callback)
    // [TODO] fs.readv(fd, buffers[, position], callback)
    // [TODO] fs.realpath(path[, options], callback)
    // [TODO] fs.realpath.native(path[, options], callback)
    // [TODO] fs.stat(path[, options], callback)
    // [TODO] fs.statfs(path[, options], callback)
    // [TODO] fs.symlink(target, path[, type], callback)
    // [TODO] fs.truncate(path[, len], callback)
    // [TODO] fs.unwatchFile(filename[, listener])
    // [TODO] fs.utimes(path, atime, mtime, callback)
    // [TODO] fs.watch(filename[, options][, listener])
    // [TODO] fs.watchFile(filename[, options], listener)
    // [TODO] fs.write(fd, buffer, offset[, length[, position]], callback)
    // [TODO] fs.write(fd, buffer[, options], callback)
    // [TODO] fs.write(fd, string[, position[, encoding]], callback)
    // [TODO] fs.writev(fd, buffers[, position], callback)
}
FsFake.constants = constants;
module.exports = FsFake;