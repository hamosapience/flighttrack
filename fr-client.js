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
    this.filter = options.filter || function(){ return true;};
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
    request(frUrl, function (error, response, body) {
        if (!error && response.statusCode == 200) {
	     that._handleResponseEnd(body);
        }
	if (error){
	    console.log(error);
	}
    })
    //var req = http.get(frUrl, this._handleResponse.bind(this));

//    req.on('error', this._emitError.bind(this));
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
        data = eval(data);
    }
    catch(e){
        return;
    }
    if (!data || data === null){
        console.log('fr data err');
        return;
    }
        
    delete data.full_count;
    delete data.version;

    for (var id in data){
        var plane = data[id];
        // [HEX-CODE, LAT, LON, TRACK, ALTITUDE, SPEED, SQUAWK, RADAR, AIRCRAFT, REGISTRATION, ???, FROM, TO, FLIGHT_N?, ???, ???, ID?, ???]
        var aircraft = {
            hex_ident: plane[0],
            callsign: plane[16],
            latitude: plane[1],
            longitude: plane[2],
            altitude: plane[4],
            track: plane[3],
            ground_speed: plane[5],
            plane_type: plane[8],
            flight_no: plane[13]
        };
        if ( (aircraft.longitude >= this.bounds[0].longitude &&
            aircraft.longitude <= this.bounds[1].longitude &&
            aircraft.latitude >= this.bounds[0].latitude &&
            aircraft.latitude <= this.bounds[1].latitude
            ) && this.filter(aircraft) ) {
            traffic.push(aircraft);
        }

    }
    this.emit('data', traffic);
    
};

exports.Client.prototype._emitError = function(err) {
    this.emit('error', err);
};

