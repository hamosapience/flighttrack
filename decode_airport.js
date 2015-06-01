var fs = require('fs');

// https://github.com/mwgg/Airports
var rawDB = JSON.parse(fs.readFileSync('./airports.json', 'utf8'));

var icaoCodes = Object.keys(rawDB);

var iataDB = {};

icaoCodes.forEach(function(icaoCode) {
    var obj = rawDB[icaoCode];

    if (obj.iata) {
        iataDB[obj.iata] = obj.icao;
    }

});

function decode(iataCode) {
    return iataDB[iataCode];
}

module.exports = decode;
