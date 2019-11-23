"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var util = require("util"), events = require('events'), dgram = require('dgram'), IP = require('ip'), uuid = require('node-uuid'), os = require('os');
var Sood = /** @class */ (function (_super) {
    __extends(Sood, _super);
    function Sood(logger) {
        var _this = _super.call(this) || this;
        _this.SOOD_PORT = 9003;
        _this.SOOD_MULTICAST_IP = "239.255.90.90";
        _this._multicast = {};
        _this._unicast = {};
        _this._iface_seq = 0;
        _this.logger = logger;
        return _this;
        //    this.on("message", (msg) => { this.logger.log(JSON.stringify(msg)); });
    }
    ;
    Sood.prototype._parse = function (buf, minfo) {
        var msg = {
            from: {
                ip: minfo.address,
                port: minfo.port,
            },
            type: "",
            props: {},
        };
        try {
            if (buf.toString('utf8', 0, 4) != 'SOOD')
                return null;
            if (buf[4] != 2)
                return null;
            msg.type = buf.toString('utf8', 5, 6);
            var pos = 6;
            while (pos < buf.length) {
                var len = buf[pos++];
                if (len == 0)
                    return null;
                if (pos + len > buf.length)
                    return null;
                var name_1 = buf.toString('utf8', pos, pos + len);
                pos += len;
                len = buf[pos++] << 8;
                len |= buf[pos++];
                var val = void 0;
                if (len == 65535)
                    val = null;
                else if (len == 0)
                    val = "";
                else {
                    if (pos + len > buf.length)
                        return null;
                    val = buf.toString('utf8', pos, pos + len);
                    pos += len;
                }
                msg.props[name_1] = val;
            }
            return msg;
        }
        catch (e) {
            return null;
        }
    };
    Sood.prototype.query = function (msg) {
        if (!msg['_tid']) {
            msg['_tid'] = uuid.v4();
        }
        var buf = new Buffer(65535);
        buf.write("SOOD");
        buf[4] = 2;
        buf.write("Q", 5);
        var pos = 6;
        for (var n in msg) {
            var namelen = buf.write(n, pos + 1);
            buf[pos++] = namelen;
            pos += namelen;
            if (msg === undefined || msg === null) {
                buf[pos++] = 0xff;
                buf[pos++] = 0xff;
            }
            else {
                namelen = buf.write(msg[n], pos + 2);
                buf[pos++] = namelen >> 8;
                buf[pos++] = namelen & 0xff;
                pos += namelen;
            }
        }
        for (var ip in this._multicast) {
            if (this._multicast[ip].send_sock) {
                //	    this.logger.log('sending on mcast ' + ip);
                this._multicast[ip].send_sock.send(buf, 0, pos, this.SOOD_PORT, this.SOOD_MULTICAST_IP);
                //	    this.logger.log('sending on mcast ' + ip + ", bcast " + this._multicast[ip].broadcast);
                this._multicast[ip].send_sock.send(buf, 0, pos, this.SOOD_PORT, this._multicast[ip].broadcast);
            }
        }
        if (this._unicast.send_sock) {
            //	this.logger.log('sending on unicast');
            this._unicast.send_sock.send(buf, 0, pos, this.SOOD_PORT, this.SOOD_MULTICAST_IP);
        }
    };
    ;
    Sood.prototype.initsocket = function (cb) {
        var _this = this;
        this._iface_seq += 1;
        var list = os.networkInterfaces();
        var iface_change = false;
        for (var iface in list) {
            list[iface].forEach(function (e) {
                if (e.family == 'IPv4')
                    iface_change = _this._listen_iface(e.address, e.netmask, iface) || iface_change;
            });
        }
        for (var ip in this._multicast) {
            if (this._multicast[ip].seq != this._iface_seq) {
                delete this._multicast[ip];
                iface_change = true;
            }
        }
        var unicast = this._unicast;
        if (!unicast.send_sock) {
            //	    this.logger.log(`SOOD: new sock: unicast`);
            unicast.send_sock = dgram.createSocket({ type: 'udp4' });
            unicast.send_sock.on('error', function (err) {
                //		this.logger.log(`server error ${ip}`, err);
                unicast.send_sock.close();
            });
            unicast.send_sock.on('close', function () {
                //		this.logger.log(`closed unicast on ${ip}`);
                delete (unicast.send_sock);
            });
            unicast.send_sock.on('message', function (msg, rinfo) {
                msg = _this._parse(msg, rinfo);
                if (msg)
                    _this.emit("message", msg);
            });
            unicast.send_sock.bind({ port: 0 }, function () {
                unicast.send_sock.setBroadcast(true);
                unicast.send_sock.setMulticastTTL(1);
            });
        }
        if (cb)
            setTimeout(cb, 200);
        if (iface_change)
            this.emit('network');
    };
    ;
    Sood.prototype.start = function (cb) {
        var _this = this;
        if (!this.interface_timer)
            this.interface_timer = setInterval(function () { return _this.initsocket(cb); }, 5000);
        this.initsocket(cb);
    };
    ;
    Sood.prototype.stop = function () {
        if (this.interface_timer)
            clearInterval(this.interface_timer);
        delete (this.interface_timer);
        for (var ip in this._multicast) {
            try {
                this._multicast[ip].recv_sock.close();
            }
            catch (e) { }
            try {
                this._multicast[ip].send_sock.close();
            }
            catch (e) { }
        }
        try {
            this._unicast.send_sock.close();
        }
        catch (e) { }
    };
    Sood.prototype._listen_iface = function (ip, netmask, ifacename) {
        var _this = this;
        if (!ip)
            return false;
        var iface = this._multicast[ip] = this._multicast[ip] || {};
        iface.seq = this._iface_seq;
        var new_iface = false;
        if (!iface.recv_sock) {
            //	this.logger.log(`SOOD: new sock: recv ${ip}/${ifacename}`);
            new_iface = true;
            iface.recv_sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
            iface.recv_sock.on('error', function (err) {
                //	    this.logger.log(`server error ${ip}`, err);
                iface.recv_sock.close();
            });
            iface.recv_sock.on('close', function () {
                //	    this.logger.log(`closed multicast on ${ip}`);
                delete (iface.recv_sock);
            });
            iface.recv_sock.on('message', function (msg, rinfo) {
                msg = _this._parse(msg, rinfo);
                if (msg)
                    _this.emit("message", msg);
            });
            iface.recv_sock.bind({ port: this.SOOD_PORT }, function () {
                iface.recv_sock.addMembership(_this.SOOD_MULTICAST_IP, ip);
            });
        }
        if (!iface.send_sock) {
            //        this.logger.log(`SOOD: new sock: send ${ip}/${ifacename}`);
            new_iface = true;
            iface.send_sock = dgram.createSocket({ type: 'udp4' });
            iface.broadcast = IP.subnet(ip, netmask).broadcastAddress;
            iface.send_sock.on('error', function (err) {
                //	    this.logger.log(`server error ${ip}`, err);
                iface.send_sock.close();
            });
            iface.send_sock.on('close', function () {
                //	    this.logger.log(`closed multicast on ${ip}`);
                delete (iface.send_sock);
            });
            iface.send_sock.on('message', function (msg, rinfo) {
                msg = _this._parse(msg, rinfo);
                if (msg)
                    _this.emit("message", msg);
            });
            iface.send_sock.bind({ port: 0, address: ip }, function () {
                iface.send_sock.setBroadcast(true);
                iface.send_sock.setMulticastTTL(1);
            });
        }
        return new_iface;
    };
    ;
    return Sood;
}(events.EventEmitter));
exports.Sood = Sood;
