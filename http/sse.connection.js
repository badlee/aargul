
/**
 * 
 * @file Represents a connection (both client and server sides)
 */
'use strict'

var util = require('util'),
	stream = require('stream'),
	events = require('events'),
	crypto = require('crypto');
const EventEmitter = require('../util/EventEmitter');
const { waiter } = require('../util');




const frame = (function () {
	let exports = {};
	/**
	 * @file Utility functions for creating frames
	 */
	'use strict'

	/**
	 * Creates a text frame
	 * @param {string} data
	 * @param {boolean} [masked=false] if the frame should be masked
	 * @returns {Buffer}
	 * @private
	 */
	exports.createTextFrame = function (data, masked) {
		var payload, meta

		payload = Buffer.from(data)
		meta = generateMetaData(true, 1, masked === undefined ? false : masked, payload)

		return Buffer.concat([meta, payload], meta.length + payload.length)
	}

	/**
	 * Create a binary frame
	 * @param {Buffer} data
	 * @param {boolean} [masked=false] if the frame should be masked
	 * @param {boolean} [first=true] if this is the first frame in a sequence
	 * @param {boolean} [fin=true] if this is the final frame in a sequence
	 * @returns {Buffer}
	 * @private
	 */
	exports.createBinaryFrame = function (data, masked, first, fin) {
		var payload, meta

		first = first === undefined ? true : first
		masked = masked === undefined ? false : masked
		if (masked) {
			payload = Buffer.alloc(data.length)
			data.copy(payload)
		} else {
			payload = data
		}
		meta = generateMetaData(fin === undefined ? true : fin, first ? 2 : 0, masked, payload)

		return Buffer.concat([meta, payload], meta.length + payload.length)
	}

	/**
	 * Create a close frame
	 * @param {number} code
	 * @param {string} [reason='']
	 * @param {boolean} [masked=false] if the frame should be masked
	 * @returns {Buffer}
	 * @private
	 */
	exports.createCloseFrame = function (code, reason, masked) {
		var payload, meta

		if (code !== undefined && code !== 1005) {
			payload = Buffer.from(reason === undefined ? '--' : '--' + reason)
			payload.writeUInt16BE(code, 0)
		} else {
			payload = Buffer.alloc(0)
		}
		meta = generateMetaData(true, 8, masked === undefined ? false : masked, payload)

		return Buffer.concat([meta, payload], meta.length + payload.length)
	}

	/**
	 * Create a ping frame
	 * @param {string} data
	 * @param {boolean} [masked=false] if the frame should be masked
	 * @returns {Buffer}
	 * @private
	 */
	exports.createPingFrame = function (data, masked) {
		var payload, meta

		payload = Buffer.from(data)
		meta = generateMetaData(true, 9, masked === undefined ? false : masked, payload)

		return Buffer.concat([meta, payload], meta.length + payload.length)
	}

	/**
	 * Create a pong frame
	 * @param {string} data
	 * @param {boolean} [masked=false] if the frame should be masked
	 * @returns {Buffer}
	 * @private
	 */
	exports.createPongFrame = function (data, masked) {
		var payload, meta

		payload = Buffer.from(data)
		meta = generateMetaData(true, 10, masked === undefined ? false : masked, payload)

		return Buffer.concat([meta, payload], meta.length + payload.length)
	}

	/**
	 * Creates the meta-data portion of the frame
	 * If the frame is masked, the payload is altered accordingly
	 * @param {boolean} fin
	 * @param {number} opcode
	 * @param {boolean} masked
	 * @param {Buffer} payload
	 * @returns {Buffer}
	 * @private
	 */
	function generateMetaData(fin, opcode, masked, payload) {
		var len, meta, start, mask, i

		len = payload.length

		// Creates the buffer for meta-data
		meta = Buffer.alloc(2 + (len < 126 ? 0 : (len < 65536 ? 2 : 8)) + (masked ? 4 : 0))

		// Sets fin and opcode
		meta[0] = (fin ? 128 : 0) + opcode

		// Sets the mask and length
		meta[1] = masked ? 128 : 0
		start = 2
		if (len < 126) {
			meta[1] += len
		} else if (len < 65536) {
			meta[1] += 126
			meta.writeUInt16BE(len, 2)
			start += 2
		} else {
			// Warning: JS doesn't support integers greater than 2^53
			meta[1] += 127
			meta.writeUInt32BE(Math.floor(len / Math.pow(2, 32)), 2)
			meta.writeUInt32BE(len % Math.pow(2, 32), 6)
			start += 8
		}

		// Set the mask-key
		if (masked) {
			mask = Buffer.alloc(4)
			for (i = 0; i < 4; i++) {
				meta[start + i] = mask[i] = Math.floor(Math.random() * 256)
			}
			for (i = 0; i < payload.length; i++) {
				payload[i] ^= mask[i % 4]
			}
			start += 4
		}

		return meta
	}
	return exports;
})()
const InStream = (function () {
	/**
	 * Represents the readable stream for binary frames
	 * @class
	 * @event readable
	 * @event end
	 */
	function InStream() {
		stream.Readable.call(this)
	}

	util.inherits(InStream, stream.Readable)

	/**
	 * No logic here, the pushs are made outside _read
	 * @private
	 */
	InStream.prototype._read = function () { }

	/**
	 * Add more data to the stream and fires "readable" event
	 * @param {Buffer} data
	 * @private
	 */
	InStream.prototype.addData = function (data) {
		this.push(data)
	}

	/**
	 * Indicates there is no more data to add to the stream
	 * @private
	 */
	InStream.prototype.end = function () {
		this.push(null)
	}
	return InStream;

})()
const OutStream = (function () {
	/**
	 * @class Represents the writable stream for binary frames
	 * @param {Connection} connection
	 * @param {number} minSize
	 */
	function OutStream(connection, minSize) {
		var that = this
		this.connection = connection
		this.minSize = minSize
		this.buffer = Buffer.alloc(0)
		this.hasSent = false // Indicates if any frame has been sent yet
		stream.Writable.call(this)
		this.on('finish', function () {
			if (that.connection.readyState === that.connection.OPEN) {
				// Ignore if not connected anymore
				that.connection.socket.write(frame.createBinaryFrame(that.buffer, !that.connection.server, !that.hasSent, true))
			}
			that.connection.outStream = null
		})
	}

	util.inherits(OutStream, stream.Writable)

	/**
	 * @param {Buffer} chunk
	 * @param {string} encoding
	 * @param {Function} callback
	 * @private
	 */
	OutStream.prototype._write = function (chunk, encoding, callback) {
		var frameBuffer
		this.buffer = Buffer.concat([this.buffer, chunk], this.buffer.length + chunk.length)
		if (this.buffer.length >= this.minSize) {
			if (this.connection.readyState === this.connection.OPEN) {
				// Ignore if not connected anymore
				frameBuffer = frame.createBinaryFrame(this.buffer, !this.connection.server, !this.hasSent, false)
				this.connection.socket.write(frameBuffer, encoding, callback)
			}
			this.buffer = Buffer.alloc(0)
			this.hasSent = true
			if (this.connection.readyState !== this.connection.OPEN) {
				callback()
			}
		} else {
			callback()
		}
	}
	return OutStream;
})()


