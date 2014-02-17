var http = Npm.require('http');
var hostname = Npm.require('os').hostname();
var logger = Npm.require('debug')('apm:apm');
var Fibers = Npm.require('fibers');

Apm = {};
Apm.models = {};

Apm.connect = function(appId, appSecret, options) {
  options = options || {};
  options.payloadTimeout = options.payloadTimeout || 1000 * 10;
  options.endpoint = options.endpoint || "https://engine.meteorapm.com";
  options.thresholds = options.thresholds || {};

  Apm.syncedDate = new Ntp("http://ntp.meteorapm.com");
  Apm.syncedDate.sync();
  Apm.models.methods = new MethodsModel(options.thresholds.methods);

  //set sendMaxMinInterval accordingly (need to send one per minute)
  Apm.models.methods.sendMaxMinInterval = Math.ceil((1000 * 60) / options.payloadTimeout);

  if(appId && appSecret) {
    schedulePayloadSend();
    logger('connected to app: ', appId);
  } else {
    throw new Error('APM: AppId and AppSecret required!');
  }

  var retries = 0;
  Apm.connected = true;

  function sendPayload() {
    var payload = buildPayload();
    var headers = {'APM-APP-ID': appId, 'APM-APP-SECRET': appSecret};
    var httpOptions = {headers: headers, data: payload};

    callHTTP();

    function callHTTP() {
      try {
        var response = HTTP.call('POST', options.endpoint, httpOptions);
        processResponse(response);
      } catch(err) {
        tryAgain(err);
      }
    }

    function processResponse(response) {
      if(response.statusCode == '401') {
        throw new Error('APM: AppId, AppSecret combination is invalid');
      } else if(response.statusCode == '200') {
        //success send again in 10 secs
        schedulePayloadSend();
      } else {
        tryAgain();
      }
    }

    function tryAgain(err) {
      if(++retries < 5) {
        Meteor.setTimeout(callHTTP, 1000 * retries);
      } else {
        console.error('APM: Error sending payload(dropped after 5 tries) ', err.message);
        retries = 0;
        schedulePayloadSend();
      }
    }

  }
  
  function schedulePayloadSend() {
    Meteor.setTimeout(sendPayload, options.payloadTimeout); 
  }
};

//this return the __apmInfo from the current Fiber. 
//WARNNING: this is not cloning the object, so it's writable; USE WITH CARE
Apm._getInfo = function() {
  if(Fibers.current) {
    return Fibers.current.__apmInfo;
  }
};

//this does not clone the info object. So, use with care
Apm._setInfo = function(info) {
  Fibers.current.__apmInfo = info;
};

function buildPayload() {
  var payload = {host: hostname};
  _.extend(payload, Apm.models.methods.buildPayload());

  return payload;
}