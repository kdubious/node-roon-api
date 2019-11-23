"use strict";

import ws from "ws";
import { Logger } from "./lib";
import { Moo } from "./moo";

// polyfill websockets in Node
// if (typeof (WebSocket) == "undefined") global.WebSocket = require('ws');

export class WSTransport {

    private _isonopencalled: boolean = false;
    private _onclosecalled: boolean = false;
    public onopen: (() => void) | undefined;
    public onmessage: ((msg: any) => void) | undefined;
    public onclose: (() => void) | undefined;
    public moo: Moo | undefined;
    private ws: ws | undefined;
    public logger: Logger;

    constructor(ip: string, port: string, logger: Logger) {
        var host = ip + ":" + port;
        this.ws = new ws('ws://' + host + '/api');
        if (typeof (window) != "undefined") this.ws.binaryType = 'arraybuffer';
        this.logger = logger;

        this.ws.onopen = () => {
            this._isonopencalled = true;
            this.onopen && this.onopen();
        };

        this.ws.onclose = () => {
            this.close();
        };

        this.ws.onmessage = (event) => {
            var msg = this.moo && this.moo.parse(event.data);
            if (!msg) {
                this.close();
                return;
            }
            this.onmessage && this.onmessage(msg);
        };
    }

    public send(buf: string | ArrayBuffer | SharedArrayBuffer | Blob | ArrayBufferView) {
        this.ws && this.ws.send(buf, { binary: true, mask: true });
    };

    public close() {
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
}