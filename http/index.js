// ===========================================================================
//                                   Aargul Http
// ===========================================================================

// ===========================================================================
//  External Dependencies
// ===========================================================================

const EventEmitter = require('../util/EventEmitter');
const METHODS = require("http").METHODS


// ===========================================================================
//  Internal Dependencies
// ===========================================================================    

const Router = require('./router')
const Handler = require('./handler')
const Resource = require('./resource')
const Construct = require('./construct')
const EventSourceServer = require('./sse');

// ===========================================================================
//  Middleware
// =========================================================================== 

const cookies = require('./middlewares/cookies')
const cors = require('./middlewares/cors')
const morgan = require('./middlewares/morgan');

// ===========================================================================
//  Exports
// =========================================================================== 

var events = new EventEmitter({ wildcards: true });
module.exports = Server;
events.attach(module.exports);


// ===========================================================================
//  Server
// =========================================================================== 

function Server({
    readStreamFile, existFile, corsOptions, logFormat, uploadOptions
}) {

    // -----------------------------------------------------------------------
    //  Event: app.create
    // -----------------------------------------------------------------------

    module.exports.emit('init')

    // -----------------------------------------------------------------------
    // Return a Server Instance
    // -----------------------------------------------------------------------

    var app = new App()
    app.uploadOptions = Object.assign({
        fieldNameSize : 100,
        fieldSize : 1048576,// (1MB)
        fields : Infinity,
        files : Infinity,
        fileSize : Infinity,
        parts: Infinity,
        headerPairs : 200
    },typeof uploadOptions == "object" && Object.keys(uploadOptions).length ? uploadOptions : {});
    app.readStreamFile = readStreamFile;
    app.existFile = existFile;

    // -----------------------------------------------------------------------
    //  Server is an Event Emitter
    // -----------------------------------------------------------------------

    var events = new EventEmitter({ wildcards: true });
    events.attach(app);

    // -----------------------------------------------------------------------
    //  Core Middleware
    // -----------------------------------------------------------------------
    app.header(cookies)
    app.header(cors(corsOptions))
    app.header(morgan(logFormat))
    // -----------------------------------------------------------------------
    //  Return
    // -----------------------------------------------------------------------

    return app;


}



// ===========================================================================
//  App
// ===========================================================================   

function App(defaultHeaders) {

    // -----------------------------------------------------------------------
    //  Variables
    // -----------------------------------------------------------------------
    this.defaultHeaders = {
        'X-Powered-By': 'Aargul ',
        'Server': 'Aargul',
        ...(defaultHeaders && typeof defaultHeaders == "object" ? defaultHeaders : {})
    }
    try {
        var p = require("./../package.json");
        var name = p.name || "Aargul";
        name = name[0].toUpperCase() + name.slice(1);
        this.defaultHeaders['Server'] = name
        this.defaultHeaders['X-Powered-By'] = (name + (" " + (p.version || ""))).trim()
    } catch (e) { }
    // -----------------------------------------------------------------------
    //  Methods
    // -----------------------------------------------------------------------
    METHODS.forEach(method => {
        this[method.toLowerCase()] = new Router(method.toLowerCase(), 'method', this);
    })
    this.sse = EventSourceServer.bind(this);
    this.ws = new Router('get', 'websocket', this)
    this.get = new Router('get', 'method', this)
    this.post = new Router('post', 'method', this)
    this.head = new Router('head', 'method', this)
    this.put = new Router('put', 'method', this)
    this.delete = new Router('delete', 'method', this)
    this.patch = new Router('patch', 'method', this)
    this.trace = new Router('trace', 'method', this)
    this.options = new Router('options', 'method', this)
    this.header = new Router('header', 'api', this)
    this.footer = new Router('footer', 'api', this)
    this.missing = new Router('missing', 'api', this)
    this.error = new Router('error', 'api', this)
    this.view = new Construct('view', 'views', this)
    this.model = new Construct('model', 'models', this)
    this.controller = new Construct('controller', 'controllers', this)
    this.resource = new Resource(this)
    this.handler = new Handler(this)
    // -----------------------------------------------------------------------
    //  Return Instance
    // -----------------------------------------------------------------------

    return this

}

