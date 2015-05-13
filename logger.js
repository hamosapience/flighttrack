function log(errorType, errorData){
    var errorDataString;
    try {
        errorDataString = (errorData).toString();
    }
    catch (e){
        errorDataString = errorData && errorData.toString();
    }
    console.log('ERROR[' + errorType + '] ' + errorDataString);
}

module.exports = log;
