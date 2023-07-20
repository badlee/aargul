/**
 * @enum {string}
 */
const RequesType = {
    EXPRESS : "EXPRESS",
    CONNECT : "CONNECT",
    KOA : "KOA",
    NEXT : "NEXT",
  };
 /**
 * @typedef Request 
 * @property {String} method - ;
 * @property {String} hostname - ;
 * @property {String} url - ;
 * @property {String} baseUrl - ;
 * @property {String} originalUrl - ;
 * @property {Object} body - ;
 * @property {String} method - ;
 * @property {String} ip - ;
 * @property {String} path - ;
 * @property {String} protocol - ;
 * @property {Object} query - ;
 * @property {Boolean} secure - ;
 * @property {Object} headers - ;
 * @property {Object} httpVersionMajor - ;
 * @property {Object} httpVersionMinor - ;
 * @property {Object} httpVersion - ;
 * @returns 
 */

 function hasBody(req) {
    const encoding = ('transfer-encoding' in req.headers);
    const length = (
      'content-length' in req.headers && req.headers['content-length'] !== '0'
    );
    return (encoding || length);
}
function mime(req) {
    const str = (req.headers['content-type'] || '');
    return str.split(';')[0];
}

/**
 * @param {RequesType} type 
 * @param  {...any} args 
 * @returns {Promise<[Request,import("net").Socket, NextFunction]>}
*/
async function requestHandler(type, ...args){
    switch(type){
        case RequesType.CONNECT:
        case RequesType.EXPRESS:
            var req = args[0];
            // var res = args[1];
            var next = args[2];
            // req.rawBody = req.rawBody ?? (req._body ?  req.body : "");
            // var w;
            // var wait = new Promise(ok=>w = ok)
            // req.setEncoding('utf8');
            // console.log("DEDE", req.rawBody?.toString())
            // if(
            //     !(req._body && req.busboy) && !(
            //         req.method === 'GET'
            //         || req.method === 'HEAD'
            //         || !hasBody(req)
            //     )
            // ){
            //     req.on('data', function(chunk) { 
            //         req.rawBody += chunk;
            //     });
            //     req.on('end', function(chunk) { 
            //         w();
            //     });
            //     await wait;
            // }
            const protocol = req.protocol;
            const host = req.hostname;
            const url = req.originalUrl;
            const port = req.socket.localPort == (req.secure ? 443 : 80) ? "" : `:${req.socket.localPort}`;
            req.fullUrl = `${protocol}://${host}${port}${url}`;
            req.socket.on("error",err=>{
                console.log("ERROR...",err);
                next(err);
            });
            return [{
                method: req.method,
                headers: req.headers,
                path: req.path,
                httpVersionMajor: req.httpVersionMajor,
                httpVersionMinor: req.httpVersionMinor,
                query: req.query,
                body : req.rawBody, // must be raw
                baseUrl : req.baseUrl,
                url : req.fullUrl,
                originalUrl : req.originalUrl,
                ip : req.ip,
                port : req.socket.localPort,
                protocol : req.protocol,
                secure : req.secure, // req.protocol === 'https',
                hostname : req.hostname,
                httpVersion : req.httpVersion
            },req.socket,next];
            break;
        case RequesType.KOA:
            break;
        case RequesType.NEXT:
            break;
    }
    return []
}
requestHandler.RequesType = RequesType;
module.exports = requestHandler;