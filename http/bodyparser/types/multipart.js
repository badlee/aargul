'use strict';

const { Readable, Writable } = require('stream');
const StreamSearch = (function () {
  /*
  Based heavily on the Streaming Boyer-Moore-Horspool C++ implementation
  by Hongli Lai at: https://github.com/FooBarWidget/boyer-moore-horspool
*/
  function memcmp(buf1, pos1, buf2, pos2, num) {
    for (let i = 0; i < num; ++i) {
      if (buf1[pos1 + i] !== buf2[pos2 + i])
        return false;
    }
    return true;
  }

  class SBMH {
    constructor(needle, cb) {
      if (typeof cb !== 'function')
        throw new Error('Missing match callback');

      if (typeof needle === 'string')
        needle = Buffer.from(needle);
      else if (!Buffer.isBuffer(needle))
        throw new Error(`Expected Buffer for needle, got ${typeof needle}`);

      const needleLen = needle.length;

      this.maxMatches = Infinity;
      this.matches = 0;

      this._cb = cb;
      this._lookbehindSize = 0;
      this._needle = needle;
      this._bufPos = 0;

      this._lookbehind = Buffer.allocUnsafe(needleLen);

      // Initialize occurrence table.
      this._occ = [
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen, needleLen, needleLen,
        needleLen, needleLen, needleLen, needleLen
      ];

      // Populate occurrence table with analysis of the needle, ignoring the last
      // letter.
      if (needleLen > 1) {
        for (let i = 0; i < needleLen - 1; ++i)
          this._occ[needle[i]] = needleLen - 1 - i;
      }
    }

    reset() {
      this.matches = 0;
      this._lookbehindSize = 0;
      this._bufPos = 0;
    }

    push(chunk, pos) {
      let result;
      if (!Buffer.isBuffer(chunk))
        chunk = Buffer.from(chunk, 'latin1');
      const chunkLen = chunk.length;
      this._bufPos = pos || 0;
      while (result !== chunkLen && this.matches < this.maxMatches)
        result = feed(this, chunk);
      return result;
    }

    destroy() {
      const lbSize = this._lookbehindSize;
      if (lbSize)
        this._cb(false, this._lookbehind, 0, lbSize, false);
      this.reset();
    }
  }

  function feed(self, data) {
    const len = data.length;
    const needle = self._needle;
    const needleLen = needle.length;

    // Positive: points to a position in `data`
    //           pos == 3 points to data[3]
    // Negative: points to a position in the lookbehind buffer
    //           pos == -2 points to lookbehind[lookbehindSize - 2]
    let pos = -self._lookbehindSize;
    const lastNeedleCharPos = needleLen - 1;
    const lastNeedleChar = needle[lastNeedleCharPos];
    const end = len - needleLen;
    const occ = self._occ;
    const lookbehind = self._lookbehind;

    if (pos < 0) {
      // Lookbehind buffer is not empty. Perform Boyer-Moore-Horspool
      // search with character lookup code that considers both the
      // lookbehind buffer and the current round's haystack data.
      //
      // Loop until
      //   there is a match.
      // or until
      //   we've moved past the position that requires the
      //   lookbehind buffer. In this case we switch to the
      //   optimized loop.
      // or until
      //   the character to look at lies outside the haystack.
      while (pos < 0 && pos <= end) {
        const nextPos = pos + lastNeedleCharPos;
        const ch = (nextPos < 0
          ? lookbehind[self._lookbehindSize + nextPos]
          : data[nextPos]);

        if (ch === lastNeedleChar
          && matchNeedle(self, data, pos, lastNeedleCharPos)) {
          self._lookbehindSize = 0;
          ++self.matches;
          if (pos > -self._lookbehindSize)
            self._cb(true, lookbehind, 0, self._lookbehindSize + pos, false);
          else
            self._cb(true, undefined, 0, 0, true);

          return (self._bufPos = pos + needleLen);
        }

        pos += occ[ch];
      }

      // No match.

      // There's too few data for Boyer-Moore-Horspool to run,
      // so let's use a different algorithm to skip as much as
      // we can.
      // Forward pos until
      //   the trailing part of lookbehind + data
      //   looks like the beginning of the needle
      // or until
      //   pos == 0
      while (pos < 0 && !matchNeedle(self, data, pos, len - pos))
        ++pos;

      if (pos < 0) {
        // Cut off part of the lookbehind buffer that has
        // been processed and append the entire haystack
        // into it.
        const bytesToCutOff = self._lookbehindSize + pos;

        if (bytesToCutOff > 0) {
          // The cut off data is guaranteed not to contain the needle.
          self._cb(false, lookbehind, 0, bytesToCutOff, false);
        }

        self._lookbehindSize -= bytesToCutOff;
        lookbehind.copy(lookbehind, 0, bytesToCutOff, self._lookbehindSize);
        lookbehind.set(data, self._lookbehindSize);
        self._lookbehindSize += len;

        self._bufPos = len;
        return len;
      }

      // Discard lookbehind buffer.
      self._cb(false, lookbehind, 0, self._lookbehindSize, false);
      self._lookbehindSize = 0;
    }

    pos += self._bufPos;

    const firstNeedleChar = needle[0];

    // Lookbehind buffer is now empty. Perform Boyer-Moore-Horspool
    // search with optimized character lookup code that only considers
    // the current round's haystack data.
    while (pos <= end) {
      const ch = data[pos + lastNeedleCharPos];

      if (ch === lastNeedleChar
        && data[pos] === firstNeedleChar
        && memcmp(needle, 0, data, pos, lastNeedleCharPos)) {
        ++self.matches;
        if (pos > 0)
          self._cb(true, data, self._bufPos, pos, true);
        else
          self._cb(true, undefined, 0, 0, true);

        return (self._bufPos = pos + needleLen);
      }

      pos += occ[ch];
    }

    // There was no match. If there's trailing haystack data that we cannot
    // match yet using the Boyer-Moore-Horspool algorithm (because the trailing
    // data is less than the needle size) then match using a modified
    // algorithm that starts matching from the beginning instead of the end.
    // Whatever trailing data is left after running this algorithm is added to
    // the lookbehind buffer.
    while (pos < len) {
      if (data[pos] !== firstNeedleChar
        || !memcmp(data, pos, needle, 0, len - pos)) {
        ++pos;
        continue;
      }
      data.copy(lookbehind, 0, pos, len);
      self._lookbehindSize = len - pos;
      break;
    }

    // Everything until `pos` is guaranteed not to contain needle data.
    if (pos > 0)
      self._cb(false, data, self._bufPos, pos < len ? pos : len, true);

    self._bufPos = len;
    return len;
  }

  function matchNeedle(self, data, pos, len) {
    const lb = self._lookbehind;
    const lbSize = self._lookbehindSize;
    const needle = self._needle;

    for (let i = 0; i < len; ++i, ++pos) {
      const ch = (pos < 0 ? lb[lbSize + pos] : data[pos]);
      if (ch !== needle[i])
        return false;
    }
    return true;
  }
  return SBMH;
})()

