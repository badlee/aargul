// ===========================================================================
//  Signal Controller
// ===========================================================================
"use strict"
   
// ===========================================================================
//  External Dependencies
// ===========================================================================

const qs = require('../util/querystrings')
const mime = require('../util/mimetype');
const EventEmitter = require('../util/EventEmitter');
const { waiter } = require('../util');
const { render } = require('../util/preact-to-string');
const { isValidElement } = require('../util/preact');

// ===========================================================================
//  Dependencies
// ===========================================================================

    const fs = require('fs')
    const url = require('url')
    const Path = require('path')
    const status_codes = require('http').STATUS_CODES;
    const utils = require('./utils');
	const bodyparser = require('./bodyparser');
	const { Readable } = require('stream');

// ===========================================================================
//  Exports
// ===========================================================================
    module.exports = function(request, response, app, location, callback){

        // ---------------------------------------------------------------------
        //  signal
        // ---------------------------------------------------------------------
    	let _events = new EventEmitter();
		let preactToString =(b)=> isValidElement(b) ?  render(b,{}, {pretty : true}) : b;
        let signal = {
            httpVersionMajor: request.httpVersionMajor,
            httpVersionMinor: request.httpVersionMinor,
    		app: app,
    		url: location,                                                  // pass parsed request url
    		qs: qs,                                                         // pass query string parser
    		query: location.query ? qs.parse(location.query) : {} ,         // parse query string
    		response: response,                                             // original response
    		request: request,                                               // original request
    		method: request.method,                                         // GET or POST
    		multipart: false,  
			xml : false, 
            rawBody : request.body || "",
    		body : {},
			files : {},
            responded : false,                                            // is it a multipart request?
    		params: {}, data: {}, route: {}, fail: {}, errors: {},          // containers
            onFinished(fn, afterSentHeaders){
                _events.on(afterSentHeaders ? "afterSentHeaders" : "finish", fn)
            },
			onEnd(fn){
                response.on("close", fn);
                response.socket.on("error", fn);
            },
    		header : function(where, newValue){	
    			if(!newValue){                                                  // not a set operation
    				return response.getHeader(where) || request.headers[where]; // get header
    			} else if(!response.headersSent){                               // if headers are not yet sent
    				return response.setHeader(where, newValue);                 // set header
    			}
    		},
    		setHeader: function(key, value){ return response.setHeader(key, value); },
    		removeHeader: function(key, value){ return response.removeHeader(key); },
    		getHeader: function(key){ return response.getHeader(key); },
    		getRequestHeader: function(key){ return request.headers[key] },
    		headers: request.headers,	
    		send: function(message) { response.write(message); },               // send data chunk to client
    		sendFile: function(path, encoding){
                if(!app.readStreamFile || !app.existFile) return;
                if(app.existFile(path)){
                    let [size, readStream] = app.readStreamFile(path);
                    response.writeHead(200, {
                        'Content-Type': mime.lookup(path),
                        'Content-Length': size
                    });
                    readStream.pipe(response);
                    signal.responded = true
                    signal.end()
                }
			    // fs.stat(path, function(error, stat){
			    // 	if(error){
			    // 		throw error;
			    // 	} else {
				// 	    response.writeHead(200, {
				// 	        'Content-Type': mime.lookup(path),
				// 	        'Content-Length': stat.size
				// 	    });
				// 	    let readStream = fs.createReadStream(path);
				// 	    readStream.pipe(response);
				// 	    signal.responded = true
				// 	    signal.end()
				//     }
			    // })
    		},
    		download: function(path, name, encoding){
    			let filename = name ? name : Path.basename(path)
    			signal.setHeader('Content-Disposition', 'attachment; filename="'+filename+'"')
    			signal.sendFile(path, encoding)
    		},
    		redirect: function(input, statusCode, isLast){
    			if(input.substring(0, 4) === 'back') { 
    				let path = request.headers.referer || '/';
    			} else if(input.substring(0, 4) === 'home') { 
    				let path = '/'; 
    			} else {
    				let path = input;
    			}
    			// Append Additional Routes
    			if(input.split('back')[1]){ path += input.split('back')[1]; }
    			if(input.split('home')[1]){ path += input.split('home')[1]; }
    			let URI = url.parse(path);
    			if(URI.query){ // Reconstruct the Path
    				let QUERY = '?'+signal.qs.stringify(signal.qs.parse(URI.query));
    				let path = '';
    				if(URI.protocol) 	path += URI.protocol + '//';
    				if(URI.hostname) 	path += URI.hostname;
    				if(URI.port) 		path += ':' + URI.port;
    				if(URI.pathname) 	path += URI.pathname;
    				if(QUERY) {
                        if (!path.indexOf(QUERY) > -1) path += QUERY;
                    }
    			}
    			signal.status((!statusCode) ? 302 : statusCode)
    			signal.header('Location', path);
    			response.end()
    			signal.responded = true
    			if(!isLast) signal.nextRoute()
    		},
    		env: process.env.NODE_ENV,
    		setFinalHeaders: function(data){
    		    if(!response.headersSent){
    		    	if(!signal.header('content-type')) signal.header('content-type', 'text/plain')
    		    	if(data){
    		    		let length = typeof data === 'string' ? Buffer.byteLength(data, 'utf8') : data.length ;
    		    		response.setHeader('content-length', length)
    		    	}
    		    }
    		},
    		end: function(input, isLast){
    			if(!signal.responded && !signal.stopped){
    			    signal.responded = true
    			    input = preactToString(input);
					if(input && typeof input == 'object' || signal.header('x-requested-with') == 'XMLHttpRequest' || ( signal.header('authorization') && (signal.header('authorization').indexOf('Bearer') != -1 || signal.header('authorization').indexOf('Token') != -1 ))) { 
    			        let data = signal.jsonString(input); // json
    			        signal.setFinalHeaders(data); 
    			        response.end(data)      
    			        if(!isLast) signal.nextRoute() // call next route
    			    } else {
                        signal.setFinalHeaders(input); 
                        response.end(input)  // default
                        if(!isLast) signal.nextRoute() // call next route
    			    }
    			}
    			if(isLast) signal.stopped = true;
    		},
    		status : function(code, message){
    			signal.statusMessage = response.statusMessage =  message || signal.statusMessage || status_codes[code];	
    			signal.statusCode = response.statusCode = code;					
    		},
    		passed: true,
    		error: function(field, error){
    			if(error){
	    			signal.passed = signal.data.passed = false
	    			signal.errors[field] = error
    			} else if (field) {
    				return signal.errors[field]
    			}
    		},
    		success: function(input, isLast){ // respond with JSON success
    			if(!signal.statusCode) signal.status(200)
    			signal.header('content-type', 'application/json')
    			let data = signal.data
    			if(utils.isset(input)) data = Object.merge(signal.data, input)
    			data.passed = true
    			signal.end(data, isLast)
    		},
    		failure: function(input, isLast){ // respond with JSON errors
    			if(!signal.statusCode) signal.status(200)
    			signal.header('content-type', 'application/json')
    			if(signal.data.errors) signal.errors = Object.merge(signal.error, signal.data.errors)
    			if(utils.isset(input)) data = Object.merge(signal.errors, input)
    			signal.end({ passed: false, errors: signal.errors }, isLast)
    		},
    		jsonString: function(input){
    		    // if(utils.isset(input) && typeof input == "object") signal.data = Object.merge(signal.data, input)
    		    if(!signal.statusCode) signal.status(200)
    		    signal.header('content-type', 'application/json')
    		    return JSON.stringify(input);
    		},
    		json : function(input, isLast){ // respond with JSON data
    			signal.end(signal.jsonString(input), isLast)
    		},
    		html: function(input, isLast){
				signal.header('content-type', 'text/html; charset=UTF-8')
				if(!signal.statusCode) signal.status(200);
				if(isValidElement(input)){
					signal.end(preactToString(input),isLast);
				} else if(signal.htmlModule) { 
    		        signal.htmlModule(input);
                    signal.nextRoute();
    		    } else { 
    		        signal.end(input,isLast);
    		    }
    		}
    	}
        response._realWrite = response.write.bind(response);
        response.write = (data)=>{
			data = preactToString(data);
			if(data && typeof data == 'object'){
				data = signal.jsonString(data);
			}
			return response._realWrite(data);
		}
        response._realEnd = response.end.bind(response);
        response._ending = false;
        response.end = (data)=>{
            if(response._ending) return; // prevent circular call
            signal.responded = true;
            response._ending = true;
            _events.emitAsync("finish", data, function setData(d){
                data = d
			}).then(e=>{
				let encoding = signal.header("accept-encoding") ? ((signal.header("accept-encoding") ?? "").split(/[ ]*,[ ]*/).indexOf("gzip") == -1 ? "deflate" :"gzip"):  "";
                let hasVary = (signal.getHeader("Vary") || "")?.toLowerCase() == 'accept-encoding';
                let hasEncoding = ["gzip", "deflate"].indexOf((signal.getHeader("Content-Encoding") || "")?.toLowerCase()) != -1;
                if((!hasVary && !hasEncoding) && encoding){
                    try {
                        data = require('zlib')[encoding+"Sync"](data);    
                        signal.header('Content-Length', Buffer.byteLength(data),)
                        signal.status(Buffer.byteLength(data) ? 200 : 204);
                        signal.header('Content-Encoding', encoding)
                        signal.header('Vary', 'Accept-Encoding')
                    } catch (error) {
                        // ignore error
                    }
                }
                // set coontent-length
                if(!signal.getHeader("Content-Length")){
                    signal.header('Content-Length', Buffer.byteLength(data),);
                    if(response.statusCode == 200 && !Buffer.byteLength(data)){
                        signal.status(204);
                    }
                }
                response.flushHeaders();
                _events.emitAsync("afterSentHeaders", data).then((e)=>{
					try {
                        if((signal.getHeader("Connection") || "").toLowerCase() == "close"){
							response._realEnd.call(response,data);
							try{
								response.destroy(); // clean connexion
							}catch(e){
								// ignore
							}
							_events.emitAsync("signalEnd")
                        }else{
                            response.write.call(response,data);
                        }
                    } catch (error) {
                        console.error("WRITE END", error)
                    }
                })
            });            
        }    	
        // ---------------------------------------------------------------------
        //  signal.params
        // ---------------------------------------------------------------------
        // determine method, host, location, port and hostname
        let method   = request.method ? request.method.toLowerCase() : '' ;
        // get routes for this method
        let routes = app.routes[method] 
        
        // get path from routes
        let path = routes ? routes[location.pathname] : "";
        let match_found = !!path
        // if the app (host controller) exists and it has routes for this method
        if(app && app.routes && app.routes[method]){ 
            
            // set default headers
            for(let key in app.defaultHeaders) {
                response.setHeader(key, app.defaultHeaders[key])
            }
            
            if(!path){                                     // dynamic path
                for(let index in routes){                      // loop trough all method routes
                    let item = new Array(routes[index][0])
                    if(item[0].paramRegex){
                        match_found = item[0].paramRegex.exec(location.pathname)
                        if(match_found){
                            path = item;
                            break;
                        }
                    }
                }
            }

        // } else {
        //     app.emit('route.missingAll');
        //     response.statusCode = 404
        //     response.statusMessage = "NOT FOUND";
        //     response.end('404 Not found') // no host found
        }
    	if(match_found){	
    		let path_keys_length = path[0].paramKeys.length;
    		for(let i = 0; i < path_keys_length; i++){
    			let param = path[0].paramKeys[i];
    			signal.params[param.name] = match_found[i+1];
    		}
    	}
        signal.path = path;
    	
    	// ---------------------------------------------------------------------
        //  signal.body
        // ---------------------------------------------------------------------
    	if(path && request.headers && request.headers['content-type'] || request.headers['transfer-encoding']){
    		let multipart = request.headers['content-type'] && request.headers['content-type'].toString().indexOf('multipart/form-data');
    		if(multipart === -1){
    			signal.multipart = false;
                if(request.headers['content-type'].toLowerCase().indexOf('application/x-www-form-urlencoded') != -1){ // parse querystring
                    signal.body = signal.qs.parse(decodeURIComponent(signal.rawBody));
                } else if(request.headers['content-type'].toLowerCase() == "application/json") { // parse JSON
                    try {
                        signal.body = JSON.parse(signal.rawBody); 
                    } catch (error) {
						// ingore
                    }
                } else if(/(\/|\+)xml$/.test(request.headers['content-type'].toLowerCase())) { // parse XML 
					signal.xml = true;
					signal.body = new XMLDocument(signal.rawBody);
                }
                callback(signal); 
    		} else {
    			signal.multipart = true;
				const parser = bodyparser({
					headers: signal.headers,
					preservePath: true,
					limits : app.uploadOptions,
				});
				parser.on('file', (name, file, info) => {
					let data = waiter();
					signal.files[name] = {
						...info,
						name,
						buffer : data.promise
					}
					let b = Buffer.alloc(0); // empty buffer
					file.on('data', (data) => {
						b = Buffer.concat([b, data], b.length + data.length);
					}).on('close', () => {
						data(b);
					});
				});
				parser.on('field', (name, val, info) => {
					signal.body[name] = val;
				});
				parser.on('close', () => {
					callback(signal);
				});
				Readable.from(signal.rawBody).pipe(parser)
    		}
    	} else {
    		callback(signal);
    	}
    }
    
