const EventEmitter = require("../util/EventEmitter");
const Connection = require("./sse.connection");
const { waiter } = require("../util");
const { isValidElement } = require("../util/preact");
const { render } = require("../util/preact-to-string");
const MIME_TYPE = 'text/event-stream';
const CHECK_BASE_64 = /^(([\w\. \*]+):)?((?:[a-z0-9+/]{4})*(?:[a-z0-9+/]{2}==|[a-z0-9+/]{3}=)?)$/i;
const CHECK_BASE_16 = /^(([\w\. \*]+):)?([0-9a-f]+)$/i;
const CHECK_TEXT = /^(([\w\. \*]+):)?((\[.*\]|\{.*\}|\".*\"|true|false|null|-?(?=[1-9]|0(?!\d))\d+(\.\d+)?([eE][+-]?\d+)?))$/i;
const DEFAULT_EVENT = "message";

class Room {
    constructor(name, limit, validator){
        this.name = name || "main"; // sub rooms
        this.rooms = new Set(); // sub rooms
        this.members = new Set();
        this.validator = validator &&  typeof validator == "function" ? validator : ()=>true;
        this.limit = limit ??  Infinity;
        this.limit = isNaN(this.limit) ? Infinity : this.limit;
        Object.defineProperty(this, "length", {
            get(){
                return this.members.size
            }
        });
        EventEmitter.attachEmitter(this);
        
    }
    join(member, namespace){
        if(typeof namespace == "string" && namespace ){
            if(!this.rooms.has(namespace)){
                this.rooms.set(namespace, new Room(namespace));
                this.emit("new_namespace")
            }
            return this.rooms.get(namespace).join(member);
        }else{
            if(this.limit > this.members.size && this.validator(member)){
                this.members.add(member);
                member.emit("join", this.name);
                this.emit("join", member);
                return true;;
            }
        }
        return false;
    }
    leave(member, namespace){
        if(typeof namespace == "string" && namespace ){
            if(this.rooms.has(namespace)){
                this.rooms.get(namespace).leave(member);
            }
        }else{
            this.members.delete(member);
            this.rooms.forEach(room=>{
                room.leave(member);
                member.emit("leave", room.name);
                this.emit("leave", member);
            }); // remove in included rooms
        }
    }
    disconnect(member, namespace){
        if(typeof namespace == "string" && namespace ){
            if(this.rooms.has(namespace)){
                this.rooms.get(namespace).disconnect(member);
            }
        }else{
            this.leave(member);
            if(!member.response.socket.destroyed){
                member.response.socket.destroySoon();
            }
        }
    }
    disconnectMembers(){
        this.members.forEach(member=>this.disconnect(member)); // remove all memebers
    }
    of(namespaceOrMember, rooms){
        var member = namespaceOrMember instanceof RegExp || typeof namespaceOrMember == "string" || namespaceOrMember instanceof String  ? null : namespaceOrMember;
        rooms = (rooms || this.rooms).values().filter((room)=>{
            return (member && room.members.has(member)) || (namespaceOrMember == room.name || 
                    (namespaceOrMember instanceof RegExp && namespaceOrMember.test(room.name)));
        }).map(([_,room])=>room);
        return {
            broadcast(event, data){
                rooms.forEach(room=>room.broadcastExpected(member || [],event, data))
            },
            broadcastExpected(member,event, data){
                rooms.forEach(room=>room.broadcastExpected(member,event, data))
            },
            in(name){
                return this.of(member || name, rooms.filter(room=>name == room.name));
            },
            rooms(){
                return rooms.map(room=>room.name);
            },
            disconnect(member, namespace){
                rooms.forEach(room=>room.disconnect(member, namespace))
            },
            disconnectMembers(){
                rooms.forEach(room=>room.disconnectMembers())
            },
            join(member, namespace){
                rooms.forEach(room=>room.join(member, namespace))
            },
            leave(member, namespace){
                rooms.forEach(room=>room.leave(member, namespace))
            }
        }
    }
    broadcast(event, data){
        this.broadcastExpected([],event, data)
    }
    broadcastExpected(member,event, data){
        if(typeof event == "object"){
            let tmp = event;
            event = `${data ??  DEFAULT_EVENT}`;
            data = tmp;
        }
        event = `${event || DEFAULT_EVENT}`.toLowerCase().trim();
        member = Array.isArray(member) ? member : (member ? [member] : []);
        for (const m of this.members) {
            var index = -1;
            if(member.some(member=>{
                index++;
                return member.id == m.id
            })){
                member.splice(index, 1); 
            }else{
                m.send(event,data);
            }
        }
    }
    getMemberById(id){
        for (const member of this.members) {
            if(member.id == id){
                return member;
            }
        }
    }

}

const EventSourceServer =  function(path, ...middleware) {
    var privateEvents = ["connection"];
    var fn = middleware.pop();
    var notEventFn;
    if (!fn) return;
    var subscribers = new Room();
    
    this.post(path+"/:id/:event?", ...middleware, function ({qs,params, rawBody, body,request, json : response }) {

        var subscriber = subscribers.getMemberById(params.id);
        try{
            var event = params.event ?? DEFAULT_EVENT;
            if(rawBody && CHECK_BASE_64.test(rawBody)){
                var match = rawBody.match(CHECK_BASE_64);
                subscriber?.emit(match[2] || event, Buffer.from(match[3],"base64"));
            }else if(rawBody && CHECK_BASE_16.test(rawBody)){
                var match = rawBody.match(CHECK_BASE_16);
                subscriber?.emit(match[2] || event, Buffer.from(match[3],"hex"));
            }else if(rawBody && CHECK_TEXT.test(rawBody)){
                var match = rawBody.match(CHECK_TEXT);
                try {
                    match[3] = JSON.parse(match[3]); 
                } catch (error) {
                    //ignore
                }
                subscriber?.emit(match[2] || event, match[3]);
            }else{
                //send default event
                throw new Error("DEFAULT");
            }
        }catch(e){
            subscriber?.emit(event, rawBody);
        }
        response({ success: !!subscriber });
    })
    this.get(path, ...middleware, function (signal) {
        const { headers, request, response} = signal;
        const subscriberId = (Math.random().toString(36)+"" + Date.now().toString(36)+"" + Math.random().toString(36)).replace(/0\./g,"");
        var ws = (headers["upgrade"] || "").toLowerCase() == 'websocket';
        var attached = waiter();
        if(ws){
            var conn = new Connection(response, request,async ()=>{
                var subscriber = await attached;
                if(subscriber){
                    conn.on("text", function (body) {
                        try {
                            if(body && CHECK_BASE_64.test(body)){
                                var match = body.match(CHECK_BASE_64);
                                subscriber?.emit(match[2] || event, Buffer.from(match[3],"base64"));
                            }else if(body && CHECK_BASE_16.test(body)){
                                var match = body.match(CHECK_BASE_16);
                                subscriber?.emit(match[2] || event, Buffer.from(match[3],"hex"));
                            }else if(body && CHECK_TEXT.test(body)){
                                var match = body.match(CHECK_TEXT);
                                try {
                                    match[3] = JSON.parse(match[3]); 
                                } catch (error) {
                                    //ignore
                                }
                                subscriber.emit(match[2] || DEFAULT_EVENT, match[3]);
                            }else{
                                //send default event
                                throw new Error("DEFAULT");
                            }
                        } catch (error) {
                            subscriber.emit(DEFAULT_EVENT, body);
                        }
                    });
                    conn.on("binary", function (buffer) {
                        subscriber.emit(DEFAULT_EVENT, buffer);
                    });
                    conn.send(["connection",{ id: subscriberId }]);
                    process.nextTick(()=>{
                        try {
                            subscribers.emit("connection", subscriber);
                        } catch (error) {
                            subscriber.send("error", ""+error);
                        }
                    })
                }
            });
            ws = conn;
        }else{
            if((headers["accept"] || "").toLowerCase() != "*/*" && (headers["accept"] || "").toLowerCase() != MIME_TYPE){
                if(notEventFn){
                    notEventFn(signal);
                }else{
                    const _headers = {
                        'Content-Type': 'text/plain; charset=utf-8',
                        'Connection': 'close',
                    };
                    response.writeHead(400, _headers);
                    response.end(`400 Bad Request.\n\n`)
                }
                return;
            }

            const _headers = {
                'Content-Type': MIME_TYPE,
                'Connection': 'keep-alive',
                'Transfer-Encoding': 'identity',
                'X-Accel-Buffering': 'no',
                'Cache-Control': 'no-cache'
            };

            response.writeHead(200, _headers);
            response.flushHeaders();
        }

        const subscriber = {};
        subscriber.id = subscriberId;
        subscriber.response = response;
        subscriber.setReconnectionTime = ws ? ()=>{} : (ms) =>{
            ms = parseInt(ms);
            if(!isNaN(ms)){
                response.write(`retry: ${ms}\n`);
            }
        };
        subscriber.rooms = [];
        subscriber.ws = ws;
        subscriber.data = request.query;
        EventEmitter.attachEmitter(subscriber);
        subscriber.send = (event, data)=>{
            if(typeof event == "object"){
                let tmp = event;
                event = `${data ??  DEFAULT_EVENT}`;
                data = tmp;
            }
            event = `${event || DEFAULT_EVENT}`.trim();
            if(subscriber.ws){
                try{
                    subscriber.ws.send([event || DEFAULT_EVENT,data]);
                }catch(e){
                    // ignore
                }
            }else{
                if(event.split(":")[0].trim() == "retry"){
                    response.write(`retry: ${data}\n`);
                }else{
                    response.write(`event: ${event.split(":")[0].trim()}\n`);
                    response.write(`data: ${(Buffer.isBuffer(data) ? data.toString("base64") : (typeof data == "string" ?  data : JSON.stringify(data))).split(/(\r)?\n/).join("\ndata: ")}\n`);
                }
                response.write(`\n`);
            }
        };
        Object.defineProperty(subscriber,"rooms",{
            get(){
                return subscribers.of(suscriber);
            },
            enumerable: true,
            configurable : false
        })
        subscriber.join = (namespace)=>{
            subscribers.join(subscriber, namespace);
        }
        subscriber.leave = (namespace)=>{
            subscribers.leave(subscriber, namespace);
        }
        subscriber.disconnect = ()=>{
            subscribers.disconnect(subscriber);
        }
        subscriber.broadcast = (event,data)=>{
            subscribers.broadcastExpected(subscriber, event,data);
        }
        subscribers.join(subscriber); // attach the suscriber
        subscriber.ns = subscribers;
        signal.responded = true;
        response.socket.on('close', () => {
            subscribers.disconnect(subscriber); // force disconnect from rooms
            response.socket.destroySoon(); // for destroy socket
            subscriber.emit("disconnect"); // emit 
        });
        process.nextTick(()=>{
            if(!subscriber.ws){
                // send ID
                response.write(`event: connection\n`);
                response.write(`data: ${JSON.stringify({ id: subscriberId })}\n`);
                response.write(`id: ${subscriberId}\n`);
                response.write(`\n`);
                process.nextTick(()=>{
                    try {
                        subscribers.emit("connection", subscriber);
                    } catch (error) {
                        subscriber.send("error", ``+error);
                    }
                })
            }
            attached(subscriber);
        })
    })
    notEventFn = fn(subscribers);
    if(typeof notEventFn != "function"){
        notEventFn = isValidElement(notEventFn) ? ((element)=>(signal)=>{
            signal.html(render(element, {signal},{pretty: true}));
        })(notEventFn) : (typeof notEventFn == "string" ? ((str)=>(signal)=>signal.html(str))(notEventFn) : undefined);
    }
}


module.exports = EventSourceServer;