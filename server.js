var express = require('express');
var app = express();
var lru = require('lru-cache');
var engine = require('express-dot-engine');
var request = require('request');
var measureTextWidth = require('./measure-text');

var cache = lru({ max: 2000, maxAge: 30 * 60 * 1000 });

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

app.engine('dot', engine.__express);
app.set('views', __dirname + '/views');
app.set('view engine', 'dot');

app.get('/', function(req, res) {
  res.render('index');
});

app.get('/hackaday/:prop(skulls|followers)/:id(\\d+).svg', function(req, res) {
  var date = (new Date()).toGMTString();
  res.setHeader('Expires', date);
  res.setHeader('Date', date);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Content-Type', 'image/svg+xml;charset=utf-8');

  var cacheKey = req.params.id + ':' + req.params.prop;
  if((cached = cache.get(cacheKey))) {
    console.log('Hit ' + cacheKey);
    res.render('template', cached);
  } else {
    console.log('Miss ' + cacheKey);
    var url = 'https://api.hackaday.io/v1/projects/' + req.params.id + '?api_key=' + process.env.HACKADAY_IO_API_KEY;
    request.get({ url: url, json: true }, function (err, r, project) {
      var data = {};
      if(err || !project || project.project === 0 || !(req.params.prop in project)) {
        data.logo = false;
        data.texts = ['hackaday.io', 'unknown'];
      } else {
        data.logo = (req.params.prop == 'skulls');
        data.texts = ['hackaday.io', '' + project[req.params.prop]];
      }
      data.widths = [measureTextWidth(data.texts[0]) + 10, measureTextWidth(data.texts[1]) + 10];
      data.width = data.widths[0] + data.widths[1] + (data.logo ? 20 : 0);

      cache.set(cacheKey, data);
      res.render('template', data);
    });
  }
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
