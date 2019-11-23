import * as fs from "fs";
import { Core } from "./core";
import { Moo } from "./moo";
import { MooMessage } from "./moomsg";
import { Sood } from "./sood";
import { WSTransport } from "./transport-websocket";
// var fs = ((typeof _fs) === 'undefined') ? require('fs') : _fs;


interface IServiceCollection {
    required_services: any[];
    provided_services: any[];
    optional_services: any[];
}

export interface IRegistrationInfo {

    extension_id: string; // - A unique ID for this extension.Something like @com.your_company_or_name.name_of_extension @.
    display_name: string; // - The name of your extension.
    display_version: string; // - A version string that is displayed to the user for this extension.Can be anything you want.
    publisher: string; // - The name of the developer of the extension.
    email: string; // - EMail of the developer?

    website?: string; // - Website for more information about the extension.
    core_id?: string;
    log_level?: string; //
    token?: string; //

    services: IServiceCollection;

    set_persisted_state?: () => void;
    get_persisted_state?: () => any;

    core_paired?: (core: Core) => any; //RoonApi~core_paired;
    core_unpaired?: (core: Core) => any; //RoonApi~core_paired;
    core_found?: (core: Core) => any; //RoonApi~core_paired;
    core_lost?: (core: Core) => any; //RoonApi~core_paired;
}


export class Logger {
    private roonapi: RoonApi
    constructor(roonapi: RoonApi) {
        this.roonapi = roonapi;
    }

    log = (...args: any[]) => {
        if (this.roonapi.log_level != "none") {
            console.log(null, args);
        }
    };
}


export class RoonApi {

    private logger: Logger;
    private extension_reginfo: IRegistrationInfo
    private extension_opts: any;
    private paired_core_id: string = "";
    private is_paired: boolean;
    private paired_core: Core | undefined;
    private pairing_service_1: any;
    private _sood: any;
    private _sood_conns: any;
    private scan_count: number = 0;
    private _service_request_handlers: any = {};
    private set_persisted_state: (state: any) => void;
    private get_persisted_state: () => any;

    public log_level: string;
    public services_opts: IServiceCollection = {
        required_services: [],
        provided_services: [],
        optional_services: [],
    };


    // private save_config = (config: string, state) => null;
    // private load_config = (config: string) => null;

    // public ws_connect_with_token?= ({ host, port, token, onclose }): Moo => null;

