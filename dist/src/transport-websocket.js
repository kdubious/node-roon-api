"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var ws_1 = __importDefault(require("ws"));
// polyfill websockets in Node
// if (typeof (WebSocket) == "undefined") global.WebSocket = require('ws');
var WSTransport = /** @class */ (function () {
    function WSTransport(ip, port, logger) {
        var _this = this;
        this._isonopencalled = false;
        this._onclosecalled = false;
        var host = ip + ":" + port;
        this.ws = new ws_1.default('ws://' + host + '/api');
        if (typeof (window) != "undefined")
            this.ws.binaryType = 'arraybuffer';
        this.logger = logger;
        this.ws.onopen = function () {
            _this._isonopencalled = true;
            _this.onopen && _this.onopen();
        };
        this.ws.onclose = function () {
            _this.close();
        };
        this.ws.onmessage = function (event) {
            var msg = _this.moo && _this.moo.parse(event.data);
            if (!msg) {
                _this.close();
                return;
            }
            _this.onmessage && _this.onmessage(msg);
        };
    }
    WSTransport.prototype.send = function (buf) {
        this.ws && this.ws.send(buf, { binary: true, mask: true });
    };
    ;
    WSTransport.prototype.close = function () {
        if (this.ws) {
            this.ws.close();
            this.ws = undefined;
        }
        if (!this._onclosecalled && this._isonopencalled) {
            this._onclosecalled = true;
            this.onclose && this.onclose();
        }
        if (this.moo) {
            this.moo.clean_up();
            this.moo = undefined;
        }
    };
    ;
    return WSTransport;
}());
exports.WSTransport = WSTransport;
