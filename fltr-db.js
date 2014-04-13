var moment = require("moment");
var redis = require("redis");
var pg = require('pg');
var events = require('events');
var util = require('util');

var TRACKING_INTERVAL = 1000;
var FLIGHTLIST_INTERVAL = 1000;
var CLEANING_INTERVAL = 3000;

var timezone = -(moment().zone())/60;


// 


// pgClient.query('SELECT DISTINCT ON ("hex-ident") "hex-ident", "lat", "lon" FROM (SELECT * FROM meteo."flight-track" ORDER BY "timestamp" DESC) ordered;', function(err, data){
//     console.log('initial');
//     data.rows.forEach(function(item){
//         redisClient.set(item["hex-ident"], item.lat + "," + item.lon);
//     });
// });


exports.dataTransport = function(config){
    var conString = "postgres://%pgUser:%pgPassword@localhost/%pgDB"
        .replace("%pgUser", config.pgUser)
        .replace("%pgPassword", config.pgPassword)
        .replace("%pgDB", config.pgDB);
    this.pgClient = new pg.Client(conString);
    this.pgClient.connect();
    this.pgClient.query('DELETE FROM meteo."flight-track"');
    this.redisClient = redis.createClient();
    this.redisClient.select(config.redisDBID);
    this.redisClient.flushdb();
    this.cleanTimeout = config.cleanTimeout;
    this.tracked = {};
};

util.inherits(exports.dataTransport, events.EventEmitter);

var dataTransport = exports.dataTransport;

var cleaner;

dataTransport.prototype.getFlightList = function(){
    var that = this;
    this.pgClient.query(
        'SELECT DISTINCT ON ("hex-ident") "flight_no", "hex-ident" FROM meteo."flight-track";',
        function(err, data){
            that.emit("flightList", data.rows);
        }
    );
};

dataTransport.prototype.getFlightTrack = function(hex_ident){
    var that = this;
    this.pgClient.query(
        'SELECT timestamp, lat, lon, altitude, speed FROM meteo."flight-track" t ' +
        'WHERE t."hex-ident" = \'' + hex_ident + "' ORDER BY timestamp;",
        function(err, data){
            that.emit("flightTrack-" + hex_ident, data.rows.map(function(item){
                var i = item;
                i.longitude = i.lon;
                i.latitude = i.lat;
                i.timestamp = moment(item.timestamp).zone(0).add("hours", timezone); //добавляем часы чтобы нивелировать инциативу pg по приведении строки к локальной дате
                return i;
            }));
        });
};

dataTransport.prototype.cleanOld = function(){
    var thresh = moment().subtract("minutes", this.cleanTimeout).zone(0).toISOString();
    this.pgClient.query(
        'DELETE FROM meteo."flight-track" '+
        "WHERE timestamp < '" + thresh + "'"
    );
};

dataTransport.prototype.startCleaning = function(){
    var that = this;
    setInterval(function(){
        that.cleanOld();
    }, CLEANING_INTERVAL);
};

dataTransport.prototype.startFlightTracking = function(hex_ident){
    if (hex_ident in this.tracked){
        return;
    }
    var binded = this.getFlightTrack.bind(this);
    var t = setInterval(function(){
        binded(hex_ident);
    }, TRACKING_INTERVAL);
    this.tracked[hex_ident] = t;

};

dataTransport.prototype.stopFlightTracking = function(hex_ident){
    clearInterval(this.tracked[hex_ident]);
    delete this.tracked[hex_ident];
};


dataTransport.prototype.start = function(){
    setInterval(this.getFlightList.bind(this), FLIGHTLIST_INTERVAL);
};

dataTransport.prototype.writeDataToPg = function(plane){
    var timestamp = moment().toISOString();
    if (!plane["hex_ident"]) {
        return;
    }
    this.pgClient.query(
        'INSERT INTO meteo."flight-track" ' +
        '("hex-ident", timestamp, lat, lon, speed, altitude, flight_no) ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [plane.hex_ident, timestamp, plane.latitude, plane.longitude, plane.ground_speed, plane.altitude, plane.flight_no],
        function(err, result) {
            if (err){
                return console.error('error running query', err);
            }
        }

    );
};

dataTransport.prototype.writeData = function (data) {
    if (!data){
        return;
    }
    var that = this;
    data.forEach(function(plane){
        var coordString = plane.latitude + "," + plane.longitude;
        var hex_ident = plane.hex_ident;
        that.redisClient.get(hex_ident, function(err, cachedCoordString){
            if (cachedCoordString !== coordString){
                that.redisClient.set(hex_ident, coordString);
                that.writeDataToPg(plane);
            }
        });
    });

};