    constructor(o: IRegistrationInfo) {

        if (typeof (o.extension_id) != 'string') throw new Error("Roon Extension options is missing the required 'extension_id' property.");
        if (typeof (o.display_name) != 'string') throw new Error("Roon Extension options is missing the required 'display_name' property.");
        if (typeof (o.display_version) != 'string') throw new Error("Roon Extension options is missing the required 'display_version' property.");
        if (typeof (o.publisher) != 'string') throw new Error("Roon Extension options is missing the required 'publisher' property.");
        if (typeof (o.email) != 'string') throw new Error("Roon Extension options is missing the required 'email' property.");

        if (typeof (o.set_persisted_state) == 'undefined')
            this.set_persisted_state = state => { this.save_config("roonstate", state); };
        else
            this.set_persisted_state = o.set_persisted_state;

        if (typeof (o.get_persisted_state) == 'undefined')
            this.get_persisted_state = () => { return this.load_config("roonstate") || {}; };
        else
            this.get_persisted_state = o.get_persisted_state;

        if (o.core_found && !o.core_lost) throw new Error("Roon Extension options .core_lost is required if you implement .core_found.");
        if (!o.core_found && o.core_lost) throw new Error("Roon Extension options .core_found is required if you implement .core_lost.");
        if (o.core_paired && !o.core_unpaired) throw new Error("Roon Extension options .core_unpaired is required if you implement .core_paired.");
        if (!o.core_paired && o.core_unpaired) throw new Error("Roon Extension options .core_paired is required if you implement .core_unpaired.");

        if (o.core_paired && o.core_found) throw new Error("Roon Extension options can not specify both .core_paired and .core_found.");

        if (o.core_found && typeof (o.core_found) != "function") throw new Error("Roon Extensions options has a .core_found which is not a function");
        if (o.core_lost && typeof (o.core_lost) != "function") throw new Error("Roon Extensions options has a .core_lost which is not a function");
        if (o.core_paired && typeof (o.core_paired) != "function") throw new Error("Roon Extensions options has a .core_paired which is not a function");
        if (o.core_unpaired && typeof (o.core_unpaired) != "function") throw new Error("Roon Extensions options has a .core_unpaired which is not a function");

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

        if (o.website) this.extension_reginfo.website = o.website;

        this.logger = new Logger(this);
        this.log_level = o.log_level ? o.log_level : "none";
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
    public init_services(o: IServiceCollection) {
        if (!(o.required_services instanceof Array)) o.required_services = [];
        if (!(o.optional_services instanceof Array)) o.optional_services = [];
        if (!(o.provided_services instanceof Array)) o.provided_services = [];

        if (o.required_services.length || o.optional_services.length)
            if (!this.extension_opts.core_paired && !this.extension_opts.core_found) throw new Error("Roon Extensions options has required or optional services, but has neither .core_paired nor .core_found.");

        if (this.extension_opts.core_paired) {
            let svc = this.register_service("com.roonlabs.pairing:1", {
                subscriptions: [
                    {
                        subscribe_name: "subscribe_pairing",
                        unsubscribe_name: "unsubscribe_pairing",
                        start: (req: any) => {
                            req.send_continue("Subscribed", { paired_core_id: this.paired_core_id });
                        }
                    }
                ],
                methods: {
                    get_pairing: (req: any) => {
                        req.send_complete("Success", { paired_core_id: this.paired_core_id });
                    },
                    pair: (req: any) => {
                        if (this.paired_core_id != req.moo.core.core_id) {
                            if (this.paired_core) {
                                this.pairing_service_1.lost_core(this.paired_core);
                                delete this.paired_core_id;
                                delete this.paired_core;
                            }
                            this.pairing_service_1.found_core(req.moo.core);
                        }
                    },
                }
            });

            this.pairing_service_1 = {
                services: [svc],

                found_core: (core: Core) => {
                    if (!this.paired_core_id) {
                        let settings = this.get_persisted_state();
                        settings.paired_core_id = core.core_id;
                        this.set_persisted_state(settings);

                        this.paired_core_id = core.core_id;
                        this.paired_core = core;
                        this.is_paired = true;
                        svc.send_continue_all("subscribe_pairing", "Changed", { paired_core_id: this.paired_core_id })
                    }
                    if (core.core_id == this.paired_core_id)
                        if (this.extension_opts.core_paired) this.extension_opts.core_paired(core);
                },
                lost_core: (core: Core) => {
                    if (core.core_id == this.paired_core_id)
                        this.is_paired = false;
                    if (this.extension_opts.core_unpaired) this.extension_opts.core_unpaired(core);
                },
            };
            o.provided_services.push(this.pairing_service_1);
        }

        o.provided_services.push({
            services: [this.register_service("com.roonlabs.ping:1", {
                methods: {
                    ping: function (req: any) {
                        req.send_complete("Success");
                    },
                }
            })]
        })
        o.required_services.forEach(svcobj => { svcobj.services.forEach((svc: any) => { this.extension_reginfo.services.required_services.push(svc.name); }); });
        o.optional_services.forEach(svcobj => { svcobj.services.forEach((svc: any) => { this.extension_reginfo.services.optional_services.push(svc.name); }); });
        o.provided_services.forEach(svcobj => { svcobj.services.forEach((svc: any) => { this.extension_reginfo.services.provided_services.push(svc.name); }); });

        this.services_opts = o;
    };



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
    public start_discovery() {
        if (this._sood) return;
        this._sood = new Sood(this.logger);
        this._sood_conns = {};
        this._sood.on('message', (msg: any) => {
            //	    this.logger.log(msg);
            if (msg.props.service_id == "00720724-5143-4a9b-abac-0e50cba674bb" && msg.props.unique_id) {
                if (this._sood_conns[msg.props.unique_id]) return;
                this._sood_conns[msg.props.unique_id] = true;
                this.ws_connect({ host: msg.from.ip, port: msg.props.http_port, onclose: () => { delete (this._sood_conns[msg.props.unique_id]); } });
            }
        });
        this._sood.on('network', () => {
            this._sood.query({ query_service_id: "00720724-5143-4a9b-abac-0e50cba674bb" });
        });
        this._sood.start(() => {
            this._sood.query({ query_service_id: "00720724-5143-4a9b-abac-0e50cba674bb" });
            setInterval(() => this.periodic_scan(), (10 * 1000));
            this.scan_count = -1;
        });
    };

    public periodic_scan() {
        this.scan_count += 1;
        if (this.is_paired) return;
        if ((this.scan_count < 6) || ((this.scan_count % 6) == 0)) {
            this._sood.query({ query_service_id: "00720724-5143-4a9b-abac-0e50cba674bb" });
        }
    };


    /**
     * Save a key value pair in the configuration data store.
     * @param {string} key
     * @param {object} value
     */
    public save_config(k: string, v: any) {
        try {
            let config;
            try {
                let content = fs.readFileSync("config.json", { encoding: 'utf8' });

                console.log("lib:279");
                console.log(content);

                config = JSON.parse(content) || {};
            } catch (e) {
                config = {};
            }
            if (v === undefined || v === null)
                delete (config[k]);
            else
                config[k] = v;
            fs.writeFileSync("config.json", JSON.stringify(config, null, '    '));
        } catch (e) { }
    };

    /**
     * Load a key value pair in the configuration data store.
     * @param {string} key
     * @return {object} value
     */
    public load_config(k: string) {
        try {
            let content = fs.readFileSync("config.json", { encoding: 'utf8' });

            console.log(content);

            return JSON.parse(content)[k];
        } catch (e) {
            return undefined;
        }
    };

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

    public register_service(svcname: string, spec: any) {
        let ret: any = {
            _subtypes: {}
        };

        if (spec.subscriptions) {
            for (let x in spec.subscriptions) {
                let s = spec.subscriptions[x];
                let subname = s.subscribe_name;
                ret._subtypes[subname] = {};

                spec.methods[subname] = (req: any) => {
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
                spec.methods[s.unsubscribe_name] = (req: any) => {
                    // XXX make sure req.body.subscription_key exists or respond send_complete with error
                    delete (ret._subtypes[subname][req.moo.mooid][req.body.subscription_key]);
                    if (s.end) s.end(req);
                    req.send_complete("Unsubscribed");
                };
            }
        }

        // process incoming requests from the other side
        this._service_request_handlers[svcname] = (req: any, mooid: number) => {
            // make sure the req's request name is something we know about
            if (req) {
                let method = spec.methods[req.msg.name];
                if (method) {
                    method(req);
                } else {
                    req.send_complete("InvalidRequest", { error: "unknown request name (" + svcname + ") : " + req.msg.name });
                }
            } else {
                if (spec.subscriptions) {
                    for (let x in spec.subscriptions) {
                        let s = spec.subscriptions[x];
                        let subname = s.subscribe_name;
                        delete (ret._subtypes[subname][mooid]);
                        if (s.end) s.end(req);
                    }
                }
            }
        };

        ret.name = svcname;
        ret.send_continue_all = (subtype: string, name: string, props: any) => {
            for (let id in ret._subtypes[subtype]) {
                for (let x in ret._subtypes[subtype][id]) (ret._subtypes[subtype][id][x].send_continue(name, props));
            }
        };
        ret.send_complete_all = (subtype: string, name: string, props: any) => {
            for (let id in ret._subtypes[subtype]) {
                for (let x in ret._subtypes[subtype][id]) (ret._subtypes[subtype][id][x].send_complete(name, props));
            }
        };
        return ret;
    };


    /**
    * If not using Roon discovery, call this to connect to the Core via a websocket.
    *
    * @this RoonApi
    * @param {object}          options
    * @param {string}          options.host - hostname or ip to connect to
    * @param {number}          options.port - port to connect to
    * @param {RoonApi~onclose} [options.onclose] - Called once when connect to host is lost
    */
    public ws_connect(arg0: { host: string, port: string, onclose: () => void; }) {
        let moo = new Moo(new WSTransport(arg0.host, arg0.port, this.logger));

        moo.transport.onopen = () => {
            //        this.logger.log("OPEN");

            moo.send_request("com.roonlabs.registry:1/info",
                (msg: any, body: any) => {
                    if (!msg) return;
                    let s: any = this.get_persisted_state();
                    const data: IRegistrationInfo = JSON.parse(body);
                    if (s.tokens && s.tokens[data.core_id as string]) this.extension_reginfo.token = s.tokens[data.core_id as string];

                    moo.send_request("com.roonlabs.registry:1/register", this.extension_reginfo,
                        (msg: any, data: any) => {
                            this.ev_registered.call(this, moo, msg, body);
                        });
                });
        };

        moo.transport.onclose = () => {
            //        this.logger.log("CLOSE");
            Object.keys(this._service_request_handlers).forEach(e => this._service_request_handlers[e] && this._service_request_handlers[e](null, moo.mooid));
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

        moo.transport.onmessage = msg => {
            //        this.logger.log("GOTMSG");
            var body = msg.body;
            delete (msg.body);
            var logging = msg && msg.headers && msg.headers["Logging"];
            msg.log = ((this.log_level == "all") || (logging != "quiet"));
            if (msg.verb == "REQUEST") {
                if (msg.log) this.logger.log('<-', msg.verb, msg.request_id, msg.service + "/" + msg.name, body ? JSON.stringify(body) : "");
                var req = new MooMessage(moo, msg, body);
                var handler = this._service_request_handlers[msg.service];
                if (handler)
                    handler(req, req.moo.mooid);
                else
                    req.send_complete("InvalidRequest", { error: "unknown service: " + msg.service });
            } else {
                if (msg.log) this.logger.log('<-', msg.verb, msg.request_id, msg.name, body ? JSON.stringify(body) : "");
                if (!moo.handle_response(msg, body)) {
                    moo.transport.close(); // this will trigger the above onclose handler
                }
            }
        };

        return moo;
    };

    // DO NOT USE -- internal only
    public ws_connect_with_token(arg0: { host: string, port: string, token: string, onclose: () => void }) {
        var moo = this.ws_connect({ host: arg0.host, port: arg0.port, onclose: arg0.onclose })

        moo.transport.onopen = () => {
            let args = Object.assign({}, this.extension_reginfo);
            args.token = arg0.token;
            moo.send_request("com.roonlabs.registry:1/register_one_time_token", args,
                (msg: any, body: any) => {
                    this.ev_registered.call(this, moo, msg, body);
                });
        };

        return moo;
    }

    private ev_registered(moo: Moo, msg: any, body: string) {
        const data: IRegistrationInfo = JSON.parse(body);
        if (!msg) { // lost connection
            if (moo.core) {
                if (this.pairing_service_1) this.pairing_service_1.lost_core(moo.core);
                if (this.extension_opts.core_lost) this.extension_opts.core_lost(moo.core);
                moo.core = undefined;
            }
        } else if (msg.name == "Registered") {
            moo.core = new Core(moo, this, data); //, this.logger);

            let settings = this.get_persisted_state();
            if (!settings.tokens) settings.tokens = {} as any;
            settings.tokens[data.core_id as string] = data.token;
            this.set_persisted_state(settings);

            if (this.pairing_service_1) this.pairing_service_1.found_core(moo.core);
            if (this.extension_opts.core_found) this.extension_opts.core_found(moo.core);
        }
    }
}



