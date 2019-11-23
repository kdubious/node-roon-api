"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var RoonApiSettings = /** @class */ (function () {
    function RoonApiSettings(roon, opts) {
        this.services = [];
        this._svc = roon.register_service("com.roonlabs.settings:1", {
            subscriptions: [
                {
                    subscribe_name: "subscribe_settings",
                    unsubscribe_name: "unsubscribe_settings",
                    start: function (req) {
                        opts.get_settings(function (s) {
                            req.send_continue("Subscribed", { settings: s });
                        });
                    }
                },
            ],
            methods: {
                get_settings: function (req) {
                    opts.get_settings(function (s) {
                        req.send_complete("Success", { settings: s });
                    });
                },
                save_settings: function (req) {
                    opts.save_settings(req, req.body.is_dry_run, req.body.settings);
                },
                button_pressed: function (req) {
                    opts.button_pressed(req, req.body.buttonid, req.body.settings);
                },
            }
        });
    }
    RoonApiSettings.prototype.update_settings = function (settings) {
        this._svc.send_continue_all('subscribe_settings', "Changed", { settings: settings });
    };
    ;
    return RoonApiSettings;
}());
exports.RoonApiSettings = RoonApiSettings;
