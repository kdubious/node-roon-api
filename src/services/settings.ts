import { RoonApi } from "../lib";

export class RoonApiSettings {
    private services: any[] = [];
    private _svc: any;

    constructor(roon: RoonApi, opts: any) {
        this._svc = roon.register_service("com.roonlabs.settings:1", {
            subscriptions: [
                {
                    subscribe_name: "subscribe_settings",
                    unsubscribe_name: "unsubscribe_settings",
                    start: (req: any) => {
                        opts.get_settings((s: any) => {
                            req.send_continue("Subscribed", { settings: s })
                        });
                    }
                },
            ],
            methods: {
                get_settings: function (req: any) {
                    opts.get_settings((s: any) => {
                        req.send_complete("Success", { settings: s });
                    });
                },
                save_settings: function (req: any) {
                    opts.save_settings(req, req.body.is_dry_run, req.body.settings);
                },
                button_pressed: function (req: any) {
                    opts.button_pressed(req, req.body.buttonid, req.body.settings);
                },
            }
        });
    }

    update_settings(settings: any) {
        this._svc.send_continue_all('subscribe_settings', "Changed", { settings: settings });
    };




}

