var EventEmitter = require('events').EventEmitter;
var util = require('util');
var request = require('got');

var log = require('./logger');
var iataDecoder = require('./decode_airport');

var frUrl = "http://bma.data.fr24.com/zones/fcgi/feed.js";
/*
http://bma.data.fr24.com/zones/fcgi/feed.js
    ?bounds=67.22338348289102,50.32813819638923,22.510634765624673,127.880859375
    &faa=1&mlat=1&flarm=1&adsb=1&gnd=1&air=1&vehicles=1&estimated=1&maxage=900&gliders=1&stats=1&
*/

exports.createClient = function(options) {
    var client = new exports.Client(options);
    return client;
};

exports.Client = function(options) {
    this.bounds = options.bounds;
    this.filter = options.filter || function() {
        return true;
    };
    if (!this.bounds) {
        throw new Error('Must specify bounds in options.');
    }
    this.interval = options.interval || 20000;
};

util.inherits(exports.Client, EventEmitter);

exports.Client.prototype.resume = function() {
    this.startRequest();
    setInterval(this.startRequest.bind(this), this.interval);
};

exports.Client.prototype.startRequest = function() {
    this.body = '';
    var that = this;
    var bounds = this.bounds;

    var boundString = [bounds[0].latitude, bounds[1].latitude, bounds[0].longitude, bounds[1].longitude].join(',');

    request({
        url: frUrl,
        query: {
            bounds: boundString,
            faa: 1,
            mlat: 1,
            flarm: 1,
            adsb: 1,
            gnd: 1,
            air: 1,
            vehicles: 1,
            stimated: 1,
            maxage: 900,
            gliders: 1,
            stats: 1
        }
    }, function(error, response, body) {
        if (error) {
            that._emitError(error);
        }
        if (!error && response.statusCode == 200) {
            that._handleResponseEnd(body);
        }

    });
};

exports.Client.prototype._handleResponse = function(res) {
    res.on('data', this._handleResponseData.bind(this));
    res.on('end', this._handleResponseEnd.bind(this));
    res.on('error', this._emitError.bind(this));
};

exports.Client.prototype._handleResponseData = function(chunk) {
    this.body += chunk;
};

exports.Client.prototype._handleResponseEnd = function(body) {
    // var traffic = planefinder.parseJson(this.body);
    var traffic = [];
    var data = body || this.body;
    try {
        data = JSON.parse(data);
    } catch (e) {
        this._emitError(e);
        return;
    }
    if (!data || data === null) {
        this._emitError('fr data err');
        return;
    }

    delete data.full_count;
    delete data.stats;
    delete data.version;

    for (var id in data) {
        var plane = data[id];
        // [HEX-CODE, LAT, LON, TRACK, ALTITUDE, SPEED, SQUAWK, RADAR, AIRCRAFT, REGISTRATION, ???, FROM, TO, FLIGHT_N?, ???, ???, ID?, ???]
        var fromIcaoCode = iataDecoder(plane[11]);
        var toIcaoCode = iataDecoder(plane[12]);

        var aircraft = {
            hex_ident: plane[0],
            callsign: plane[16],
            latitude: plane[1],
            longitude: plane[2],
            altitude: plane[4],
            track: plane[3],
            ground_speed: plane[5],
            plane_type: plane[8],
            flight_no: plane[13],
            from: fromIcaoCode,
            to: toIcaoCode
        };
        if (this.filter(aircraft)){
            traffic.push(aircraft);
        }
    }
    this.emit('data', traffic);

};

exports.Client.prototype._emitError = function(err) {
    log('fr-client', err);
};
