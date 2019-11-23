import { IRegistrationInfo, RoonApi } from "./lib";
import { Moo } from "./moo";

export class Core {

    private moo: Moo;
    public core_id: string;
    private display_name: string;
    private display_version: string;
    private registration: IRegistrationInfo;
    private services: any[] = [];
    private roon: RoonApi;
    private svcs: any[] = [];

    constructor(moo: Moo, roon: RoonApi, registration: IRegistrationInfo) {
        this.moo = moo;
        this.roon = roon;
        this.registration = registration;
        this.core_id = registration.core_id ? registration.core_id : "";
        this.display_name = registration.display_name;
        this.display_version = registration.display_version;
    }

    public init() {
        if (this.roon.services_opts.required_services) {
            this.roon.services_opts.required_services.forEach((svcobj: { services: any[] }) => svcobj.services.forEach(svc => this.svcs[svc.name] = svcobj));
        }
        if (this.registration.services.provided_services) {
            this.registration.services.provided_services.forEach(e => { this.services[this.svcs[e].name] = new this.svcs[e](this); });
        }

    }

}
