"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Core = /** @class */ (function () {
    function Core(moo, roon, registration) {
        this.services = [];
        this.svcs = [];
        this.moo = moo;
        this.roon = roon;
        this.registration = registration;
        this.core_id = registration.core_id;
        this.display_name = registration.display_name;
        this.display_version = registration.display_version;
    }
    Core.prototype.init = function () {
        var _this = this;
        if (this.roon.services_opts.required_services) {
            this.roon.services_opts.required_services.forEach(function (svcobj) { return svcobj.services.forEach(function (svc) { return _this.svcs[svc.name] = svcobj; }); });
        }
        if (this.registration.services.provided_services) {
            this.registration.services.provided_services.forEach(function (e) { _this.services[_this.svcs[e].name] = new _this.svcs[e](_this); });
        }
    };
    return Core;
}());
exports.Core = Core;
