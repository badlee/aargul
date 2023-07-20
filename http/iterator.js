// ===========================================================================
//  Aargul Http
//  Iterator Controller
// ===========================================================================
   "use strict"
   
    module.exports = function(route, signal, callback, state){
    	if(route && route.length){
    		var iterator = route.values();
    		
    		function nextRoute(){
    			if(!signal.stopped){
        			var current = iterator.next()
        			
        			if(!current.done){
        				current.value.handler(signal.request, signal.response, signal.app, nextRoute, signal)
        			
        			} else if (callback) {
        				callback(signal)
        			}
    			}
    		}
    		
    		signal.nextRoute = nextRoute
    		nextRoute()
    	
    	} else if (callback) {
    		callback(signal)
    	}
    }
    