const {
  basename,
  convertToUTF8,
  getDecoder,
  parseContentType,
  parseDisposition,
} = require('../utils.js');

const BUF_CRLF = Buffer.from('\r\n');
const BUF_CR = Buffer.from('\r');
const BUF_DASH = Buffer.from('-');

function noop() { }

const MAX_HEADER_PAIRS = 2000; // From node
const MAX_HEADER_SIZE = 16 * 1024; // From node (its default value)

const HPARSER_NAME = 0;
const HPARSER_PRE_OWS = 1;
const HPARSER_VALUE = 2;
class HeaderParser {
  constructor(cb) {
    this.header = Object.create(null);
    this.pairCount = 0;
    this.byteCount = 0;
    this.state = HPARSER_NAME;
    this.name = '';
    this.value = '';
    this.crlf = 0;
    this.cb = cb;
  }

  reset() {
    this.header = Object.create(null);
    this.pairCount = 0;
    this.byteCount = 0;
    this.state = HPARSER_NAME;
    this.name = '';
    this.value = '';
    this.crlf = 0;
  }

  push(chunk, pos, end) {
    let start = pos;
    while (pos < end) {
      switch (this.state) {
        case HPARSER_NAME: {
          let done = false;
          for (; pos < end; ++pos) {
            if (this.byteCount === MAX_HEADER_SIZE)
              return -1;
            ++this.byteCount;
            const code = chunk[pos];
            if (TOKEN[code] !== 1) {
              if (code !== 58/* ':' */)
                return -1;
              this.name += chunk.latin1Slice(start, pos);
              if (this.name.length === 0)
                return -1;
              ++pos;
              done = true;
              this.state = HPARSER_PRE_OWS;
              break;
            }
          }
          if (!done) {
            this.name += chunk.latin1Slice(start, pos);
            break;
          }
          // FALLTHROUGH
        }
        case HPARSER_PRE_OWS: {
          // Skip optional whitespace
          let done = false;
          for (; pos < end; ++pos) {
            if (this.byteCount === MAX_HEADER_SIZE)
              return -1;
            ++this.byteCount;
            const code = chunk[pos];
            if (code !== 32/* ' ' */ && code !== 9/* '\t' */) {
              start = pos;
              done = true;
              this.state = HPARSER_VALUE;
              break;
            }
          }
          if (!done)
            break;
          // FALLTHROUGH
        }
        case HPARSER_VALUE:
          switch (this.crlf) {
            case 0: // Nothing yet
              for (; pos < end; ++pos) {
                if (this.byteCount === MAX_HEADER_SIZE)
                  return -1;
                ++this.byteCount;
                const code = chunk[pos];
                if (FIELD_VCHAR[code] !== 1) {
                  if (code !== 13/* '\r' */)
                    return -1;
                  ++this.crlf;
                  break;
                }
              }
              this.value += chunk.latin1Slice(start, pos++);
              break;
            case 1: // Received CR
              if (this.byteCount === MAX_HEADER_SIZE)
                return -1;
              ++this.byteCount;
              if (chunk[pos++] !== 10/* '\n' */)
                return -1;
              ++this.crlf;
              break;
            case 2: { // Received CR LF
              if (this.byteCount === MAX_HEADER_SIZE)
                return -1;
              ++this.byteCount;
              const code = chunk[pos];
              if (code === 32/* ' ' */ || code === 9/* '\t' */) {
                // Folded value
                start = pos;
                this.crlf = 0;
              } else {
                if (++this.pairCount < MAX_HEADER_PAIRS) {
                  this.name = this.name.toLowerCase();
                  if (this.header[this.name] === undefined)
                    this.header[this.name] = [this.value];
                  else
                    this.header[this.name].push(this.value);
                }
                if (code === 13/* '\r' */) {
                  ++this.crlf;
                  ++pos;
                } else {
                  // Assume start of next header field name
                  start = pos;
                  this.crlf = 0;
                  this.state = HPARSER_NAME;
                  this.name = '';
                  this.value = '';
                }
              }
              break;
            }
            case 3: { // Received CR LF CR
              if (this.byteCount === MAX_HEADER_SIZE)
                return -1;
              ++this.byteCount;
              if (chunk[pos++] !== 10/* '\n' */)
                return -1;
              // End of header
              const header = this.header;
              this.reset();
              this.cb(header);
              return pos;
            }
          }
          break;
      }
    }

    return pos;
  }
}

