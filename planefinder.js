var fs = require("fs");
var fr = require("./fr-client.js");
var ftdb = require("./fltr-db.js");

var configFile = "./config.prod.json";
var config = JSON.parse(fs.readFileSync(configFile));

var defaultCoordList = [
    {
        "latitude": "41.17",
        "longitude": "12.11"
    }, {
        "latitude": "76.15",
        "longitude": "7.01"
    }, {
        "latitude": "59.58",
        "longitude": "33.63"
    }, {
        "latitude": "54",
        "longitude": "33"
    }
];

var coordList = config.sector || defaultCoordList;

var frBounds = [
    coordList[1], coordList[3]
];

var frClient = fr.createClient({
    bounds: frBounds,
    interval: 2000
});

var dt = new ftdb.dataTransport(config);

frClient.on('data', function(data) {
    dt.writeData(data);
});

dt.start();
dt.startCleaning();

frClient.resume();

