var express = require('express');
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


app.get('/', 
function(req, res) {
  // check if user is signed in
    res.render('index');
  // else
    // res.redirect('/login');
    // res.status(403);
    // res.end();
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
  res.render('login');
});

app.get('/signup', 
function(req, res) {
  res.render('signup');
});

app.get('/links', 
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.status(200).send(links.models);
  });
    // res.redirect('/login');
    // res.status(403);
    // res.end();
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
  console.log('hello');
  res.end();
});

app.post('/signup', function(req, res) {
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
        console.log(newLink);
        res.status(201).send(newLink);
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