class FileStream extends Readable {
  constructor(opts, owner) {
    super(opts);
    this.truncated = false;
    this._readcb = null;
    this.once('end', () => {
      // We need to make sure that we call any outstanding _writecb() that is
      // associated with this file so that processing of the rest of the form
      // can continue. This may not happen if the file stream ends right after
      // backpressure kicks in, so we force it here.
      this._read();
      if (--owner._fileEndsLeft === 0 && owner._finalcb) {
        const cb = owner._finalcb;
        owner._finalcb = null;
        // Make sure other 'end' event handlers get a chance to be executed
        // before busboy's 'finish' event is emitted
        process.nextTick(cb);
      }
    });
  }
  _read(n) {
    const cb = this._readcb;
    if (cb) {
      this._readcb = null;
      cb();
    }
  }
}

const ignoreData = {
  push: (chunk, pos) => { },
  destroy: () => { },
};

function callAndUnsetCb(self, err) {
  const cb = self._writecb;
  self._writecb = null;
  if (err)
    self.destroy(err);
  else if (cb)
    cb();
}

function nullDecoder(val, hint) {
  return val;
}

class Multipart extends Writable {
  constructor(cfg) {
    const streamOpts = {
      autoDestroy: true,
      emitClose: true,
      highWaterMark: (typeof cfg.highWaterMark === 'number'
        ? cfg.highWaterMark
        : undefined),
    };
    super(streamOpts);

    if (!cfg.conType.params || typeof cfg.conType.params.boundary !== 'string')
      throw new Error('Multipart: Boundary not found');

    const boundary = cfg.conType.params.boundary;
    const paramDecoder = (typeof cfg.defParamCharset === 'string'
      && cfg.defParamCharset
      ? getDecoder(cfg.defParamCharset)
      : nullDecoder);
    const defCharset = (cfg.defCharset || 'utf8');
    const preservePath = cfg.preservePath;
    const fileOpts = {
      autoDestroy: true,
      emitClose: true,
      highWaterMark: (typeof cfg.fileHwm === 'number'
        ? cfg.fileHwm
        : undefined),
    };

    const limits = cfg.limits;
    const fieldSizeLimit = (limits && typeof limits.fieldSize === 'number'
      ? limits.fieldSize
      : 1 * 1024 * 1024);
    const fileSizeLimit = (limits && typeof limits.fileSize === 'number'
      ? limits.fileSize
      : Infinity);
    const filesLimit = (limits && typeof limits.files === 'number'
      ? limits.files
      : Infinity);
    const fieldsLimit = (limits && typeof limits.fields === 'number'
      ? limits.fields
      : Infinity);
    const partsLimit = (limits && typeof limits.parts === 'number'
      ? limits.parts
      : Infinity);

    let parts = -1; // Account for initial boundary
    let fields = 0;
    let files = 0;
    let skipPart = false;

    this._fileEndsLeft = 0;
    this._fileStream = undefined;
    this._complete = false;
    let fileSize = 0;

    let field;
    let fieldSize = 0;
    let partCharset;
    let partEncoding;
    let partType;
    let partName;
    let partTruncated = false;

    let hitFilesLimit = false;
    let hitFieldsLimit = false;

    this._hparser = null;
    const hparser = new HeaderParser((header) => {
      this._hparser = null;
      skipPart = false;

      partType = 'text/plain';
      partCharset = defCharset;
      partEncoding = '7bit';
      partName = undefined;
      partTruncated = false;

      let filename;
      if (!header['content-disposition']) {
        skipPart = true;
        return;
      }

      const disp = parseDisposition(header['content-disposition'][0],
        paramDecoder);
      if (!disp || disp.type !== 'form-data') {
        skipPart = true;
        return;
      }

      if (disp.params) {
        if (disp.params.name)
          partName = disp.params.name;

        if (disp.params['filename*'])
          filename = disp.params['filename*'];
        else if (disp.params.filename)
          filename = disp.params.filename;

        if (filename !== undefined && !preservePath)
          filename = basename(filename);
      }

      if (header['content-type']) {
        const conType = parseContentType(header['content-type'][0]);
        if (conType) {
          partType = `${conType.type}/${conType.subtype}`;
          if (conType.params && typeof conType.params.charset === 'string')
            partCharset = conType.params.charset.toLowerCase();
        }
      }

      if (header['content-transfer-encoding'])
        partEncoding = header['content-transfer-encoding'][0].toLowerCase();

      if (partType === 'application/octet-stream' || filename !== undefined) {
        // File

        if (files === filesLimit) {
          if (!hitFilesLimit) {
            hitFilesLimit = true;
            this.emit('filesLimit');
          }
          skipPart = true;
          return;
        }
        ++files;

        if (this.listenerCount('file') === 0) {
          skipPart = true;
          return;
        }

        fileSize = 0;
        this._fileStream = new FileStream(fileOpts, this);
        ++this._fileEndsLeft;
        this.emit(
          'file',
          partName,
          this._fileStream,
          {
            filename,
            encoding: partEncoding,
            mimeType: partType
          }
        );
      } else {
        // Non-file

        if (fields === fieldsLimit) {
          if (!hitFieldsLimit) {
            hitFieldsLimit = true;
            this.emit('fieldsLimit');
          }
          skipPart = true;
          return;
        }
        ++fields;

        if (this.listenerCount('field') === 0) {
          skipPart = true;
          return;
        }

        field = [];
        fieldSize = 0;
      }
    });

    let matchPostBoundary = 0;
    const ssCb = (isMatch, data, start, end, isDataSafe) => {
      retrydata:
      while (data) {
        if (this._hparser !== null) {
          const ret = this._hparser.push(data, start, end);
          if (ret === -1) {
            this._hparser = null;
            hparser.reset();
            this.emit('error', new Error('Malformed part header'));
            break;
          }
          start = ret;
        }

        if (start === end)
          break;

        if (matchPostBoundary !== 0) {
          if (matchPostBoundary === 1) {
            switch (data[start]) {
              case 45: // '-'
                // Try matching '--' after boundary
                matchPostBoundary = 2;
                ++start;
                break;
              case 13: // '\r'
                // Try matching CR LF before header
                matchPostBoundary = 3;
                ++start;
                break;
              default:
                matchPostBoundary = 0;
            }
            if (start === end)
              return;
          }

          if (matchPostBoundary === 2) {
            matchPostBoundary = 0;
            if (data[start] === 45/* '-' */) {
              // End of multipart data
              this._complete = true;
              this._bparser = ignoreData;
              return;
            }
            // We saw something other than '-', so put the dash we consumed
            // "back"
            const writecb = this._writecb;
            this._writecb = noop;
            ssCb(false, BUF_DASH, 0, 1, false);
            this._writecb = writecb;
          } else if (matchPostBoundary === 3) {
            matchPostBoundary = 0;
            if (data[start] === 10/* '\n' */) {
              ++start;
              if (parts >= partsLimit)
                break;
              // Prepare the header parser
              this._hparser = hparser;
              if (start === end)
                break;
              // Process the remaining data as a header
              continue retrydata;
            } else {
              // We saw something other than LF, so put the CR we consumed
              // "back"
              const writecb = this._writecb;
              this._writecb = noop;
              ssCb(false, BUF_CR, 0, 1, false);
              this._writecb = writecb;
            }
          }
        }

        if (!skipPart) {
          if (this._fileStream) {
            let chunk;
            const actualLen = Math.min(end - start, fileSizeLimit - fileSize);
            if (!isDataSafe) {
              chunk = Buffer.allocUnsafe(actualLen);
              data.copy(chunk, 0, start, start + actualLen);
            } else {
              chunk = data.slice(start, start + actualLen);
            }

            fileSize += chunk.length;
            if (fileSize === fileSizeLimit) {
              if (chunk.length > 0)
                this._fileStream.push(chunk);
              this._fileStream.emit('limit');
              this._fileStream.truncated = true;
              skipPart = true;
            } else if (!this._fileStream.push(chunk)) {
              if (this._writecb)
                this._fileStream._readcb = this._writecb;
              this._writecb = null;
            }
          } else if (field !== undefined) {
            let chunk;
            const actualLen = Math.min(
              end - start,
              fieldSizeLimit - fieldSize
            );
            if (!isDataSafe) {
              chunk = Buffer.allocUnsafe(actualLen);
              data.copy(chunk, 0, start, start + actualLen);
            } else {
              chunk = data.slice(start, start + actualLen);
            }

            fieldSize += actualLen;
            field.push(chunk);
            if (fieldSize === fieldSizeLimit) {
              skipPart = true;
              partTruncated = true;
            }
          }
        }

        break;
      }

      if (isMatch) {
        matchPostBoundary = 1;

        if (this._fileStream) {
          // End the active file stream if the previous part was a file
          this._fileStream.push(null);
          this._fileStream = null;
        } else if (field !== undefined) {
          let data;
          switch (field.length) {
            case 0:
              data = '';
              break;
            case 1:
              data = convertToUTF8(field[0], partCharset, 0);
              break;
            default:
              data = convertToUTF8(
                Buffer.concat(field, fieldSize),
                partCharset,
                0
              );
          }
          field = undefined;
          fieldSize = 0;
          this.emit(
            'field',
            partName,
            data,
            {
              nameTruncated: false,
              valueTruncated: partTruncated,
              encoding: partEncoding,
              mimeType: partType
            }
          );
        }

        if (++parts === partsLimit)
          this.emit('partsLimit');
      }
    };
    this._bparser = new StreamSearch(`\r\n--${boundary}`, ssCb);

    this._writecb = null;
    this._finalcb = null;

    // Just in case there is no preamble
    this.write(BUF_CRLF);
  }

