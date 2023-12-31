/*!
 * morgan
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2014-2017 Douglas Christopher Wilson
 * Copyright(c) 2023 Badinga Ulrich
 * MIT Licensed
 */

'use strict'

/**
 * Module exports.
 * @public
 */

module.exports = morgan
module.exports.compile = compile
module.exports.format = format
module.exports.token = token

/**
 * Module dependencies.
 * @private
 */
function debug(...args){
    (args??[]).forEach((arg)=>process.stdout.write((typeof arg == "string" ? arg : inspect(arg))+" "));
    if((args??[]).length) process.stdout.write("\n");
}
var deprecate = debug.bind({},"[DEPRECATE]")

/**
 * Array of CLF month names.
 * @private
 */

var CLF_MONTH = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

/**
 * Default log buffer duration.
 * @private
 */

var DEFAULT_BUFFER_DURATION = 1000

/**
 * Create a logger middleware.
 *
 * @public
 * @param {String|Function} format
 * @param {Object} [options]
 * @return {Function} middleware
 */

function morgan (format, options) {
    if(!format) return ($)=>$.nextRoute();
  var fmt = format
  var opts = options || {}

  if (format && typeof format === 'object') {
    opts = format
    fmt = opts.format || 'default'

    // smart deprecation message
    // deprecate('morgan(options): use morgan(' + (typeof fmt === 'string' ? JSON.stringify(fmt) : 'format') + ', options) instead')
  }

  if (fmt === undefined) {
    // deprecate('undefined format: specify a format')
  }

  // output on request instead of response
  var immediate = opts.immediate

  // check if log entry should be skipped
  var skip = opts.skip || false

  // format function
  var formatLine = typeof fmt !== 'function'
    ? getFormatFunction(fmt)
    : fmt

  // stream
  var buffer = opts.buffer
  var stream = opts.stream || process.stdout

  // buffering support
  if (buffer) {
    // deprecate('buffer option')

    // flush interval
    var interval = typeof buffer !== 'number'
      ? DEFAULT_BUFFER_DURATION
      : buffer

    // swap the stream
    stream = createBufferStream(stream, interval)
  }

  return function logger ($) {
    // request data
    $._startAt = undefined
    $._startTime = undefined
    $._remoteAddress = getip($)

    // response data
    $._startAt = undefined
    $._startTime = undefined

    // record request start
    recordStartTime.call($)

    function logRequest () {
      if (skip !== false && skip($)) {
        //debug('skip request')
        return
      }

      var line = formatLine(morgan, $)

      if (line == null) {
        //debug('skip line')
        return
      }

      //debug('log request')
      stream.write(line + '\n')
    };

    if (immediate) {
      // immediate log
      logRequest()
    } else {
      // record response start
      recordStartTime.call($)
      // log when response finished
      $.onFinished(logRequest, true)
    }

    $.nextRoute()
  }
}

/**
 * Apache combined log format.
 */

