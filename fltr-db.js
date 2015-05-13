var moment = require("moment");
var redis = require("redis");
var pg = require('pg');
var events = require('events');
var util = require('util');

var log = require('./logger');

var TRACKING_INTERVAL = 2000;
var FLIGHTLIST_INTERVAL = 2000;
var CLEANING_INTERVAL = 5000;
var STAT_INTERVAL = 10 *  1000;

var timezone = -(moment().zone()) / 60;
var statCounter = 0;
var notValidCounter = 0;

exports.dataTransport = function(config){
    var conString = "postgres://%pgUser:%pgPassword@localhost/%pgDB"
        .replace("%pgUser", config.pgUser)
        .replace("%pgPassword", config.pgPassword)
        .replace("%pgDB", config.pgDB);
    this.trackTableName = config.trackTableName;
    this.archive = config.archive;
    this.archiveTimeout = config.archiveTimeout;
    this.archiveTableName = config.archiveTableName;
    this.cleanArchive = config.cleanArchive;
    this.pgClient = new pg.Client(conString);
    this.pgClient.connect();
    this.pgClient.query('DELETE FROM ' + this.trackTableName);
    this.redisClient = redis.createClient();
    this.redisClient.select(config.redisDBID);
    this.redisClient.flushdb();
    this.cleanTimeout = config.cleanTimeout;
    this.tracked = {};
};

var statCounter = 0;

setInterval(function(){
    console.log('written: ' + statCounter + ' not valid: ' + notValidCounter);
    statCounter = 0;
    notValidCounter = 0;
}, STAT_INTERVAL);

util.inherits(exports.dataTransport, events.EventEmitter);

var dataTransport = exports.dataTransport;

dataTransport.prototype.getFlightList = function(){
    var that = this;
    this.pgClient.query(
        'SELECT DISTINCT ON ("hex-ident") "flight_no", "hex-ident" FROM %tableName;'.replace("%tableName", this.trackTableName),
        function(err, data){
            if (err){
                return log('datatransport' + ' getFlightList', err);
            }
            that.emit("flightList", data.rows);
        }
    );
};

dataTransport.prototype.getFlightTrack = function(hex_ident){
    var that = this;
    this.pgClient.query(
        'SELECT timestamp, lat, lon, altitude, speed FROM ' + that.trackTableName + ' t ' +
        'WHERE t."hex-ident" = \'' + hex_ident + "' ORDER BY timestamp;",
        function(err, data){
            if (err){
                return log('datatransport' + ' getFlightTrack', err);
            }
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
        'DELETE FROM ' + this.trackTableName + ' ' +
        "WHERE timestamp < '" + thresh + "'"
    );
    if (this.archive && this.archiveTimeout && this.archiveTableName && this.cleanArchive){
        var archiveTreshold = moment().subtract("minutes", this.archiveTimeout).zone(0).toISOString();
        this.pgClient.query(
            ('DELETE FROM ' + this.archiveTableName + ' ' +
            "WHERE timestamp < '" + archiveTreshold + "'"),
            function(err){
                if (err){
                    return log('datatransport' + ' getOld', err);
                }
            }
        );
    }
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

function planeDataIsValid(planeData){
    var fields = ['hex_ident', 'latitude', 'longitude', 'ground_speed', 'altitude', 'flight_no'];

    for (var i = 0; i < fields.length; i++){
        if (!planeData[fields[i]]) {
            return false;
        }
    }
    if ( (planeData.longitude != parseFloat(planeData.longitude)) || (planeData.latitude != parseFloat(planeData.latitude)) ){
        return false;
    }

    return true;
}

dataTransport.prototype.writeDataToPg = function(plane){
    if (!planeDataIsValid(plane)){
    	notValidCounter++;
        return;
    }

    var timestamp = moment().toISOString();
    var planeDataItem = [plane.hex_ident, timestamp, plane.latitude, plane.longitude, plane.ground_speed, plane.altitude, plane.flight_no];

    statCounter++;

    this.pgClient.query(
        'INSERT INTO ' + this.trackTableName + ' ' +
        '("hex-ident", timestamp, lat, lon, speed, altitude, flight_no) ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7)',
        planeDataItem,
        function(err, result) {
            if (err){
                return log('datatransport' + ' writeData', err);
            }
        }
    );
    if (this.archive && this.archiveTableName){
        this.pgClient.query(
            'INSERT INTO ' + this.archiveTableName + ' ' +
            '("hex-ident", timestamp, lat, lon, speed, altitude, flight_no) ' +
            'VALUES ($1, $2, $3, $4, $5, $6, $7)',
            planeDataItem,
            function(err, result) {
                if (err){
                    return log('datatransport' + ' writeDataArchive', err);
                }
            }
        );
    }
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
            if (err){
                return log('datatransport', err);
            }
            if (cachedCoordString !== coordString){
                that.redisClient.set(hex_ident, coordString);
                that.writeDataToPg(plane);
            }
        });
    });

};




