const Utils = require("./");
const pth = require("path");
const fs = require("fs");
const Entry = require("./entry");
const archiveFile = require("./archive");

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
 * @property {(entryName: string, content: Buffer | string | null, comment?: string | undefined, attr?: number | any) => void} addFile
 * @property {() => Array.<Entry>} getEntries
 * @property {(name: any) => Entry|null} getEntry
 * @property {() => number} getEntryCount
 * @property {(callback: any) => any} forEach
 * @property {(entry: any, targetPath: any, maintainEntryPath: any, overwrite: any, keepOriginalPermission: any, outFileName: any) => boolean} extractEntryTo
 * @property {(pass: any) => boolean} test
 * @property {(targetPath: any, overwrite: any, keepOriginalPermission: any, pass: any) => void} extractAllTo
 * @property {(targetPath: any, overwrite: any, keepOriginalPermission: any, callback: any) => void} extractAllToAsync
 * @property {(targetFileName: any, callback?: any, ...args: any[]) => void} writeFile
 * @property {(targetFileName: any, props?: any) => Promise<any>} writeFilePromise
 * @property {(targetFileName: any, props: any, callback: any) => void | Promise<any>} save
 * @property {() => Promise<any>} toBufferPromise
 * @property {typeof toBuffer} toBuffer
 * @property {typeof toBuffer} toBuffer
 * */



const get_Bool = (val, def) => (typeof val === "boolean" ? val : def);
const get_Str = (val, def) => (typeof val === "string" ? val : def);

const defaultOptions = {
    // option "noSort" : if true it disables files sorting
    noSort: false,
    // read entries during load (initial loading may be slower)
    readEntries: false,
    // default method is none
    method: Utils.Constants.NONE,
    // file system
    fs: null
};
/**
 * 
 * @param {String} [input] - path file name
 * @param {Object} [options]
 * @param {Boolean} [options.noSort]
 * @param {Boolean} [options.readEntries]
 * @param {Number} [options.method]
 * @param {Number| null} [options.fs]
 * @returns  {AargulArchive} AargulArchive Instance
 */