/**
 * @typedef {Object} Connection~Options
 * @param {string} path
 * @param {string} host
 * @param {?Object<string>} extraHeaders
 * @param {?Array<string>} protocols
 */

/**
 * @class
 * @param {import("http").ServerResponse} response a net or tls socket
 * @param {Server} request parent in case of server-side connection,  object in case of client-side
 * @param {Function} [callback] will be added as a listener to 'connect'
 * @inherits EventEmitter
 * @event close the numeric code and string reason will be passed
 * @event error an error object is passed
 * @event text a string is passed
 * @event binary a inStream object is passed
 * @event pong a string is passed
 * @event connect
 */
function Connection(response, {headers, path, hostname}, callback) {
	var that = this,
        socket = response.socket;

    // Server-side connection
    this.path = path
    this.host = hostname
    this.extraHeaders = null
    this.protocols = []
	

	this.protocol = undefined
	this.response = response
	this.socket = socket
	this.readyState = this.CONNECTING
	this.buffer = Buffer.alloc(0)
	this.frameBuffer = null // string for text frames and InStream for binary frames
	this.outStream = null // current allocated OutStream object for sending binary frames
	this.key = null // the Sec-WebSocket-Key header
	this.headers = headers // read only map of header names and values. Header names are lower-cased

	// Set listeners

	socket.on('error', function (err) {
		that.emit('error', err)
	})

	// Close listeners
	var onclose = function () {
		if (that.readyState === that.CONNECTING || that.readyState === that.OPEN) {
			that.emit('close', 1006, '')
		}
		that.readyState = this.CLOSED
		if (that.frameBuffer instanceof InStream) {
			that.frameBuffer.end()
			that.frameBuffer = null
		}
		if (that.outStream instanceof OutStream) {
			that.outStream.end()
			that.outStream = null
		}
	}
	socket.once('close', onclose)
	socket.once('finish', onclose)

	// super constructor
    EventEmitter.attachEmitter(this);
	if (callback) {
		this.once('connect', callback)
	}
    if (this.answerHandshake()) {
		// this.buffer = this.buffer.subarray(i + 4)
		this.readyState = this.OPEN
		this.emit('connect')
        process.nextTick(()=>{
            var buffers = [];
            var next = waiter()
            next(true);
            var running = false;
            var runTask = ()=>{
                if(running) return;
                next.then(async (value)=>{
                    next = waiter();
                    var buffer = buffers.shift();
                    if(buffer){
                        if(buffer.length > Connection.maxBufferLength){
                            // Frame too big
                            this.close(1009);
                            return next(false);
                        }
                        running = true;
                        next(this.extractFrame(buffer));
                        running = false;
                        if(await next === false){
                            // Protocol error
                            this.close(1002);
                        }else{
                            runTask();
                        }
                    }else{
                        running = false;
                        next(false);
                    }
                })
            }
            this.response.socket.on('data', (buffer) =>{
                if(buffer.length > 2){
                    buffers.push(buffer);
                    runTask()
                }
            });
        })
		return true
	} else {
		this.socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
		return false
	}
}
module.exports = Connection

