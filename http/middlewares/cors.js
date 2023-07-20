(function () {

  'use strict';

  /**
   * RegExp to match field-name in RFC 7230 sec 3.2
   *
   * field-name    = token
   * token         = 1*tchar
   * tchar         = "!" / "#" / "$" / "%" / "&" / "'" / "*"
   *               / "+" / "-" / "." / "^" / "_" / "`" / "|" / "~"
   *               / DIGIT / ALPHA
   *               ; any VCHAR, except delimiters
   */

  var FIELD_NAME_REGEXP = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

  /**
   * Append a field to a vary header.
   *
   * @param {String} header
   * @param {String|Array} field
   * @return {String}
   * @public
   */

  function append(header, field) {
    if (typeof header !== 'string') {
      throw new TypeError('header argument is required')
    }

    if (!field) {
      throw new TypeError('field argument is required')
    }

    // get fields array
    var fields = !Array.isArray(field)
      ? parse(String(field))
      : field

    // assert on invalid field names
    for (var j = 0; j < fields.length; j++) {
      if (!FIELD_NAME_REGEXP.test(fields[j])) {
        throw new TypeError('field argument contains an invalid header name')
      }
    }

    // existing, unspecified vary
    if (header === '*') {
      return header
    }

    // enumerate current values
    var val = header
    var vals = parse(header.toLowerCase())

    // unspecified vary
    if (fields.indexOf('*') !== -1 || vals.indexOf('*') !== -1) {
      return '*'
    }

    for (var i = 0; i < fields.length; i++) {
      var fld = fields[i].toLowerCase()

      // append value (case-preserving)
      if (vals.indexOf(fld) === -1) {
        vals.push(fld)
        val = val
          ? val + ', ' + fields[i]
          : fields[i]
      }
    }

    return val
  }

  /**
   * Parse a vary header into an array.
   *
   * @param {String} header
   * @return {Array}
   * @private
   */

  function parse(header) {
    var end = 0
    var list = []
    var start = 0

    // gather tokens
    for (var i = 0, len = header.length; i < len; i++) {
      switch (header.charCodeAt(i)) {
        case 0x20: /*   */
          if (start === end) {
            start = end = i + 1
          }
          break
        case 0x2c: /* , */
          list.push(header.substring(start, end))
          start = end = i + 1
          break
        default:
          end = i + 1
          break
      }
    }

    // final token
    list.push(header.substring(start, end))

    return list
  }

  /**
   * Mark that a request is varied on a header field.
   *
   * @param {Object} $
   * @param {String|Array} field
   * @public
   */

  function vary($, field) {

    // get existing header
    var val = $.header('Vary') || ''
    var header = Array.isArray(val)
      ? val.join(', ')
      : String(val)

    // set new header
    if ((val = append(header, field))) {
      $.header('Vary', val)
    }
  }

  var defaults = {
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204
  };

  function isString(s) {
    return typeof s === 'string' || s instanceof String;
  }

  function isOriginAllowed(origin, allowedOrigin) {
    if (Array.isArray(allowedOrigin)) {
      for (var i = 0; i < allowedOrigin.length; ++i) {
        if (isOriginAllowed(origin, allowedOrigin[i])) {
          return true;
        }
      }
      return false;
    } else if (isString(allowedOrigin)) {
      return origin === allowedOrigin;
    } else if (allowedOrigin instanceof RegExp) {
      return allowedOrigin.test(origin);
    } else {
      return !!allowedOrigin;
    }
  }

  function configureOrigin(options, $) {
    var requestOrigin = $.headers.origin,
      headers = [],
      isAllowed;

    if (!options.origin || options.origin === '*') {
      // allow any origin
      headers.push([{
        key: 'Access-Control-Allow-Origin',
        value: '*'
      }]);
    } else if (isString(options.origin)) {
      // fixed origin
      headers.push([{
        key: 'Access-Control-Allow-Origin',
        value: options.origin
      }]);
      headers.push([{
        key: 'Vary',
        value: 'Origin'
      }]);
    } else {
      isAllowed = isOriginAllowed(requestOrigin, options.origin);
      // reflect origin
      headers.push([{
        key: 'Access-Control-Allow-Origin',
        value: isAllowed ? requestOrigin : false
      }]);
      headers.push([{
        key: 'Vary',
        value: 'Origin'
      }]);
    }

    return headers;
  }

  function configureMethods(options) {
    var methods = options.methods;
    if (methods.join) {
      methods = options.methods.join(','); // .methods is an array, so turn it into a string
    }
    return {
      key: 'Access-Control-Allow-Methods',
      value: methods
    };
  }

  function configureCredentials(options) {
    if (options.credentials === true) {
      return {
        key: 'Access-Control-Allow-Credentials',
        value: 'true'
      };
    }
    return null;
  }

  function configureAllowedHeaders(options, $) {
    var allowedHeaders = options.allowedHeaders || options.headers;
    var headers = [];

    if (!allowedHeaders) {
      allowedHeaders = $.headers['access-control-request-headers']; // .headers wasn't specified, so reflect the request headers
      headers.push([{
        key: 'Vary',
        value: 'Access-Control-Request-Headers'
      }]);
    } else if (allowedHeaders.join) {
      allowedHeaders = allowedHeaders.join(','); // .headers is an array, so turn it into a string
    }
    if (allowedHeaders && allowedHeaders.length) {
      headers.push([{
        key: 'Access-Control-Allow-Headers',
        value: allowedHeaders
      }]);
    }

    return headers;
  }

  function configureExposedHeaders(options) {
    var headers = options.exposedHeaders;
    if (!headers) {
      return null;
    } else if (headers.join) {
      headers = headers.join(','); // .headers is an array, so turn it into a string
    }
    if (headers && headers.length) {
      return {
        key: 'Access-Control-Expose-Headers',
        value: headers
      };
    }
    return null;
  }

  function configureMaxAge(options) {
    var maxAge = (typeof options.maxAge === 'number' || options.maxAge) && options.maxAge.toString()
    if (maxAge && maxAge.length) {
      return {
        key: 'Access-Control-Max-Age',
        value: maxAge
      };
    }
    return null;
  }

  function applyHeaders(headers, $) {
    for (var i = 0, n = headers.length; i < n; i++) {
      var header = headers[i];
      if (header) {
        if (Array.isArray(header)) {
          applyHeaders(header, $);
        } else if (header.key === 'Vary' && header.value) {
          vary($, header.value);
        } else if (header.value) {
          $.header(header.key, header.value);
        }
      }
    }
  }

  function cors(options, $, next) {
    
    var headers = [],
    method = $.method && $.method.toUpperCase && $.method.toUpperCase();
    
    if (method === 'OPTIONS') {
      // preflight
      headers.push(configureOrigin(options, $));
      headers.push(configureCredentials(options))
      headers.push(configureMethods(options))
      headers.push(configureAllowedHeaders(options, $));
      headers.push(configureMaxAge(options))
      headers.push(configureExposedHeaders(options))
      applyHeaders(headers, $);

      if (!options.preflightContinue) {
        // Safari (and potentially other browsers) need content-length 0,
        //   for 204 or they just hang waiting for a body
        $.status(options.optionsSuccessStatus)
        $.header('Content-Length', '0');
        $.responded = true;
        $.response.end()
      }
    } else {
      // actual response
      headers.push(configureOrigin(options, $));
      headers.push(configureCredentials(options))
      headers.push(configureExposedHeaders(options))
      applyHeaders(headers, $);
    }
    next();
  }

  function middlewareWrapper(o) {
    // if options are static (either via defaults or custom options passed in), wrap in a function
    var optionsCallback = null;
    if (typeof o === 'function') {
      optionsCallback = o;
    } else {
      optionsCallback = function ($, cb) {
        cb(null, o);
      };
    }

    return function corsMiddleware($) {
      if($.header("Sec-Fetch-Mode")?.toLowerCase() == "no-cors"){
        return $.nextRoute();
      }
      var next = (error) => {
        if (error) {
          // getError modified
          $.status(500)
          $.responded = true;
          $.response.end(error)
        }
        $.return();
      }
      optionsCallback($, function (err, options) {
        if (err) {
          next(err);
        } else {
          var corsOptions = Object.assign({}, defaults, options);
          var originCallback = null;
          if (corsOptions.origin && typeof corsOptions.origin === 'function') {
            originCallback = corsOptions.origin;
          } else if (corsOptions.origin) {
            originCallback = function (origin, cb) {
              cb(null, corsOptions.origin);
            };
          }

          if (originCallback) {
            originCallback($.headers.origin, function (err2, origin) {
              if (err2 || !origin) {
                next(err2);
              } else {
                corsOptions.origin = origin;
                cors(corsOptions, $, next);
              }
            });
          } else {
            next();
          }
        }
      });
    };
  }

  // can pass either an options hash, an options delegate, or nothing
  module.exports = middlewareWrapper;

}());