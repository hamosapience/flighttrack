var EventEmitter = require('events').EventEmitter;
var util = require('util');
var request = require('request');
var http = require('http');

var frUrl = "http://bma.fr24.com/zones/europe_all.js";
var pd_callback = function(x){
    return x;
};

var fr = exports;

exports.createClient = function(options) {
  var client = new exports.Client(options);
  return client;
};

exports.Client = function(options){
    this.bounds = options.bounds;
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
    var req = http.get(frUrl, this._handleResponse.bind(this));

    req.on('error', this._emitError.bind(this));
};

exports.Client.prototype._handleResponse = function(res) {
    res.on('data', this._handleResponseData.bind(this));
    res.on('end', this._handleResponseEnd.bind(this));
    res.on('error', this._emitError.bind(this));
};

exports.Client.prototype._handleResponseData = function(chunk) {
    this.body += chunk;
};

exports.Client.prototype._handleResponseEnd = function() {
    // var traffic = planefinder.parseJson(this.body);
    var traffic = [];
    var data = this.body;
    try {
        data = eval(data);
        delete data.full_count;
        delete data.version;

        for (var id in data){
            var plane = data[id];
            // [HEX-CODE, LAT, LON, TRACK, ALTITUDE, SPEED, SQUAWK, RADAR, AIRCRAFT, REGISTRATION, ???, FROM, TO, FLIGHT_N?, ???, ???, ID?, ???]
            var aircraft = {
                hex_ident: plane[0],
                callsign: plane[16],
                lat: plane[1],
                lon: plane[2],
                altitude: plane[4],
                track: plane[3],
                ground_speed: plane[5],
                plane_type: plane[8]
            };
            if (aircraft.lon >= this.bounds[0].longitude &&
                aircraft.lon <= this.bounds[1].longitude &&
                aircraft.lat >= this.bounds[0].latitude &&
                aircraft.lat <= this.bounds[1].latitude) {
                traffic.push(aircraft);
            }

        }

        this.emit('data', traffic);
    }
    catch(e){
        console.log(e);
    }
    
};

exports.Client.prototype._emitError = function(err) {
    this.emit('error', err);
};

