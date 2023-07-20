var crypto = require('crypto'),
    algorithm = 'aes-256-ctr';
const pth = require("path");
const vm = require("node:vm");
const { existsSync, readFileSync } = require('fs');

module.exports = require("./utils");
module.exports.Constants = require("./constants");
module.exports.Errors = require("./errors");
module.exports.FileAttr = require("./fattr");
module.exports.encrypt = encrypt;
module.exports.decrypt = decrypt;
module.exports.getByteCode = getByteCode;
module.exports.getByteScript = getByteScript;
module.exports.getHashes = getHashes;
module.exports.encodeBase64FileName = encodeBase64FileName;
module.exports.decodeBase64FileName = decodeBase64FileName;
module.exports.extendSwigEnv = extendSwigEnv;


function encrypt (chunk, password) {

	var cipher,
	    key,
	    iv;

	// Create an iv
	iv = crypto.randomBytes(16);

	// Create a new cipher
    key = crypto.scryptSync(password, 'AarGul', 32);
	cipher = crypto.createCipheriv(algorithm, key, iv);
	// Create the new chunk
	return Buffer.concat([iv, cipher.update(chunk), cipher.final()]);

}
function decrypt (chunk, password) {

	var decipher,
	    key,
	    iv;

	// Get the iv: the first 16 bytes
	iv = chunk.slice(0, 16);

	// Get the rest
	chunk = chunk.slice(16);

	// Create a decipher
    key  = crypto.scryptSync(password, 'AarGul', 32);
	decipher = crypto.createDecipheriv(algorithm, key, iv);

	// Actually decrypt it
	return Buffer.concat([decipher.update(chunk), decipher.final()]);

}
function getByteCode (filename,handler, encodeFunction, entryName){
    var hasEncodeFunction = typeof encodeFunction  == "function"  ;
    var forceEncode = hasEncodeFunction  ? (c)=>encodeFunction(c.toString("utf-8"), filename,entryName) : c=>c;
    encodeFunction = hasEncodeFunction ? encodeFunction : (str)=>`module.exports = ${str}`;
    let content = (typeof handler == "function" ? 
        encodeFunction(handler.toString(),filename,entryName) : forceEncode(
            Buffer.isBuffer(handler) ?  
                handler : (
                    existsSync(handler) ? 
                        readFileSync(handler) : 
                        handler
                )
            )
    );
    if(hasEncodeFunction && !content) return null;
    const script = new vm.Script(content.toString("utf-8"),{
        filename,
        produceCachedData: true
    });
    return (script.createCachedData && typeof script.createCachedData.call == "function")
        ? script.createCachedData()
        : script.cachedData;
}
function fixBytecode(bytecodeBuffer) {
    if (!Buffer.isBuffer(bytecodeBuffer)) {
      throw new Error('bytecodeBuffer must be a buffer object.');
    }
  
    const dummyBytecode = getByteCode("dummyBytecode",'"ಠ_ಠ"');
    const version = parseFloat(process.version.slice(1, 5));
  
    if (process.version.startsWith('v8.8') || process.version.startsWith('v8.9')) {
      // Node is v8.8.x or v8.9.x
      dummyBytecode?.subarray(16, 20).copy(bytecodeBuffer, 16);
      dummyBytecode?.subarray(20, 24).copy(bytecodeBuffer, 20);
    } else if (version >= 12 && version <= 20) {
      dummyBytecode?.subarray(12, 16).copy(bytecodeBuffer, 12);
    } else {
      dummyBytecode?.subarray(12, 16).copy(bytecodeBuffer, 12);
      dummyBytecode?.subarray(16, 20).copy(bytecodeBuffer, 16);
    }
};
function readSourceHash(bytecodeBuffer) {
    if (!Buffer.isBuffer(bytecodeBuffer)) {
      throw new Error('bytecodeBuffer must be a buffer object.');
    }
  
    if (process.version.startsWith('v8.8') || process.version.startsWith('v8.9')) {
      // Node is v8.8.x or v8.9.x
      // eslint-disable-next-line no-return-assign
      return bytecodeBuffer.subarray(12, 16).reduce((sum, number, power) => sum += number * Math.pow(256, power), 0);
    } else {
      // eslint-disable-next-line no-return-assign
      return bytecodeBuffer.subarray(8, 12).reduce((sum, number, power) => sum += number * Math.pow(256, power), 0);
    }
};
function getByteScript (filename,bytecodeBuffer){
    if (!Buffer.isBuffer(bytecodeBuffer)) {
        throw new TypeError('bytecodeBuffer must be a buffer object.');
      }
    
      fixBytecode(bytecodeBuffer);
    
      let length = readSourceHash(bytecodeBuffer);
      try {
        let dummyCode = '';
    
        if (length > 1) {
          dummyCode = '"' + '\u200b'.repeat(length - 2) + '"'; // "\u200b" Zero width space
        }
      
        const script = new vm.Script(dummyCode, {
          cachedData: bytecodeBuffer,
          filename
        });
      
        if (script.cachedDataRejected) {
          throw new Error('Invalid or incompatible byte code');
        }
      
        return script;
      } catch (error) {
        throw new Error('Rejected bytecode');
      }

}
function getHashes (content){
    var hash = crypto.createHash("sha1");
    return hash.update(content, 'utf-8').digest();
}
function encodeBase64FileName (filename){
     filename = typeof filename == "string" ? Buffer.from(filename) : filename;
     return (Buffer.isBuffer(filename) ? filename : Buffer.from(filename.toString())).toString("base64").replace(/\+/g, "_").replace(/\//g, "-");
}
function decodeBase64FileName (filename){
    var start = "";
    if(/^\/hash\//.test(`${filename}`)){
        start = "/hash/";
        filename =  filename.replace(/^\/hash\//, "");
    } 
    return start + Buffer.from(`${filename}`, "base64").toString('utf-8').replace(/_/g, "+").replace(/-/g, "/");
}
function extendSwigEnv (swig,name, code){
    var tName = pth.basename(name).replace(/\.(tag|filter)\.js$/,"");
    var constants = {
        "LEVEL_ROOT": true,
        "LEVEL_BLOCK" : false,
        "BLOCK" : true,
        "NOT_BLOCK" : false,
        "AUTO_ESCAPE" : false,
        "RAW_STRING" : true,
    };
    var ctx = {
        name : tName,
        isBlock : constants.BLOCK,
        isSafe : constants.AUTO_ESCAPE,
        blockLevel : constants.LEVEL_BLOCK,
        compile(compiler, args, content, parents, options, blockName) {
            return '';
        },
        parse(str, line, parser, types, options, swig) {
        },
        run(data,...args){
            return "";
        }   
    };
    var m = {exports : ctx}
    var c = {
        module : m,
        exports : m.exports,
        ...constants
    };
    if(code instanceof vm.Script)
        code.runInNewContext(c, {filename: name})
    else
        vm.runInNewContext(code, c, {filename: name});
    if(/\.filter\.js$/.test(name)){
        // @ts-ignore
        ctx.run.safe = ctx.isSafe;
        swig.setFilter(ctx.name,ctx.run);
    }else {
        swig.setTag(ctx.name, ctx.parse, ctx.compile, ctx.isBlock, ctx.blockLevel)
        if(ctx.ext){
            swig.setExtension(ctx.name, ctx.ext);
        }
    }
}