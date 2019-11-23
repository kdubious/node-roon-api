"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = __importStar(require("fs"));
var core_1 = require("./core");
var moo_1 = require("./moo");
var transport_websocket_1 = require("./transport-websocket");
var MooMessage = require('./moomsg.js');
var Logger = /** @class */ (function () {
    function Logger(roonapi) {
        var _this = this;
        this.log = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            if (_this.roonapi.log_level != "none") {
                console.log(null, args);
            }
        };
        this.roonapi = roonapi;
    }
    return Logger;
}());
exports.Logger = Logger;
var RoonApi = /** @class */ (function () {
    // private save_config = (config: string, state) => null;
    // private load_config = (config: string) => null;
    // public ws_connect_with_token?= ({ host, port, token, onclose }): Moo => null;
    function RoonApi(o) {
        var _this = this;
        this.paired_core_id = "";
        this.scan_count = 0;
        this.services_opts = {
            required_services: [],
            provided_services: [],
            optional_services: [],
        };
        if (typeof (o.extension_id) != 'string')
            throw new Error("Roon Extension options is missing the required 'extension_id' property.");
        if (typeof (o.display_name) != 'string')
            throw new Error("Roon Extension options is missing the required 'display_name' property.");
        if (typeof (o.display_version) != 'string')
            throw new Error("Roon Extension options is missing the required 'display_version' property.");
        if (typeof (o.publisher) != 'string')
            throw new Error("Roon Extension options is missing the required 'publisher' property.");
        if (typeof (o.email) != 'string')
            throw new Error("Roon Extension options is missing the required 'email' property.");
        if (typeof (o.set_persisted_state) == 'undefined')
            this.set_persisted_state = function (state) { _this.save_config("roonstate", state); };
        else
            this.set_persisted_state = o.set_persisted_state;
        if (typeof (o.get_persisted_state) == 'undefined')
            this.get_persisted_state = function () { return _this.load_config("roonstate") || {}; };
        else
            this.get_persisted_state = o.get_persisted_state;
        if (o.core_found && !o.core_lost)
            throw new Error("Roon Extension options .core_lost is required if you implement .core_found.");
        if (!o.core_found && o.core_lost)
            throw new Error("Roon Extension options .core_found is required if you implement .core_lost.");
        if (o.core_paired && !o.core_unpaired)
            throw new Error("Roon Extension options .core_unpaired is required if you implement .core_paired.");
        if (!o.core_paired && o.core_unpaired)
            throw new Error("Roon Extension options .core_paired is required if you implement .core_unpaired.");
        if (o.core_paired && o.core_found)
            throw new Error("Roon Extension options can not specify both .core_paired and .core_found.");
        if (o.core_found && typeof (o.core_found) != "function")
            throw new Error("Roon Extensions options has a .core_found which is not a function");
        if (o.core_lost && typeof (o.core_lost) != "function")
            throw new Error("Roon Extensions options has a .core_lost which is not a function");
        if (o.core_paired && typeof (o.core_paired) != "function")
            throw new Error("Roon Extensions options has a .core_paired which is not a function");
        if (o.core_unpaired && typeof (o.core_unpaired) != "function")
            throw new Error("Roon Extensions options has a .core_unpaired which is not a function");
        this.extension_reginfo = {
            core_id: o.core_id,
            extension_id: o.extension_id,
            display_name: o.display_name,
            display_version: o.display_version,
            publisher: o.publisher,
            email: o.email,
            log_level: o.log_level,
            token: o.token,
            services: {
                required_services: [],
                optional_services: [],
                provided_services: []
            }
        };
        if (o.website)
            this.extension_reginfo.website = o.website;
        this.logger = new Logger(this);
        this.log_level = o.log_level;
        this.extension_opts = o;
        this.is_paired = false;
    }
    /**
    * Initializes the services you require and that you provide.
    *
    * @this RoonApi
    * @param {object} services - Information about your extension. Used by Roon to display to the end user what is trying to access Roon.
    * @param {object[]} [services.required_services] - A list of services which the Roon Core must provide.
    * @param {object[]} [services.optional_services] - A list of services which the Roon Core may provide.
    * @param {object[]} [services.provided_services] - A list of services which this extension provides to the Roon Core.
    */
    RoonApi.prototype.init_services = function (o) {
        var _this = this;
        if (!(o.required_services instanceof Array))
            o.required_services = [];
        if (!(o.optional_services instanceof Array))
            o.optional_services = [];
        if (!(o.provided_services instanceof Array))
            o.provided_services = [];
        if (o.required_services.length || o.optional_services.length)
            if (!this.extension_opts.core_paired && !this.extension_opts.core_found)
                throw new Error("Roon Extensions options has required or optional services, but has neither .core_paired nor .core_found.");
        if (this.extension_opts.core_paired) {
            var svc_1 = this.register_service("com.roonlabs.pairing:1", {
                subscriptions: [
                    {
                        subscribe_name: "subscribe_pairing",
                        unsubscribe_name: "unsubscribe_pairing",
                        start: function (req) {
                            req.send_continue("Subscribed", { paired_core_id: _this.paired_core_id });
                        }
                    }
                ],
                methods: {
                    get_pairing: function (req) {
                        req.send_complete("Success", { paired_core_id: _this.paired_core_id });
                    },
                    pair: function (req) {
                        if (_this.paired_core_id != req.moo.core.core_id) {
                            if (_this.paired_core) {
                                _this.pairing_service_1.lost_core(_this.paired_core);
                                delete _this.paired_core_id;
                                delete _this.paired_core;
                            }
                            _this.pairing_service_1.found_core(req.moo.core);
                        }
                    },
                }
            });
            this.pairing_service_1 = {
                services: [svc_1],
                found_core: function (core) {
                    if (!_this.paired_core_id) {
                        var settings = _this.get_persisted_state();
                        settings.paired_core_id = core.core_id;
                        _this.set_persisted_state(settings);
                        _this.paired_core_id = core.core_id;
                        _this.paired_core = core;
                        _this.is_paired = true;
                        svc_1.send_continue_all("subscribe_pairing", "Changed", { paired_core_id: _this.paired_core_id });
                    }
                    if (core.core_id == _this.paired_core_id)
                        if (_this.extension_opts.core_paired)
                            _this.extension_opts.core_paired(core);
                },
                lost_core: function (core) {
                    if (core.core_id == _this.paired_core_id)
                        _this.is_paired = false;
                    if (_this.extension_opts.core_unpaired)
                        _this.extension_opts.core_unpaired(core);
                },
            };
            o.provided_services.push(this.pairing_service_1);
        }
        o.provided_services.push({
            services: [this.register_service("com.roonlabs.ping:1", {
                    methods: {
                        ping: function (req) {
                            req.send_complete("Success");
                        },
                    }
                })]
        });
        o.required_services.forEach(function (svcobj) { svcobj.services.forEach(function (svc) { _this.extension_reginfo.services.required_services.push(svc.name); }); });
        o.optional_services.forEach(function (svcobj) { svcobj.services.forEach(function (svc) { _this.extension_reginfo.services.optional_services.push(svc.name); }); });
        o.provided_services.forEach(function (svcobj) { svcobj.services.forEach(function (svc) { _this.extension_reginfo.services.provided_services.push(svc.name); }); });
        this.services_opts = o;
    };
    ;
    // - pull in Sood and provide discovery methods in Node, but not in WebBrowser
    //
    // - implement save_config/load_config based on:
    //      Node:       require('fs')
    //      WebBrowser: localStroage
    //
    // if (typeof (window) == "undefined" || typeof (nw) !== "undefined") {
    /**
     * Begin the discovery process to find/connect to a Roon Core.
     */
    RoonApi.prototype.start_discovery = function () {
        var _this = this;
        if (this._sood)
            return;
        this._sood = require('./sood.js')(this.logger);
        this._sood_conns = {};
        this._sood.on('message', function (msg) {
            //	    this.logger.log(msg);
            if (msg.props.service_id == "00720724-5143-4a9b-abac-0e50cba674bb" && msg.props.unique_id) {
                if (_this._sood_conns[msg.props.unique_id])
                    return;
                _this._sood_conns[msg.props.unique_id] = true;
                _this.ws_connect({ host: msg.from.ip, port: msg.props.http_port, onclose: function () { delete (_this._sood_conns[msg.props.unique_id]); } });
            }
        });
        this._sood.on('network', function () {
            _this._sood.query({ query_service_id: "00720724-5143-4a9b-abac-0e50cba674bb" });
        });
        this._sood.start(function () {
            _this._sood.query({ query_service_id: "00720724-5143-4a9b-abac-0e50cba674bb" });
            setInterval(function () { return _this.periodic_scan(); }, (10 * 1000));
            _this.scan_count = -1;
        });
    };
    ;
    RoonApi.prototype.periodic_scan = function () {
        this.scan_count += 1;
        if (this.is_paired)
            return;
        if ((this.scan_count < 6) || ((this.scan_count % 6) == 0)) {
            this._sood.query({ query_service_id: "00720724-5143-4a9b-abac-0e50cba674bb" });
        }
    };
    ;
    /**
     * Save a key value pair in the configuration data store.
     * @param {string} key
     * @param {object} value
     */
    RoonApi.prototype.save_config = function (k, v) {
        try {
            var config = void 0;
            try {
                var content = fs.readFileSync("config.json", { encoding: 'utf8' });
                config = JSON.parse(content) || {};
            }
            catch (e) {
                config = {};
            }
            if (v === undefined || v === null)
                delete (config[k]);
            else
                config[k] = v;
            fs.writeFileSync("config.json", JSON.stringify(config, null, '    '));
        }
        catch (e) { }
    };
    ;
    /**
     * Load a key value pair in the configuration data store.
     * @param {string} key
     * @return {object} value
     */
    RoonApi.prototype.load_config = function (k) {
        try {
            var content = fs.readFileSync("config.json", { encoding: 'utf8' });
            return JSON.parse(content)[k];
        }
        catch (e) {
            return undefined;
        }
    };
    ;
    // } else {
    //     RoonApi.prototype.save_config = function (k, v) {
    //         if (v === undefined || v === null)
    //             localStorage.removeItem(k);
    //         else
    //             localStorage.setItem(k, JSON.stringify(v));
    //     };
    //     RoonApi.prototype.load_config = function (k) {
    //         try {
    //             let r = localStorage.getItem(k);
    //             return r ? JSON.parse(r) : undefined;
    //         } catch (e) {
    //             return undefined;
    //         }
    //     };
    // }
    RoonApi.prototype.register_service = function (svcname, spec) {
        var ret = {
            _subtypes: {}
        };
        if (spec.subscriptions) {
            var _loop_1 = function (x) {
                var s = spec.subscriptions[x];
                var subname = s.subscribe_name;
                ret._subtypes[subname] = {};
                spec.methods[subname] = function (req) {
                    // XXX make sure req.body.subscription_key exists or respond send_complete with error
                    req.orig_send_complete = req.send_complete;
                    req.send_complete = function () {
                        this.orig_send_complete.apply(this, arguments);
                        delete (ret._subtypes[subname][req.moo.mooid][this.body.subscription_key]);
                    };
                    s.start(req);
                    if (!ret._subtypes[subname].hasOwnProperty(req.moo.mooid)) {
                        ret._subtypes[subname][req.moo.mooid] = {};
                    }
                    ret._subtypes[subname][req.moo.mooid][req.body.subscription_key] = req;
                };
                spec.methods[s.unsubscribe_name] = function (req) {
                    // XXX make sure req.body.subscription_key exists or respond send_complete with error
                    delete (ret._subtypes[subname][req.moo.mooid][req.body.subscription_key]);
                    if (s.end)
                        s.end(req);
                    req.send_complete("Unsubscribed");
                };
            };
            for (var x in spec.subscriptions) {
                _loop_1(x);
            }
        }
        // process incoming requests from the other side
        this._service_request_handlers[svcname] = function (req, mooid) {
            // make sure the req's request name is something we know about
            if (req) {
                var method = spec.methods[req.msg.name];
                if (method) {
                    method(req);
                }
                else {
                    req.send_complete("InvalidRequest", { error: "unknown request name (" + svcname + ") : " + req.msg.name });
                }
            }
            else {
                if (spec.subscriptions) {
                    for (var x in spec.subscriptions) {
                        var s = spec.subscriptions[x];
                        var subname = s.subscribe_name;
                        delete (ret._subtypes[subname][mooid]);
                        if (s.end)
                            s.end(req);
                    }
                }
            }
        };
        ret.name = svcname;
        ret.send_continue_all = function (subtype, name, props) {
            for (var id in ret._subtypes[subtype]) {
                for (var x in ret._subtypes[subtype][id])
                    (ret._subtypes[subtype][id][x].send_continue(name, props));
            }
        };
        ret.send_complete_all = function (subtype, name, props) {
            for (var id in ret._subtypes[subtype]) {
                for (var x in ret._subtypes[subtype][id])
                    (ret._subtypes[subtype][id][x].send_complete(name, props));
            }
        };
        return ret;
    };
    ;
    /**
    * If not using Roon discovery, call this to connect to the Core via a websocket.
    *
    * @this RoonApi
    * @param {object}          options
    * @param {string}          options.host - hostname or ip to connect to
    * @param {number}          options.port - port to connect to
    * @param {RoonApi~onclose} [options.onclose] - Called once when connect to host is lost
    */
    RoonApi.prototype.ws_connect = function (arg0) {
        var _this = this;
        var moo = new moo_1.Moo(new transport_websocket_1.WSTransport(arg0.host, arg0.port, this.logger));
        moo.transport.onopen = function () {
            //        this.logger.log("OPEN");
            moo.send_request("com.roonlabs.registry:1/info", function (msg, body) {
                if (!msg)
                    return;
                var s = _this.get_persisted_state();
                var data = JSON.parse(body);
                if (s.tokens && s.tokens[data.core_id])
                    _this.extension_reginfo.token = s.tokens[data.core_id];
                moo.send_request("com.roonlabs.registry:1/register", _this.extension_reginfo, function (msg, data) {
                    _this.ev_registered.call(_this, moo, msg, body);
                });
            });
        };
        moo.transport.onclose = function () {
            //        this.logger.log("CLOSE");
            Object.keys(_this._service_request_handlers).forEach(function (e) { return _this._service_request_handlers[e] && _this._service_request_handlers[e](null, moo.mooid); });
            moo.clean_up();
            arg0.onclose && arg0.onclose();
            // arg0.onclose = undefined;
        };
        /*
        moo.transport.onerror = err => {
    //        this.logger.log("ERROR", err);
        if (moo) moo.close();
        moo = undefined;
            moo.transport.close();
        };*/
        moo.transport.onmessage = function (msg) {
            //        this.logger.log("GOTMSG");
            var body = msg.body;
            delete (msg.body);
            var logging = msg && msg.headers && msg.headers["Logging"];
            msg.log = ((_this.log_level == "all") || (logging != "quiet"));
            if (msg.verb == "REQUEST") {
                if (msg.log)
                    _this.logger.log('<-', msg.verb, msg.request_id, msg.service + "/" + msg.name, body ? JSON.stringify(body) : "");
                var req = new MooMessage(moo, msg, body, _this.logger);
                var handler = _this._service_request_handlers[msg.service];
                if (handler)
                    handler(req, req.moo.mooid);
                else
                    req.send_complete("InvalidRequest", { error: "unknown service: " + msg.service });
            }
            else {
                if (msg.log)
                    _this.logger.log('<-', msg.verb, msg.request_id, msg.name, body ? JSON.stringify(body) : "");
                if (!moo.handle_response(msg, body)) {
                    moo.transport.close(); // this will trigger the above onclose handler
                }
            }
        };
        return moo;
    };
    ;
    // DO NOT USE -- internal only
    RoonApi.prototype.ws_connect_with_token = function (arg0) {
        var _this = this;
        var moo = this.ws_connect({ host: arg0.host, port: arg0.port, onclose: arg0.onclose });
        moo.transport.onopen = function () {
            var args = Object.assign({}, _this.extension_reginfo);
            args.token = arg0.token;
            moo.send_request("com.roonlabs.registry:1/register_one_time_token", args, function (msg, body) {
                _this.ev_registered.call(_this, moo, msg, body);
            });
        };
        return moo;
    };
    RoonApi.prototype.ev_registered = function (moo, msg, body) {
        var data = JSON.parse(body);
        if (!msg) { // lost connection
            if (moo.core) {
                if (this.pairing_service_1)
                    this.pairing_service_1.lost_core(moo.core);
                if (this.extension_opts.core_lost)
                    this.extension_opts.core_lost(moo.core);
                moo.core = undefined;
            }
        }
        else if (msg.name == "Registered") {
            moo.core = new core_1.Core(moo, this, data); //, this.logger);
            var settings = this.get_persisted_state();
            if (!settings.tokens)
                settings.tokens = {};
            settings.tokens[data.core_id] = data.token;
            this.set_persisted_state(settings);
            if (this.pairing_service_1)
                this.pairing_service_1.found_core(moo.core);
            if (this.extension_opts.core_found)
                this.extension_opts.core_found(moo.core);
        }
    };
    return RoonApi;
}());
exports.RoonApi = RoonApi;