/**
 * Minimum size of a pack of binary data to send in a single frame
 * @property {number} binaryFragmentation
 */
Connection.binaryFragmentation = 512 * 1024 // .5 MiB

/**
 * The maximum size the internal Buffer can grow
 * If at any time it stays bigger than this, the connection will be closed with code 1009
 * This is a security measure, to avoid memory attacks
 * @property {number} maxBufferLength
 */
Connection.maxBufferLength = 2 * 1024 * 1024 // 2 MiB

/**
 * Possible ready states for the connection
 * @constant {number} CONNECTING
 * @constant {number} OPEN
 * @constant {number} CLOSING
 * @constant {number} CLOSED
 */
Connection.prototype.CONNECTING = 0
Connection.prototype.OPEN = 1
Connection.prototype.CLOSING = 2
Connection.prototype.CLOSED = 3

/**
 * Send a given string to the other side
 * @param {string} str
 * @param {Function} [callback] will be executed when the data is finally written out
 */
Connection.prototype.sendText = function (str, callback) {
	if (this.readyState === this.OPEN) {
		if (!this.outStream) {
			return this.socket.write(frame.createTextFrame(str, false), callback)
		}
		this.emit('error', new Error('You can\'t send a text frame until you finish sending binary frames'))
	} else {
		this.emit('error', new Error('You can\'t write to a non-open connection'))
	}
}

/**
 * Request for a OutStream to send binary data
 * @returns {OutStream}
 */
Connection.prototype.beginBinary = function () {
	if (this.readyState === this.OPEN) {
		if (!this.outStream) {
			return (this.outStream = new OutStream(this, Connection.binaryFragmentation))
		}
		this.emit('error', new Error('You can\'t send more binary frames until you finish sending the previous binary frames'))
	} else {
		this.emit('error', new Error('You can\'t write to a non-open connection'))
	}
}

