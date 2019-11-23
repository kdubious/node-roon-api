import { RoonApi } from "./src/lib";
import * as RoonApiImage from "./src/services/images";

var core;

const roon = new RoonApi({
    extension_id: 'com.musicapristina.artwork',
    display_name: "Musica Pristina album art viewer",
    display_version: "1.0.0",
    publisher: 'Musica Pristina',
    email: 'alwayslistening@musicapristina.com',
    website: 'https://musicapristina.com',
    services: {
        required_services: [],
        provided_services: [],
        optional_services: [],
    },
    core_paired: function (core_) {
        //v.current_zone_id = roon.load_config("current_zone_id");
        core = core_;
        // core.services.RoonApiTransport.subscribe_zones((response, msg) => {
        //     if (response == "Subscribed") {
        //         let zones = msg.zones.reduce((p, e) => (p[e.zone_id] = e) && p, {});
        //         v.$set('zones', zones);
        //     } else if (response == "Changed") {
        //         var z;
        //         if (msg.zones_removed) msg.zones_removed.forEach(e => delete (v.zones[e.zone_id]));
        //         if (msg.zones_added) msg.zones_added.forEach(e => v.zones[e.zone_id] = e);
        //         if (msg.zones_changed) msg.zones_changed.forEach(e => v.zones[e.zone_id] = e);
        //         v.$set('zones', v.zones);
        //     }
        // });
        // v.status = 'connected';
        // v.listoffset = 0;
        // refresh_browse();
    },

    core_unpaired: function (core_) {
        core = undefined;
        //v.status = 'disconnected';
    }
})





roon.init_services({
    required_services: [RoonApiImage],
    provided_services: [],
    optional_services: [],
});

roon.start_discovery();