function AargulArchive (/**String*/ input, /** object */ options) {
    let inBuffer = null;
    // create object based default options, allowing them to be overwritten
    const opts = Object.assign(Object.create(null), defaultOptions);

    // test input variable
    if (input && "object" === typeof input) {
        // if value is not buffer we accept it to be object with options
        // @ts-ignore
        if (!(input instanceof Uint8Array)) {
            Object.assign(opts, input);
            input = opts.input ? opts.input : undefined;
            if (opts.input) delete opts.input;
        }

        // if input is buffer
        if (Buffer.isBuffer(input)) {
            inBuffer = input;
            opts.method = Utils.Constants.BUFFER;
            input = undefined;
        }
    }

    // assign options
    Object.assign(opts, options);

    // instanciate utils filesystem
    const filetools = new Utils(opts);
    // if input is file name we retrieve its content
    if (input && "string" === typeof input) {
        // load file
        if (filetools.fs.existsSync(input) && filetools.fs.statSync(input).isFile()) {
            opts.method = Utils.Constants.FILE;
            opts.filename = input;
            inBuffer = filetools.fs.readFileSync(input);
        } else {
            throw new Error(Utils.Errors.INVALID_FILENAME);
        }
    }

    // create variable
    // @ts-ignore
    const _archive = new archiveFile(inBuffer, opts);

    const { canonical, sanitize } = Utils;

    function getEntry(/**Object*/ entry) {
        if (entry && _archive) {
            var item;
            // If entry was given as a file name
            if (typeof entry === "string") item = _archive.getEntry(entry);
            // if entry was given as a Entry object
            if (typeof entry === "object" && typeof entry.entryName !== "undefined" && typeof entry.header !== "undefined") item = _archive.getEntry(entry.entryName);

            if (item) {
                return item;
            }
        }
        return null;
    }

    function fixPath(archivePath) {
        const { join, normalize, sep } = pth.posix;
        // convert windows file separators and normalize
        return join(".", normalize(sep + archivePath.split("\\").join(sep) + sep));
    }
    var _stats = Utils.Constants.FILE == opts.method ? filetools.fs.statSync(opts.filename) : null;
    // @ts-ignore
    var a = {
        filename : Utils.Constants.FILE == opts.method ? opts.filename : null,
        /** @type {import('fs').Stats | null} */
        stats : _stats,
        /**
         * Synchronously tests a user's permissions for the file or directory specified by path. 
         * The mode argument is an optional integer that specifies the accessibility checks to be performed. 
         * 
         * @param {number} [mode] mode should be either the value fs.constants.F_OK or a mask consisting of the bitwise OR of any of 
         *      - fs.constants.R_OK
         *      - fs.constants.W_OK
         *      - fs.constants.X_OK 
         *
         * @return {boolean} True if access is allowed
         */
        access: (mode)=>{
            try{
                if(Utils.Constants.FILE == opts.method){
                    filetools.fs.accessSync(opts.filename,mode);
                    return true;
                }
                throw "NOT A FILE";
            }catch(e){
                return false
            }
        },
        /**
         * Extracts the given entry from the archive and returns the content as a Buffer object
         * @param entry Entry object or String with the full path of the entry
         *
         * @return Buffer or Null in case of error
         */
        readFile: function (/**Object*/ entry, /*String, Buffer*/ pass) {
            var item = getEntry(entry);
            return (item && item.getData(pass)) || null;
        },

        /**
         * Asynchronous readFile
         * @param entry Entry object or String with the full path of the entry
         * @param callback
         *
         * @return Buffer or Null in case of error
         */
        readFileAsync: function (/**Object*/ entry, /**Function*/ callback) {
            var item = getEntry(entry);
            if (item) {
                item.getDataAsync(callback);
            } else {
                callback(null, "getEntry failed for:" + entry);
            }
        },

        /**
         * Extracts the given entry from the archive and returns the content as plain text in the given encoding
         * @param entry Entry object or String with the full path of the entry
         * @param encoding Optional. If no encoding is specified utf8 is used
         *
         * @return String
         */
        readAsText: function (/**Object*/ entry, /**String=*/ encoding) {
            var item = getEntry(entry);
            if (item) {
                var data = item.getData();
                if (data && data.length) {
                    return data.toString(encoding || "utf8");
                }
            }
            return "";
        },

        /**
         * Asynchronous readAsText
         * @param entry Entry object or String with the full path of the entry
         * @param callback
         * @param encoding Optional. If no encoding is specified utf8 is used
         *
         * @return String
         */
        readAsTextAsync: function (/**Object*/ entry, /**Function*/ callback, /**String=*/ encoding) {
            var item = getEntry(entry);
            if (item) {
                item.getDataAsync(function (data, err) {
                    if (err) {
                        callback(data, err);
                        return;
                    }

                    if (data && data.length) {
                        callback(data.toString(encoding || "utf8"));
                    } else {
                        callback("");
                    }
                });
            } else {
                callback("");
            }
        },

        /**
         * Remove the entry from the file or the entry and all it's nested directories and files if the given entry is a directory
         *
         * @param entry
         */
        deleteFile: function (/**Object*/ entry) {
            // @TODO: test deleteFile
            var item = getEntry(entry);
            if (item) {
                _archive.deleteEntry(item.entryName);
            }
        },

        /**
         * Adds a comment to the zip. The zip must be rewritten after adding the comment.
         *
         * @param comment
         */
        addZipComment: function (/**String*/ comment) {
            // @TODO: test addZipComment
            _archive.comment = comment;
        },

        /**
         * Returns the zip comment
         *
         * @return String
         */
        getZipComment: function () {
            return _archive.comment || "";
        },

        /**
         * Adds a comment to a specified zipEntry. The zip must be rewritten after adding the comment
         * The comment cannot exceed 65535 characters in length
         *
         * @param entry
         * @param comment
         */
        addEntryComment: function (/**Object*/ entry, /**String*/ comment) {
            var item = getEntry(entry);
            if (item) {
                item.comment = comment;
            }
        },

        /**
         * Returns the comment of the specified entry
         *
         * @param entry
         * @return String
         */
        getEntryComment: function (/**Object*/ entry) {
            var item = getEntry(entry);
            if (item) {
                return item.comment || "";
            }
            return "";
        },

        /**
         * Updates the content of an existing entry inside the archive. The zip must be rewritten after updating the content
         *
         * @param entry
         * @param content
         */
        updateFile: function (/**Object*/ entry, /**Buffer*/ content) {
            var item = getEntry(entry);
            if (item) {
                item.setData(content);
            }
        },

        /**
         * Adds a file from the disk to the archive
         *
         * @param localPath File to add to zip
         * @param archivePath Optional path inside the zip
         * @param zipName Optional name for the file
         */
        addLocalFile: function (/**String*/ localPath, /**String=*/ archivePath, /**String=*/ zipName, /**String*/ comment) {
            if (filetools.fs.existsSync(localPath)) {
                // fix ZipPath
                archivePath = archivePath ? fixPath(archivePath) : "";

                // p - local file name
                var p = localPath.split("\\").join("/").split("/").pop();

                // add file name into zippath
                archivePath += zipName ? zipName : p;

                // read file attributes
                const _attr = filetools.fs.statSync(localPath);

                // add file into file
                this.addFile(archivePath, filetools.fs.readFileSync(localPath), comment, _attr);
            } else {
                throw new Error(Utils.Errors.FILE_NOT_FOUND.replace("%s", localPath));
            }
        },

        /**
         * Adds a local directory and all its nested files and directories to the archive
         *
         * @param localPath
         * @param archivePath optional path inside zip
         * @param filter optional RegExp or Function if files match will
         *               be included.
         * @param {Number | Object} attr - number as unix file permissions, object as filesystem Stats object
         */
        addLocalFolder: function (/**String*/ localPath, /**String=*/ archivePath, /**=RegExp|Function*/ filter, /**=number|object*/ attr) {
            // Prepare filter
            if (filter instanceof RegExp) {
                // if filter is RegExp wrap it
                filter = (function (rx) {
                    return function (filename) {
                        return rx.test(filename);
                    };
                })(filter);
            } else if ("function" !== typeof filter) {
                // if filter is not function we will replace it
                filter = function () {
                    return true;
                };
            }

            // fix ZipPath
            archivePath = archivePath ? fixPath(archivePath) : "";

            // normalize the path first
            localPath = pth.normalize(localPath);

            if (filetools.fs.existsSync(localPath)) {
                const items = filetools.findFiles(localPath);
                const self = this;

                if (items.length) {
                    items.forEach(function (filepath) {
                        var p = pth.relative(localPath, filepath).split("\\").join("/"); //windows fix
                        if (filter(p)) {
                            var stats = filetools.fs.statSync(filepath);
                            if (stats.isFile()) {
                                self.addFile(archivePath + p, filetools.fs.readFileSync(filepath), "", attr ? attr : stats);
                            } else {
                                self.addFile(archivePath + p + "/", Buffer.alloc(0), "", attr ? attr : stats);
                            }
                        }
                    });
                }
            } else {
                throw new Error(Utils.Errors.FILE_NOT_FOUND.replace("%s", localPath));
            }
        },

        /**
         * Asynchronous addLocalFile
         * @param localPath
         * @param callback
         * @param archivePath optional path inside zip
         * @param filter optional RegExp or Function if files match will
         *               be included.
         */
        addLocalFolderAsync: function (/*String*/ localPath, /*Function*/ callback, /*String*/ archivePath, /*RegExp|Function*/ filter) {
            if (filter instanceof RegExp) {
                filter = (function (rx) {
                    return function (filename) {
                        return rx.test(filename);
                    };
                })(filter);
            } else if ("function" !== typeof filter) {
                filter = function () {
                    return true;
                };
            }

            // fix ZipPath
            archivePath = archivePath ? fixPath(archivePath) : "";

            // normalize the path first
            localPath = pth.normalize(localPath);

            var self = this;
            filetools.fs.open(localPath, "r", function (err) {
                if (err && err.code === "ENOENT") {
                    callback(undefined, Utils.Errors.FILE_NOT_FOUND.replace("%s", localPath));
                } else if (err) {
                    callback(undefined, err);
                } else {
                    var items = filetools.findFiles(localPath);
                    var i = -1;

                    var next = function () {
                        i += 1;
                        if (i < items.length) {
                            var filepath = items[i];
                            var p = pth.relative(localPath, filepath).split("\\").join("/"); //windows fix
                            p = p
                                .normalize("NFD")
                                .replace(/[\u0300-\u036f]/g, "")
                                .replace(/[^\x20-\x7E]/g, ""); // accent fix
                            if (filter(p)) {
                                filetools.fs.stat(filepath, function (er0, stats) {
                                    if (er0) callback(undefined, er0);
                                    if (stats.isFile()) {
                                        filetools.fs.readFile(filepath, function (er1, data) {
                                            if (er1) {
                                                callback(undefined, er1);
                                            } else {
                                                self.addFile(archivePath + p, data, "", stats);
                                                next();
                                            }
                                        });
                                    } else {
                                        self.addFile(archivePath + p + "/", Buffer.alloc(0), "", stats);
                                        next();
                                    }
                                });
                            } else {
                                process.nextTick(() => {
                                    next();
                                });
                            }
                        } else {
                            callback(true, undefined);
                        }
                    };

                    next();
                }
            });
        },

        /**
         *
         * @param {String} localPath - path where files will be extracted
         * @param {Object} props - optional properties
         * @param {String} props.archivePath - optional path inside zip
         * @param {RegExp | function} props.filter - RegExp or Function if files match will be included.
         */
        addLocalFolderPromise: function (/*String*/ localPath, /* object */ props) {
            return new Promise((resolve, reject) => {
                // @ts-ignore
                const { filter, archivePath } = Object.assign({}, props);
                this.addLocalFolderAsync(
                    localPath,
                    (done, err) => {
                        if (err) reject(err);
                        if (done) resolve(this);
                    },
                    archivePath,
                    filter
                );
            });
        },

        /**
         * Allows you to create a entry (file or directory) in the file.
         * If you want to create a directory the entryName must end in / and a null buffer should be provided.
         * Comment and attributes are optional
         *
         * @param {String} entryName
         * @param {Buffer | String} content - file content as buffer or utf8 coded string
         * @param {String} [comment] - file comment
         * @param {Number | Object} [attr] - number as unix file permissions, object as filesystem Stats object
         */
        addFile: function (/**String*/ entryName, /**Buffer*/ content, /**String*/ comment, /**Number*/ attr) {
            let entry = getEntry(entryName);
            const update = entry != null;

            // prepare new entry
            if (!update) {
                // @ts-ignore
                entry = new Entry();
                entry.entryName = entryName;
            }
            entry.comment = comment || "";

            const isStat = "object" === typeof attr && attr instanceof filetools.fs.Stats;

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
            if (!update) _archive.setEntry(entry);
        },

        /**
         * Returns an array of Entry objects representing the files and folders inside the archive
         *
         * @return Array
         */
        getEntries: function () {
            return _archive ? _archive.entries : [];
        },

        /**
         * Returns a Entry object representing the file or folder specified by ``name``.
         *
         * @param name
         * @return Entry
         */
        getEntry: function (/**String*/ name) {
            return getEntry(name);
        },

        getEntryCount: function () {
            return _archive.getEntryCount();
        },

        forEach: function (callback) {
            return _archive.forEach(callback);
        },

        /**
         * Extracts the given entry to the given targetPath
         * If the entry is a directory inside the archive, the entire directory and it's subdirectories will be extracted
         *
         * @param entry Entry object or String with the full path of the entry
         * @param targetPath Target folder where to write the file
         * @param maintainEntryPath If maintainEntryPath is true and the entry is inside a folder, the entry folder
         *                          will be created in targetPath as well. Default is TRUE
         * @param overwrite If the file already exists at the target path, the file will be overwriten if this is true.
         *                  Default is FALSE
         * @param keepOriginalPermission The file will be set as the permission from the entry if this is true.
         *                  Default is FALSE
         * @param outFileName String If set will override the filename of the extracted file (Only works if the entry is a file)
         *
         * @return Boolean
         */
        extractEntryTo: function (
            /**Object*/ entry,
            /**String*/ targetPath,
            /**Boolean*/ maintainEntryPath,
            /**Boolean*/ overwrite,
            /**Boolean*/ keepOriginalPermission,
            /**String**/ outFileName
        ) {
            overwrite = get_Bool(overwrite, false);
            keepOriginalPermission = get_Bool(keepOriginalPermission, false);
            maintainEntryPath = get_Bool(maintainEntryPath, true);
            outFileName = get_Str(outFileName, get_Str(keepOriginalPermission, undefined));

            var item = getEntry(entry);
            if (!item) {
                throw new Error(Utils.Errors.NO_ENTRY);
            }

            var entryName = canonical(item.entryName);

            var target = sanitize(targetPath, outFileName && !item.isDirectory ? outFileName : maintainEntryPath ? entryName : pth.basename(entryName));

            if (item.isDirectory) {
                var children = _archive.getEntryChildren(item);
                children.forEach(function (child) {
                    if (child.isDirectory) return;
                    var content = child.getData();
                    if (!content) {
                        throw new Error(Utils.Errors.CANT_EXTRACT_FILE);
                    }
                    var name = canonical(child.entryName);
                    var childName = sanitize(targetPath, maintainEntryPath ? name : pth.basename(name));
                    // The reverse operation for attr depend on method addFile()
                    const fileAttr = keepOriginalPermission ? child.header.fileAttr : undefined;
                    filetools.writeFileTo(childName, content, overwrite, fileAttr);
                });
                return true;
            }

            var content = item.getData();
            if (!content) throw new Error(Utils.Errors.CANT_EXTRACT_FILE);

            if (filetools.fs.existsSync(target) && !overwrite) {
                throw new Error(Utils.Errors.CANT_OVERRIDE);
            }
            // The reverse operation for attr depend on method addFile()
            const fileAttr = keepOriginalPermission ? entry.header.fileAttr : undefined;
            filetools.writeFileTo(target, content, overwrite, fileAttr);

            return true;
        },

        /**
         * Test the archive
         *
         */
        test: function (pass) {
            if (!_archive) {
                return false;
            }

            for (var entry in _archive.entries) {
                try {
                    // @ts-ignore
                    if (entry.isDirectory) {
                        continue;
                    }
                    var content = _archive.entries[entry].getData(pass);
                    if (!content) {
                        return false;
                    }
                } catch (err) {
                    return false;
                }
            }
            return true;
        },

        /**
         * Extracts the entire archive to the given location
         *
         * @param targetPath Target location
         * @param overwrite If the file already exists at the target path, the file will be overwriten if this is true.
         *                  Default is FALSE
         * @param keepOriginalPermission The file will be set as the permission from the entry if this is true.
         *                  Default is FALSE
         */
        extractAllTo: function (/**String*/ targetPath, /**Boolean*/ overwrite, /**Boolean*/ keepOriginalPermission, /*String, Buffer*/ pass) {
            overwrite = get_Bool(overwrite, false);
            pass = get_Str(keepOriginalPermission, pass);
            keepOriginalPermission = get_Bool(keepOriginalPermission, false);
            if (!_archive) {
                throw new Error(Utils.Errors.NO_ZIP);
            }
            _archive.entries.forEach(function (entry) {
                var entryName = sanitize(targetPath, canonical(entry.entryName.toString()));
                if (entry.isDirectory) {
                    filetools.makeDir(entryName);
                    return;
                }
                var content = entry.getData(pass);
                if (!content) {
                    throw new Error(Utils.Errors.CANT_EXTRACT_FILE);
                }
                // The reverse operation for attr depend on method addFile()
                const fileAttr = keepOriginalPermission ? entry.header.fileAttr : undefined;
                filetools.writeFileTo(entryName, content, overwrite, fileAttr);
                try {
                    filetools.fs.utimesSync(entryName, entry.header.time, entry.header.time);
                } catch (err) {
                    throw new Error(Utils.Errors.CANT_EXTRACT_FILE);
                }
            });
        },

        /**
         * Asynchronous extractAllTo
         *
         * @param targetPath Target location
         * @param overwrite If the file already exists at the target path, the file will be overwriten if this is true.
         *                  Default is FALSE
         * @param keepOriginalPermission The file will be set as the permission from the entry if this is true.
         *                  Default is FALSE
         * @param callback The callback will be executed when all entries are extracted successfully or any error is thrown.
         */
        extractAllToAsync: function (/**String*/ targetPath, /**Boolean*/ overwrite, /**Boolean*/ keepOriginalPermission, /**Function*/ callback) {
            overwrite = get_Bool(overwrite, false);
            if (typeof keepOriginalPermission === "function" && !callback) callback = keepOriginalPermission;
            keepOriginalPermission = get_Bool(keepOriginalPermission, false);
            if (!callback) {
                callback = function (err) {
                    throw new Error(err);
                };
            }
            if (!_archive) {
                callback(new Error(Utils.Errors.NO_ZIP));
                return;
            }

            targetPath = pth.resolve(targetPath);
            // convert entryName to
            const getPath = (entry) => sanitize(targetPath, pth.normalize(canonical(entry.entryName.toString())));
            const getError = (msg, file) => new Error(msg + ': "' + file + '"');

            // separate directories from files
            const dirEntries = [];
            const fileEntries = new Set();
            _archive.entries.forEach((e) => {
                if (e.isDirectory) {
                    dirEntries.push(e);
                } else {
                    fileEntries.add(e);
                }
            });

            // Create directory entries first synchronously
            // this prevents race condition and assures folders are there before writing files
            for (const entry of dirEntries) {
                const dirPath = getPath(entry);
                // The reverse operation for attr depend on method addFile()
                const dirAttr = keepOriginalPermission ? entry.header.fileAttr : undefined;
                try {
                    filetools.makeDir(dirPath);
                    if (dirAttr) filetools.fs.chmodSync(dirPath, dirAttr);
                    // in unix timestamp will change if files are later added to folder, but still
                    filetools.fs.utimesSync(dirPath, entry.header.time, entry.header.time);
                } catch (er) {
                    callback(getError("Unable to create folder", dirPath));
                }
            }

            // callback wrapper, for some house keeping
            const done = () => {
                if (fileEntries.size === 0) {
                    callback();
                }
            };

            // Extract file entries asynchronously
            for (const entry of fileEntries.values()) {
                const entryName = pth.normalize(canonical(entry.entryName.toString()));
                const filePath = sanitize(targetPath, entryName);
                entry.getDataAsync(function (content, err_1) {
                    if (err_1) {
                        callback(new Error(err_1));
                        return;
                    }
                    if (!content) {
                        callback(new Error(Utils.Errors.CANT_EXTRACT_FILE));
                    } else {
                        // The reverse operation for attr depend on method addFile()
                        const fileAttr = keepOriginalPermission ? entry.header.fileAttr : undefined;
                        filetools.writeFileToAsync(filePath, content, overwrite, fileAttr, function (succ) {
                            if (!succ) {
                                callback(getError("Unable to write file", filePath));
                                return;
                            }
                            filetools.fs.utimes(filePath, entry.header.time, entry.header.time, function (err_2) {
                                if (err_2) {
                                    callback(getError("Unable to set times", filePath));
                                    return;
                                }
                                fileEntries.delete(entry);
                                // call the callback if it was last entry
                                done();
                            });
                        });
                    }
                });
            }
            // call the callback if fileEntries was empty
            done();
        },
        save: function (/**String*/ targetFileName, /* object */props, /**Function*/ callback) {
            if(typeof props == "function"){
                [props, callback] = [callback, props]
            }
            if(callback)
                return this.writeFile(targetFileName, props, callback);
            return this.writeFilePromise(targetFileName, props);
        },

        /**
         * Writes the newly created file to disk at the specified location or if a zip was opened and no ``targetFileName`` is provided, it will overwrite the opened zip
         *
         * @param targetFileName
         * @param [callback]
         */
        writeFile: function (/**String*/ targetFileName, /* object */props, /**Function*/ callback) {
            if(typeof props == "function"){
                [props, callback] = [callback, props]
            }
            const { overwrite, perm } = Object.assign({ overwrite: true }, props?? {});
            if (arguments.length === 1) {
                if (typeof targetFileName === "function") {
                    callback = targetFileName;
                    targetFileName = "";
                }
            }

            if (!targetFileName && opts.filename) {
                targetFileName = opts.filename;
            }
            if (!targetFileName) return;

            var zipData = _archive.compressToBuffer();
            if (zipData) {
                var ok = filetools.writeFileTo(targetFileName, zipData, overwrite, perm );
                if (typeof callback === "function") callback(!ok ? new Error(`AARGUL: Wasn't able to write ${targetFileName}`) : null, "");
            }
        },

        writeFilePromise: function (/**String*/ targetFileName, /* object */ props) {
            const { overwrite, perm } = Object.assign({ overwrite: true }, props ?? {} );

            return new Promise((resolve, reject) => {
                // find file name
                if (!targetFileName && opts.filename) targetFileName = opts.filename;
                if (!targetFileName) reject("AARGUL: File Name Missing");

                this.toBufferPromise().then((zipData) => {
                    const ret = (done) => (done ? resolve(done) : reject(`AARGUL: Wasn't able to write ${targetFileName}`));
                    filetools.writeFileToAsync(targetFileName, zipData, overwrite, perm, ret);
                }, reject);
            });
        },

        toBufferPromise: function () {
            return new Promise((resolve, reject) => {
                _archive.toAsyncBuffer(resolve, reject);
            });
        },

        /**
         * Returns the content of the entire file as a Buffer object
         *
         * @return Buffer
         */
        toBuffer: function (/**Function=*/ onSuccess, /**Function=*/ onFail, /**Function=*/ onItemStart, /**Function=*/ onItemEnd) {
            // @ts-ignore
            this.valueOf = 2;
            if (typeof onSuccess === "function") {
                _archive.toAsyncBuffer(onSuccess, onFail, onItemStart, onItemEnd);
                return null;
            }
            return _archive.compressToBuffer();
        }
    };
    return a;
};

module.exports = AargulArchive;