  static detect(conType) {
    return (conType.type === 'multipart' && conType.subtype === 'form-data');
  }

  _write(chunk, enc, cb) {
    this._writecb = cb;
    this._bparser.push(chunk, 0);
    if (this._writecb)
      callAndUnsetCb(this);
  }

  _destroy(err, cb) {
    this._hparser = null;
    this._bparser = ignoreData;
    if (!err)
      err = checkEndState(this);
    const fileStream = this._fileStream;
    if (fileStream) {
      this._fileStream = null;
      fileStream.destroy(err);
    }
    cb(err);
  }

  _final(cb) {
    this._bparser.destroy();
    if (!this._complete)
      return cb(new Error('Unexpected end of form'));
    if (this._fileEndsLeft)
      this._finalcb = finalcb.bind(null, this, cb);
    else
      finalcb(this, cb);
  }
}

function finalcb(self, cb, err) {
  if (err)
    return cb(err);
  err = checkEndState(self);
  cb(err);
}

function checkEndState(self) {
  if (self._hparser)
    return new Error('Malformed part header');
  const fileStream = self._fileStream;
  if (fileStream) {
    self._fileStream = null;
    fileStream.destroy(new Error('Unexpected end of file'));
  }
  if (!self._complete)
    return new Error('Unexpected end of form');
}

const TOKEN = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0,
  0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

const FIELD_VCHAR = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
];

module.exports = Multipart;