/**
 * Sends a binary buffer at once
 * @param {Buffer} data
 * @param {Function} [callback] will be executed when the data is finally written out
 */
Connection.prototype.sendBinary = function (data, callback) {
	if (this.readyState === this.OPEN) {
		if (!this.outStream) {
			return this.socket.write(frame.createBinaryFrame(data, false, true, true), callback)
		}
		this.emit('error', new Error('You can\'t send more binary frames until you finish sending the previous binary frames'))
	} else {
		this.emit('error', new Error('You can\'t write to a non-open connection'))
	}
}

/**
 * Sends a text or binary frame
 * @param {string|Buffer} data
 * @param {Function} [callback] will be executed when the data is finally written out
 */
Connection.prototype.send = function (data, callback) {
	if (Buffer.isBuffer(data)) {
		this.sendBinary(data, callback)
	} else if (data !== undefined) {
		this.sendText(typeof data == "string" ||  typeof data == "number" ? `${data}` : JSON.stringify(data, (k, v) => {
            if (Buffer.isBuffer(v)) {
              return v.toString("base64");
            }
            return v;
          }), callback)
	} else {
		throw new TypeError('data should be either a string or a Buffer instance')
	}
}

/**
 * Sends a ping to the remote
 * @param {string} [data=''] - optional ping data
 * @fires pong when pong reply is received
 */
Connection.prototype.sendPing = function (data) {
	if (this.readyState === this.OPEN) {
		this.socket.write(frame.createPingFrame(data || '', false))
	} else {
		this.emit('error', new Error('You can\'t write to a non-open connection'))
	}
}

/**
 * Close the connection, sending a close frame and waiting for response
 * If the connection isn't OPEN, closes it without sending a close frame
 * @param {number} [code]
 * @param {string} [reason]
 * @fires close
 */
Connection.prototype.close = function (code, reason) {
	if (this.readyState === this.OPEN) {
		this.socket.write(frame.createCloseFrame(code, reason, false))
		this.readyState = this.CLOSING
	} else if (this.readyState !== this.CLOSED) {
		this.socket.end()
		this.readyState = this.CLOSED
	}
	this.emit('close', code, reason)
}

/**
 * Process and answer a handshake started by a client
 * @returns {boolean} if the handshake was sucessful. If not, the connection must be closed with error 400-Bad Request
 * @private
 */
