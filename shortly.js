var express = require('express');
var session = require('express-session');
var path = require('path');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var url = require('url');
var knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: path.join(__dirname, 'db/shortly.sqlite')
  },
  useNullAsDefault: true
});


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

var sessionOptions = {secret:"secret"};

app.use(session(sessionOptions));




app.get('/', 
function(req, res) {
  if (req.session.username) {
    res.render('index');
  } else {
    res.redirect('/login');
  }
  res.end();
});

app.get('/create', 
function(req, res) {
  // res.render('index');
  res.redirect('/login');
  res.status(403);
  res.end();
});

app.get('/login', 
function(req, res) {
  if (req.session.username) {
    res.render('index');
  } else {
    res.render('login');
  }
  res.end();
});

app.get('/signup', 
function(req, res) {
  res.render('signup');
});

app.get('/links', 
function(req, res) {
  if (req.session.username) {
    Links.reset().fetch().then(function(links) {
      res.status(200).send(links.models);
    });
  } else {
    res.redirect('/login');
  }
  res.end();
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;
  console.log(util.isValidUrl(uri));
  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.post('/login', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  knex('users').where({username: username, password: password}).select('id')
  .then(function(d) {
    if (d.length >= 1) {
      req.session.username = username;
      res.redirect('/');
    } else {
      res.redirect('/login');
    } 
    res.end();
  });
});

app.get('/logout', function(req, res) {
  req.session.destroy(function(err) {
    res.redirect('/');
    res.end();
  });
});


app.post('/signup', function(req, res) {
  if (req.session.username) {
    res.redirect('/');
    res.end();
    return;
  }
  var username = req.body.username;
  var password = req.body.password;
  knex('users').where({username: username}).select('id').then(function(a) {
    if (a.length >= 1) {
      res.redirect('/login');
      res.sendStatus(200).end();
    } else {
      Users.create({
        username: username,
        password: password
      })
      .then(function(newLink) {
        req.session.username = username;
        res.status(201);
        res.redirect('/');
        res.end();
      });
    }
  });
});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
