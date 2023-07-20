// ===========================================================================
//  Request Controller
// ===========================================================================
"use strict"
    
// ===========================================================================
//  Dependencies
// ===========================================================================
    const Signal        = require('./signal')
    const Error         = require('./error')
    const RouteIterator = require('./iterator')
    
// ===========================================================================
//  Exports
// ===========================================================================

    module.exports = function(app){

    	return function(request, response,notFoundHandler){
            try {
                
                app.emit('route.start', { app, request, response })
                
                // set default header
                response.setHeader('Content-Type', 'text/plain')      
                response.setHeader('Connection', 'close')//  don't reuse the socket for an other request
                var location = request.url ? new URL(request.url) : '' ;                    
                // Create Signal
                new Signal(request, response, app, location, signalReady)
                // When Signal is Ready
                function signalReady(signal){
                    app.emit('route.headers', { app: app, signal: signal })
                    if(notFoundHandler){
                        signal.onEnd(()=>{
                            notFoundHandler(null, signal.responded);
                        })
                    }    
                    new RouteIterator(app.routes.header, signal, headersReady, 'header')
                }
                
                // When Headers are Ready
                function headersReady(signal){
                    var path = signal.path;
                    if(path) { 
                        app.emit('route.body', { path: path, app: app, signal: signal })
                        new RouteIterator(path, signal, bodyReady, 'body') 
                    } else {
                        app.emit('route.footer_404', { app: app, signal: signal });
                        bodyReady(signal, 'footer_404');
                    }
                }
                
                // When Bodies are ready
                function bodyReady(signal, state){
                    app.emit('route.' + (state || 'footer'));
                    new RouteIterator(app.routes.footer, signal, footersReady, state || 'footer')
                }
                
                // When Footers are Ready
                function footersReady(signal){
                    if(!signal.responded){
                        if(notFoundHandler){
                            if (app.routes && app.routes.missing && app.routes.missing.length){ 
                                notFoundHandler('route.missing');
                            } else { 
                                notFoundHandler('route.missingAll')
                            }
                            // response.end() // no host found
                        }else{
                            signal.status(404)
                            if (app.routes && app.routes.missing && app.routes.missing.length){ 
                                app.emit('route.missing');
                                new RouteIterator(app.routes.missing, signal, false, 'missing_body') 
                            } else { 
                                app.emit('route.missingAll');
                                response.end('404 Not found') // no host found
                            }
                        }
                    }
                }
            } catch (error) {                
                response.statusCode = 500
                response.statusMessage = "SERVER ERROR";
                response.end('500 Server Error') // no host 
                console.error(error);
            }
    		
    	}
    }