Connection.prototype.answerHandshake = function () {
	var key, sha1, headers
	// Validate necessary headers
	if (!('sec-websocket-key' in this.headers) ||
		!('upgrade' in this.headers) ||
		!('connection' in this.headers)) {
		return false
	}
	if (this.headers.upgrade.toLowerCase() !== 'websocket' ||
		this.headers.connection.toLowerCase().split(/\s*,\s*/).indexOf('upgrade') === -1) {
		return false
	}
	if (this.headers['sec-websocket-version'] !== '13') {
		return false
	}

	this.key = this.headers['sec-websocket-key']

	// Agree on a protocol
	if ('sec-websocket-protocol' in this.headers) {
		// Parse
		this.protocols = this.headers['sec-websocket-protocol'].split(',').map(function (each) {
			return each.trim()
		})
	}

	// Build and send the response
	sha1 = crypto.createHash('sha1')
	sha1.end(this.key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
	key = sha1.read().toString('base64')
	headers = {
		Upgrade: 'websocket',
		Connection: 'Upgrade',
		'Sec-WebSocket-Accept': key
	}
	if (this.protocol) {
		headers['Sec-WebSocket-Protocol'] = this.protocol
	}
    this.response.writeHead(101, headers);
    this.response.flushHeaders();
	return true
}

/**
 * Try to extract frame contents from the buffer (and execute it)
 * @returns {(boolean|undefined)} false=something went wrong (the connection must be closed); undefined=there isn't enough data to catch a frame; true=the frame was successfully fetched and executed
 * @private
 */
Connection.prototype.extractFrame = function (buffer) {
	var fin, opcode, B, HB, mask, len, payload, start, i, hasMask

	if (buffer.length < 2) {
		return
	}

	// Is this the last frame in a sequence?
	B = buffer[0]
	HB = B >> 4
	if (HB % 8) {
		// RSV1, RSV2 and RSV3 must be clear
		return false
	}
	fin = HB === 8
	opcode = B % 16

	if (opcode !== 0 && opcode !== 1 && opcode !== 2 &&
		opcode !== 8 && opcode !== 9 && opcode !== 10) {
		// Invalid opcode
		return false
	}
	if (opcode >= 8 && !fin) {
		// Control frames must not be fragmented
		return false
	}

	B = buffer[1]
	hasMask = B >> 7
	if (!hasMask) {
		// Frames sent by clients must be masked
		return false
	}
	len = B % 128
	start = hasMask ? 6 : 2

	if (buffer.length < start + len) {
		// Not enough data in the buffer
		return
	}

	// Get the actual payload length
	if (len === 126) {
		len = buffer.readUInt16BE(2)
		start += 2
	} else if (len === 127) {
		// Warning: JS can only store up to 2^53 in its number format
		len = buffer.readUInt32BE(2) * Math.pow(2, 32) + buffer.readUInt32BE(6)
		start += 8
	}
	if (buffer.length < start + len) {
		return
	}

	// Extract the payload
	payload = buffer.subarray(start, start + len)
	if (hasMask) {
		// Decode with the given mask
		mask = buffer.subarray(start - 4, start)
		for (i = 0; i < payload.length; i++) {
			payload[i] ^= mask[i % 4]
		}
	}
	// buffer = buffer.subarray(start + len)

	// Proceeds to frame processing
	return this.processFrame(fin, opcode, payload)
}

/**
 * Process a given frame received
 * @param {boolean} fin
 * @param {number} opcode
 * @param {Buffer} payload
 * @returns {boolean} false if any error occurs, true otherwise
 * @fires text
 * @fires binary
 * @private
 */
Connection.prototype.processFrame = function (fin, opcode, payload) {
	if (opcode === 8) {
		// Close frame
		if (this.readyState === this.CLOSING) {
			this.socket.end()
		} else if (this.readyState === this.OPEN) {
			this.processCloseFrame(payload)
		}
		return true
	} else if (opcode === 9) {
		// Ping frame
		if (this.readyState === this.OPEN) {
			this.socket.write(frame.createPongFrame(payload.toString(), false))
		}
		return true
	} else if (opcode === 10) {
		// Pong frame
		this.emit('pong', payload.toString())
		return true
	}

	if (this.readyState !== this.OPEN) {
		// Ignores if the connection isn't opened anymore
		return true
	}

	if (opcode === 0 && this.frameBuffer === null) {
		// Unexpected continuation frame
		return false
	} else if (opcode !== 0 && this.frameBuffer !== null) {
		// Last sequence didn't finished correctly
		return false
	}

	if (!opcode) {
		// Get the current opcode for fragmented frames
		opcode = typeof this.frameBuffer === 'string' ? 1 : 2
	}

	if (opcode === 1) {
		// Save text frame
		payload = payload.toString()
		this.frameBuffer = this.frameBuffer ? this.frameBuffer + payload : payload

		if (fin) {
			// Emits 'text' event
			this.emit('text', this.frameBuffer)
			this.frameBuffer = null
		}
	} else {
		// Sends the buffer for InStream object
		if (!this.frameBuffer) {
			// Emits the 'binary' event
			this.frameBuffer = new InStream
			this.emit('binary', this.frameBuffer)
		}
		this.frameBuffer.addData(payload)

		if (fin) {
			// Emits 'end' event
			this.frameBuffer.end()
			this.frameBuffer = null
		}
	}

	return true
}

/**
 * Process a close frame, emitting the close event and sending back the frame
 * @param {Buffer} payload
 * @fires close
 * @private
 */
Connection.prototype.processCloseFrame = function (payload) {
	var code, reason
	if (payload.length >= 2) {
		code = payload.readUInt16BE(0)
		reason = payload.subarray(2).toString()
	} else {
		code = 1005
		reason = ''
	}
	this.socket.write(frame.createCloseFrame(code, reason, false))
	this.readyState = this.CLOSED
	this.emit('close', code, reason)
}