morgan.format('combined', ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"')

/**
 * Apache common log format.
 */

morgan.format('common', ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length]')

/**
 * Default format.
 */

morgan.format('default', ':remote-addr - :remote-user [:date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"')

/**
 * Short format.
 */

morgan.format('short', ':remote-addr :remote-user :method :url HTTP/:http-version :status :res[content-length] - :response-time ms')

/**
 * Tiny format.
 */

morgan.format('tiny', ':method :url :status :res[content-length] - :response-time ms')

/**
 * dev (colored)
 */

morgan.format('dev', function developmentFormatLine (tokens, $) {
  // get the status code if response written
  var status = headersSent($)
    ? $.statusCode
    : undefined

  // get status color
  var color = status >= 500 ? 31 // red
    : status >= 400 ? 33 // yellow
      : status >= 300 ? 36 // cyan
        : status >= 200 ? 32 // green
          : 0 // no color

  // get colored function
  var fn = developmentFormatLine[color]

  if (!fn) {
    // compile
    fn = developmentFormatLine[color] = compile('\x1b[0m:method :url \x1b[' +
      color + 'm:status\x1b[0m :response-time ms - :res[content-length]\x1b[0m')
  }

  return fn(tokens, $)
})

/**
 * request url
 */

morgan.token('url', function getUrlToken ($) {
  return $.originalUrl || $.url
})

/**
 * request method
 */

morgan.token('method', function getMethodToken ($) {
  return $.method
})

/**
 * response time in milliseconds
 */

morgan.token('response-time', function getResponseTimeToken ($, digits) {
  if (!$._startAt || !$._startAt) {
    // missing request and/or response start time
    return
  }

  // calculate diff
  var ms = ($._startAt[0] - $._startAt[0]) * 1e3 +
    ($._startAt[1] - $._startAt[1]) * 1e-6

  // return truncated value
  return ms.toFixed(digits === undefined ? 3 : digits)
})

/**
 * total time in milliseconds
 */

morgan.token('total-time', function getTotalTimeToken ($, digits) {
    if (!$._startAt || !$._startAt) {
        // missing request and/or response start time
        return
    }

  // time elapsed from request start
  var elapsed = process.hrtime($._startAt)

  // cover to milliseconds
  var ms = (elapsed[0] * 1e3) + (elapsed[1] * 1e-6)

  // return truncated value
  return ms.toFixed(digits === undefined ? 3 : digits)
})

/**
 * current date
 */

morgan.token('date', function getDateToken ($, format) {
  var date = new Date()

  switch (format || 'web') {
    case 'clf':
      return clfdate(date)
    case 'iso':
      return date.toISOString()
    case 'web':
      return date.toUTCString()
  }
})

/**
 * response status code
 */

morgan.token('status', function getStatusToken ($) {
  return headersSent($)
    ? String($.response.statusCode)
    : undefined
})

/**
 * normalized referrer
 */

morgan.token('referrer', function getReferrerToken ($) {
  return $.headers.referer || $.headers.referrer
})

/**
 * remote address
 */

morgan.token('remote-addr', getip)

/**
 * remote user
 */

morgan.token('remote-user', function getRemoteUserToken ($) {
  // parse basic credentials
  if(!$?.headers?.authorization) return undefined;
  var CREDENTIALS_REGEXP = /^ *(?:[Bb][Aa][Ss][Ii][Cc]) +([A-Za-z0-9._~+/-]+=*) *$/;
  var USER_PASS_REGEXP = /^([^:]*):(.*)$/;

  var match = CREDENTIALS_REGEXP.exec($?.headers?.authorization);
  if (!match) {
    return undefined
  }
   // decode user pass
   var userPass = USER_PASS_REGEXP.exec(Buffer.from(match[1], 'base64').toString())

  // return username
  return userPass
    ? userPass[1]
    : undefined
})

/**
 * HTTP version
 */

morgan.token('http-version', function getHttpVersionToken ($) {
  return $.httpVersionMajor + '.' + $.httpVersionMinor
})

/**
 * UA string
 */

morgan.token('user-agent', function getUserAgentToken ($) {
  return $.headers['user-agent']
})

/**
 * request header
 */

morgan.token('req', function getRequestToken ($, field) {
  // get header
  var header = $.headers[field.toLowerCase()]

  return Array.isArray(header)
    ? header.join(', ')
    : header
})

/**
 * response header
 */

morgan.token('res', function getResponseHeader ($, field) {
  if (!headersSent($)) {
    return undefined
  }


  // get header
  var header = $.getHeader(field)

  return Array.isArray(header)
    ? header.join(', ')
    : header
})

/**
 * Format a Date in the common log format.
 *
 * @private
 * @param {Date} dateTime
 * @return {string}
 */

function clfdate (dateTime) {
  var date = dateTime.getUTCDate()
  var hour = dateTime.getUTCHours()
  var mins = dateTime.getUTCMinutes()
  var secs = dateTime.getUTCSeconds()
  var year = dateTime.getUTCFullYear()

  var month = CLF_MONTH[dateTime.getUTCMonth()]

  return pad2(date) + '/' + month + '/' + year +
    ':' + pad2(hour) + ':' + pad2(mins) + ':' + pad2(secs) +
    ' +0000'
}

/**
 * Compile a format string into a function.
 *
 * @param {string} format
 * @return {function}
 * @public
 */

function compile (format) {
  if (typeof format !== 'string') {
    throw new TypeError('argument format must be a string')
  }

  var fmt = String(JSON.stringify(format))
  var js = '  "use strict"\n return ' + fmt.replace(/:([-\w]{2,})(?:\[([^\]]+)\])?/g, function (_, name, arg) {
    var tokenArguments = '$'
    var tokenFunction = 'tokens[' + String(JSON.stringify(name)) + ']'

    if (arg !== undefined) {
      tokenArguments += ', ' + String(JSON.stringify(arg))
    }

    return '" +\n    (' + tokenFunction + '(' + tokenArguments + ') || "-") + "'
  })

  // eslint-disable-next-line no-new-func
  return new Function('tokens, $', js)
}

/**
 * Create a basic buffering stream.
 *
 * @param {object} stream
 * @param {number} interval
 * @public
 */

function createBufferStream (stream, interval) {
  var buf = []
  var timer = null

  // flush function
  function flush () {
    timer = null
    stream.write(buf.join(''))
    buf.length = 0
  }

  // write function
  function write (str) {
    if (timer === null) {
      timer = setTimeout(flush, interval)
    }

    buf.push(str)
  }

  // return a minimal "stream"
  return { write: write }
}

/**
 * Define a format with the given name.
 *
 * @param {string} name
 * @param {string|function} fmt
 * @public
 */

function format (name, fmt) {
  morgan[name] = fmt
  return this
}

/**
 * Lookup and compile a named format function.
 *
 * @param {string} name
 * @return {function}
 * @public
 */

function getFormatFunction (name) {
  // lookup format
  var fmt = morgan[name] || name || morgan.default

  // return compiled format
  return typeof fmt !== 'function'
    ? compile(fmt)
    : fmt
}

/**
 * Get request IP address.
 *
 * @private
 * @param {IncomingMessage} req
 * @return {string}
 */

function getip ($) {
  return $.ip ||
    $._remoteAddress ||
    ($?.response?.connection && $?.response?.connection.remoteAddress) ||
    undefined
}

/**
 * Determine if the response headers have been sent.
 *
 * @param {object} res
 * @returns {boolean}
 * @private
 */

function headersSent ($) {
  // istanbul ignore next: node.js 0.8 support
  return $?.response?.headersSent && typeof $.response.headersSent !== 'boolean'
    ? Boolean($._header)
    : $.response.headersSent
}

/**
 * Pad number to two digits.
 *
 * @private
 * @param {number} num
 * @return {string}
 */

function pad2 (num) {
  var str = String(num)

  // istanbul ignore next: num is current datetime
  return (str.length === 1 ? '0' : '') + str
}

/**
 * Record the start time.
 * @private
 */

function recordStartTime () {
  this._startAt = process.hrtime()
  this._startTime = new Date()
}

/**
 * Define a token function with the given name,
 * and callback fn($).
 *
 * @param {string} name
 * @param {function} fn
 * @public
 */

function token (name, fn) {
  morgan[name] = fn
  return this
}