var EventEmitter = require('events').EventEmitter;
var util = require('util');
var request = require('request');

var frUrl = "http://bma.fr24.com/zones/europe_all.js";
var pd_callback = function(x){
    return x;
};

var fr = exports;

exports.createClient = function(options) {
  var client = new fr.Client(options);
  return client;
};

exports.Client = function(options){
    this.bounds = options.bounds;
    if (!this.bounds) {
        throw new Error('Must specify bounds in options.');
    }
    this.interval = options.interval || 20000;
};

util.inherits(Client, EventEmitter);

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
    this.emit(this.body);
    // this.emit('data', traffic);
};

exports.Client.prototype._emitError = function(err) {
    this.emit('error', err);
};


exports.parseJson = function(reportsJson) {
    var planes = JSON.parse(reportsJson).planes;
    var traffic = [];
    for (var i = 0; i < planes.length; i++) {
        var planeMap = planes[i];
        for (var hex_ident in planeMap) {
            var plane = planeMap[hex_ident];
            var aircraft = {
                hex_ident: hex_ident,
                callsign: plane[2],
                lat: plane[3],
                lon: plane[4],
                altitude: plane[5],
                track: plane[6],
                ground_speed: plane[7],
                plane_type: plane[0]
              };
              traffic.push(aircraft);
        }
    }
    return traffic;
};



// [HEX-CODE, LAT, LON, TRACK, ALTITUDE, SPEED, SQUAWK, RADAR, AIRCRAFT, REGISTRATION, ???, FROM, TO, FLIGHT_N?, ???, ???, ID?, ???]
setInterval(function(){
    data = request("http://bma.fr24.com/zones/europe_all.js", function(error, response, body){
        data = eval(body);
        
    });
}, 2000);